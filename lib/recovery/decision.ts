/**
 * RECOVERY DECISION TABLE — PayPal Payouts v1 item status → the one safe next action.
 *
 * Pure and client-safe (no Node crypto) so the Command Center, the resident portal and the
 * server engine all read the SAME table. Provider status ≠ internal case state ≠ recipient receipt:
 * SUCCESS means "credited to the recipient's PayPal account", nothing more.
 *
 * INVARIANT: `canReissueImmediately` is false for every status. A second payout is only ever
 * prepared as a NEW plan that needs two-person passkey approval.
 */
import type { PayoutItemRecord, RecoveryRecommendation } from "./types";

export function recoveryDecisionForStatus(
  status: string,
  detail?: { errorMessage?: string; rawStatusDescription?: string }
): RecoveryRecommendation {

  switch (status) {
    case "SUCCESS":
      return {
        safeAction: "CLOSE_AS_RESOLVED",
        urgency: "LOW",
        reason: "Disbursement completed successfully on PayPal rails. Funds credited to recipient PayPal balance.",
        requiresHumanApproval: false,
        requiresPasskeyReauthorization: false,
        allowLedgerAdjustment: false,
        canReissueImmediately: false,
      };

    case "PENDING":
      return {
        safeAction: "WAIT_AND_MONITOR",
        urgency: "LOW",
        reason: "Payout item is currently queued or in-flight within PayPal processing systems.",
        requiresHumanApproval: false,
        requiresPasskeyReauthorization: false,
        allowLedgerAdjustment: false,
        canReissueImmediately: false,
      };

    case "UNCLAIMED":
      return {
        safeAction: "CONTACT_RECIPIENT",
        urgency: "HIGH",
        reason:
          "Payout delivered to PayPal escrow but recipient has not claimed it (unregistered or unverified email). INVARIANT: Payout remains active for 30 days. Do NOT reissue payout to avoid duplicate payments.",
        recipientGuidanceNotes:
          "Contact recipient via SMS/Phone. Advise them to log into PayPal using their registered email within 30 days to claim funds.",
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: false,
        allowLedgerAdjustment: false,
        canReissueImmediately: false, // Critical invariant: NEVER reissue while unclaimed
      };

    case "RETURNED":
      return {
        safeAction: "PREPARE_CORRECTED_RETRY",
        urgency: "HIGH",
        reason:
          "30-day PayPal claim window expired or recipient declined payment. Principal has been refunded back to Landfall's PayPal balance. Zero net loss confirmed.",
        recipientGuidanceNotes:
          "Verify updated contact details with recipient before issuing any corrected payout.",
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: true,
        allowLedgerAdjustment: true,
        canReissueImmediately: false,
      };

    case "FAILED":
      return {
        safeAction: "PREPARE_NEW_APPROVED_PAYOUT",
        urgency: "CRITICAL",
        reason: `Payout failed immediately at PayPal API boundary: ${
          detail?.errorMessage || detail?.rawStatusDescription || "Invalid recipient identifier or receiver country restriction"
        }. Principal was not debited. Safe to reallocate under new dual-custody authorization.`,
        recipientGuidanceNotes:
          "Investigate recipient payment routing method. Update recipient record to active PayPal account or manual relief distribution path.",
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: true,
        allowLedgerAdjustment: true,
        canReissueImmediately: false,
      };

    case "ONHOLD":
    case "BLOCKED":
      return {
        safeAction: "ESCALATE_TO_PAYPAL_OR_OPERATOR",
        urgency: "CRITICAL",
        reason:
          "Payout placed on administrative, compliance, or risk hold by PayPal. Do NOT attempt duplicate payout. Immediate operator intervention and PayPal Merchant Support escalation required.",
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: true,
        allowLedgerAdjustment: false,
        canReissueImmediately: false,
      };

    case "REFUNDED":
    case "REVERSED":
      return {
        safeAction: "PREPARE_CORRECTED_RETRY",
        urgency: "HIGH",
        reason:
          "Disbursement was reversed or refunded post-settlement. Ledger reversal transaction required prior to re-initiating assistance.",
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: true,
        allowLedgerAdjustment: true,
        canReissueImmediately: false,
      };

    default:
      return {
        safeAction: "HOLD_INSUFFICIENT_EVIDENCE",
        urgency: "HIGH",
        reason: `Unknown or unhandled payout status: ${status}. Withholding action until verifiable provider telemetry is obtained.`,
        requiresHumanApproval: true,
        requiresPasskeyReauthorization: true,
        allowLedgerAdjustment: false,
        canReissueImmediately: false,
      };
  }
}
