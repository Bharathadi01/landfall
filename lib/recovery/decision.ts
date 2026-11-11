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

/* ───────────────────────────────────────────────────────────────────────────
 * RECOVERY OPTIONS — which money-moving actions may even be PROPOSED for a case.
 *
 * A proposal is never money movement: it must still be approved by two people (one Finance) and is executed only
 * by the Treasurer. This gate decides what a coordinator is allowed to ask for. It is deterministic, has no AI
 * input, and its answers are the only ones the AI case officer may recommend (the model's choice is intersected
 * with `allowed`).
 *
 *   CANCEL_ITEM  ask PayPal to cancel an UNCLAIMED item so the funds return to the fund now
 *                allowed only when: status is UNCLAIMED, the resident hasn't said they received it, and either
 *                (a) the resident reported a barrier that makes claiming unrealistic, or
 *                (b) the PayPal claim window is nearly over (≤ FINAL_DAYS days left)
 *   REISSUE      prepare a NEW payout to replace one that did not land
 *                allowed only from RETURNED / FAILED / CANCELED (never while the original is claimable,
 *                credited, pending or on hold — that would be a duplicate)
 * ──────────────────────────────────────────────────────────────────────── */
export type RecoveryActionKind = "CANCEL_ITEM" | "REISSUE";

export const FINAL_CLAIM_DAYS = 5;
const BARRIERS_THAT_BLOCK_CLAIMING = new Set(["NO_PAYPAL_ACCOUNT", "CANT_SIGN_IN", "NO_PHONE"]);

export interface RecoveryCaseFacts {
  status: string;
  claimDaysLeft: number | null;
  barrier?: string | null;
  /** The resident said they received it (recipient-reported). */
  reportedReceived?: boolean;
}

export interface RecoveryOption {
  kind: RecoveryActionKind;
  allowed: boolean;
  /** Plain-language reason shown to the coordinator, whether allowed or not. */
  reason: string;
}

export function recoveryOptionsForCase(c: RecoveryCaseFacts): RecoveryOption[] {
  const s = c.status.toUpperCase();

  let cancel: RecoveryOption;
  if (s !== "UNCLAIMED") {
    cancel = { kind: "CANCEL_ITEM", allowed: false, reason: `Only an UNCLAIMED payment can be cancelled (this one is ${s}).` };
  } else if (c.reportedReceived) {
    cancel = { kind: "CANCEL_ITEM", allowed: false, reason: "The resident says they have the money; cancelling could take it back from them." };
  } else if (c.barrier && BARRIERS_THAT_BLOCK_CLAIMING.has(c.barrier)) {
    cancel = { kind: "CANCEL_ITEM", allowed: true, reason: "The resident reported they can’t claim it. Returning the funds lets the fund help them another way." };
  } else if (c.claimDaysLeft !== null && c.claimDaysLeft <= FINAL_CLAIM_DAYS) {
    cancel = { kind: "CANCEL_ITEM", allowed: true, reason: `Only ${c.claimDaysLeft} day${c.claimDaysLeft === 1 ? "" : "s"} left in PayPal’s claim window; PayPal will return it anyway.` };
  } else {
    cancel = { kind: "CANCEL_ITEM", allowed: false, reason: `Still claimable with ${c.claimDaysLeft ?? "several"} days left and no reported barrier. Help the resident claim it; do not cancel or resend.` };
  }

  const reissueStates = new Set(["RETURNED", "FAILED", "CANCELED"]);
  const reissue: RecoveryOption = reissueStates.has(s)
    ? { kind: "REISSUE", allowed: true, reason: s === "FAILED" ? "The payment failed and no money left the fund. A new payment needs two-person approval." : "The funds are back in the fund. A new payment needs two-person approval." }
    : { kind: "REISSUE", allowed: false, reason: `A replacement payment is only possible after the original is RETURNED, FAILED or CANCELED (this one is ${s}). Sending again now would be a duplicate.` };

  return [cancel, reissue];
}
