/**
 * RECIPIENT CONSENT & DATA MINIMIZATION (§6, §10)
 * Invariants:
 * 1. Unbundled consent: Terms of Service, Payment Routing, Location Tracking, Emergency Disclosure.
 * 2. Mandatory consents: TERMS_OF_SERVICE and PAYMENT_ROUTING are strictly required for enrollment.
 * 3. Multi-modal consent methods: SELF_DIGITAL, VERBAL_TO_VOLUNTEER, PAPER_AFFIDAVIT.
 * 4. Withdrawn consents take immediate effect; historical consent records are immutable.
 */

import crypto from "crypto";
import type { ConsentPurpose, ConsentMethod, ConsentRecord } from "./types";

export const CURRENT_CONSENT_VERSION = "v1.0.0";

export const MANDATORY_CONSENT_PURPOSES: ConsentPurpose[] = [
  "TERMS_OF_SERVICE",
  "PAYMENT_ROUTING",
];

export interface ValidateConsentInput {
  consents?: Partial<Record<ConsentPurpose, boolean>> | null;
  consentAccepted?: boolean;
}

/**
 * Validates that all mandatory consents have been explicitly accepted.
 */
export function validateMandatoryConsents(input: ValidateConsentInput): {
  valid: boolean;
  missingPurposes: ConsentPurpose[];
} {
  // If legacy blanket consent accepted, treat as accepting mandatory purposes
  if (input.consentAccepted && !input.consents) {
    return { valid: true, missingPurposes: [] };
  }

  const missingPurposes: ConsentPurpose[] = [];
  for (const purpose of MANDATORY_CONSENT_PURPOSES) {
    if (!input.consents || !input.consents[purpose]) {
      missingPurposes.push(purpose);
    }
  }

  return {
    valid: missingPurposes.length === 0,
    missingPurposes,
  };
}

/**
 * Creates an immutable consent record for a specific purpose.
 */
export function createConsentRecord({
  householdId,
  purpose,
  actor,
  method = "SELF_DIGITAL",
  language = "en",
  consentVersion = CURRENT_CONSENT_VERSION,
}: {
  householdId: string;
  purpose: ConsentPurpose;
  actor: string;
  method?: ConsentMethod;
  language?: string;
  consentVersion?: string;
}): ConsentRecord {
  return {
    id: `cst_${crypto.randomBytes(8).toString("hex")}`,
    householdId,
    purpose,
    consentVersion,
    language,
    acceptedAt: new Date().toISOString(),
    actor,
    method,
  };
}

/**
 * Marks a consent record as withdrawn.
 */
export function withdrawConsentRecord(
  consent: ConsentRecord,
  withdrawnAt: Date = new Date()
): ConsentRecord {
  return {
    ...consent,
    withdrawnAt: withdrawnAt.toISOString(),
  };
}

/**
 * Checks whether an active (non-withdrawn) consent exists for a specific purpose.
 */
export function hasActiveConsent(
  consents: ConsentRecord[],
  purpose: ConsentPurpose
): boolean {
  return consents.some(
    (c) => c.purpose === purpose && (!c.withdrawnAt || new Date(c.withdrawnAt).getTime() > Date.now())
  );
}
