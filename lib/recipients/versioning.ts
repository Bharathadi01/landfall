/**
 * RECIPIENT VERSIONING & PLAN INVALIDATION (§11)
 * Invariants:
 * 1. Every household record carries an integer `recipient_version` (starts at 1).
 * 2. Any material mutation to a recipient (receiver, payment channel, address, displaced status)
 *    increments `recipient_version`.
 * 3. Payout plans lock an immutable snapshot of recipient receiver and version at plan generation.
 * 4. Destination edits invalidate pending plan approval hash so two-person passkey approval
 *    cannot be bypassed by modifying recipients after voting.
 */

import crypto from "crypto";

export interface RecipientPlanSnapshot {
  householdId: string;
  recipientVersion: number;
  receiver: string;
  paymentChannel: string;
}

/**
 * Checks whether any recipient in a plan has been modified since the snapshot was taken.
 */
export function validatePlanRecipientVersions({
  planSnapshots,
  currentRecipients,
}: {
  planSnapshots: RecipientPlanSnapshot[];
  currentRecipients: Map<string, { recipientVersion: number; receiver: string; paymentChannel: string }>;
}): {
  isValid: boolean;
  mismatchedHouseholdIds: string[];
  reason?: string;
} {
  const mismatchedHouseholdIds: string[] = [];

  for (const snapshot of planSnapshots) {
    const current = currentRecipients.get(snapshot.householdId);
    if (!current) {
      mismatchedHouseholdIds.push(snapshot.householdId);
      continue;
    }

    if (
      current.recipientVersion !== snapshot.recipientVersion ||
      current.receiver !== snapshot.receiver ||
      current.paymentChannel !== snapshot.paymentChannel
    ) {
      mismatchedHouseholdIds.push(snapshot.householdId);
    }
  }

  if (mismatchedHouseholdIds.length > 0) {
    return {
      isValid: false,
      mismatchedHouseholdIds,
      reason: `Recipient records modified after plan approval: ${mismatchedHouseholdIds.join(", ")}. Plan must be re-audited and re-approved.`,
    };
  }

  return {
    isValid: true,
    mismatchedHouseholdIds: [],
  };
}

/**
 * Computes deterministic approval hash for a list of recipient snapshots and amounts.
 */
export function computePlanRecipientsHash(
  items: Array<{ householdId: string; recipientVersion: number; receiver: string; amount: string }>
): string {
  const sorted = [...items].sort((a, b) => a.householdId.localeCompare(b.householdId));
  const payload = JSON.stringify(sorted);
  return crypto.createHash("sha256").update(payload).digest("hex");
}
