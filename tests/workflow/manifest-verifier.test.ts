import { describe, it, expect } from "vitest";
import {
  getAuthoritativeEvidenceManifest,
  getAuthoritativeRehearsalManifest,
  type GoldenWorkflowEvidenceManifest,
} from "@/lib/workflow/manifest";
import { verifyEvidenceManifest } from "@/lib/workflow/manifest-verifier";

describe("Evidence Manifest Verifier & Referential Integrity Audit (§3, §4, §15)", () => {
  it("verifies the authoritative empirical sandbox manifest with 100% check pass rate", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const result = verifyEvidenceManifest(manifest);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checksPassed).toBe(result.checksRun);
    expect(result.checksRun).toBeGreaterThanOrEqual(18);
    expect(result.summary).toContain("PASSED");
  });

  it("verifies the authoritative Hurricane Milton rehearsal manifest with 100% check pass rate", () => {
    const manifest = getAuthoritativeRehearsalManifest();
    const result = verifyEvidenceManifest(manifest);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checksPassed).toBe(result.checksRun);
    expect(result.checksRun).toBeGreaterThanOrEqual(18);
  });

  it("REJECTS manifest when canonical plan hash is tampered or malformed", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      canonicalPlanHash: "bad_hash_not_sha256",
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("CANONICAL_PLAN_HASH_FORMAT"))).toBe(true);
  });

  it("REJECTS manifest when payout item amount does not match plan items", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      payoutItemAmountCents: 99999, // Mismatched amount
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("PAYOUT_ITEM_AMOUNT_CONSISTENCY"))).toBe(true);
  });

  it("REJECTS manifest when plan commitment exceeds treasury allocatable cash", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      treasuryMetrics: {
        ...manifest.treasuryMetrics,
        allocatableCents: 50, // Less than the 100¢ plan requirement
      },
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("PLAN_BUDGET_SOLVENCY"))).toBe(true);
  });

  it("REJECTS dual-custody self-approval by the same operator", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      secondApproval: {
        ...manifest.secondApproval,
        approverId: manifest.firstApproval.approverId, // Self approval!
      },
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("DUAL_CUSTODY_DISTINCT_PERSONS"))).toBe(true);
  });

  it("REJECTS dual-custody approval without a fiduciary/finance sign-off", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      firstApproval: {
        ...manifest.firstApproval,
        approverRole: "coordinator",
      },
      secondApproval: {
        ...manifest.secondApproval,
        approverRole: "coordinator", // Missing finance/admin role!
      },
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("DUAL_CUSTODY_ROLE_SEPARATION"))).toBe(true);
  });

  it("REJECTS manifest when treasury solvency invariant is violated", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      treasuryMetrics: {
        totalCashCents: 500,
        reserveProtectedCents: 300,
        feesReservedCents: 100,
        allocatableCents: 500, // 300 + 100 + 500 = 900 > 500 totalCash!
      },
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("TREASURY_SOLVENCY_INVARIANT"))).toBe(true);
  });

  it("REJECTS manifest when double-entry ledger is not balanced", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      finalLedgerDifferenceCents: 150, // Discrepancy > 0!
      isAuditBalanced: false,
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("LEDGER_AUDIT_BALANCED"))).toBe(true);
  });

  it("REJECTS manifest when webhook verification failed", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: GoldenWorkflowEvidenceManifest = {
      ...manifest,
      webhookVerificationResult: "FAILED",
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("WEBHOOK_VERIFICATION_STATUS"))).toBe(true);
  });

  it("REJECTS manifest with invalid payout item terminal status", () => {
    const manifest = getAuthoritativeEvidenceManifest();
    const corrupted: any = {
      ...manifest,
      finalItemStatus: "UNAUTHORIZED_STATE",
    };

    const result = verifyEvidenceManifest(corrupted);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("PAYOUT_ITEM_STATUS_VALIDITY"))).toBe(true);
  });
});

