import { describe, it, expect } from "vitest";
import {
  computeFourChecks,
  isReconfirmationValid,
  createEncryptedHouseholdCase,
  createAppeal,
  type EnrollmentInput,
} from "@/lib/recipients/index";
import { decryptPII } from "@/lib/security/encryption";

describe("Recipient Management & Inclusion (§4.4)", () => {
  describe("Four-Check Chips Generation", () => {
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
  });

  describe("Re-confirmation ('Still here?') Logic", () => {
    it("returns true if reconfirmed within the past 12 months", () => {
      const now = new Date("2026-11-09T00:00:00Z");
      const sixMonthsAgo = "2026-05-09T00:00:00Z";
      expect(isReconfirmationValid(sixMonthsAgo, now)).toBe(true);
    });

    it("returns false if last reconfirmation was more than 12 months ago", () => {
      const now = new Date("2026-11-09T00:00:00Z");
      const thirteenMonthsAgo = "2025-10-01T00:00:00Z";
      expect(isReconfirmationValid(thirteenMonthsAgo, now)).toBe(false);
    });
  });

  describe("Encrypted Enrollment & Consent", () => {
    it("encrypts PII columns and stores encrypted case record", () => {
      const input: EnrollmentInput = {
        name: "Maria Rodriguez",
        address: "1402 E 7th Ave, Tampa FL",
        recipientPath: "LINKED_PAYPAL",
        paypalEmailOrId: "maria@example.com",
        evidenceLevel: "DOCUMENT",
        documentSnippet: "TECO Energy Bill #987654",
        hasMedicalDevice: true,
        consentAccepted: true,
      };

      const stored = createEncryptedHouseholdCase(input);
      expect(stored.id).toMatch(/^hh_/);
      expect(stored.encryptedName).toContain("v1:");
      expect(stored.encryptedAddress).toContain("v1:");

      // Decryption verifies stored text
      expect(decryptPII(stored.encryptedName)).toBe("Maria Rodriguez");
      expect(decryptPII(stored.encryptedAddress)).toBe("1402 E 7th Ave, Tampa FL");
    });

    it("strictly rejects enrollment if consent is not accepted (§6)", () => {
      const input: EnrollmentInput = {
        name: "John Doe",
        address: "123 Elm St",
        recipientPath: "EMAIL_CLAIM",
        evidenceLevel: "SELF_DECLARED",
        consentAccepted: false, // rejected!
      };

      expect(() => createEncryptedHouseholdCase(input)).toThrow(/Consent is mandatory/);
    });
  });

  describe("Appeals Queue & SLA", () => {
    it("creates appeal record with 24-hour SLA deadline", () => {
      const appeal = createAppeal({
        householdId: "hh_test_123",
        reason: "Evacuation zone boundary was updated to include my block",
        contactPreference: "email",
      });

      expect(appeal.id).toMatch(/^app_/);
      expect(appeal.status).toBe("OPEN");
      expect(appeal.householdId).toBe("hh_test_123");

      const createdTime = new Date(appeal.createdAt).getTime();
      const deadlineTime = new Date(appeal.slaDeadline).getTime();
      const diffHours = (deadlineTime - createdTime) / (1000 * 60 * 60);

      expect(diffHours).toBeCloseTo(24, 0.1);
    });
  });
});
