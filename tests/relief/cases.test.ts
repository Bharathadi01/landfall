import { describe, it, expect } from "vitest";
import { RELIEF_CASES, CASE_SUMMARY, buildReliefCases, attentionQueue, caseRefFor, STAGES } from "@/lib/relief/cases";
import { TREASURY, studioPayoutItems, studioObligations } from "@/lib/studio/landfall-studio-data";
import { recoveryDecisionForStatus } from "@/lib/recovery/decision";

describe("Relief Delivery Cases — one source of truth", () => {
  it("one case per payout item, with unique case refs and one name per household", () => {
    expect(RELIEF_CASES).toHaveLength(studioPayoutItems.length);
    expect(new Set(RELIEF_CASES.map((c) => c.caseRef)).size).toBe(RELIEF_CASES.length);
    const names = new Map<string, Set<string>>();
    for (const c of RELIEF_CASES) names.set(c.householdRef, (names.get(c.householdRef) ?? new Set()).add(c.resident));
    for (const [, set] of names) expect(set.size).toBe(1);
  });

  it("summary agrees with the treasury and the obligations (no figure typed twice)", () => {
    const s = CASE_SUMMARY;
    expect(s.approvedUsd).toBe(studioObligations.reduce((t, o) => t + o.grant_usd, 0));
    expect(s.creditedUsd).toBe(TREASURY.paidOut);
    expect(s.unresolvedUsd).toBe(TREASURY.inFlight + TREASURY.needsReissue);
    expect(TREASURY.allocatable + TREASURY.reserve + TREASURY.paidOut + TREASURY.inFlight).toBe(TREASURY.total);
  });

  it("PayPal SUCCESS is never treated as recipient-confirmed", () => {
    const credited = RELIEF_CASES.filter((c) => c.status === "SUCCESS");
    expect(credited.length).toBeGreaterThan(0);
    // at least one credited case is unconfirmed, and every credited-unconfirmed case asks the resident
    const unconfirmed = credited.filter((c) => !c.stagesReached.CONFIRMED);
    expect(unconfirmed.length).toBeGreaterThan(0);
    for (const c of unconfirmed) {
      expect(c.stagesReached.CREDITED).toBe(true);
      expect(c.stagesReached.CLOSED).toBe(false);
      expect(c.nextAction.safeAction).toBe("ASK_RECIPIENT_TO_CONFIRM");
    }
    expect(CASE_SUMMARY.creditedUnconfirmedCount).toBe(unconfirmed.length);
  });

  it("stages are monotonic: later stages are never reached without the earlier evidence", () => {
    for (const c of RELIEF_CASES) {
      expect(c.stagesReached.CONFIRMED ? c.stagesReached.CREDITED : true).toBe(true);
      expect(c.stagesReached.CREDITED ? c.stagesReached.SENT : true).toBe(true);
    }
    expect(STAGES.map((s) => s.key)).toEqual(["APPROVED", "SENT", "CREDITED", "CONFIRMED", "CLOSED"]);
  });

  it("no case ever suggests an immediate second payout", () => {
    for (const c of RELIEF_CASES) {
      expect(recoveryDecisionForStatus(c.status).canReissueImmediately).toBe(false);
      expect(c.nextAction.plain.toLowerCase()).not.toMatch(/send again now|resend now|pay again/);
    }
    const unclaimed = RELIEF_CASES.find((c) => c.status === "UNCLAIMED")!;
    expect(unclaimed.claimDaysLeft).toBeGreaterThan(0);
    expect(unclaimed.nextAction.plain).toContain("don’t send again");
  });

  it("missing evidence is labelled missing, never fabricated; PENDING is not expected to have a webhook", () => {
    const pending = RELIEF_CASES.find((c) => c.status === "PENDING")!;
    expect(pending.evidence.find((e) => e.key === "webhook")!.state).toBe("not_expected");
    const failed = RELIEF_CASES.find((c) => c.status === "FAILED")!;
    expect(failed.evidence.find((e) => e.key === "webhook")!.state).toBe("missing");
    for (const c of RELIEF_CASES) expect(c.evidenceCount.present).toBeLessThanOrEqual(c.evidenceCount.applicable);
  });

  it("resident reports are recorded as RECIPIENT_REPORTED and change the case, without touching provider status", () => {
    const target = RELIEF_CASES.find((c) => c.status === "SUCCESS" && !c.stagesReached.CONFIRMED)!;
    const received = buildReliefCases([{ caseRef: target.caseRef, kind: "RECEIVED", createdAt: "2024-10-10T10:00:00Z" }]).find((c) => c.caseRef === target.caseRef)!;
    expect(received.status).toBe("SUCCESS");
    expect(received.stagesReached.CONFIRMED).toBe(true);
    expect(received.evidence.find((e) => e.key === "recipient")!.provenance).toBe("RECIPIENT_REPORTED");

    const cantAccess = buildReliefCases([{ caseRef: target.caseRef, kind: "CANT_ACCESS", reason: "CANT_SIGN_IN", createdAt: "2024-10-10T10:00:00Z" }]).find((c) => c.caseRef === target.caseRef)!;
    expect(cantAccess.status).toBe("SUCCESS"); // provider status unchanged
    expect(cantAccess.barrier).toBe("CANT_SIGN_IN");
    expect(cantAccess.nextAction.safeAction).toBe("RESOLVE_ACCESS_BARRIER");
    expect(cantAccess.priority.score).toBeGreaterThan(target.priority.score);
  });

  it("a later CANT_ACCESS report supersedes an earlier seeded confirmation", () => {
    const seeded = RELIEF_CASES.find((c) => c.status === "SUCCESS" && c.stagesReached.CONFIRMED)!;
    const after = buildReliefCases([{ caseRef: seeded.caseRef, kind: "CANT_ACCESS", reason: "NO_PHONE", createdAt: "2024-10-11T00:00:00Z" }]).find((c) => c.caseRef === seeded.caseRef)!;
    expect(after.stagesReached.CONFIRMED).toBe(false);
    expect(after.openIssue).toBe(true);
  });

  it("priority is explainable: score equals the sum of its stated reasons, highest need first", () => {
    for (const c of RELIEF_CASES) expect(c.priority.score).toBe(c.priority.reasons.reduce((t, r) => t + r.points, 0));
    const q = attentionQueue();
    for (let i = 1; i < q.length; i++) expect(q[i - 1].priority.score).toBeGreaterThanOrEqual(q[i].priority.score);
    expect(q.every((c) => c.openIssue)).toBe(true);
  });

  it("case refs follow the treasurer's deterministic sender_item_id pattern", () => {
    expect(caseRefFor("hh_tbw_001")).toBe("milton-2024:t1:hh_tbw_001");
  });
});
