import { db } from "@/lib/db/client";
import { ledgerAccounts, ledgerEntries, hosts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export type AccountName =
  | "paypal_available"
  | "reserve_protected"
  | "allocatable"
  | `committed:${string}`
  | "fees_reserved"
  | "paid_out"
  | "returned"
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
export function calculateAllocatable({
  paypalAvailableCents,
  reserveProtectedCents,
  feesReservedCents,
  committedCents,
  isTranche1 = false,
}: {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  isTranche1?: boolean;
}): number {
  const protectedDeduction = isTranche1 ? 0 : reserveProtectedCents;
  const allocatable = paypalAvailableCents - protectedDeduction - feesReservedCents - committedCents;
  return Math.max(0, allocatable);
}

/**
 * Persists a balanced ledger transaction.
 */
export async function recordLedgerTransaction(params: RecordTransactionParams): Promise<void> {
  const validation = validateBalancedTransaction(params.entries);
  if (!validation.balanced) {
    throw new Error(
      `Unbalanced ledger transaction ${params.transactionId}: Debits (${validation.totalDebits}¢) != Credits (${validation.totalCredits}¢)`
    );
  }

  // Execute inside a database transaction to ensure atomicity
  await db.transaction(async (tx) => {
    for (const entry of params.entries) {
      // Find or create account
      let [account] = await tx
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.name, entry.accountName))
        .limit(1);

      if (!account) {
        const [created] = await tx
          .insert(ledgerAccounts)
          .values({
            id: entry.accountName,
            name: entry.accountName,
            accountType: entry.accountName.startsWith("committed:") ? "LIABILITY" : "ASSET",
          })
          .returning();
        account = created;
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
