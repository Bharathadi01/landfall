import type { ApprovalRecord } from "./types";

/**
 * Pure two-person rule. Satisfied only when at least TWO DIFFERENT people approved the SAME payload hash and at
 * least one of them holds the Finance role. Roles come from the signed session at approval time, never from a request.
 */
export interface ApprovalEvaluation {
  satisfied: boolean;
  /** Plain-language list of what is still missing (empty when satisfied). */
  needs: string[];
}

export function evaluateApprovals(approvals: ApprovalRecord[], payloadHash: string): ApprovalEvaluation {
  const valid = approvals.filter((a) => a.payloadHash === payloadHash);
  const people = new Set(valid.map((a) => a.approverId));
  const hasFinance = valid.some((a) => a.role === "finance");
  const needs: string[] = [];
  if (people.size < 2) needs.push(people.size === 0 ? "Two different people must approve" : "One more approver (a different person)");
  if (!hasFinance) needs.push("A Finance approver");
  return { satisfied: needs.length === 0, needs };
}
