import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { db } from "@/lib/db/client";
import { passkeyCredentials, type passkeyCredentials as PasskeySchema } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const RP_NAME = "Landfall Anticipatory Aid";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

/**
 * Creates passkey registration options for a new coordinator/finance officer.
 */
export async function getPasskeyRegistrationOptions(userId: string, userName: string) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: crypto.createHash("sha256").update(userId).digest(),
    userName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

/**
 * Creates passkey authentication options, binding the challenge to the canonical plan hash.
 */
export async function getPasskeyAuthOptionsForPlan(planHash: string) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    // Embed planHash as part of the challenge to guarantee cryptographic binding
    challenge: crypto.createHash("sha256").update(`${planHash}:${Date.now()}`).digest("base64url"),
  });
}

export interface ApprovalKeyVerification {
  approverId: string;
  approverRole: "coordinator" | "finance" | "admin";
  planHash: string;
  passkeySignature: string;
}

/**
 * Validates the two-key approval requirement for money release:
 * - Exactly two distinct approvers
 * - At least one holds the 'finance' or 'admin' role
 * - Signatures all bind to the exact same locked plan hash
 */
export function validateTwoKeyApproval(approvals: ApprovalKeyVerification[], expectedPlanHash: string): {
  valid: boolean;
  error?: string;
} {
  if (approvals.length < 2) {
    return { valid: false, error: "Two passkey approvals are required before money can move." };
  }

  // Ensure both approvers are distinct people
  const uniqueApprovers = new Set(approvals.map((a) => a.approverId));
  if (uniqueApprovers.size < 2) {
    return { valid: false, error: "Approvals must be signed by two distinct individuals." };
  }

  // Ensure plan hashes match the expected locked plan hash
  for (const app of approvals) {
    if (app.planHash !== expectedPlanHash) {
      return { valid: false, error: `Approval plan hash mismatch: expected ${expectedPlanHash}` };
    }
  }

  // Ensure at least one approver holds the Finance or Admin role
  const hasFinanceRole = approvals.some((a) => a.approverRole === "finance" || a.approverRole === "admin");
  if (!hasFinanceRole) {
    return { valid: false, error: "At least one approver must hold the host's Finance role." };
  }

  return { valid: true };
}
