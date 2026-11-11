import { db } from "@/lib/db/client";
import { ledgerAccounts, ledgerEntries, hosts, stormPledges } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { calculateAllocatable } from "./allocatable";
export { calculateAllocatable };

export type AccountName =
  | "paypal_available"
  | "reserve_protected"
  | "allocatable"
  | `committed:${string}`
  | "fees_reserved"
  | "paid_out"
  | "returned"
  | "payout_unclaimed"
  | "payout_fees"
  | "pledges_contingent"
  | "pledges_captured";

export interface LedgerEntryItem {
  accountName: AccountName;
  entryType: "DEBIT" | "CREDIT";
  amountCents: number; // Stored in cents (integer) for absolute numeric precision
  currency?: string;
}

export interface RecordTransactionParams {
  hostId: string;
  transactionId: string;
  description: string;
  entries: LedgerEntryItem[];
  correlationId?: string;
}

export interface TreasuryWaterfall {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  allocatableCents: number;
  contingentPledgesCents: number;
  paidOutCents: number;
  returnedCents: number;
}

/**
 * Validates that total debits equal total credits.
 * Double-entry accounting golden rule.
 */
export function validateBalancedTransaction(entries: LedgerEntryItem[]): {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
} {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    if (entry.amountCents < 0) {
      throw new Error(`Negative amounts are illegal in ledger entries: ${entry.accountName} has ${entry.amountCents}`);
    }
    if (entry.entryType === "DEBIT") {
      totalDebits += entry.amountCents;
    } else if (entry.entryType === "CREDIT") {
      totalCredits += entry.amountCents;
    }
  }

  return {
    balanced: totalDebits === totalCredits,
    totalDebits,
    totalCredits,
    difference: Math.abs(totalDebits - totalCredits),
  };
}

/**
 * Computes the exact allocatable amount via deterministic formula:
 * Allocatable = PayPal Available - Protected Floor (except Tranche 1) - Fees Reserved - Committed.
 */


/**
 * Persists a balanced ledger transaction.
 */
type LedgerExecutor = any; // a drizzle transaction handle, so callers can post inside their own transaction

export async function recordLedgerTransaction(params: RecordTransactionParams, executor?: LedgerExecutor): Promise<void> {
  const validation = validateBalancedTransaction(params.entries);
  if (!validation.balanced) {
    throw new Error(
      `Unbalanced ledger transaction ${params.transactionId}: Debits (${validation.totalDebits}¢) != Credits (${validation.totalCredits}¢)`
    );
  }

  // Execute inside a database transaction to ensure atomicity (or inside the caller's, when given)
  const run: (fn: (tx: LedgerExecutor) => Promise<void>) => Promise<void> = executor ? (fn) => fn(executor) : (fn) => db.transaction(fn);
  await run(async (tx) => {
    for (const entry of params.entries) {
      // Find or create account
      let [account] = await tx
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.name, entry.accountName))
        .limit(1);

      if (!account) {
        // onConflictDoNothing: two concurrent first postings to a new account must not collide on the primary key.
        await tx
          .insert(ledgerAccounts)
          .values({
            id: entry.accountName,
            name: entry.accountName,
            accountType: entry.accountName.startsWith("committed:") ? "LIABILITY" : "ASSET",
          })
          .onConflictDoNothing();
        [account] = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.name, entry.accountName)).limit(1);
      }

      await tx.insert(ledgerEntries).values({
        transactionId: params.transactionId,
        accountId: account.id,
        direction: entry.entryType,
        amount: (entry.amountCents / 100).toFixed(2),
        description: params.description,
        correlationId: params.correlationId || params.transactionId,
      });
    }
  });
}

/**
 * Checks whether a transaction ID has already been recorded in the ledger.
 */
export async function isTransactionRecorded(transactionId: string, executor?: LedgerExecutor): Promise<boolean> {
  const existing = await (executor ?? db)
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.transactionId, transactionId))
    .limit(1);
  return existing.length > 0;
}

const DEBIT_POSITIVE_ACCOUNTS = new Set<string>(["paypal_available", "paid_out", "payout_unclaimed", "payout_fees"]);

/**
 * Calculates current ledger balance for a given account in cents.
 */
export async function getAccountBalance(accountName: AccountName): Promise<number> {
  const entries = await db
    .select({
      direction: ledgerEntries.direction,
      amount: ledgerEntries.amount,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountName));

  let totalCents = 0;
  // Debit-positive accounts. paid_out / payout_unclaimed / payout_fees were never posted before the
  // payout lifecycle was wired to the ledger, so declaring them debit-positive changes no existing balance.
  const isAsset = DEBIT_POSITIVE_ACCOUNTS.has(accountName);

  for (const entry of entries) {
    const cents = Math.round(parseFloat(entry.amount) * 100);
    if (isAsset) {
      totalCents += entry.direction === "DEBIT" ? cents : -cents;
    } else {
      totalCents += entry.direction === "CREDIT" ? cents : -cents;
    }
  }

  return totalCents;
}

/**
 * Computes the full live Treasury Waterfall snapshot from internal ledger state and contingent pledges.
 */
export async function getTreasuryWaterfall(): Promise<TreasuryWaterfall> {
  const paypalAvailableCents = await getAccountBalance("paypal_available");
  const reserveProtectedCents = await getAccountBalance("reserve_protected");
  const feesReservedCents = await getAccountBalance("fees_reserved");

  // Committed: sum of all committed:* accounts
  const committedEntries = await db
    .select({
      direction: ledgerEntries.direction,
      amount: ledgerEntries.amount,
      accountId: ledgerEntries.accountId,
    })
    .from(ledgerEntries);

  let committedCents = 0;
  for (const entry of committedEntries) {
    if (entry.accountId.startsWith("committed:")) {
      const cents = Math.round(parseFloat(entry.amount) * 100);
      committedCents += entry.direction === "CREDIT" ? cents : -cents;
    }
  }

  // Contingent pledges from active storm pledges
  const activePledges = await db
    .select({ amountPerEvent: stormPledges.amountPerEvent })
    .from(stormPledges)
    .where(eq(stormPledges.status, "ACTIVE"));

  const contingentPledgesCents = activePledges.reduce((sum, p) => {
    return sum + Math.round(parseFloat(p.amountPerEvent) * 100);
  }, 0);

  const paidOutCents = await getAccountBalance("paid_out");
  const returnedCents = await getAccountBalance("returned");

  const allocatableCents = calculateAllocatable({
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    isTranche1: false,
  });

  return {
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    allocatableCents,
    contingentPledgesCents,
    paidOutCents,
    returnedCents,
  };
}
