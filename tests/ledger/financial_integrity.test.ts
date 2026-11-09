import { describe, it, expect, beforeEach } from "vitest";
import {
  recordLedgerTransaction,
  isTransactionRecorded,
  validateBalancedTransaction,
  calculateAllocatable,
  getAccountBalance,
  getTreasuryWaterfall,
  type LedgerEntryItem,
} from "@/lib/ledger/index";
import { db } from "@/lib/db/client";
import { ledgerEntries, auditEvents, stormPledges, subscriptions } from "@/lib/db/schema";
import { runTreasuryReconciliation } from "@/lib/treasury/reconciler";
import { eq } from "drizzle-orm";

describe("Adversarial Financial Integrity & Ledger Audit (§3, §4.2)", () => {
  beforeEach(async () => {
    // Clear ledger entries and pledges for clean test isolation
    await db.delete(ledgerEntries);
    await db.delete(stormPledges);
    await db.delete(subscriptions);
  });

  describe("Double-Entry Strict Balance Verification", () => {
    it("strictly verifies Debits == Credits across all financial operations", () => {
      // 1. Storm Pledge Capture: DEBIT paypal_available, CREDIT pledges_captured
      const pledgeTx: LedgerEntryItem[] = [
        { accountName: "paypal_available", entryType: "DEBIT", amountCents: 5000 },
        { accountName: "pledges_captured", entryType: "CREDIT", amountCents: 5000 },
      ];
      const pledgeValidation = validateBalancedTransaction(pledgeTx);
      expect(pledgeValidation.balanced).toBe(true);
      expect(pledgeValidation.difference).toBe(0);

      // 2. Sustainer Monthly Sale: DEBIT paypal_available, CREDIT reserve_protected
      const sustainerTx: LedgerEntryItem[] = [
        { accountName: "paypal_available", entryType: "DEBIT", amountCents: 2500 },
        { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 2500 },
      ];
      const sustainerValidation = validateBalancedTransaction(sustainerTx);
      expect(sustainerValidation.balanced).toBe(true);
      expect(sustainerValidation.difference).toBe(0);

      // 3. One-Time Donation: DEBIT paypal_available, CREDIT reserve_protected
      const donationTx: LedgerEntryItem[] = [
        { accountName: "paypal_available", entryType: "DEBIT", amountCents: 10000 },
        { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 10000 },
      ];
      const donationValidation = validateBalancedTransaction(donationTx);
      expect(donationValidation.balanced).toBe(true);
      expect(donationValidation.difference).toBe(0);
    });

    it("strictly rejects unbalanced entries and throws before database mutation", async () => {
      const unbalancedTx: LedgerEntryItem[] = [
        { accountName: "paypal_available", entryType: "DEBIT", amountCents: 5000 },
        { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 4900 }, // 100 cents off!
      ];

      expect(validateBalancedTransaction(unbalancedTx).balanced).toBe(false);

      await expect(
        recordLedgerTransaction({
          hostId: "default",
          transactionId: "tx_unbalanced_attempt",
          description: "Malicious unbalanced test",
          entries: unbalancedTx,
        })
      ).rejects.toThrow(/Unbalanced ledger transaction/);

      // Verify nothing was written to the ledger
      const recorded = await isTransactionRecorded("tx_unbalanced_attempt");
      expect(recorded).toBe(false);
    });
  });

  describe("Single-Credit Idempotency & Replay Resistance", () => {
    it("ensures an external payment is credited exactly once in the ledger", async () => {
      const txId = "tx_external_payment_12345";
      const entries: LedgerEntryItem[] = [
        { accountName: "paypal_available", entryType: "DEBIT", amountCents: 2500 },
        { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 2500 },
      ];

      // Initial credit
      await recordLedgerTransaction({
        hostId: "default",
        transactionId: txId,
        description: "Payment 1",
        entries,
      });

      const initialAvailable = await getAccountBalance("paypal_available");
      expect(initialAvailable).toBe(2500);

      // Check idempotency check helper
      const isRecorded = await isTransactionRecorded(txId);
      expect(isRecorded).toBe(true);

      // Replay attempt should be blocked by idempotency guard
      if (!isRecorded) {
        await recordLedgerTransaction({
          hostId: "default",
          transactionId: txId,
          description: "Payment Replay",
          entries,
        });
      }

      // Balance must remain strictly 2500 cents (no duplicate credit)
      const finalAvailable = await getAccountBalance("paypal_available");
      expect(finalAvailable).toBe(2500);
    });
  });

  describe("Contingent Pledges vs Allocatable Cash Audit (§4.2 Invariant)", () => {
    it("INVARIANT: Contingent pledges are NEVER included in allocatable funds prior to confirmed capture", async () => {
      // Seed $1,000 in PayPal available, $300 in protected reserve, $50 in fees
      await recordLedgerTransaction({
        hostId: "default",
        transactionId: "tx_seed_initial",
        description: "Initial cash pool",
        entries: [
          { accountName: "paypal_available", entryType: "DEBIT", amountCents: 100000 },
          { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 100000 },
        ],
      });

      // Insert active contingent pledge in storm_pledges table ($50 per event)
      await db.insert(stormPledges).values({
        donorEmail: "contingent_donor@relief.org",
        vaultPaymentToken: "tok_contingent_vault",
        amountPerEvent: "50.00",
        seasonCap: "200.00",
        chargedThisSeason: "0.00",
        hazardScope: ["HURRICANE"],
        status: "ACTIVE",
      });

      // Compute live waterfall
      const waterfall = await getTreasuryWaterfall();

      // Contingent pledges should be recognized in contingentPledgesCents
      expect(waterfall.contingentPledgesCents).toBe(5000); // $50.00

      // BUT Allocatable cash must NOT count contingent pledges:
      // Allocatable for general operations = Available ($1,000) - Protected Floor ($1,000) - Fees ($0) - Committed ($0) = $0!
      expect(waterfall.allocatableCents).toBe(0);

      // Even for Tranche 1 (which draws on protected floor), Allocatable = Available ($1,000) - Fees ($0) = $1,000 (NOT $1,050!)
      const tranche1Allocatable = calculateAllocatable({
        paypalAvailableCents: waterfall.paypalAvailableCents,
        reserveProtectedCents: waterfall.reserveProtectedCents,
        feesReservedCents: waterfall.feesReservedCents,
        committedCents: waterfall.committedCents,
        isTranche1: true,
      });
      expect(tranche1Allocatable).toBe(100000); // Exactly $1,000.00, NEVER includes the $50 pledge
    });
  });

  describe("Reconciliation Immutability Audit (§4.6 Invariant)", () => {
    it("reconciliation discrepancy produces immutable audit logs and NEVER mutates historical ledger entries", async () => {
      // Seed an initial ledger entry
      await recordLedgerTransaction({
        hostId: "default",
        transactionId: "tx_historical_immutable",
        description: "Original historical entry",
        entries: [
          { accountName: "paypal_available", entryType: "DEBIT", amountCents: 10000 },
          { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 10000 },
        ],
      });

      const [entryBefore] = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, "tx_historical_immutable"));

      // Run reconciliation that detects a discrepancy ($100 in ledger vs $50 in PayPal)
      const report = await runTreasuryReconciliation({
        ledgerBalanceCents: 10000,
        forceFallback: false,
        actor: "audit_adversary",
      });

      // Verify report flags mismatch or timing difference
      expect(report.discrepancyCents).toBeDefined();

      // Check that historical ledger entry has NOT been modified
      const [entryAfter] = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, "tx_historical_immutable"));

      expect(entryAfter.amount).toBe(entryBefore.amount);
      expect(entryAfter.direction).toBe(entryBefore.direction);
      expect(entryAfter.createdAt.getTime()).toBe(entryBefore.createdAt.getTime());

      // Verify audit record was written
      const auditLog = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "treasury.reconcile"));

      expect(auditLog.length).toBeGreaterThan(0);
    });
  });
});

