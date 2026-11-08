import { describe, it, expect } from "vitest";
import { validateTwoKeyApproval, type ApprovalKeyVerification } from "@/lib/security/passkeys";

describe("Two-Key Passkey Approval Validation", () => {
  const planHash = "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890";

  it("passes when two distinct approvers sign the locked plan hash and one is finance", () => {
    const approvals: ApprovalKeyVerification[] = [
      {
        approverId: "user_coord_1",
        approverRole: "coordinator",
        planHash,
        passkeySignature: "sig_coord_valid",
      },
      {
        approverId: "user_fin_2",
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_fin_valid",
      },
    ];

    const result = validateTwoKeyApproval(approvals, planHash);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects if less than 2 approvals are provided", () => {
    const approvals: ApprovalKeyVerification[] = [
      {
        approverId: "user_fin_1",
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_fin_1",
      },
    ];

    const result = validateTwoKeyApproval(approvals, planHash);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Two passkey approvals are required");
  });

  it("rejects if same person signs twice", () => {
    const approvals: ApprovalKeyVerification[] = [
      {
        approverId: "user_fin_1",
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_1",
      },
      {
        approverId: "user_fin_1",
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_2",
      },
    ];

    const result = validateTwoKeyApproval(approvals, planHash);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("two distinct individuals");
  });

  it("rejects if neither approver holds the Finance or Admin role", () => {
    const approvals: ApprovalKeyVerification[] = [
      {
        approverId: "user_coord_1",
        approverRole: "coordinator",
        planHash,
        passkeySignature: "sig_1",
      },
      {
        approverId: "user_coord_2",
        approverRole: "coordinator",
        planHash,
        passkeySignature: "sig_2",
      },
    ];

    const result = validateTwoKeyApproval(approvals, planHash);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Finance role");
  });

  it("rejects if any approval was signed against a different plan hash (hash mismatch)", () => {
    const approvals: ApprovalKeyVerification[] = [
      {
        approverId: "user_coord_1",
        approverRole: "coordinator",
        planHash: "tampered_hash_123456789012345678901234567890123456789012345678901234",
        passkeySignature: "sig_1",
      },
      {
        approverId: "user_fin_2",
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_2",
      },
    ];

    const result = validateTwoKeyApproval(approvals, planHash);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Approval plan hash mismatch");
  });
});

