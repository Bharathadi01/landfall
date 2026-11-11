import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTreasuryReconciliation } from "@/lib/treasury/reconciler";
import * as reporting from "@/lib/paypal/reporting";
import * as ledger from "@/lib/ledger/index";
import { db } from "@/lib/db/client";
import { auditEvents, ledgerAccounts, ledgerEntries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe.skipIf(!process.env.LANDFALL_DB_TESTS)("Treasury Reconciliation Engine", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.delete(ledgerEntries);
  });

  it("produces IN_SYNC report when internal ledger and PayPal reporting balances match", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(500000); // $5,000.00
    vi.spyOn(reporting, "getAccountBalances").mockResolvedValue({
      availableUsd: 5000.0,
      totalUsd: 5000.0,
      raw: { balances: [] },
    });
    vi.spyOn(reporting, "listTransactions").mockResolvedValue({
      transaction_details: [],
    });

    const report = await runTreasuryReconciliation({ actor: "test_reconciler" });

    expect(report.status).toBe("IN_SYNC");
    expect(report.discrepancyCents).toBe(0);
    expect(report.ledgerBalanceCents).toBe(500000);
    expect(report.paypalBalanceCents).toBe(500000);
    expect(report.unmatchedPayPalCount).toBe(0);
    expect(report.unmatchedLedgerCount).toBe(0);
  });

  it("detects TIMING_DIFFERENCE when transactions are in-flight", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(497500); // $4,975.00
    vi.spyOn(reporting, "getAccountBalances").mockResolvedValue({
      availableUsd: 5000.0, // $5,000.00 (2500 cents diff)
      totalUsd: 5000.0,
      raw: { balances: [] },
    });
    vi.spyOn(reporting, "listTransactions").mockResolvedValue({
      transaction_details: [
        {
          transaction_info: {
            transaction_id: "TX-INFLIGHT-123",
            transaction_amount: { value: "25.00", currency_code: "USD" },
            transaction_status: "S",
          },
        },
      ],
    });

    const report = await runTreasuryReconciliation({ actor: "test_reconciler" });

    expect(report.status).toBe("TIMING_DIFFERENCE");
    expect(report.discrepancyCents).toBe(2500);
    expect(report.unmatchedPayPalCount).toBe(1);
    expect(report.unmatchedItems.length).toBeGreaterThan(0);
    expect(report.notes).toMatch(/Timing difference detected/);
  });

  it("raises MISMATCH_ALERT when unexplained discrepancy occurs", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(200000); // $2,000.00
    vi.spyOn(reporting, "getAccountBalances").mockResolvedValue({
      availableUsd: 5000.0, // $5,000.00 ($3,000.00 discrepancy > $500 threshold)
      totalUsd: 5000.0,
      raw: { balances: [] },
    });
    vi.spyOn(reporting, "listTransactions").mockResolvedValue({
      transaction_details: [],
    });

    const report = await runTreasuryReconciliation({ actor: "test_reconciler" });

    expect(report.status).toBe("MISMATCH_ALERT");
    expect(report.discrepancyCents).toBe(300000);
    expect(report.notes).toMatch(/DISCREPANCY ALERT/);
  });

  it("reports UNVERIFIED (never a match) when the PayPal reporting API fails", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(450000);
    vi.spyOn(reporting, "getAccountBalances").mockRejectedValue(
      new Error("PERMISSION_DENIED")
    );

    const report = await runTreasuryReconciliation({ actor: "test_reconciler" });

    expect(report.status).toBe("UNVERIFIED");
    expect(report.isMatched).toBe(false);
    expect(report.matchedCount).toBe(0);
    expect(report.notes).toMatch(/UNVERIFIED.*PERMISSION_DENIED/);
  });

  it("a ledger-only view (forceFallback) is labelled and is never counted as matched", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(300000);

    const report = await runTreasuryReconciliation({
      actor: "test_reconciler",
      forceFallback: true,
    });

    expect(report.status).toBe("FALLBACK_LEDGER_ONLY");
    expect(report.isMatched).toBe(false);
    expect(report.notes).toMatch(/NOT a reconciliation/);
  });

  it("logs immutable audit event on every reconciliation pass", async () => {
    vi.spyOn(ledger, "getAccountBalance").mockResolvedValue(500000);
    vi.spyOn(reporting, "getAccountBalances").mockResolvedValue({
      availableUsd: 5000.0,
      totalUsd: 5000.0,
      raw: { balances: [] },
    });
    vi.spyOn(reporting, "listTransactions").mockResolvedValue({
      transaction_details: [],
    });

    const actorName = `audit_tester_${Date.now()}`;
    await runTreasuryReconciliation({ actor: actorName });

    const [event] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actor, actorName));

    expect(event).toBeDefined();
    expect(event.action).toBe("treasury.reconcile");
  });
});
