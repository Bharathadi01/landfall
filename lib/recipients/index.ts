/**
 * RECIPIENT MANAGEMENT & INCLUSION SERVICE (§4.4)
 * Golden Rules:
 * - Four recipient paths: LINKED_PAYPAL, EMAIL_CLAIM, ASSISTED, MANUAL_CHANNEL
 * - Evidence ladder: SELF_DECLARED, ATTESTED, DOCUMENT (extracted, not authenticated)
 * - Four independent chips: Payment Channel, Residence Evidence, Exposure, Need
 * - No government ID, SSN or immigration status ever requested.
 * - Missing paperwork never lowers priority (routes to human review).
 */

import { encryptPII, decryptPII } from "@/lib/security/encryption";
import { type Role, logPIIAccess } from "@/lib/security/rbac";
import crypto from "crypto";

export type RecipientPath = "LINKED_PAYPAL" | "EMAIL_CLAIM" | "ASSISTED" | "MANUAL_CHANNEL";
export type EvidenceLevel = "SELF_DECLARED" | "ATTESTED" | "DOCUMENT";

export interface FourChecks {
  paymentChannel: {
    status: "VERIFIED" | "CLAIM_LINK" | "MANUAL" | "UNRESOLVED";
    label: string;
    detail: string;
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
  recipientPath: RecipientPath;
  paypalEmailOrId?: string;
  assistedByVolunteerId?: string;
  evidenceLevel: EvidenceLevel;
  documentSnippet?: string; // Extracted snippet from utility bill, lease, mail
  hasMedicalDevice?: boolean;
  isElderlyLivingAlone?: boolean;
  hasDisability?: boolean;
  hasNoVehicleInSurgeZone?: boolean;
  hasChildrenUnder5?: boolean;
  numMembers?: number;
  consentAccepted: boolean;
}

export interface StoredHouseholdCase {
  id: string;
  encryptedName: string;
  encryptedAddress: string;
  lat?: number;
  lng?: number;
  zone: string;
  language: string;
  recipientPath: RecipientPath;
  receiver: string;
  evidenceLevel: EvidenceLevel;
  documentNote?: string;
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

export interface AppealInput {
  householdId: string;
  reason: string;
  contactPreference: string;
}

export interface AppealRecord {
  id: string;
  householdId: string;
  reason: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  slaDeadline: string; // ISO, e.g. 24h SLA
  createdAt: string;
  resolvedAt?: string;
  resolverNote?: string;
}

/**
 * Computes the four independent verification chips (§4.4) for a household.
 */
export function computeFourChecks({
  recipientPath,
  evidenceLevel,
  isExposureConfirmed,
  hasExposureDisagreement = false,
  priorityTier,
  priorityCode,
  tranche2ImpactConfirmed = false,
}: {
  recipientPath: RecipientPath;
  evidenceLevel: EvidenceLevel;
  isExposureConfirmed: boolean;
  hasExposureDisagreement?: boolean;
  priorityTier: number;
  priorityCode: string;
  tranche2ImpactConfirmed?: boolean;
}): FourChecks {
  // 1. Payment Channel Check
  let paymentChannel: FourChecks["paymentChannel"];
  switch (recipientPath) {
    case "LINKED_PAYPAL":
      paymentChannel = {
        status: "VERIFIED",
        label: "Verified PayPal",
        detail: "Direct account payout (expected SUCCESS)",
      };
      break;
    case "EMAIL_CLAIM":
      paymentChannel = {
        status: "CLAIM_LINK",
        label: "PayPal Claim Link",
        detail: "Arrives via email claim (expected UNCLAIMED until claimed)",
      };
      break;
    case "ASSISTED":
      paymentChannel = {
        status: "VERIFIED",
        label: "Assisted Enrollment",
        detail: "Volunteer-assisted enrollment channel",
      };
      break;
    case "MANUAL_CHANNEL":
      paymentChannel = {
        status: "MANUAL",
        label: "Manual Offline Channel",
        detail: "Check or cash card (never sent to PayPal)",
      };
      break;
    default:
      paymentChannel = {
        status: "UNRESOLVED",
        label: "Unresolved",
        detail: "Channel not yet verified",
      };
  }

  // 2. Residence Evidence Check
  let residenceEvidence: FourChecks["residenceEvidence"];
  switch (evidenceLevel) {
    case "DOCUMENT":
      residenceEvidence = {
        level: "DOCUMENT",
        label: "Document Verified",
        verified: true,
        disclaimer: "Extracted, not authenticated",
      };
      break;
    case "ATTESTED":
      residenceEvidence = {
        level: "ATTESTED",
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

  // 4. Need Check
  const need: FourChecks["need"] = {
    priorityTier,
    code: priorityCode,
    label: `Tier ${priorityTier} (${priorityCode})`,
    tranche2ImpactConfirmed,
  };

  return {
    paymentChannel,
    residenceEvidence,
    exposure,
    need,
  };
}

/**
 * Checks whether a household's reconfirmation is still valid for Tranche 1.
 * Tranche 1 requires reconfirmation within 12 months (§4.4).
 */
export function isReconfirmationValid(lastReconfirmedAt: string, now: Date = new Date()): boolean {
  const reconfirmedDate = new Date(lastReconfirmedAt);
  const diffMs = now.getTime() - reconfirmedDate.getTime();
  const maxAgeMs = 365 * 24 * 60 * 60 * 1000; // 365 days
  return diffMs <= maxAgeMs && diffMs >= 0;
}

/**
 * Creates an encrypted household case record.
 */
export function createEncryptedHouseholdCase(input: EnrollmentInput): StoredHouseholdCase {
  if (!input.consentAccepted) {
    throw new Error("Consent is mandatory for enrollment under data minimization rules (§6).");
  }

  const encryptedName = encryptPII(input.name);
  const encryptedAddress = encryptPII(input.address);
  if (!encryptedName || !encryptedAddress) {
    throw new Error("Failed to encrypt sensitive personal information.");
  }

  const receiver = input.paypalEmailOrId || input.name;
  const now = new Date().toISOString();

  return {
    id: `hh_${crypto.randomBytes(8).toString("hex")}`,
    encryptedName,
    encryptedAddress,
    lat: input.lat,
    lng: input.lng,
    zone: input.zone || "Zone A",
    language: input.language || "en",
    recipientPath: input.recipientPath,
    receiver,
    evidenceLevel: input.evidenceLevel,
    documentNote: input.documentSnippet ? "Extracted, not authenticated" : undefined,
    hasMedicalDevice: input.hasMedicalDevice ?? false,
    isElderlyLivingAlone: input.isElderlyLivingAlone ?? false,
    hasDisability: input.hasDisability ?? false,
    hasNoVehicleInSurgeZone: input.hasNoVehicleInSurgeZone ?? false,
    hasChildrenUnder5: input.hasChildrenUnder5 ?? false,
    numMembers: input.numMembers ?? 1,
    lastReconfirmedAt: now,
    consentRecordedAt: now,
    status: "submitted",
  };
}

/**
 * Submits an appeal to the coordinator review queue with a 24-hour SLA.
 */
export function createAppeal(input: AppealInput): AppealRecord {
  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24h SLA

  return {
    id: `app_${crypto.randomBytes(6).toString("hex")}`,
    householdId: input.householdId,
    reason: input.reason,
    status: "OPEN",
    slaDeadline,
    createdAt: now.toISOString(),
  };
}
