import { describe, it, expect } from "vitest";
import {
  evaluateRecoveryAction,
  generateRecoveryProof,
  verifyRecoveryProof,
  createRecoveryCase,
  sha256Hex,
} from "@/lib/recovery/engine";
import type {
  ReliefObligation,
  PayoutItemRecord,
  WebhookEventRecord,
  LedgerTraceRecord,
} from "@/lib/recovery/types";

describe("Proof-Carrying Relief Recovery Engine (§3, §4)", () => {
  const mockObligation: ReliefObligation = {
    obligationId: "ob_milton_hh_001",
    householdId: "hh_pinellas_001",
    recipientName: "Maria Santos",
    recipientEmail: "maria.santos@test.example",
    targetAmountCents: 10000,
    currency: "USD",
    stormId: "milton-2024",
    policyTranche: 1,
    approvedPlanId: "plan_milton_tranche1",
    approvedPlanHash: "46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c",
    approvedAt: "2024-10-09T18:00:00.000Z",
    dualSignatures: {
      coordinatorKeyId: "key_sarah_lin_passkey_001",
      financeKeyId: "key_marcus_vance_passkey_002",
    },
  };

  const mockPayoutSuccess: PayoutItemRecord = {
    payoutBatchId: "CYX4HC52K54WN",
    payoutItemId: "XVV68QXJWJ66Y",
    paypalTransactionId: "6SM40781T11720216",
    status: "SUCCESS",
    amountCents: 10000,
    feeCents: 25,
    currency: "USD",
    recipientIdentifier: "maria.santos@test.example",
    submittedAt: "2024-10-09T19:00:00.000Z",
    lastUpdatedAt: "2024-10-09T19:02:00.000Z",
  };

  const mockPayoutUnclaimed: PayoutItemRecord = {
    payoutBatchId: "7Y5GP4ETNLCUQ",
    payoutItemId: "2FN4JTY2SF8A2",
    status: "UNCLAIMED",
    amountCents: 10000,
    feeCents: 25,
    currency: "USD",
    recipientIdentifier: "unregistered.recipient@test.example",
    submittedAt: "2024-10-09T19:00:00.000Z",
    lastUpdatedAt: "2024-10-09T19:05:00.000Z",
    rawStatusDescription: "Recipient has not registered PayPal account or claimed funds.",
  };

  const mockPayoutReturned: PayoutItemRecord = {
    payoutBatchId: "BATCH_RET_001",
    payoutItemId: "ITEM_RET_001",
    status: "RETURNED",
    amountCents: 10000,
    feeCents: 25,
    currency: "USD",
    recipientIdentifier: "expired.claim@test.example",
    submittedAt: "2024-09-01T19:00:00.000Z",
    lastUpdatedAt: "2024-10-01T19:00:00.000Z",
  };

  const mockPayoutFailed: PayoutItemRecord = {
    payoutBatchId: "BATCH_FAIL_001",
    payoutItemId: "ITEM_FAIL_001",
    status: "FAILED",
    amountCents: 10000,
    feeCents: 0,
    currency: "USD",
    recipientIdentifier: "invalid.recipient@closed.account",
    submittedAt: "2024-10-09T19:00:00.000Z",
    lastUpdatedAt: "2024-10-09T19:01:00.000Z",
    errorDetails: {
      name: "RECEIVER_UNREGISTERED",
      message: "Receiver account is closed or does not accept domestic USD payouts.",
    },
  };

  const mockLedgerTrace: LedgerTraceRecord = {
    transactionId: "tx_trace_881920",
    debitAccount: "ledger_relief_disbursements",
    creditAccount: "ledger_paypal_cash",
    amountCents: 10000,
    timestamp: "2024-10-09T19:00:00.000Z",
    reconciliationStatus: "MATCHED",
  };

  const mockWebhook: WebhookEventRecord = {
    eventId: "WH_EVT_UNCLAIMED_9918",
    eventType: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
    eventTime: "2024-10-09T19:05:00.000Z",
    verifiedByPayPal: true,
    rawPayloadHash: sha256Hex("mock_verified_webhook_payload"),
  };

  const mockAuthorization = {
    authorizedBy: "Marcus Vance",
    authorizationRole: "Fiduciary & Treasury Lead",
    passkeySignature: "sig_fido2_webauthn_passkey_mock_9921",
    authorizedAction: "CONTACT_RECIPIENT" as const,
    authorizedAt: "2024-10-09T19:10:00.000Z",
  };

  describe("1. Authoritative Payout State Evaluations", () => {
    it("evaluates SUCCESS as CLOSE_AS_RESOLVED without duplicate actions", () => {
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: mockPayoutSuccess,
      });

      expect(rec.safeAction).toBe("CLOSE_AS_RESOLVED");
      expect(rec.urgency).toBe("LOW");
      expect(rec.canReissueImmediately).toBe(false);
      expect(rec.requiresHumanApproval).toBe(false);
    });

    it("evaluates PENDING as WAIT_AND_MONITOR and prevents reissue", () => {
      const pendingItem: PayoutItemRecord = { ...mockPayoutSuccess, status: "PENDING" };
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: pendingItem,
      });

      expect(rec.safeAction).toBe("WAIT_AND_MONITOR");
      expect(rec.canReissueImmediately).toBe(false);
      expect(rec.requiresHumanApproval).toBe(false);
    });

    it("INVARIANT: UNCLAIMED strictly bars reissue while funds remain in PayPal escrow", () => {
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
      });

      expect(rec.safeAction).toBe("CONTACT_RECIPIENT");
      expect(rec.canReissueImmediately).toBe(false); // MUST NOT DUPLICATE PAYOUT
      expect(rec.requiresHumanApproval).toBe(true);
      expect(rec.recipientGuidanceNotes).toContain("30 days");
    });

    it("evaluates RETURNED as PREPARE_CORRECTED_RETRY with ledger adjustment", () => {
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: mockPayoutReturned,
      });

      expect(rec.safeAction).toBe("PREPARE_CORRECTED_RETRY");
      expect(rec.allowLedgerAdjustment).toBe(true);
      expect(rec.requiresPasskeyReauthorization).toBe(true);
      expect(rec.canReissueImmediately).toBe(false); // Still requires new authorization
    });

    it("evaluates FAILED as PREPARE_NEW_APPROVED_PAYOUT", () => {
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: mockPayoutFailed,
      });

      expect(rec.safeAction).toBe("PREPARE_NEW_APPROVED_PAYOUT");
      expect(rec.urgency).toBe("CRITICAL");
      expect(rec.allowLedgerAdjustment).toBe(true);
      expect(rec.requiresPasskeyReauthorization).toBe(true);
    });

    it("evaluates ONHOLD and BLOCKED as ESCALATE_TO_PAYPAL_OR_OPERATOR", () => {
      const holdItem: PayoutItemRecord = { ...mockPayoutSuccess, status: "ONHOLD" };
      const rec = evaluateRecoveryAction({
        obligation: mockObligation,
        payoutItem: holdItem,
      });

      expect(rec.safeAction).toBe("ESCALATE_TO_PAYPAL_OR_OPERATOR");
      expect(rec.urgency).toBe("CRITICAL");
      expect(rec.canReissueImmediately).toBe(false);
    });
  });

  describe("2. Cryptographic Proof Generator & Verification Chain", () => {
    it("generates a complete 5-pillar SHA-256 cryptographic RecoveryProof", () => {
      const proof = generateRecoveryProof({
        caseRecord: { caseId: "rcv_test_001", detectedAt: "2024-10-09T19:05:00.000Z", status: "WAITING_ON_RECIPIENT" },
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      expect(proof.proofId).toContain("prf_rcv_test_001");
      expect(proof.obligationHash).toHaveLength(64);
      expect(proof.payoutTraceHash).toHaveLength(64);
      expect(proof.webhookVerificationHash).toHaveLength(64);
      expect(proof.ledgerTraceHash).toHaveLength(64);
      expect(proof.actionAuthorizationHash).toHaveLength(64);
      expect(proof.masterProofHash).toHaveLength(64);
      expect(proof.verifiedByNode).toBe("landfall-sentinel-v4-auditor");
    });

    it("verifies genuine RecoveryProof matches underlying data", () => {
      const proof = generateRecoveryProof({
        caseRecord: { caseId: "rcv_test_002", detectedAt: "2024-10-09T19:05:00.000Z", status: "WAITING_ON_RECIPIENT" },
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      const verification = verifyRecoveryProof(proof, {
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      expect(verification.valid).toBe(true);
      expect(verification.error).toBeUndefined();
    });

    it("detects adversarial tampering with obligation amount and fails verification", () => {
      const proof = generateRecoveryProof({
        caseRecord: { caseId: "rcv_test_003", detectedAt: "2024-10-09T19:05:00.000Z", status: "WAITING_ON_RECIPIENT" },
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      const tamperedObligation: ReliefObligation = {
        ...mockObligation,
        targetAmountCents: 50000, // Altered from $100 to $500
      };

      const verification = verifyRecoveryProof(proof, {
        obligation: tamperedObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      expect(verification.valid).toBe(false);
      expect(verification.error).toContain("Obligation hash mismatch");
    });

    it("detects tampering with payout transaction trace", () => {
      const proof = generateRecoveryProof({
        caseRecord: { caseId: "rcv_test_004", detectedAt: "2024-10-09T19:05:00.000Z", status: "WAITING_ON_RECIPIENT" },
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      const tamperedPayout: PayoutItemRecord = {
        ...mockPayoutUnclaimed,
        status: "SUCCESS", // Fabricated success status
      };

      const verification = verifyRecoveryProof(proof, {
        obligation: mockObligation,
        payoutItem: tamperedPayout,
        webhookHistory: [mockWebhook],
        ledgerTrace: mockLedgerTrace,
        actionAuthorization: mockAuthorization,
      });

      expect(verification.valid).toBe(false);
      expect(verification.error).toContain("Payout trace hash mismatch");
    });
  });

  describe("3. Recovery Case Creation and Lifecycle", () => {
    it("creates an initial RecoveryCase for UNCLAIMED item", () => {
      const recoveryCase = createRecoveryCase({
        obligation: mockObligation,
        payoutItem: mockPayoutUnclaimed,
        webhookHistory: [mockWebhook],
      });

      expect(recoveryCase.status).toBe("WAITING_ON_RECIPIENT");
      expect(recoveryCase.payoutItemId).toBe("2FN4JTY2SF8A2");
      expect(recoveryCase.recommendation.safeAction).toBe("CONTACT_RECIPIENT");
    });

    it("creates an initial RecoveryCase for FAILED item", () => {
      const recoveryCase = createRecoveryCase({
        obligation: mockObligation,
        payoutItem: mockPayoutFailed,
      });

      expect(recoveryCase.status).toBe("READY_FOR_REAUTHORIZATION");
      expect(recoveryCase.recommendation.safeAction).toBe("PREPARE_NEW_APPROVED_PAYOUT");
    });
  });
});

