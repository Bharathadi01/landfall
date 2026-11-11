import { describe, it, expect } from "vitest";
import { RELIEF_CASES, CASE_SUMMARY, attentionQueue, buildReliefCases } from "@/lib/relief/cases";

/**
 * Pins the REPLAY case model exactly. The case-building logic is shared with the live Sandbox adapter,
 * so any change in how a case is staged, evidenced, prioritised or explained must be deliberate (update the snapshot).
 */
describe("replay case model is stable", () => {
  it("cases", () => expect(RELIEF_CASES).toMatchSnapshot());
  it("summary", () => expect(CASE_SUMMARY).toMatchSnapshot());
  it("attention queue", () => expect(attentionQueue().map((c) => [c.caseRef, c.priority.score, c.priority.reasons])).toMatchSnapshot());
  it("with a resident barrier and a confirmation applied", () => {
    const withReports = buildReliefCases([
      { caseRef: RELIEF_CASES[1].caseRef, kind: "CANT_ACCESS", reason: "NO_PAYPAL_ACCOUNT", createdAt: "2026-11-11T00:00:00.000Z" },
      { caseRef: RELIEF_CASES[0].caseRef, kind: "RECEIVED", createdAt: "2026-11-11T00:00:00.000Z" },
    ]);
    expect(withReports.map((c) => [c.caseRef, c.stage, c.barrier, c.nextAction, c.openIssue])).toMatchSnapshot();
  });
});
