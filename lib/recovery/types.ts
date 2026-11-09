/**
 * PROOF-CARRYING RELIEF RECOVERY DOMAIN TYPES (§3, §4)
 *
 * Defines the core types for connecting:
 * Contribution -> Approved Obligation -> PayPal Payout Item -> Exception Investigation
 * -> Authorized Recovery Action -> Cryptographic Recovery Proof -> Final Ledger Reconciliation
 */

export type PayPalPayoutItemStatus =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "UNCLAIMED"
  | "RETURNED"
  | "ONHOLD"
  | "BLOCKED"
  | "REFUNDED"
  | "REVERSED";

export type RecoveryCaseStatus =
  | "OPEN_INVESTIGATING"
  | "WAITING_ON_RECIPIENT"
  | "WAITING_ON_PROVIDER"
  | "READY_FOR_REAUTHORIZATION"
  | "RETRY_PREPARED"
  | "RESOLVED_CONFIRMED"
  | "RESOLVED_CLOSED"
  | "ESCALATED";

export type SafeRecoveryAction =
  | "WAIT_AND_MONITOR"
  | "CONTACT_RECIPIENT"
  | "ESCALATE_TO_PAYPAL_OR_OPERATOR"
  | "PREPARE_CORRECTED_RETRY"
  | "PREPARE_NEW_APPROVED_PAYOUT"
  | "CLOSE_AS_RESOLVED"
  | "HOLD_INSUFFICIENT_EVIDENCE";

export interface ReliefObligation {
  obligationId: string;
  householdId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  targetAmountCents: number;
  currency: string;
  stormId: string;
  policyTranche: 1 | 2;
  approvedPlanId: string;
  approvedPlanHash: string;
  approvedAt: string;
  dualSignatures: {
    coordinatorKeyId: string;
    financeKeyId: string;
  };
}

export interface PayoutItemRecord {
  payoutBatchId: string;
  payoutItemId: string;
  paypalTransactionId?: string;
  status: PayPalPayoutItemStatus;
  amountCents: number;
  feeCents: number;
  currency: string;
  recipientIdentifier: string; // email or paypal_id
  submittedAt: string;
  lastUpdatedAt: string;
  rawStatusDescription?: string;
  errorDetails?: {
    name?: string;
    message?: string;
    issue?: string;
  };
}

export interface WebhookEventRecord {
  eventId: string;
  eventType: string; // e.g. PAYMENT.PAYOUTS-ITEM.UNCLAIMED, PAYMENT.PAYOUTS-ITEM.RETURNED
  eventTime: string;
  verifiedByPayPal: boolean;
  webhookId?: string;
  rawPayloadHash: string;
}

export interface LedgerTraceRecord {
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  amountCents: number;
  timestamp: string;
  reconciliationStatus: "MATCHED" | "DISCREPANCY" | "PENDING";
}

export interface RecoveryProof {
  proofId: string;
  caseId: string;
  obligationHash: string;
  payoutTraceHash: string;
  webhookVerificationHash: string;
  ledgerTraceHash: string;
  actionAuthorizationHash: string;
  masterProofHash: string; // SHA-256 root hash chaining all 5 component hashes
  generatedAt: string;
  verifiedByNode: string;
}

export interface RecoveryRecommendation {
  safeAction: SafeRecoveryAction;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  recipientGuidanceNotes?: string;
  requiresHumanApproval: boolean;
  requiresPasskeyReauthorization: boolean;
  allowLedgerAdjustment: boolean;
  canReissueImmediately: boolean; // INVARIANT: always FALSE if previous payout is active (e.g. UNCLAIMED)
}

export interface RecoveryCase {
  caseId: string;
  obligationId: string;
  payoutItemId: string;
  payoutBatchId: string;
  status: RecoveryCaseStatus;
  detectedAt: string;
  lastUpdatedAt: string;
  rootCause: string;
  investigationSummary: string;
  recommendation: RecoveryRecommendation;
  proof?: RecoveryProof;
  resolvedAt?: string;
  resolutionNotes?: string;
}

