/**
 * FOUR INDEPENDENT VERIFICATION CHIPS (§4.4)
 * Invariants:
 * 1. Payment Channel, Residence Evidence, Exposure, and Need are orthogonal checks.
 * 2. Missing paperwork or documents NEVER lowers policy priority tier or payout amount.
 * 3. Document text extraction is always disclaimed: "Extracted, not authenticated".
 * 4. Deterministic computation with no AI involvement.
 */

import type {
  FourChecks,
  PaymentChannelType,
  RecipientPath,
  EvidenceLevel,
} from "./types";

export interface ComputeFourChecksParams {
  paymentChannel?: PaymentChannelType;
  recipientPath?: RecipientPath;
  isPaymentVerified?: boolean;
  evidenceLevel: EvidenceLevel;
  isExposureConfirmed: boolean;
  hasExposureDisagreement?: boolean;
  priorityTier: number;
  priorityCode: string;
  tranche2ImpactConfirmed?: boolean;
}

/**
 * Computes the four independent verification chips for a recipient household.
 */
export function computeFourChecks({
  paymentChannel,
  recipientPath,
  isPaymentVerified,
  evidenceLevel,
  isExposureConfirmed,
  hasExposureDisagreement = false,
  priorityTier,
  priorityCode,
  tranche2ImpactConfirmed = false,
}: ComputeFourChecksParams): FourChecks {
  // Resolve effective payment channel type
  const effectiveChannel: PaymentChannelType =
    paymentChannel ||
    (recipientPath === "LINKED_PAYPAL"
      ? "PAYPAL_ID"
      : recipientPath === "EMAIL_CLAIM"
      ? "EMAIL"
      : recipientPath === "MANUAL_CHANNEL"
      ? "MANUAL"
      : "UNSET");

  // Determine verification status: EMAIL_CLAIM by definition means pending claim link unless explicitly set verified
  const verified =
    isPaymentVerified !== undefined
      ? isPaymentVerified
      : recipientPath === "EMAIL_CLAIM"
      ? false
      : true;

  // 1. Payment Channel Check
  let channelChip: FourChecks["paymentChannel"];
  switch (effectiveChannel) {
    case "PAYPAL_ID":
      channelChip = {
        status: verified ? "VERIFIED" : "UNRESOLVED",
        label: verified ? "Verified PayPal" : "Unverified Payer ID",
        detail: verified
          ? "Direct account payout (expected SUCCESS)"
          : "Payer ID provided without OAuth verification",
        type: "PAYPAL_ID",
      };
      break;
    case "EMAIL":
      channelChip = {
        status: verified ? "VERIFIED" : "CLAIM_LINK",
        label: verified ? "Verified Email Payout" : "PayPal Claim Link",
        detail: verified
          ? "Direct payout to verified email (instant transfer)"
          : "Arrives via email claim (expected UNCLAIMED until claimed)",
        type: "EMAIL",
      };
      break;
    case "MANUAL":
      channelChip = {
        status: "MANUAL",
        label: "Manual Offline Channel",
        detail: "Check or cash card (never sent to PayPal)",
        type: "MANUAL",
      };
      break;
    case "UNSET":
    default:
      channelChip = {
        status: "UNRESOLVED",
        label: "Unresolved Channel",
        detail: "Payment route not configured",
        type: "UNSET",
      };
      break;
  }

  // 2. Residence Evidence Check (preserving input level format)
  let residenceEvidence: FourChecks["residenceEvidence"];
  switch (evidenceLevel) {
    case "DOCUMENT_PROVIDED":
    case "DOCUMENT":
      residenceEvidence = {
        level: evidenceLevel,
        label: "Document Verified",
        verified: true,
        disclaimer: "Extracted, not authenticated",
      };
      break;
    case "VOLUNTEER_ATTESTATION":
    case "ATTESTED":
      residenceEvidence = {
        level: evidenceLevel,
        label: "Volunteer Attested",
        verified: true,
      };
      break;
    case "SELF_DECLARED":
    default:
      residenceEvidence = {
        level: "SELF_DECLARED",
        label: "Self-Declared",
        verified: true,
      };
      break;
  }

  // 3. Exposure Check
  let exposure: FourChecks["exposure"];
  if (hasExposureDisagreement) {
    exposure = {
      status: "NEEDS_REVIEW",
      label: "Needs Review (Point Disagreement)",
      pointChecked: true,
    };
  } else if (isExposureConfirmed) {
    exposure = {
      status: "CONFIRMED",
      label: "In Warning Area",
      pointChecked: true,
    };
  } else {
    exposure = {
      status: "OUT_OF_AREA",
      label: "Outside Warning Area",
      pointChecked: true,
    };
  }

  // 4. Need Check (Deterministic Policy Engine result)
  const need: FourChecks["need"] = {
    priorityTier,
    code: priorityCode,
    label: `Tier ${priorityTier} (${priorityCode})`,
    tranche2ImpactConfirmed,
  };

  return {
    paymentChannel: channelChip,
    residenceEvidence,
    exposure,
    need,
  };
}
