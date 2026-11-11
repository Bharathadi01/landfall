import { describe, it, expect } from "vitest";
import { evaluateApprovals } from "@/lib/proposals/approvals";
import { checkPayoutCaps } from "@/lib/proposals/policy";
import { buildProposal } from "@/lib/proposals/create";
import { hashCancelPayload } from "@/lib/proposals/payload";
import type { ApprovalRecord } from "@/lib/proposals/types";
import type { ReliefCase } from "@/lib/relief/case-types";

const H = "a".repeat(64);
const ap = (id: string, role: "coordinator" | "finance", hash = H): ApprovalRecord => ({ approverId: id, approverName: id, role, method: "DEMO_KEY", payloadHash: hash });

describe("two-person rule (pure)", () => {
  it("needs two different people, one of them Finance", () => {
    expect(evaluateApprovals([], H).satisfied).toBe(false);
    expect(evaluateApprovals([ap("dana", "coordinator")], H).satisfied).toBe(false);
    expect(evaluateApprovals([ap("dana", "coordinator"), ap("dana", "coordinator")], H).satisfied).toBe(false);
    expect(evaluateApprovals([ap("dana", "coordinator"), ap("lee", "coordinator")], H).needs).toContain("A Finance approver");
    expect(evaluateApprovals([ap("dana", "coordinator"), ap("sam", "finance")], H).satisfied).toBe(true);
  });
  it("ignores approvals given to a different payload", () => {
    expect(evaluateApprovals([ap("dana", "coordinator", "b".repeat(64)), ap("sam", "finance")], H).satisfied).toBe(false);
  });
});

describe("payout caps", () => {
  it("rejects oversize items and totals, zero and fractional amounts", () => {
    expect(checkPayoutCaps([{ amountCents: 100 }, { amountCents: 100 }])).toBeNull();
    expect(checkPayoutCaps([{ amountCents: 10_001 }])).toMatch(/capped/);
    expect(checkPayoutCaps(Array.from({ length: 6 }, () => ({ amountCents: 1000 })))).toMatch(/in total/);
    expect(checkPayoutCaps([{ amountCents: 0 }])).toBeTruthy();
    expect(checkPayoutCaps([{ amountCents: 1.5 }])).toBeTruthy();
    expect(checkPayoutCaps([])).toBeTruthy();
  });
});

const liveCase = (over: Partial<ReliefCase> = {}): ReliefCase =>
  ({
    origin: "SANDBOX_LIVE",
    caseRef: "sandbox:act_x:t1:hh_tbw_003",
    itemId: "PAYPALITEM3",
    batchId: "BATCH1",
    householdRef: "hh_tbw_003",
    amountUsd: 100,
    status: "UNCLAIMED",
    claimDaysLeft: 20,
    barrier: "NO_PAYPAL_ACCOUNT",
    evidence: [],
    ...over,
  }) as unknown as ReliefCase;

describe("buildProposal (server-derived, gated)", () => {
  const deps = (cases: ReliefCase[], active: string[] = [], receivers: Record<string, string> = { hh_tbw_003: "x@example.com", hh_a: "a@example.com", hh_b: "b@example.com" }) => ({
    loadLiveCases: async () => cases,
    activeHouseholds: async () => new Set(active),
    receiverFor: (hh: string) => receivers[hh] ?? null,
  });

  it("builds a cancel proposal from the stored case, with a payload hash over what PayPal reported", async () => {
    const r = await buildProposal({ kind: "CANCEL_ITEM", caseRef: "sandbox:act_x:t1:hh_tbw_003" }, deps([liveCase()]));
    expect(r.ok).toBe(true);
    if (r.ok && r.payload.kind === "CANCEL_ITEM") {
      expect(r.payload.paypalItemId).toBe("PAYPALITEM3");
      expect(r.payload.amountCents).toBe(10000);
      expect(r.payloadHash).toBe(hashCancelPayload(r.payload));
    }
  });
  it("refuses to cancel anything that is not unclaimed, or that the resident says they received", async () => {
    const credited = await buildProposal({ kind: "CANCEL_ITEM", caseRef: "sandbox:act_x:t1:hh_tbw_003" }, deps([liveCase({ status: "SUCCESS", claimDaysLeft: null })]));
    expect(credited.ok).toBe(false);
    const unknown = await buildProposal({ kind: "CANCEL_ITEM", caseRef: "sandbox:nope" }, deps([liveCase()]));
    expect(unknown.ok === false && unknown.status).toBe(404);
  });
  it("never reissues while the original could still land", async () => {
    const r = await buildProposal({ kind: "REISSUE", caseRef: "sandbox:act_x:t1:hh_tbw_003" }, deps([liveCase()]));
    expect(r.ok === false && r.error).toBe("not_allowed");
  });
  it("blocks duplicates, missing routes, caps and duplicate households in a new payout", async () => {
    const items = [{ householdId: "hh_a", amountCents: 100 }, { householdId: "hh_b", amountCents: 100 }];
    expect((await buildProposal({ kind: "NEW_PAYOUT", items }, deps([]))).ok).toBe(true);
    const dup = await buildProposal({ kind: "NEW_PAYOUT", items }, deps([], ["hh_a"]));
    expect(dup.ok === false && dup.error).toBe("duplicate_blocked");
    const noRoute = await buildProposal({ kind: "NEW_PAYOUT", items: [{ householdId: "hh_zzz", amountCents: 100 }] }, deps([]));
    expect(noRoute.ok === false && noRoute.error).toBe("no_payout_route");
    const big = await buildProposal({ kind: "NEW_PAYOUT", items: [{ householdId: "hh_a", amountCents: 99_999 }] }, deps([]));
    expect(big.ok === false && big.error).toBe("cap_exceeded");
    const twice = await buildProposal({ kind: "NEW_PAYOUT", items: [items[0], items[0]] }, deps([]));
    expect(twice.ok === false && twice.error).toBe("duplicate_household");
  });
  it("is deterministic: the same request yields the same hash and idempotency key", async () => {
    const items = [{ householdId: "hh_a", amountCents: 100 }, { householdId: "hh_b", amountCents: 100 }];
    const a = await buildProposal({ kind: "NEW_PAYOUT", items }, deps([]));
    const b = await buildProposal({ kind: "NEW_PAYOUT", items: [...items].reverse() }, deps([]));
    expect(a.ok && b.ok && a.idempotencyKey === b.idempotencyKey).toBe(true);
  });
  it("the approved hash changes if a household's payout route changes", async () => {
    const items = [{ householdId: "hh_a", amountCents: 100 }];
    const a = await buildProposal({ kind: "NEW_PAYOUT", items }, deps([]));
    const b = await buildProposal({ kind: "NEW_PAYOUT", items }, deps([], [], { hh_a: "other@example.com" }));
    expect(a.ok && b.ok && a.payloadHash !== b.payloadHash).toBe(true);
  });
});
