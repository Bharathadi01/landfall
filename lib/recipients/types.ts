/**
 * RECIPIENT SYSTEM TYPES & INTERFACES (§4.4)
 * Authoritative dual-axis recipient architecture:
 * 1. Enrollment Method: SELF_SERVICE | ASSISTED | POST_EVENT
 * 2. Payment Channel: PAYPAL_ID | EMAIL | MANUAL | UNSET
 */

export type EnrollmentMethod = "SELF_SERVICE" | "ASSISTED" | "POST_EVENT";
export type PaymentChannelType = "PAYPAL_ID" | "EMAIL" | "MANUAL" | "UNSET";

/**
 * Backward-compatible & UI projection path:
 * - LINKED_PAYPAL: Confirmed PayPal identity / Payer ID
 * - EMAIL_CLAIM: PayPal email recipient (may require claim link if account pending)
 * - ASSISTED: Registered via volunteer proxy
 * - MANUAL_CHANNEL: Non-digital cash card / check / local disbursement
 */
export type RecipientPath = "LINKED_PAYPAL" | "EMAIL_CLAIM" | "ASSISTED" | "MANUAL_CHANNEL";

export type EvidenceLevel = "SELF_DECLARED" | "VOLUNTEER_ATTESTATION" | "DOCUMENT_PROVIDED" | "ATTESTED" | "DOCUMENT";

export type ConsentPurpose =
  | "TERMS_OF_SERVICE"
  | "PAYMENT_ROUTING"
  | "LOCATION_TRACKING"
  | "EMERGENCY_DISCLOSURE";

export type ConsentMethod = "SELF_DIGITAL" | "VERBAL_TO_VOLUNTEER" | "PAPER_AFFIDAVIT";

export interface FourChecks {
  paymentChannel: {
    status: "VERIFIED" | "CLAIM_LINK" | "MANUAL" | "UNRESOLVED";
    label: string;
    detail: string;
    type: PaymentChannelType;
  };
  residenceEvidence: {
    level: EvidenceLevel;
    label: string;
    verified: boolean;
    disclaimer?: string;
  };
  exposure: {
    status: "CONFIRMED" | "OUT_OF_AREA" | "NEEDS_REVIEW";
    label: string;
    pointChecked: boolean;
  };
  need: {
    priorityTier: number;
    code: string;
    label: string;
    tranche2ImpactConfirmed: boolean;
  };
}

export interface EnrollmentInput {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  zone?: string;
  language?: string; // "en" | "es" | "ht" | "vi" | "zh"
  enrollmentMethod?: EnrollmentMethod;
  paymentChannel?: PaymentChannelType;
  recipientPath?: RecipientPath;
  paypalEmailOrId?: string;
  assistedByVolunteerId?: string;
  volunteerAttestationNote?: string;
  evidenceLevel: EvidenceLevel;
  documentSnippet?: string; // Extracted snippet from utility bill, lease, mail
  isDisplaced?: boolean;
  currentAddress?: string;
  currentLat?: number;
  currentLng?: number;
  hasMedicalDevice?: boolean;
  isElderlyLivingAlone?: boolean;
  hasDisability?: boolean;
  hasNoVehicleInSurgeZone?: boolean;
  hasChildrenUnder5?: boolean;
  numMembers?: number;
  consentAccepted: boolean;
  consentMethod?: ConsentMethod;
  consents?: Record<ConsentPurpose, boolean>;
}

export interface StoredHouseholdCase {
  id: string;
  encryptedName: string;
  encryptedAddress: string;
  lat?: number; // Landfall / original residence coordinates
  lng?: number;
  currentLat?: number;
  currentLng?: number;
  isDisplaced: boolean;
  zone: string;
  language: string;
  enrollmentMethod: EnrollmentMethod;
  paymentChannel: PaymentChannelType;
  recipientPath: RecipientPath;
  recipientVersion: number;
  receiver: string;
  evidenceLevel: EvidenceLevel;
  documentNote?: string;
  assistedByVolunteerId?: string;
  hasMedicalDevice: boolean;
  isElderlyLivingAlone: boolean;
  hasDisability: boolean;
  hasNoVehicleInSurgeZone: boolean;
  hasChildrenUnder5: boolean;
  numMembers: number;
  lastReconfirmedAt: string; // ISO
  consentRecordedAt: string;
  status: "draft" | "submitted" | "verified" | "needs_review" | "rejected";
}

export interface ConsentRecord {
  id: string;
  householdId: string;
  purpose: ConsentPurpose;
  consentVersion: string;
  language: string;
  acceptedAt: string;
  actor: string;
  method: ConsentMethod;
  withdrawnAt?: string;
}

export interface VolunteerAttestationRecord {
  id: string;
  householdId: string;
  volunteerId: string;
  attestationType: "RESIDENCE_VERIFIED" | "PHYSICAL_INSPECTION" | "COMMUNITY_VOUCH";
  isDirectObservation: boolean;
  statementNote: string;
  createdAt: string;
}

export interface LocationHistoryEntry {
  id: string;
  householdId: string;
  address: string;
  lat: number;
  lng: number;
  isDisplaced: boolean;
  recordedBy: string;
  effectiveFrom: string;
  createdAt: string;
}

export interface AppealInput {
  householdId: string;
  category?: "TIER_DISPUTE" | "AMOUNT_DISPUTE" | "EXPOSURE_DISPUTE" | "EVIDENCE_SUPPLEMENT" | "OTHER";
  reason: string;
  contactPreference?: string;
}

export interface AppealRecord {
  id: string;
  householdId: string;
  caseReference: string;
  category: "TIER_DISPUTE" | "AMOUNT_DISPUTE" | "EXPOSURE_DISPUTE" | "EVIDENCE_SUPPLEMENT" | "OTHER";
  explanation: string;
  status: "SUBMITTED" | "NEEDS_INFORMATION" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  slaDeadline: string; // ISO, strictly 24 hours from creation
  assignedReviewerId?: string;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Projects orthogonal EnrollmentMethod + PaymentChannelType into display RecipientPath.
 */
export function projectRecipientPath(
  method: EnrollmentMethod,
  channel: PaymentChannelType
): RecipientPath {
  if (channel === "MANUAL") {
    return "MANUAL_CHANNEL";
  }
  if (channel === "PAYPAL_ID") {
    return "LINKED_PAYPAL";
  }
  if (method === "ASSISTED" && channel === "UNSET") {
    return "ASSISTED";
  }
  if (channel === "EMAIL") {
    return "EMAIL_CLAIM";
  }
  return method === "ASSISTED" ? "ASSISTED" : "EMAIL_CLAIM";
}
