import { describe, it, expect } from "vitest";
import {
  classifyPayoutException,
  EXCEPTION_RULES,
  type ExceptionCategory,
} from "@/lib/recovery/exception-taxonomy";
import type {
  ReliefObligation,
  PayoutItemRecord,
  WebhookEventRecord,
  LedgerTraceRecord,
} from "@/lib/recovery/types";

describe("Authoritative Payout Exception Taxonomy (§2.3, §21.3)", () => {
  const baseObligation: ReliefObligation = {
    obligationId: "ob_test_001",
    householdId: "hh_test_001",
    recipientName: "Test Household",
    recipientEmail: "test@example.com",
    targetAmountCents: 10000, // $100.00
    currency: "USD",
    stormId: "milton-2024",
    policyTranche: 1,
    approvedPlanId: "plan_test",
    approvedPlanHash: "46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c",
    approvedAt: "2024-10-09T18:00:00.000Z",
    dualSignatures: {
      coordinatorKeyId: "key_ops",
      financeKeyId: "key_finance",
    },
  };

  const basePayoutItem: PayoutItemRecord = {
    payoutBatchId: "BATCH_001",
    payoutItemId: "ITEM_001",
    status: "UNCLAIMED",
    amountCents: 10000,
    feeCents: 25,
    currency: "USD",
    recipientIdentifier: "test@example.com",
    submittedAt: "2024-10-09T18:00:00.000Z",
    lastUpdatedAt: "2024-10-09T18:05:00.000Z",
  };

  it("verifies all 18 exception categories are explicitly defined in EXCEPTION_RULES", () => {
    const categories: ExceptionCategory[] = [
      "PENDING_TOO_LONG",
      "UNCLAIMED_RECIPIENT_ACCESS",
      "RETURNED_FUNDS_UNCONFIRMED",
      "RETURNED_FUNDS_CONFIRMED",
      "FAILED_PROVIDER_REQUEST",
      "ONHOLD_REVIEW",
      "BLOCKED_PROVIDER_REQUEST",
      "REFUNDED_BY_RECIPIENT",
      "REVERSED_PROVIDER_ITEM",
      "STALE_PROVIDER_EVIDENCE",
      "CONTRADICTORY_EVIDENCE",
      "DUPLICATE_ATTEMPT_RISK",
      "MISSING_OBLIGATION_LINK",
      "RECIPIENT_MISMATCH",
      "CURRENCY_MISMATCH",
      "RESERVE_OR_COMMITMENT_BREACH",
      "WEBHOOK_SIGNATURE_INVALID",
      "UNKNOWN_PROVIDER_STATE",
    ];

    expect(Object.keys(EXCEPTION_RULES)).toHaveLength(18);
    for (const cat of categories) {
      expect(EXCEPTION_RULES[cat]).toBeDefined();
      expect(EXCEPTION_RULES[cat].category).toBe(cat);
      expect(EXCEPTION_RULES[cat].requiredEvidence.length).toBeGreaterThan(0);
      expect(typeof EXCEPTION_RULES[cat].isHardBlock).toBe("boolean");
    }
  });

  describe("Hard Invariants & Classification Logic", () => {
    it("classifies MISSING_OBLIGATION_LINK when obligation is absent", () => {
      const rule = classifyPayoutException({ payoutItem: basePayoutItem });
      expect(rule.category).toBe("MISSING_OBLIGATION_LINK");
      expect(rule.isHardBlock).toBe(true);
      expect(rule.canReissueImmediately).toBe(false);
    });

    it("classifies WEBHOOK_SIGNATURE_INVALID when an unverified webhook is present", () => {
      const unverifiedWebhook: WebhookEventRecord = {
        eventId: "wh_fake",
        eventType: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
        eventTime: "2024-10-09T18:05:00.000Z",
        verifiedByPayPal: false,
        rawPayloadHash: "fake_hash",
      };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
        webhookHistory: [unverifiedWebhook],
      });
      expect(rule.category).toBe("WEBHOOK_SIGNATURE_INVALID");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies STALE_PROVIDER_EVIDENCE when balance snapshot is stale", () => {
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
        balanceSnapshot: {
          availableCents: 100000,
          reserveProtectedCents: 30000,
          currency: "USD",
          fetchedAt: "2024-10-09T17:00:00.000Z",
          isStale: true,
        },
      });
      expect(rule.category).toBe("STALE_PROVIDER_EVIDENCE");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies DUPLICATE_ATTEMPT_RISK when multiple in-flight attempts exist", () => {
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
        inFlightAttemptsCount: 2,
      });
      expect(rule.category).toBe("DUPLICATE_ATTEMPT_RISK");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies CURRENCY_MISMATCH when payout currency does not match obligation", () => {
      const gbpItem: PayoutItemRecord = { ...basePayoutItem, currency: "GBP" };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: gbpItem,
      });
      expect(rule.category).toBe("CURRENCY_MISMATCH");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies RECIPIENT_MISMATCH when payout recipient does not match obligation", () => {
      const mismatchItem: PayoutItemRecord = { ...basePayoutItem, recipientIdentifier: "attacker@evil.com" };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: mismatchItem,
      });
      expect(rule.category).toBe("RECIPIENT_MISMATCH");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies CONTRADICTORY_EVIDENCE when ledger amount disagrees with payout item", () => {
      const conflictingLedger: LedgerTraceRecord = {
        transactionId: "tx_001",
        debitAccount: "disbursements",
        creditAccount: "cash",
        amountCents: 5000, // Disagrees with $100.00 payout item
        timestamp: "2024-10-09T18:00:00.000Z",
        reconciliationStatus: "DISCREPANCY",
      };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
        ledgerTrace: conflictingLedger,
      });
      expect(rule.category).toBe("CONTRADICTORY_EVIDENCE");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies RESERVE_OR_COMMITMENT_BREACH when allocatable cash is insufficient", () => {
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
        balanceSnapshot: {
          availableCents: 35000, // $350 available
          reserveProtectedCents: 30000, // $300 protected -> only $50 allocatable (< $100 obligation)
          currency: "USD",
          fetchedAt: "2024-10-09T18:00:00.000Z",
          isStale: false,
        },
      });
      expect(rule.category).toBe("RESERVE_OR_COMMITMENT_BREACH");
      expect(rule.isHardBlock).toBe(true);
    });

    it("classifies UNCLAIMED_RECIPIENT_ACCESS and strictly locks immediate reissuance", () => {
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: basePayoutItem,
      });
      expect(rule.category).toBe("UNCLAIMED_RECIPIENT_ACCESS");
      expect(rule.primarySafeAction).toBe("CONTACT_RECIPIENT");
      expect(rule.canReissueImmediately).toBe(false);
      expect(rule.forbiddenActions).toContain("PREPARE_NEW_APPROVED_PAYOUT");
    });

    it("classifies FAILED_PROVIDER_REQUEST and allows approved payout preparation", () => {
      const failedItem: PayoutItemRecord = { ...basePayoutItem, status: "FAILED" };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: failedItem,
      });
      expect(rule.category).toBe("FAILED_PROVIDER_REQUEST");
      expect(rule.primarySafeAction).toBe("PREPARE_NEW_APPROVED_PAYOUT");
      expect(rule.isHardBlock).toBe(false);
    });

    it("classifies RETURNED_FUNDS_CONFIRMED only when ledger reconciliation matches", () => {
      const returnedItem: PayoutItemRecord = { ...basePayoutItem, status: "RETURNED" };
      const matchedLedger: LedgerTraceRecord = {
        transactionId: "tx_ret_001",
        debitAccount: "cash",
        creditAccount: "disbursements",
        amountCents: 10000,
        timestamp: "2024-10-09T18:00:00.000Z",
        reconciliationStatus: "MATCHED",
      };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: returnedItem,
        ledgerTrace: matchedLedger,
      });
      expect(rule.category).toBe("RETURNED_FUNDS_CONFIRMED");
      expect(rule.primarySafeAction).toBe("PREPARE_CORRECTED_RETRY");
    });

    it("classifies RETURNED_FUNDS_UNCONFIRMED when ledger trace is missing", () => {
      const returnedItem: PayoutItemRecord = { ...basePayoutItem, status: "RETURNED" };
      const rule = classifyPayoutException({
        obligation: baseObligation,
        payoutItem: returnedItem,
      });
      expect(rule.category).toBe("RETURNED_FUNDS_UNCONFIRMED");
      expect(rule.primarySafeAction).toBe("HOLD_INSUFFICIENT_EVIDENCE");
    });

    it("classifies ONHOLD_REVIEW and BLOCKED_PROVIDER_REQUEST as operator escalations", () => {
      const onholdItem: PayoutItemRecord = { ...basePayoutItem, status: "ONHOLD" };
      const blockedItem: PayoutItemRecord = { ...basePayoutItem, status: "BLOCKED" };

      const onholdRule = classifyPayoutException({ obligation: baseObligation, payoutItem: onholdItem });
      const blockedRule = classifyPayoutException({ obligation: baseObligation, payoutItem: blockedItem });

      expect(onholdRule.category).toBe("ONHOLD_REVIEW");
      expect(onholdRule.primarySafeAction).toBe("ESCALATE_TO_PAYPAL_OR_OPERATOR");
      expect(blockedRule.category).toBe("BLOCKED_PROVIDER_REQUEST");
      expect(blockedRule.primarySafeAction).toBe("ESCALATE_TO_PAYPAL_OR_OPERATOR");
    });
  });
});

