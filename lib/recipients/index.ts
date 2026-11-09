/**
 * RECIPIENT MANAGEMENT & INCLUSION SERVICE (§4.4, §10)
 * Golden Rules:
 * - Dual-axis architecture: Enrollment Method (SELF_SERVICE | ASSISTED | POST_EVENT)
 *   and Payment Channel (PAYPAL_ID | EMAIL | MANUAL | UNSET).
 * - Evidence ladder: SELF_DECLARED, VOLUNTEER_ATTESTATION, DOCUMENT_PROVIDED (extracted, not authenticated).
 * - Four independent chips: Payment Channel, Residence Evidence, Exposure, Need.
 * - No government ID, SSN or immigration status ever requested.
 * - Missing paperwork never lowers priority (routes to human review).
 * - Shared volunteer devices guarded: sensitive data immediately encrypted, never cached locally.
 */

import { encryptPII, decryptPII } from "@/lib/security/encryption";
import { type Role, logPIIAccess } from "@/lib/security/rbac";
import crypto from "crypto";
import type {
  EnrollmentInput,
  StoredHouseholdCase,
  EnrollmentMethod,
  PaymentChannelType,
  RecipientPath,
  EvidenceLevel,
} from "./types";
import { projectRecipientPath } from "./types";
import { resolvePaymentChannel } from "./channels";
import { validateMandatoryConsents } from "./consent";

export * from "./types";
export * from "./channels";
export * from "./checks";
export * from "./consent";
export * from "./location";
export * from "./reconfirmation";
export * from "./appeals";
export * from "./versioning";

/**
 * Creates an encrypted household case record.
 */
export function createEncryptedHouseholdCase(input: EnrollmentInput): StoredHouseholdCase {
  // 1. Consent validation
  const consentValidation = validateMandatoryConsents({
    consents: input.consents,
    consentAccepted: input.consentAccepted,
  });

  if (!consentValidation.valid) {
    throw new Error(
      `Consent is mandatory for enrollment under data minimization rules (§6). Missing: ${consentValidation.missingPurposes.join(
        ", "
      )}`
    );
  }

  // 2. Encryption of PII
  const encryptedName = encryptPII(input.name);
  const encryptedAddress = encryptPII(input.address);
  if (!encryptedName || !encryptedAddress) {
    throw new Error("Failed to encrypt sensitive personal information.");
  }

  // 3. Resolve enrollment method and payment channel
  const enrollmentMethod: EnrollmentMethod =
    input.enrollmentMethod || (input.assistedByVolunteerId ? "ASSISTED" : "SELF_SERVICE");

  let paymentChannel: PaymentChannelType = input.paymentChannel || "UNSET";
  let receiver = input.paypalEmailOrId || input.name;

  if (input.paymentChannel) {
    paymentChannel = input.paymentChannel;
  } else if (input.recipientPath === "MANUAL_CHANNEL") {
    paymentChannel = "MANUAL";
    receiver = "OFFLINE_MANUAL_DISBURSEMENT";
  } else if (input.paypalEmailOrId) {
    const resolved = resolvePaymentChannel({
      payerId: input.paypalEmailOrId.includes("@") ? undefined : input.paypalEmailOrId,
      email: input.paypalEmailOrId.includes("@") ? input.paypalEmailOrId : undefined,
    });
    paymentChannel = resolved.paymentChannel;
    receiver = resolved.receiver;
  } else if (input.recipientPath === "LINKED_PAYPAL") {
    paymentChannel = "PAYPAL_ID";
  } else if (input.recipientPath === "EMAIL_CLAIM") {
    paymentChannel = "EMAIL";
  }

  const recipientPath = input.recipientPath || projectRecipientPath(enrollmentMethod, paymentChannel);
  const now = new Date().toISOString();

  // Normalize evidence level
  let evidenceLevel: EvidenceLevel = input.evidenceLevel;
  if (evidenceLevel === "DOCUMENT") evidenceLevel = "DOCUMENT_PROVIDED";
  if (evidenceLevel === "ATTESTED") evidenceLevel = "VOLUNTEER_ATTESTATION";

  return {
    id: `hh_${crypto.randomBytes(8).toString("hex")}`,
    encryptedName,
    encryptedAddress,
    lat: input.lat, // Original landfall home coordinates
    lng: input.lng,
    currentLat: input.currentLat ?? input.lat,
    currentLng: input.currentLng ?? input.lng,
    isDisplaced: input.isDisplaced ?? false,
    zone: input.zone || "Zone A",
    language: input.language || "en",
    enrollmentMethod,
    paymentChannel,
    recipientPath,
    recipientVersion: 1,
    receiver,
    evidenceLevel,
    documentNote: input.documentSnippet ? "Extracted, not authenticated" : undefined,
    assistedByVolunteerId: input.assistedByVolunteerId,
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
 * Backward compatibility alias for createAppeal
 */
export function createAppeal(input: {
  householdId: string;
  reason: string;
  contactPreference?: string;
}) {
  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `app_${crypto.randomBytes(6).toString("hex")}`,
    householdId: input.householdId,
    reason: input.reason,
    status: "OPEN" as const,
    slaDeadline,
    createdAt: now.toISOString(),
  };
}
