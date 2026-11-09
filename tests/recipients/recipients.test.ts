import { describe, it, expect } from "vitest";
import {
  computeFourChecks,
  isReconfirmationValid,
  evaluateReconfirmation,
  createEncryptedHouseholdCase,
  createAppeal,
  createAppealRecord,
  isSlaBreached,
  transitionAppealStatus,
  resolvePaymentChannel,
  isValidPayerId,
  isValidEmail,
  isChannelEligibleForPayPalPayout,
  generateEmailVerificationToken,
  verifyEmailToken,
  projectRecipientPath,
  validateMandatoryConsents,
  createConsentRecord,
  withdrawConsentRecord,
  hasActiveConsent,
  resolveExposureCoordinates,
  createLocationHistoryEntry,
  validatePlanRecipientVersions,
  computePlanRecipientsHash,
  type EnrollmentInput,
} from "@/lib/recipients/index";
import { decryptPII } from "@/lib/security/encryption";

describe("Recipient Management & Inclusion System (§4.4, §10, §11)", () => {
  describe("1. Four-Check Chips Generation & Orthogonal Axes", () => {
    it("generates verified chips for LINKED_PAYPAL recipient", () => {
      const checks = computeFourChecks({
        recipientPath: "LINKED_PAYPAL",
        evidenceLevel: "DOCUMENT",
        isExposureConfirmed: true,
        priorityTier: 1,
        priorityCode: "P1_MEDICAL_DEVICE",
      });

      expect(checks.paymentChannel.status).toBe("VERIFIED");
      expect(checks.paymentChannel.label).toBe("Verified PayPal");
      expect(checks.residenceEvidence.level).toBe("DOCUMENT");
      expect(checks.residenceEvidence.disclaimer).toBe("Extracted, not authenticated");
      expect(checks.exposure.status).toBe("CONFIRMED");
      expect(checks.need.code).toBe("P1_MEDICAL_DEVICE");
    });

    it("generates claim-link chip for EMAIL_CLAIM path", () => {
      const checks = computeFourChecks({
        recipientPath: "EMAIL_CLAIM",
        evidenceLevel: "ATTESTED",
        isExposureConfirmed: true,
        priorityTier: 3,
        priorityCode: "P3_DISABILITY",
      });

      expect(checks.paymentChannel.status).toBe("CLAIM_LINK");
      expect(checks.paymentChannel.detail).toContain("expected UNCLAIMED");
      expect(checks.residenceEvidence.level).toBe("ATTESTED");
    });

    it("generates manual channel chip for MANUAL_CHANNEL path", () => {
      const checks = computeFourChecks({
        recipientPath: "MANUAL_CHANNEL",
        evidenceLevel: "SELF_DECLARED",
        isExposureConfirmed: true,
        priorityTier: 6,
        priorityCode: "P6_GENERAL",
      });

      expect(checks.paymentChannel.status).toBe("MANUAL");
      expect(checks.paymentChannel.detail).toContain("never sent to PayPal");
    });

    it("flags exposure as NEEDS_REVIEW when point-check disagreement occurs", () => {
      const checks = computeFourChecks({
        recipientPath: "LINKED_PAYPAL",
        evidenceLevel: "SELF_DECLARED",
        isExposureConfirmed: true,
        hasExposureDisagreement: true,
        priorityTier: 2,
        priorityCode: "P2_ELDERLY_ALONE",
      });

      expect(checks.exposure.status).toBe("NEEDS_REVIEW");
      expect(checks.exposure.label).toContain("Point Disagreement");
    });

    it("supports dual-axis projection from enrollment method and payment channel", () => {
      expect(projectRecipientPath("SELF_SERVICE", "PAYPAL_ID")).toBe("LINKED_PAYPAL");
      expect(projectRecipientPath("SELF_SERVICE", "EMAIL")).toBe("EMAIL_CLAIM");
      expect(projectRecipientPath("ASSISTED", "UNSET")).toBe("ASSISTED");
      expect(projectRecipientPath("ASSISTED", "MANUAL")).toBe("MANUAL_CHANNEL");
      expect(projectRecipientPath("POST_EVENT", "EMAIL")).toBe("EMAIL_CLAIM");
    });
  });

  describe("2. Persona Test Cases & Humanitarian Flows", () => {
    it("Persona 1: Maria Rodriguez (P1 Medical Device, Document Extracted, Verified PayPal ID)", () => {
      const input: EnrollmentInput = {
        name: "Maria Rodriguez",
        address: "1402 E 7th Ave, Tampa FL",
        lat: 27.9601,
        lng: -82.4412,
        language: "es",
        enrollmentMethod: "SELF_SERVICE",
        paymentChannel: "PAYPAL_ID",
        paypalEmailOrId: "RMYYMT3FXD8LJ",
        evidenceLevel: "DOCUMENT_PROVIDED",
        documentSnippet: "TECO Energy Account #482019 - 1402 E 7th Ave",
        hasMedicalDevice: true,
        consentAccepted: true,
        consents: {
          TERMS_OF_SERVICE: true,
          PAYMENT_ROUTING: true,
          LOCATION_TRACKING: true,
          EMERGENCY_DISCLOSURE: false,
        },
      };

      const stored = createEncryptedHouseholdCase(input);
      expect(stored.recipientPath).toBe("LINKED_PAYPAL");
      expect(stored.paymentChannel).toBe("PAYPAL_ID");
      expect(stored.receiver).toBe("RMYYMT3FXD8LJ");
      expect(stored.documentNote).toBe("Extracted, not authenticated");
      expect(stored.hasMedicalDevice).toBe(true);

      // Verify PII is encrypted
      expect(stored.encryptedName).toContain("v1:");
      expect(decryptPII(stored.encryptedName)).toBe("Maria Rodriguez");
      expect(decryptPII(stored.encryptedAddress)).toBe("1402 E 7th Ave, Tampa FL");

      // Verify four checks
      const checks = computeFourChecks({
        paymentChannel: stored.paymentChannel,
        evidenceLevel: stored.evidenceLevel,
        isExposureConfirmed: true,
        priorityTier: 1,
        priorityCode: "P1_MEDICAL_DEVICE",
      });

      expect(checks.paymentChannel.status).toBe("VERIFIED");
      expect(checks.residenceEvidence.disclaimer).toBe("Extracted, not authenticated");
      expect(checks.need.priorityTier).toBe(1);
    });

    it("Persona 2: Mr. Tran (P2 Elderly Living Alone, Assisted Enrollment, Vietnamese, Email Claim)", () => {
      const input: EnrollmentInput = {
        name: "Van Tran",
        address: "4105 N Boulevard, Tampa FL",
        lat: 27.9821,
        lng: -82.4631,
        language: "vi",
        enrollmentMethod: "ASSISTED",
        paymentChannel: "EMAIL",
        paypalEmailOrId: "sb-tv43cm53751698@personal.example.com",
        assistedByVolunteerId: "vol_anna_chen_04",
        volunteerAttestationNote: "Met Mr. Tran at senior center; verified primary residence.",
        evidenceLevel: "VOLUNTEER_ATTESTATION",
        isElderlyLivingAlone: true,
        consentAccepted: true,
        consentMethod: "VERBAL_TO_VOLUNTEER",
        consents: {
          TERMS_OF_SERVICE: true,
          PAYMENT_ROUTING: true,
          LOCATION_TRACKING: true,
          EMERGENCY_DISCLOSURE: false,
        },
      };

      const stored = createEncryptedHouseholdCase(input);
      expect(stored.enrollmentMethod).toBe("ASSISTED");
      expect(stored.paymentChannel).toBe("EMAIL");
      expect(stored.assistedByVolunteerId).toBe("vol_anna_chen_04");
      expect(stored.isElderlyLivingAlone).toBe(true);
      expect(stored.language).toBe("vi");

      const checks = computeFourChecks({
        paymentChannel: stored.paymentChannel,
        isPaymentVerified: false,
        evidenceLevel: stored.evidenceLevel,
        isExposureConfirmed: true,
        priorityTier: 2,
        priorityCode: "P2_ELDERLY_ALONE",
      });

      expect(checks.paymentChannel.status).toBe("CLAIM_LINK");
      expect(checks.residenceEvidence.level).toBe("VOLUNTEER_ATTESTATION");
      expect(checks.need.priorityTier).toBe(2);
    });

    it("Persona 3: Displaced Resident (Preserves original landfall coordinates for hazard assessment)", () => {
      const input: EnrollmentInput = {
        name: "Carlos Rivera",
        address: "801 Bayshore Blvd, Tampa FL", // Landfall home in surge zone
        lat: 27.9351,
        lng: -82.4621,
        isDisplaced: true,
        currentAddress: "12400 US-19, Clearwater FL", // Evacuation shelter
        currentLat: 27.9011,
        currentLng: -82.7301,
        enrollmentMethod: "SELF_SERVICE",
        paymentChannel: "PAYPAL_ID",
        paypalEmailOrId: "RMYYMT3FXD8LJ",
        evidenceLevel: "SELF_DECLARED",
        consentAccepted: true,
      };

      const stored = createEncryptedHouseholdCase(input);
      expect(stored.isDisplaced).toBe(true);
      expect(stored.lat).toBe(27.9351); // Landfall home
      expect(stored.currentLat).toBe(27.9011); // Current shelter

      // Coordinates resolution invariant: Sentinel MUST use landfall coordinates
      const exposureCoords = resolveExposureCoordinates({
        landfallLat: stored.lat,
        landfallLng: stored.lng,
        currentLat: stored.currentLat,
        currentLng: stored.currentLng,
        isDisplaced: true,
      });

      expect(exposureCoords).toEqual({ lat: 27.9351, lng: -82.4621 });
    });

    it("Persona 4: Manual Offline Resident (Zero PayPal dependency, cash card channel)", () => {
      const input: EnrollmentInput = {
        name: "Samuel Jenkins",
        address: "2104 E 15th Ave, Tampa FL",
        recipientPath: "MANUAL_CHANNEL",
        evidenceLevel: "SELF_DECLARED",
        consentAccepted: true,
      };

      const stored = createEncryptedHouseholdCase(input);
      expect(stored.paymentChannel).toBe("MANUAL");
      expect(stored.recipientPath).toBe("MANUAL_CHANNEL");
      expect(stored.receiver).toBe("OFFLINE_MANUAL_DISBURSEMENT");

      // Verify safety invariant: NEVER dispatched to PayPal Payouts
      expect(isChannelEligibleForPayPalPayout(stored.paymentChannel)).toBe(false);
    });
  });

  describe("3. Payment Channel Resolution & Email Verification", () => {
    it("validates Payer ID format (13 alphanumeric chars)", () => {
      expect(isValidPayerId("RMYYMT3FXD8LJ")).toBe(true);
      expect(isValidPayerId("ABC1234567890")).toBe(true);
      expect(isValidPayerId("invalid-id")).toBe(false);
      expect(isValidPayerId("")).toBe(false);
      expect(isValidPayerId(null)).toBe(false);
    });

    it("validates email format", () => {
      expect(isValidEmail("resident@example.com")).toBe(true);
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });

    it("resolves verified Payer ID when OAuth link is confirmed", () => {
      const resolved = resolvePaymentChannel({
        payerId: "RMYYMT3FXD8LJ",
        payerIdVerified: true,
      });
      expect(resolved.paymentChannel).toBe("PAYPAL_ID");
      expect(resolved.receiver).toBe("RMYYMT3FXD8LJ");
      expect(resolved.isVerified).toBe(true);
    });

    it("falls back to Landfall-verified email if Payer ID is unverified", () => {
      const resolved = resolvePaymentChannel({
        payerId: "RMYYMT3FXD8LJ",
        payerIdVerified: false,
        email: "verified_resident@example.com",
        emailVerified: true,
      });
      expect(resolved.paymentChannel).toBe("EMAIL");
      expect(resolved.receiver).toBe("verified_resident@example.com");
      expect(resolved.isVerified).toBe(true);
    });

    it("generates and verifies 24-hour email verification tokens", () => {
      const email = "resident@example.com";
      const tokenInfo = generateEmailVerificationToken(email);

      expect(tokenInfo.token).toBeDefined();
      expect(tokenInfo.token.length).toBe(64); // 32 bytes hex
      expect(tokenInfo.tokenHash).toBeDefined();
      expect(tokenInfo.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Valid token check
      const validCheck = verifyEmailToken({
        token: tokenInfo.token,
        storedTokenHash: tokenInfo.tokenHash,
        expiresAt: tokenInfo.expiresAt,
      });
      expect(validCheck.valid).toBe(true);

      // Rejects expired token
      const expiredCheck = verifyEmailToken({
        token: tokenInfo.token,
        storedTokenHash: tokenInfo.tokenHash,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      expect(expiredCheck.valid).toBe(false);
      expect(expiredCheck.reason).toContain("expired");

      // Rejects already used token
      const usedCheck = verifyEmailToken({
        token: tokenInfo.token,
        storedTokenHash: tokenInfo.tokenHash,
        expiresAt: tokenInfo.expiresAt,
        usedAt: new Date(),
      });
      expect(usedCheck.valid).toBe(false);
      expect(usedCheck.reason).toContain("already been used");
    });
  });

  describe("4. Unbundled Consents & Multi-modal Recording", () => {
    it("strictly rejects enrollment if mandatory consents are missing", () => {
      const checkMissing = validateMandatoryConsents({
        consents: {
          TERMS_OF_SERVICE: false, // missing!
          PAYMENT_ROUTING: true,
        },
      });
      expect(checkMissing.valid).toBe(false);
      expect(checkMissing.missingPurposes).toContain("TERMS_OF_SERVICE");
    });

    it("creates immutable consent records and handles withdrawal", () => {
      const record = createConsentRecord({
        householdId: "hh_101",
        purpose: "LOCATION_TRACKING",
        actor: "hh_101",
        method: "SELF_DIGITAL",
      });

      expect(record.id).toMatch(/^cst_/);
      expect(record.purpose).toBe("LOCATION_TRACKING");
      expect(record.method).toBe("SELF_DIGITAL");

      const consents = [record];
      expect(hasActiveConsent(consents, "LOCATION_TRACKING")).toBe(true);

      // Withdraw consent
      const withdrawn = withdrawConsentRecord(record);
      expect(withdrawn.withdrawnAt).toBeDefined();
      expect(hasActiveConsent([withdrawn], "LOCATION_TRACKING")).toBe(false);
    });
  });

  describe("5. Seasonal Reconfirmation ('Still here?')", () => {
    it("returns ELIGIBLE if reconfirmed within active season", () => {
      const now = new Date("2026-11-09T00:00:00Z");
      const threeMonthsAgo = "2026-08-09T00:00:00Z";
      const status = evaluateReconfirmation(threeMonthsAgo, now);

      expect(status.isValid).toBe(true);
      expect(status.recommendation).toBe("ELIGIBLE");
      expect(status.isInGracePeriod).toBe(false);
    });

    it("returns REMINDER_REQUIRED when within the 30-day grace period", () => {
      const now = new Date("2026-11-09T00:00:00Z");
      // 345 days ago (between 335 and 365)
      const elevenMonthsAgo = new Date(now.getTime() - 345 * 24 * 60 * 60 * 1000).toISOString();
      const status = evaluateReconfirmation(elevenMonthsAgo, now);

      expect(status.isValid).toBe(true);
      expect(status.isInGracePeriod).toBe(true);
      expect(status.recommendation).toBe("REMINDER_REQUIRED");
    });

    it("returns HOLD_FOR_REVIEW when overdue (>365 days) but never alters priority", () => {
      const now = new Date("2026-11-09T00:00:00Z");
      const fourteenMonthsAgo = "2025-09-01T00:00:00Z";
      const status = evaluateReconfirmation(fourteenMonthsAgo, now);

      expect(status.isValid).toBe(false);
      expect(status.isOverdue).toBe(true);
      expect(status.recommendation).toBe("HOLD_FOR_REVIEW");
    });
  });

  describe("6. Auditable Appeals Workflow & 24h SLA", () => {
    it("creates appeal record with human case reference and strict 24h SLA", () => {
      const now = new Date("2026-11-09T10:00:00Z");
      const appeal = createAppealRecord(
        {
          householdId: "hh_404",
          category: "TIER_DISPUTE",
          reason: "Family has oxygen concentrator not captured in initial intake",
        },
        now
      );

      expect(appeal.caseReference).toMatch(/^LF-APP-[A-F0-9]{6}$/);
      expect(appeal.status).toBe("SUBMITTED");
      expect(appeal.category).toBe("TIER_DISPUTE");

      const createdTime = new Date(appeal.createdAt).getTime();
      const deadlineTime = new Date(appeal.slaDeadline).getTime();
      expect((deadlineTime - createdTime) / (1000 * 60 * 60)).toBe(24);
      expect(isSlaBreached(appeal, now)).toBe(false);

      // Check SLA breach detection
      const futureAfter25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      expect(isSlaBreached(appeal, futureAfter25h)).toBe(true);
    });

    it("executes state transitions with reviewer attribution and resolution notes", () => {
      const now = new Date();
      let appeal = createAppealRecord({
        householdId: "hh_505",
        reason: "Boundary dispute",
      });

      // 1. Assign to coordinator
      appeal = transitionAppealStatus({
        appeal,
        action: "ASSIGN",
        reviewerId: "coordinator_sarah",
      });
      expect(appeal.status).toBe("UNDER_REVIEW");
      expect(appeal.assignedReviewerId).toBe("coordinator_sarah");

      // 2. Resolve appeal
      appeal = transitionAppealStatus({
        appeal,
        action: "RESOLVE",
        reviewerId: "coordinator_sarah",
        notes: "Approved boundary exception based on revised NHC storm surge model.",
        now,
      });
      expect(appeal.status).toBe("RESOLVED");
      expect(appeal.resolutionNotes).toContain("Approved boundary exception");
      expect(appeal.resolvedAt).toBe(now.toISOString());
      expect(isSlaBreached(appeal, new Date(now.getTime() + 100 * 3600 * 1000))).toBe(false);
    });
  });

  describe("8. Branch Coverage & Edge Case Hardening", () => {
    it("handles appeal state machine error branches and all actions", () => {
      const appeal = createAppealRecord({ householdId: "hh_1", reason: "test" });

      // Action: REQUEST_INFO
      const requested = transitionAppealStatus({
        appeal,
        action: "REQUEST_INFO",
        notes: "Please upload proof of utility connection.",
      });
      expect(requested.status).toBe("NEEDS_INFORMATION");
      expect(requested.resolutionNotes).toContain("utility connection");

      // Action: REJECT
      const rejected = transitionAppealStatus({
        appeal,
        action: "REJECT",
        reviewerId: "reviewer_1",
        notes: "Outside county boundaries.",
      });
      expect(rejected.status).toBe("REJECTED");
      expect(rejected.assignedReviewerId).toBe("reviewer_1");

      // Action: REOPEN
      const reopened = transitionAppealStatus({
        appeal: rejected,
        action: "REOPEN",
      });
      expect(reopened.status).toBe("UNDER_REVIEW");
      expect(reopened.resolvedAt).toBeUndefined();

      // Error: ASSIGN without reviewerId
      expect(() =>
        transitionAppealStatus({ appeal, action: "ASSIGN" })
      ).toThrow(/reviewerId is required/);

      // Error: RESOLVE without notes
      expect(() =>
        transitionAppealStatus({ appeal, action: "RESOLVE" })
      ).toThrow(/resolutionNotes are required/);

      // Error: REJECT without notes
      expect(() =>
        transitionAppealStatus({ appeal, action: "REJECT" })
      ).toThrow(/resolutionNotes are required/);

      // Error: Unknown action
      expect(() =>
        transitionAppealStatus({ appeal, action: "UNKNOWN_ACTION" as any })
      ).toThrow(/Unknown appeal action/);
    });

    it("handles channel resolution fallbacks and edge cases", () => {
      // Manual preferred
      const manual = resolvePaymentChannel({ manualPreferred: true });
      expect(manual.paymentChannel).toBe("MANUAL");
      expect(manual.receiver).toBe("OFFLINE_MANUAL_DISBURSEMENT");

      // Unverified Payer ID without email
      const unverifiedPayer = resolvePaymentChannel({
        payerId: "RMYYMT3FXD8LJ",
        payerIdVerified: false,
      });
      expect(unverifiedPayer.paymentChannel).toBe("PAYPAL_ID");
      expect(unverifiedPayer.isVerified).toBe(false);

      // Email pending verification
      const pendingEmail = resolvePaymentChannel({
        email: "resident@example.com",
        emailVerified: false,
      });
      expect(pendingEmail.paymentChannel).toBe("EMAIL");
      expect(pendingEmail.requiresEmailVerification).toBe(true);

      // No credentials provided
      const unset = resolvePaymentChannel({});
      expect(unset.paymentChannel).toBe("UNSET");
      expect(unset.receiver).toBe("UNSET");

      // Invalid token hash verification
      const tokenCheck = verifyEmailToken({
        token: "wrong_token",
        storedTokenHash: "different_hash",
        expiresAt: new Date(Date.now() + 10000),
      });
      expect(tokenCheck.valid).toBe(false);
      expect(tokenCheck.reason).toContain("Invalid verification token");
    });

    it("handles check chips edge cases and unresolved channels", () => {
      const unsetChecks = computeFourChecks({
        paymentChannel: "UNSET",
        evidenceLevel: "SELF_DECLARED",
        isExposureConfirmed: false,
        priorityTier: 6,
        priorityCode: "P6_GENERAL",
      });
      expect(unsetChecks.paymentChannel.status).toBe("UNRESOLVED");
      expect(unsetChecks.exposure.status).toBe("OUT_OF_AREA");
      expect(unsetChecks.residenceEvidence.disclaimer).toBeUndefined();

      // Payer ID unverified
      const unverifiedChecks = computeFourChecks({
        paymentChannel: "PAYPAL_ID",
        isPaymentVerified: false,
        evidenceLevel: "SELF_DECLARED",
        isExposureConfirmed: true,
        priorityTier: 6,
        priorityCode: "P6_GENERAL",
      });
      expect(unverifiedChecks.paymentChannel.status).toBe("UNRESOLVED");
      expect(unverifiedChecks.paymentChannel.label).toContain("Unverified");
    });

    it("handles location coordinates resolution edge cases and location history creation", () => {
      // Not displaced, has current coordinates
      const current = resolveExposureCoordinates({
        landfallLat: 27.9,
        landfallLng: -82.4,
        currentLat: 28.0,
        currentLng: -82.5,
        isDisplaced: false,
      });
      expect(current).toEqual({ lat: 28.0, lng: -82.5 });

      // Not displaced, falls back to landfall coordinates
      const fallback = resolveExposureCoordinates({
        landfallLat: 27.9,
        landfallLng: -82.4,
        isDisplaced: false,
      });
      expect(fallback).toEqual({ lat: 27.9, lng: -82.4 });

      // No coordinates
      const none = resolveExposureCoordinates({});
      expect(none).toBeNull();

      // Location history record
      const entry = createLocationHistoryEntry({
        householdId: "hh_loc",
        address: "123 Elm St",
        lat: 27.9,
        lng: -82.4,
        isDisplaced: false,
        recordedBy: "volunteer_1",
      });
      expect(entry.id).toMatch(/^loc_/);
      expect(entry.address).toBe("123 Elm St");
    });

    it("handles reconfirmation null dates and clock skew", () => {
      // Null date
      const nullCheck = evaluateReconfirmation(null);
      expect(nullCheck.isValid).toBe(false);
      expect(nullCheck.isOverdue).toBe(true);
      expect(nullCheck.recommendation).toBe("HOLD_FOR_REVIEW");
      expect(isReconfirmationValid(null)).toBe(false);

      // Future date (clock skew protection)
      const future = new Date(Date.now() + 100000);
      const skewCheck = evaluateReconfirmation(future);
      expect(skewCheck.isValid).toBe(true);
      expect(skewCheck.daysSinceLastReconfirmed).toBe(0);
      expect(skewCheck.recommendation).toBe("ELIGIBLE");
    });

    it("handles plan versioning with missing household in snapshot", () => {
      const planSnapshots = [
        { householdId: "hh_missing", recipientVersion: 1, receiver: "test@example.com", paymentChannel: "EMAIL" },
      ];
      const currentRecipients = new Map(); // Empty map
      const check = validatePlanRecipientVersions({ planSnapshots, currentRecipients });
      expect(check.isValid).toBe(false);
      expect(check.mismatchedHouseholdIds).toContain("hh_missing");

      // Test receiver modified
      const snapshots2 = [{ householdId: "hh_1", recipientVersion: 1, receiver: "a@ex.com", paymentChannel: "EMAIL" }];
      const modifiedReceiver = new Map([["hh_1", { recipientVersion: 1, receiver: "attacker@ex.com", paymentChannel: "EMAIL" }]]);
      expect(validatePlanRecipientVersions({ planSnapshots: snapshots2, currentRecipients: modifiedReceiver }).isValid).toBe(false);

      // Test channel modified
      const modifiedChannel = new Map([["hh_1", { recipientVersion: 1, receiver: "a@ex.com", paymentChannel: "MANUAL" }]]);
      expect(validatePlanRecipientVersions({ planSnapshots: snapshots2, currentRecipients: modifiedChannel }).isValid).toBe(false);

      // Test version modified
      const modifiedVersion = new Map([["hh_1", { recipientVersion: 2, receiver: "a@ex.com", paymentChannel: "EMAIL" }]]);
      expect(validatePlanRecipientVersions({ planSnapshots: snapshots2, currentRecipients: modifiedVersion }).isValid).toBe(false);

      // Test matching
      const matching = new Map([["hh_1", { recipientVersion: 1, receiver: "a@ex.com", paymentChannel: "EMAIL" }]]);
      expect(validatePlanRecipientVersions({ planSnapshots: snapshots2, currentRecipients: matching }).isValid).toBe(true);

      // Test computePlanRecipientsHash
      const hash1 = computePlanRecipientsHash([{ householdId: "hh_1", recipientVersion: 1, receiver: "a@ex.com", amount: "100.00" }]);
      const hash2 = computePlanRecipientsHash([{ householdId: "hh_1", recipientVersion: 1, receiver: "a@ex.com", amount: "100.00" }]);
      expect(hash1).toBe(hash2);
    });

    it("handles legacy createAppeal helper and enrollment path variations", () => {
      const legacyAppeal = createAppeal({ householdId: "hh_legacy", reason: "Evacuation" });
      expect(legacyAppeal.id).toMatch(/^app_/);
      expect(legacyAppeal.status).toBe("OPEN");

      // Consent rejection
      expect(() =>
        createEncryptedHouseholdCase({
          name: "No Consent",
          address: "123 Main St",
          evidenceLevel: "SELF_DECLARED",
          consentAccepted: false,
        })
      ).toThrow(/Consent is mandatory/);

      // Project path post-event fallback
      expect(projectRecipientPath("POST_EVENT", "UNSET")).toBe("EMAIL_CLAIM");

      // Enrollment with MANUAL_CHANNEL path
      const manualCase = createEncryptedHouseholdCase({
        name: "Manual User",
        address: "789 Pine St",
        recipientPath: "MANUAL_CHANNEL",
        evidenceLevel: "SELF_DECLARED",
        consentAccepted: true,
      });
      expect(manualCase.paymentChannel).toBe("MANUAL");

      // Enrollment with email in paypalEmailOrId
      const emailCase = createEncryptedHouseholdCase({
        name: "Email User",
        address: "101 Cedar St",
        paypalEmailOrId: "user@example.com",
        evidenceLevel: "DOCUMENT",
        consentAccepted: true,
      });
      expect(emailCase.paymentChannel).toBe("EMAIL");
      expect(emailCase.evidenceLevel).toBe("DOCUMENT_PROVIDED");

      // Enrollment with recipientPath LINKED_PAYPAL
      const linkedCase = createEncryptedHouseholdCase({
        name: "Linked User",
        address: "202 Birch St",
        recipientPath: "LINKED_PAYPAL",
        evidenceLevel: "ATTESTED",
        consentAccepted: true,
      });
      expect(linkedCase.paymentChannel).toBe("PAYPAL_ID");
      expect(linkedCase.evidenceLevel).toBe("VOLUNTEER_ATTESTATION");
    });
  });
});
