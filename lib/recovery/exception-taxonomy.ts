/**
 * PAYOUT EXCEPTION TAXONOMY & DETERMINISTIC DECISION MATRIX (§2.3, §21.3)
 *
 * Implements the 18 typed, exhaustive payout exception categories and the
 * deterministic safe-resolution decision engine for relief payout recovery.
 *
 * INVARIANTS:
 * 1. DETERMINISTIC AUTHORITY: Policy engine, NOT the LLM, decides legal recovery actions.
 * 2. NO SILENT REISSUANCE: Items in PENDING, UNCLAIMED, ONHOLD, BLOCKED, or STALE
 *    states are strictly barred from reissuance.
 * 3. EXHAUSTIVE COVERAGE: Every abnormal provider or ledger condition maps to an explicit rule.
 */

import type {
  PayPalPayoutItemStatus,
  SafeRecoveryAction,
  ReliefObligation,
  PayoutItemRecord,
  WebhookEventRecord,
  LedgerTraceRecord,
} from "./types";

export type ExceptionCategory =
  | "PENDING_TOO_LONG"
  | "UNCLAIMED_RECIPIENT_ACCESS"
  | "RETURNED_FUNDS_UNCONFIRMED"
  | "RETURNED_FUNDS_CONFIRMED"
  | "FAILED_PROVIDER_REQUEST"
  | "ONHOLD_REVIEW"
  | "BLOCKED_PROVIDER_REQUEST"
  | "REFUNDED_BY_RECIPIENT"
  | "REVERSED_PROVIDER_ITEM"
  | "STALE_PROVIDER_EVIDENCE"
  | "CONTRADICTORY_EVIDENCE"
  | "DUPLICATE_ATTEMPT_RISK"
  | "MISSING_OBLIGATION_LINK"
  | "RECIPIENT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "RESERVE_OR_COMMITMENT_BREACH"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "UNKNOWN_PROVIDER_STATE";

export interface ExceptionDecisionRule {
  category: ExceptionCategory;
  triggerPredicate: string;
  requiredEvidence: string[];
  forbiddenActions: SafeRecoveryAction[];
  permittedNextActions: SafeRecoveryAction[];
  primarySafeAction: SafeRecoveryAction;
  humanRole: "FINANCE" | "OPERATIONS" | "AUDITOR" | "NONE";
  expiryFreshnessMs: number;
  resolutionCondition: string;
  isHardBlock: boolean;
  canReissueImmediately: boolean;
  reason: string;
}

export interface ExceptionEvaluationInput {
  obligation?: ReliefObligation;
  payoutItem?: PayoutItemRecord;
  webhookHistory?: WebhookEventRecord[];
  ledgerTrace?: LedgerTraceRecord;
  balanceSnapshot?: {
    availableCents: number;
    reserveProtectedCents: number;
    currency: string;
    fetchedAt: string;
    isStale: boolean;
  };
  inFlightAttemptsCount?: number;
  itemAgeHours?: number;
}

/**
 * 18 Exhaustive Rule Definitions
 */
export const EXCEPTION_RULES: Record<ExceptionCategory, ExceptionDecisionRule> = {
  PENDING_TOO_LONG: {
    category: "PENDING_TOO_LONG",
    triggerPredicate: "payoutItem.status === 'PENDING' && itemAgeHours > 24",
    requiredEvidence: ["payout_item_detail", "provider_event_timestamp"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["WAIT_AND_MONITOR", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "WAIT_AND_MONITOR",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 3600000, // 1 hour
    resolutionCondition: "Provider updates status to terminal state (SUCCESS, FAILED, or RETURNED)",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Payout remains pending in PayPal rails. Reissuing would risk duplicate disbursement.",
  },

  UNCLAIMED_RECIPIENT_ACCESS: {
    category: "UNCLAIMED_RECIPIENT_ACCESS",
    triggerPredicate: "payoutItem.status === 'UNCLAIMED'",
    requiredEvidence: ["payout_item_detail", "verified_unclaimed_webhook"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["CONTACT_RECIPIENT", "WAIT_AND_MONITOR"],
    primarySafeAction: "CONTACT_RECIPIENT",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 86400000, // 24 hours
    resolutionCondition: "Recipient claims funds in PayPal, or 30-day window expires and funds return",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Funds are active in PayPal 30-day escrow. Duplicate payout strictly prohibited.",
  },

  RETURNED_FUNDS_UNCONFIRMED: {
    category: "RETURNED_FUNDS_UNCONFIRMED",
    triggerPredicate: "payoutItem.status === 'RETURNED' && !ledgerTrace",
    requiredEvidence: ["provider_item_return", "reporting_balance_snapshot"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 1800000, // 30 mins
    resolutionCondition: "PayPal reporting balance confirms returned credit and ledger journal is posted",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Provider indicates return, but internal ledger reconciliation has not confirmed credit.",
  },

  RETURNED_FUNDS_CONFIRMED: {
    category: "RETURNED_FUNDS_CONFIRMED",
    triggerPredicate: "payoutItem.status === 'RETURNED' && ledgerTrace?.reconciliationStatus === 'MATCHED'",
    requiredEvidence: ["provider_item_return", "ledger_return_posting", "dual_passkey_auth"],
    forbiddenActions: [],
    permittedNextActions: ["PREPARE_CORRECTED_RETRY", "CLOSE_AS_RESOLVED"],
    primarySafeAction: "PREPARE_CORRECTED_RETRY",
    humanRole: "FINANCE",
    expiryFreshnessMs: 86400000, // 24 hours
    resolutionCondition: "New dual-custody approved payout is executed or obligation is resolved via alternative aid",
    isHardBlock: false,
    canReissueImmediately: false, // Requires new dual passkey authorization
    reason: "Principal successfully returned to Landfall PayPal balance. Safe to re-route under new authorization.",
  },

  FAILED_PROVIDER_REQUEST: {
    category: "FAILED_PROVIDER_REQUEST",
    triggerPredicate: "payoutItem.status === 'FAILED'",
    requiredEvidence: ["provider_failure_reason", "zero_debit_ledger_audit"],
    forbiddenActions: [],
    permittedNextActions: ["PREPARE_NEW_APPROVED_PAYOUT", "CLOSE_AS_RESOLVED"],
    primarySafeAction: "PREPARE_NEW_APPROVED_PAYOUT",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 86400000, // 24 hours
    resolutionCondition: "Updated recipient route verified and new dual-custody plan authorized",
    isHardBlock: false,
    canReissueImmediately: false, // Requires human reauthorization
    reason: "Payout failed at API boundary. Funds never debited. Safe to prepare alternative distribution.",
  },

  ONHOLD_REVIEW: {
    category: "ONHOLD_REVIEW",
    triggerPredicate: "payoutItem.status === 'ONHOLD'",
    requiredEvidence: ["provider_item_detail", "merchant_support_case"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "ESCALATE_TO_PAYPAL_OR_OPERATOR",
    humanRole: "FINANCE",
    expiryFreshnessMs: 3600000, // 1 hour
    resolutionCondition: "PayPal risk/compliance hold lifted or transaction returned",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "PayPal risk review active. Manual operator escalation required; programmatic retry blocked.",
  },

  BLOCKED_PROVIDER_REQUEST: {
    category: "BLOCKED_PROVIDER_REQUEST",
    triggerPredicate: "payoutItem.status === 'BLOCKED'",
    requiredEvidence: ["compliance_block_notice", "operator_investigation"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "ESCALATE_TO_PAYPAL_OR_OPERATOR",
    humanRole: "FINANCE",
    expiryFreshnessMs: 3600000, // 1 hour
    resolutionCondition: "Regulatory or account block resolved with PayPal Merchant Support",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Transaction blocked by PayPal policy or receiver restriction. Automatic reissue blocked.",
  },

  REFUNDED_BY_RECIPIENT: {
    category: "REFUNDED_BY_RECIPIENT",
    triggerPredicate: "payoutItem.status === 'REFUNDED'",
    requiredEvidence: ["provider_refund_notice", "ledger_reversal_entry"],
    forbiddenActions: [],
    permittedNextActions: ["PREPARE_CORRECTED_RETRY", "CLOSE_AS_RESOLVED"],
    primarySafeAction: "PREPARE_CORRECTED_RETRY",
    humanRole: "FINANCE",
    expiryFreshnessMs: 86400000,
    resolutionCondition: "Ledger reversal posted and replacement assistance agreed with recipient",
    isHardBlock: false,
    canReissueImmediately: false,
    reason: "Disbursement was refunded post-settlement. Ledger reversal verified.",
  },

  REVERSED_PROVIDER_ITEM: {
    category: "REVERSED_PROVIDER_ITEM",
    triggerPredicate: "payoutItem.status === 'REVERSED'",
    requiredEvidence: ["reversal_transaction_record", "fiduciary_audit"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 3600000,
    resolutionCondition: "Root cause of reversal audited and settled with provider",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Transaction reversed by PayPal. Operational investigation required before any adjustment.",
  },

  STALE_PROVIDER_EVIDENCE: {
    category: "STALE_PROVIDER_EVIDENCE",
    triggerPredicate: "balanceSnapshot?.isStale === true",
    requiredEvidence: ["live_reporting_refresh"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["WAIT_AND_MONITOR", "HOLD_INSUFFICIENT_EVIDENCE"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 600000, // 10 minutes
    resolutionCondition: "PayPal Reporting API successfully refreshed within 10-minute SLA",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Balance telemetry exceeds 10-minute freshness threshold. Solvency checks frozen.",
  },

  CONTRADICTORY_EVIDENCE: {
    category: "CONTRADICTORY_EVIDENCE",
    triggerPredicate: "payoutItem.amountCents !== ledgerTrace?.amountCents",
    requiredEvidence: ["audit_discrepancy_log", "source_verification"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY", "CLOSE_AS_RESOLVED"],
    permittedNextActions: ["ESCALATE_TO_PAYPAL_OR_OPERATOR", "HOLD_INSUFFICIENT_EVIDENCE"],
    primarySafeAction: "ESCALATE_TO_PAYPAL_OR_OPERATOR",
    humanRole: "AUDITOR",
    expiryFreshnessMs: 1800000,
    resolutionCondition: "Audit reconciliation run resolves discrepancy between provider and ledger",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Conflict detected between provider payout amount and general ledger journal.",
  },

  DUPLICATE_ATTEMPT_RISK: {
    category: "DUPLICATE_ATTEMPT_RISK",
    triggerPredicate: "inFlightAttemptsCount > 1",
    requiredEvidence: ["outbox_lock_lease", "sender_batch_id_audit"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 600000,
    resolutionCondition: "Duplicate outbox attempts pruned or confirmed mutually exclusive",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Multiple in-flight attempts detected for the same relief obligation. Hard freeze.",
  },

  MISSING_OBLIGATION_LINK: {
    category: "MISSING_OBLIGATION_LINK",
    triggerPredicate: "!obligation",
    requiredEvidence: ["manual_obligation_correlation"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 86400000,
    resolutionCondition: "Provider item manually matched to valid approved relief obligation",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Provider payout item cannot be correlated to any approved relief obligation.",
  },

  RECIPIENT_MISMATCH: {
    category: "RECIPIENT_MISMATCH",
    triggerPredicate: "payoutItem.recipientIdentifier !== obligation.recipientEmail",
    requiredEvidence: ["recipient_identity_audit"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["ESCALATE_TO_PAYPAL_OR_OPERATOR", "HOLD_INSUFFICIENT_EVIDENCE"],
    primarySafeAction: "ESCALATE_TO_PAYPAL_OR_OPERATOR",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 86400000,
    resolutionCondition: "Recipient profile updated and re-verified through intake verification",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Payout destination does not match validated recipient contact reference.",
  },

  CURRENCY_MISMATCH: {
    category: "CURRENCY_MISMATCH",
    triggerPredicate: "payoutItem.currency !== obligation.currency",
    requiredEvidence: ["currency_conversion_audit"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 3600000,
    resolutionCondition: "Single-currency programme alignment verified",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Provider currency does not match programme obligation currency.",
  },

  RESERVE_OR_COMMITMENT_BREACH: {
    category: "RESERVE_OR_COMMITMENT_BREACH",
    triggerPredicate: "balanceSnapshot.availableCents - balanceSnapshot.reserveProtectedCents < obligation.targetAmountCents",
    requiredEvidence: ["treasury_waterfall_audit"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
    permittedNextActions: ["WAIT_AND_MONITOR", "HOLD_INSUFFICIENT_EVIDENCE"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "FINANCE",
    expiryFreshnessMs: 600000,
    resolutionCondition: "Treasury balance replenished above 30% reserve floor",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Issuing recovery payout would breach the mandatory 30% operating reserve floor.",
  },

  WEBHOOK_SIGNATURE_INVALID: {
    category: "WEBHOOK_SIGNATURE_INVALID",
    triggerPredicate: "webhook.verifiedByPayPal === false",
    requiredEvidence: ["quarantine_log", "paypal_signature_recheck"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY", "CLOSE_AS_RESOLVED"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "AUDITOR",
    expiryFreshnessMs: 86400000,
    resolutionCondition: "Webhook discarded or re-verified via POST /v1/notifications/verify-webhook-signature",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Webhook signature failed cryptographic verification. Quarantined; state change rejected.",
  },

  UNKNOWN_PROVIDER_STATE: {
    category: "UNKNOWN_PROVIDER_STATE",
    triggerPredicate: "status not in canonical PayPal Payouts v1 vocabulary",
    requiredEvidence: ["raw_provider_payload", "api_schema_investigation"],
    forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY", "CLOSE_AS_RESOLVED"],
    permittedNextActions: ["HOLD_INSUFFICIENT_EVIDENCE", "ESCALATE_TO_PAYPAL_OR_OPERATOR"],
    primarySafeAction: "HOLD_INSUFFICIENT_EVIDENCE",
    humanRole: "OPERATIONS",
    expiryFreshnessMs: 3600000,
    resolutionCondition: "Provider response mapped to documented PayPal status",
    isHardBlock: true,
    canReissueImmediately: false,
    reason: "Unknown provider status encountered. Coercion to success or failure prohibited.",
  },
};

/**
 * Classifies an incoming payout observation into the authoritative exception rule
 */
export function classifyPayoutException(input: ExceptionEvaluationInput): ExceptionDecisionRule {
  const {
    obligation,
    payoutItem,
    webhookHistory = [],
    ledgerTrace,
    balanceSnapshot,
    inFlightAttemptsCount = 1,
    itemAgeHours = 0,
  } = input;

  // 1. Missing obligation link check
  if (!obligation) {
    return EXCEPTION_RULES.MISSING_OBLIGATION_LINK;
  }

  // 2. Webhook signature invalid check
  if (webhookHistory.some((w) => w.verifiedByPayPal === false)) {
    return EXCEPTION_RULES.WEBHOOK_SIGNATURE_INVALID;
  }

  // 3. Stale provider evidence check
  if (balanceSnapshot?.isStale) {
    return EXCEPTION_RULES.STALE_PROVIDER_EVIDENCE;
  }

  // 4. Duplicate attempt risk check
  if (inFlightAttemptsCount > 1) {
    return EXCEPTION_RULES.DUPLICATE_ATTEMPT_RISK;
  }

  // If no payout item yet, return monitoring
  if (!payoutItem) {
    return EXCEPTION_RULES.UNKNOWN_PROVIDER_STATE;
  }

  // 5. Currency mismatch check
  if (payoutItem.currency !== obligation.currency) {
    return EXCEPTION_RULES.CURRENCY_MISMATCH;
  }

  // 6. Recipient mismatch check
  if (
    obligation.recipientEmail &&
    payoutItem.recipientIdentifier &&
    obligation.recipientEmail.toLowerCase() !== payoutItem.recipientIdentifier.toLowerCase()
  ) {
    return EXCEPTION_RULES.RECIPIENT_MISMATCH;
  }

  // 7. Contradictory evidence (ledger amount vs payout item amount)
  if (ledgerTrace && ledgerTrace.amountCents !== payoutItem.amountCents) {
    return EXCEPTION_RULES.CONTRADICTORY_EVIDENCE;
  }

  // 8. Reserve or commitment breach check
  if (
    balanceSnapshot &&
    balanceSnapshot.availableCents - balanceSnapshot.reserveProtectedCents < obligation.targetAmountCents
  ) {
    return EXCEPTION_RULES.RESERVE_OR_COMMITMENT_BREACH;
  }

  // 9. Authoritative PayPal Item Status Rules
  const status = payoutItem.status;

  if (status === "UNCLAIMED") {
    return EXCEPTION_RULES.UNCLAIMED_RECIPIENT_ACCESS;
  }

  if (status === "PENDING") {
    if (itemAgeHours > 24) return EXCEPTION_RULES.PENDING_TOO_LONG;
    return EXCEPTION_RULES.PENDING_TOO_LONG; // Pending always waits and monitors
  }

  if (status === "RETURNED") {
    if (ledgerTrace && ledgerTrace.reconciliationStatus === "MATCHED") {
      return EXCEPTION_RULES.RETURNED_FUNDS_CONFIRMED;
    }
    return EXCEPTION_RULES.RETURNED_FUNDS_UNCONFIRMED;
  }

  if (status === "FAILED") {
    return EXCEPTION_RULES.FAILED_PROVIDER_REQUEST;
  }

  if (status === "ONHOLD") {
    return EXCEPTION_RULES.ONHOLD_REVIEW;
  }

  if (status === "BLOCKED") {
    return EXCEPTION_RULES.BLOCKED_PROVIDER_REQUEST;
  }

  if (status === "REFUNDED") {
    return EXCEPTION_RULES.REFUNDED_BY_RECIPIENT;
  }

  if (status === "REVERSED") {
    return EXCEPTION_RULES.REVERSED_PROVIDER_ITEM;
  }

  if (status === "SUCCESS") {
    // Return a dummy pseudo-rule for successful terminal state
    return {
      category: "RETURNED_FUNDS_CONFIRMED", // Placeholder
      triggerPredicate: "payoutItem.status === 'SUCCESS'",
      requiredEvidence: ["provider_success_detail"],
      forbiddenActions: ["PREPARE_NEW_APPROVED_PAYOUT", "PREPARE_CORRECTED_RETRY"],
      permittedNextActions: ["CLOSE_AS_RESOLVED"],
      primarySafeAction: "CLOSE_AS_RESOLVED",
      humanRole: "NONE",
      expiryFreshnessMs: 86400000,
      resolutionCondition: "Disbursement completed on PayPal rails",
      isHardBlock: false,
      canReissueImmediately: false,
      reason: "Payout succeeded. Funds credited to recipient account.",
    };
  }

  return EXCEPTION_RULES.UNKNOWN_PROVIDER_STATE;
}

