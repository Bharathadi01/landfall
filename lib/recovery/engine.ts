/**
 * PROOF-CARRYING RELIEF RECOVERY ENGINE (§3, §4)
 *
 * Implements deterministic exception investigation, safe action recommendations,
 * and cryptographic SHA-256 proof generation connecting:
 * Contribution -> Approved Obligation -> PayPal Payout Item -> Exception Investigation
 * -> Authorized Recovery Action -> Cryptographic Recovery Proof -> Final Ledger Reconciliation
 *
 * INVARIANTS:
 * 1. ZERO SILENT FAILURES: Every abnormal payout state generates a tracked RecoveryCase.
 * 2. NO UNCLAIMED DUPLICATION: UNCLAIMED payouts are NEVER reissued while active (30-day window).
 * 3. DUAL-PASSKEY REAUTHORIZATION: Any retry or reroute requires a new passkey authorization.
 * 4. CRYPTOGRAPHIC PROOF: Every resolution carries an immutable SHA-256 chain of custody.
 */

import { createHash } from "crypto";
import type {
  ReliefObligation,
  PayoutItemRecord,
  WebhookEventRecord,
  LedgerTraceRecord,
  RecoveryCase,
  RecoveryProof,
  RecoveryRecommendation,
  SafeRecoveryAction,
  RecoveryCaseStatus,
} from "./types";
import { recoveryDecisionForStatus } from "./decision";

export { recoveryDecisionForStatus } from "./decision";

/**
 * SHA-256 deterministic digest helper
 */
export function sha256Hex(data: string | object): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Evaluates the authoritative PayPal payout item status and provides
 * a provably safe operational recovery recommendation.
 */
export function evaluateRecoveryAction({
  obligation: _obligation,
  payoutItem,
  webhookHistory: _webhookHistory = [],
  ledgerTrace: _ledgerTrace,
}: {
  obligation: ReliefObligation;
  payoutItem: PayoutItemRecord;
  webhookHistory?: WebhookEventRecord[];
  ledgerTrace?: LedgerTraceRecord;
}): RecoveryRecommendation {
  return recoveryDecisionForStatus(payoutItem.status, {
    errorMessage: payoutItem.errorDetails?.message,
    rawStatusDescription: payoutItem.rawStatusDescription,
  });
}

/**
 * Generates an immutable Proof-Carrying Relief Recovery cryptographic certificate
 * linking all five pillars of evidence into a canonical SHA-256 master root hash.
 */
export function generateRecoveryProof({
  caseRecord,
  obligation,
  payoutItem,
  webhookHistory = [],
  ledgerTrace,
  actionAuthorization,
}: {
  caseRecord: { caseId: string; detectedAt: string; status: RecoveryCaseStatus };
  obligation: ReliefObligation;
  payoutItem: PayoutItemRecord;
  webhookHistory?: WebhookEventRecord[];
  ledgerTrace?: LedgerTraceRecord;
  actionAuthorization: {
    authorizedBy: string;
    authorizationRole: string;
    passkeySignature: string;
    authorizedAction: SafeRecoveryAction;
    authorizedAt: string;
  };
}): RecoveryProof {
  const obligationHash = sha256Hex({
    obligationId: obligation.obligationId,
    householdId: obligation.householdId,
    targetAmountCents: obligation.targetAmountCents,
    approvedPlanHash: obligation.approvedPlanHash,
    dualSignatures: obligation.dualSignatures,
  });

  const payoutTraceHash = sha256Hex({
    payoutBatchId: payoutItem.payoutBatchId,
    payoutItemId: payoutItem.payoutItemId,
    paypalTransactionId: payoutItem.paypalTransactionId,
    status: payoutItem.status,
    amountCents: payoutItem.amountCents,
    feeCents: payoutItem.feeCents,
    recipientIdentifier: payoutItem.recipientIdentifier,
  });

  const webhookVerificationHash = sha256Hex({
    events: webhookHistory.map((w) => ({
      eventId: w.eventId,
      eventType: w.eventType,
      verifiedByPayPal: w.verifiedByPayPal,
      rawPayloadHash: w.rawPayloadHash,
    })),
  });

  const ledgerTraceHash = sha256Hex({
    transactionId: ledgerTrace?.transactionId || "tx_trace_pending",
    debitAccount: ledgerTrace?.debitAccount || "ledger_relief_disbursements",
    creditAccount: ledgerTrace?.creditAccount || "ledger_paypal_cash",
    amountCents: ledgerTrace?.amountCents || payoutItem.amountCents,
    reconciliationStatus: ledgerTrace?.reconciliationStatus || "PENDING",
  });

  const actionAuthorizationHash = sha256Hex(actionAuthorization);

  // Compute master root hash combining all 5 component hashes
  const masterProofHash = sha256Hex(
    [
      obligationHash,
      payoutTraceHash,
      webhookVerificationHash,
      ledgerTraceHash,
      actionAuthorizationHash,
    ].join(":")
  );

  return {
    proofId: `prf_${caseRecord.caseId}_${Date.now()}`,
    caseId: caseRecord.caseId,
    obligationHash,
    payoutTraceHash,
    webhookVerificationHash,
    ledgerTraceHash,
    actionAuthorizationHash,
    masterProofHash,
    generatedAt: new Date().toISOString(),
    verifiedByNode: "landfall-sentinel-v4-auditor",
  };
}

/**
 * Cryptographically verifies that a RecoveryProof matches its underlying records.
 */
export function verifyRecoveryProof(
  proof: RecoveryProof,
  components: {
    obligation: ReliefObligation;
    payoutItem: PayoutItemRecord;
    webhookHistory?: WebhookEventRecord[];
    ledgerTrace?: LedgerTraceRecord;
    actionAuthorization: {
      authorizedBy: string;
      authorizationRole: string;
      passkeySignature: string;
      authorizedAction: SafeRecoveryAction;
      authorizedAt: string;
    };
  }
): { valid: boolean; error?: string } {
  const recomputed = generateRecoveryProof({
    caseRecord: { caseId: proof.caseId, detectedAt: proof.generatedAt, status: "RESOLVED_CLOSED" },
    ...components,
  });

  if (recomputed.obligationHash !== proof.obligationHash) {
    return { valid: false, error: "Obligation hash mismatch: underlying relief obligation has changed" };
  }
  if (recomputed.payoutTraceHash !== proof.payoutTraceHash) {
    return { valid: false, error: "Payout trace hash mismatch: payout status or attributes tampered" };
  }
  if (recomputed.webhookVerificationHash !== proof.webhookVerificationHash) {
    return { valid: false, error: "Webhook verification hash mismatch: provider webhook history altered" };
  }
  if (recomputed.ledgerTraceHash !== proof.ledgerTraceHash) {
    return { valid: false, error: "Ledger trace hash mismatch: financial accounting records modified" };
  }
  if (recomputed.actionAuthorizationHash !== proof.actionAuthorizationHash) {
    return { valid: false, error: "Authorization hash mismatch: human passkey signoff compromised" };
  }
  if (recomputed.masterProofHash !== proof.masterProofHash) {
    return { valid: false, error: "Master root hash mismatch: cryptographic proof chain invalidated" };
  }

  return { valid: true };
}

/**
 * Initializes a new RecoveryCase for an anomalous payout item.
 */
export function createRecoveryCase({
  obligation,
  payoutItem,
  webhookHistory = [],
  ledgerTrace,
}: {
  obligation: ReliefObligation;
  payoutItem: PayoutItemRecord;
  webhookHistory?: WebhookEventRecord[];
  ledgerTrace?: LedgerTraceRecord;
}): RecoveryCase {
  const caseId = `rcv_${payoutItem.payoutItemId}_${Date.now().toString(36)}`;
  const recommendation = evaluateRecoveryAction({
    obligation,
    payoutItem,
    webhookHistory,
    ledgerTrace,
  });

  let initialStatus: RecoveryCaseStatus = "OPEN_INVESTIGATING";
  if (payoutItem.status === "UNCLAIMED") initialStatus = "WAITING_ON_RECIPIENT";
  else if (payoutItem.status === "PENDING" || payoutItem.status === "ONHOLD")
    initialStatus = "WAITING_ON_PROVIDER";
  else if (payoutItem.status === "RETURNED" || payoutItem.status === "FAILED")
    initialStatus = "READY_FOR_REAUTHORIZATION";
  else if (payoutItem.status === "SUCCESS") initialStatus = "RESOLVED_CONFIRMED";

  return {
    caseId,
    obligationId: obligation.obligationId,
    payoutItemId: payoutItem.payoutItemId,
    payoutBatchId: payoutItem.payoutBatchId,
    status: initialStatus,
    detectedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    rootCause: payoutItem.status === "SUCCESS" ? "NONE" : payoutItem.status,
    investigationSummary: recommendation.reason,
    recommendation,
  };
}

