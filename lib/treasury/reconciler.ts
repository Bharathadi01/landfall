import { getAccountBalances, listTransactions } from "@/lib/paypal/reporting";
import { getAccountBalance } from "@/lib/ledger/index";
import { db } from "@/lib/db/client";
import { ledgerEntries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/db/audit";

export interface ReconcilerOptions {
  startDate?: string;
  endDate?: string;
  actor?: string;
  forceFallback?: boolean;
  fallbackToLedgerOnly?: boolean;
  ledgerBalanceCents?: number;
}

export interface MatchedTransaction {
  paypalTransactionId: string;
  ledgerTransactionId: string;
  amountCents: number;
  matchedAt: string;
}

export interface UnmatchedItem {
  source: "PAYPAL" | "LEDGER";
  identifier: string;
  amountCents: number;
  description: string;
}

export interface DetailedReconciliationReport {
  reconciledAt: string;
  isMatched: boolean;
  /**
   * UNVERIFIED: PayPal could not be reached or answered with an error, so NOTHING was compared.
   * FALLBACK_LEDGER_ONLY: the caller explicitly asked for a ledger-only view. Neither is a match.
   */
  status: "IN_SYNC" | "TIMING_DIFFERENCE" | "MISMATCH_ALERT" | "FALLBACK_LEDGER_ONLY" | "UNVERIFIED";
  ledgerBalanceCents: number;
  paypalBalanceCents: number;
  discrepancyCents: number;
  recordsExamined: number;
  matchedCount: number;
  unmatchedPayPalCount: number;
  unmatchedLedgerCount: number;
  unmatchedItems: UnmatchedItem[];
  matchedTransactions: MatchedTransaction[];
  notes: string;
}

/**
 * Executes a deterministic reconciliation pass between the internal double-entry
 * ledger and PayPal Reporting API (Balances and Transactions).
 */
export async function runTreasuryReconciliation(
  opts: ReconcilerOptions = {}
): Promise<DetailedReconciliationReport> {
  const actor = opts.actor || "treasury_reconciler";
  const now = new Date();
  const timestamp = now.toISOString();

  // 1. Fetch internal ledger balance for paypal_available (or use override if provided)
  const ledgerBalanceCents =
    opts.ledgerBalanceCents !== undefined
      ? opts.ledgerBalanceCents
      : await getAccountBalance("paypal_available");

  // Fetch recent internal ledger entries for paypal_available
  const internalEntries = await db
    .select({
      id: ledgerEntries.id,
      transactionId: ledgerEntries.transactionId,
      amount: ledgerEntries.amount,
      direction: ledgerEntries.direction,
      correlationId: ledgerEntries.correlationId,
      description: ledgerEntries.description,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, "paypal_available"));

  const isFallback = Boolean(opts.forceFallback || opts.fallbackToLedgerOnly);

  if (isFallback) {
    const report: DetailedReconciliationReport = {
      reconciledAt: timestamp,
      // A ledger-only view compares the ledger with itself, so it can never count as "matched".
      isMatched: false,
      status: "FALLBACK_LEDGER_ONLY",
      ledgerBalanceCents,
      paypalBalanceCents: ledgerBalanceCents,
      discrepancyCents: 0,
      recordsExamined: internalEntries.length,
      matchedCount: 0,
      unmatchedPayPalCount: 0,
      unmatchedLedgerCount: internalEntries.length,
      unmatchedItems: [],
      matchedTransactions: [],
      notes: "Ledger-only view requested: nothing was compared with PayPal, so this is NOT a reconciliation.",
    };

    await logAuditEvent({
      actor,
      action: "treasury.reconcile",
      requestRedacted: { forceFallback: true },
      responseRedacted: { status: report.status, discrepancyCents: 0 },
    });

    return report;
  }

  // 2. Fetch live PayPal balances & transactions
  try {
    const balances = await getAccountBalances(actor);
    const paypalBalanceCents = Math.round(balances.availableUsd * 100);

    // Default 30-day window for transaction matching
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = opts.startDate || thirtyDaysAgo.toISOString();
    const endDate = opts.endDate || timestamp;

    let paypalTransactions: Array<{
      id: string;
      amountCents: number;
      status?: string;
    }> = [];

    try {
      const txRes = await listTransactions({ startDate, endDate, actor });
      if (txRes.transaction_details) {
        paypalTransactions = txRes.transaction_details.map((t) => {
          const info = t.transaction_info;
          const val = parseFloat(info.transaction_amount.value);
          return {
            id: info.transaction_id,
            amountCents: Math.round(val * 100),
            status: info.transaction_status,
          };
        });
      }
    } catch (txErr: unknown) {
      console.warn("PayPal listTransactions returned non-fatal error during reconciliation:", txErr);
    }

    // 3. Transaction-Level Matching
    const matchedTransactions: MatchedTransaction[] = [];
    const unmatchedItems: UnmatchedItem[] = [];
    const matchedLedgerIds = new Set<string>();
    const matchedPayPalIds = new Set<string>();

    for (const ppTx of paypalTransactions) {
      const match = internalEntries.find((entry) => {
        if (matchedLedgerIds.has(entry.id)) return false;
        const idMatches =
          entry.correlationId === ppTx.id ||
          entry.transactionId.includes(ppTx.id) ||
          (entry.correlationId && ppTx.id.includes(entry.correlationId));
        return idMatches;
      });

      const ledgerCents = match ? Math.round(parseFloat(match.amount) * 100) : 0;
      // IDs agreeing is not enough: the amounts must agree too (PayPal reports outflows as negatives).
      if (match && Math.abs(ppTx.amountCents) !== ledgerCents) {
        matchedLedgerIds.add(match.id);
        matchedPayPalIds.add(ppTx.id);
        unmatchedItems.push({
          source: "PAYPAL",
          identifier: ppTx.id,
          amountCents: ppTx.amountCents,
          description: `Amount mismatch: PayPal ${ppTx.amountCents}¢ vs ledger ${ledgerCents}¢ (ledger entry ${match.transactionId})`,
        });
      } else if (match) {
        matchedLedgerIds.add(match.id);
        matchedPayPalIds.add(ppTx.id);
        matchedTransactions.push({
          paypalTransactionId: ppTx.id,
          ledgerTransactionId: match.transactionId,
          amountCents: ppTx.amountCents,
          matchedAt: timestamp,
        });
      } else {
        unmatchedItems.push({
          source: "PAYPAL",
          identifier: ppTx.id,
          amountCents: ppTx.amountCents,
          description: `PayPal transaction ${ppTx.id} without corresponding internal ledger entry`,
        });
      }
    }

    for (const entry of internalEntries) {
      if (!matchedLedgerIds.has(entry.id)) {
        const cents = Math.round(parseFloat(entry.amount) * 100);
        unmatchedItems.push({
          source: "LEDGER",
          identifier: entry.transactionId,
          amountCents: cents,
          description: entry.description,
        });
      }
    }

    const discrepancyCents = Math.abs(ledgerBalanceCents - paypalBalanceCents);
    const recordsExamined = internalEntries.length + paypalTransactions.length;

    let status: DetailedReconciliationReport["status"] = "IN_SYNC";
    let notes = "All balances and transactions strictly reconciled.";

    if (discrepancyCents > 0) {
      if (unmatchedItems.length > 0 && discrepancyCents < 50000) {
        status = "TIMING_DIFFERENCE";
        notes = `Timing difference detected: ${discrepancyCents}¢ in flight. ${unmatchedItems.length} transactions pending synchronization.`;
      } else {
        status = "MISMATCH_ALERT";
        notes = `DISCREPANCY ALERT: ${discrepancyCents}¢ variance between internal ledger and PayPal reporting.`;
      }
    } else if (unmatchedItems.length > 0) {
      status = "TIMING_DIFFERENCE";
      notes = `Balances match exactly, but ${unmatchedItems.length} transaction(s) pending correlation.`;
    }

    const report: DetailedReconciliationReport = {
      reconciledAt: timestamp,
      isMatched: discrepancyCents === 0,
      status,
      ledgerBalanceCents,
      paypalBalanceCents,
      discrepancyCents,
      recordsExamined,
      matchedCount: matchedTransactions.length,
      unmatchedPayPalCount: paypalTransactions.length - matchedPayPalIds.size,
      unmatchedLedgerCount: internalEntries.length - matchedLedgerIds.size,
      unmatchedItems,
      matchedTransactions,
      notes,
    };

    await logAuditEvent({
      actor,
      action: "treasury.reconcile",
      requestRedacted: { startDate, endDate },
      responseRedacted: {
        status: report.status,
        discrepancyCents: report.discrepancyCents,
        matchedCount: report.matchedCount,
      },
    });

    return report;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // PayPal could not be queried. That is an UNVERIFIED result, never a match: reporting
    // "matched, 0 discrepancy" here would turn an outage or a credential problem into a clean bill of health.
    const report: DetailedReconciliationReport = {
      reconciledAt: timestamp,
      isMatched: false,
      status: "UNVERIFIED",
      ledgerBalanceCents,
      paypalBalanceCents: ledgerBalanceCents,
      discrepancyCents: 0,
      recordsExamined: internalEntries.length,
      matchedCount: 0,
      unmatchedPayPalCount: 0,
      unmatchedLedgerCount: internalEntries.length,
      unmatchedItems: [],
      matchedTransactions: [],
      notes: `UNVERIFIED: PayPal reporting was unavailable (${msg}). No comparison was made.`,
    };
    await logAuditEvent({
      actor,
      action: "treasury.reconcile",
      requestRedacted: { startDate: opts.startDate, endDate: opts.endDate },
      responseRedacted: { status: report.status, error: msg.slice(0, 200) },
    });
    return report;
  }
}
