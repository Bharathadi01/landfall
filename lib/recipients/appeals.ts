/**
 * AUDITABLE APPEALS WORKFLOW (§4.4, §10)
 * Invariants:
 * 1. Every appeal receives a unique human-friendly case reference (e.g. LF-APP-XXXX).
 * 2. 24-hour SLA deadline is strictly computed from creation timestamp.
 * 3. AI is NEVER permitted to resolve or reject appeals; human coordinator review is mandatory.
 * 4. State transitions follow an explicit state machine.
 */

import crypto from "crypto";
import type { AppealInput, AppealRecord } from "./types";

export const APPEAL_SLA_HOURS = 24;

/**
 * Creates a new appeal record with a 24-hour SLA.
 */
export function createAppealRecord(input: AppealInput, now: Date = new Date()): AppealRecord {
  const caseRef = `LF-APP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const slaDeadline = new Date(now.getTime() + APPEAL_SLA_HOURS * 60 * 60 * 1000);

  return {
    id: `app_${crypto.randomBytes(8).toString("hex")}`,
    householdId: input.householdId,
    caseReference: caseRef,
    category: input.category || "TIER_DISPUTE",
    explanation: input.reason.trim(),
    status: "SUBMITTED",
    slaDeadline: slaDeadline.toISOString(),
    createdAt: now.toISOString(),
  };
}

/**
 * Checks if an appeal has breached its 24-hour SLA.
 */
export function isSlaBreached(appeal: AppealRecord, now: Date = new Date()): boolean {
  if (appeal.status === "RESOLVED" || appeal.status === "REJECTED") {
    return false;
  }
  return now.getTime() > new Date(appeal.slaDeadline).getTime();
}

/**
 * State machine transition for appeals.
 */
export function transitionAppealStatus({
  appeal,
  action,
  reviewerId,
  notes,
  now = new Date(),
}: {
  appeal: AppealRecord;
  action: "ASSIGN" | "REQUEST_INFO" | "RESOLVE" | "REJECT" | "REOPEN";
  reviewerId?: string;
  notes?: string;
  now?: Date;
}): AppealRecord {
  switch (action) {
    case "ASSIGN":
      if (!reviewerId) throw new Error("reviewerId is required to assign appeal.");
      return {
        ...appeal,
        status: "UNDER_REVIEW",
        assignedReviewerId: reviewerId,
      };

    case "REQUEST_INFO":
      return {
        ...appeal,
        status: "NEEDS_INFORMATION",
        resolutionNotes: notes || appeal.resolutionNotes,
      };

    case "RESOLVE":
      if (!notes) throw new Error("resolutionNotes are required to resolve appeal.");
      return {
        ...appeal,
        status: "RESOLVED",
        assignedReviewerId: reviewerId || appeal.assignedReviewerId,
        resolutionNotes: notes,
        resolvedAt: now.toISOString(),
      };

    case "REJECT":
      if (!notes) throw new Error("resolutionNotes are required to reject appeal.");
      return {
        ...appeal,
        status: "REJECTED",
        assignedReviewerId: reviewerId || appeal.assignedReviewerId,
        resolutionNotes: notes,
        resolvedAt: now.toISOString(),
      };

    case "REOPEN":
      return {
        ...appeal,
        status: "UNDER_REVIEW",
        resolvedAt: undefined,
      };

    default:
      throw new Error(`Unknown appeal action: ${action}`);
  }
}
