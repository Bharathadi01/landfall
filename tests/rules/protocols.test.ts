import { describe, it, expect } from "vitest";
import {
  FLORIDA_HURRICANE_PROTOCOL_V1,
  evaluateProtocolMatch,
  cancelAndReleaseAllocations,
  type FalseAlarmCancellationRequest,
} from "@/lib/rules/protocols";

describe("Versioned Response Protocol Engine (§4, §10, Priority 1)", () => {
  it("matches a valid Hurricane Warning against Florida Hurricane Protocol", () => {
    const alert = { phenomena: "HU", significance: "W", severity: "Extreme" };
    const match = evaluateProtocolMatch(FLORIDA_HURRICANE_PROTOCOL_V1, alert);
    expect(match.isMatch).toBe(true);
    expect(match.failureReasons.length).toBe(0);
  });

  it("rejects an unsupported phenomenon (e.g. Winter Storm WS)", () => {
    const alert = { phenomena: "WS", significance: "W", severity: "Severe" };
    const match = evaluateProtocolMatch(FLORIDA_HURRICANE_PROTOCOL_V1, alert);
    expect(match.isMatch).toBe(false);
    expect(match.failureReasons.some((r) => r.includes("not supported"))).toBe(true);
  });

  it("rejects a Watch (significance 'A') when Warning ('W') is required", () => {
    const alert = { phenomena: "HU", significance: "A", severity: "Severe" };
    const match = evaluateProtocolMatch(FLORIDA_HURRICANE_PROTOCOL_V1, alert);
    expect(match.isMatch).toBe(false);
    expect(match.failureReasons.some((r) => r.includes("Significance"))).toBe(true);
  });

  it("releases uncommitted reserves back to treasury when false alarm is issued in draft or approved state", () => {
    const req: FalseAlarmCancellationRequest = {
      activationId: "TBW:HU.W:0009",
      reason: "TRACK_DIVERGENCE",
      cancellationNote: "Storm veered 120 miles west; Tampa Bay tropical storm force probability dropped below 5%.",
      canceledBy: { operatorId: "ops_lead_01", role: "coordinator" },
      currentPlanState: "approved_2",
      committedCents: 50000, // $500 committed
    };

    const res = cancelAndReleaseAllocations(req);
    expect(res.success).toBe(true);
    expect(res.actionTaken).toBe("UNCOMMITTED_RESERVES_RELEASED");
    expect(res.releasedCents).toBe(50000);
    expect(res.message).toContain("Released $500.00 uncommitted reserves");
  });

  it("REFUSES to unilaterally cancel if payout batch was already submitted to PayPal", () => {
    const req: FalseAlarmCancellationRequest = {
      activationId: "TBW:HU.W:0009",
      reason: "TRACK_DIVERGENCE",
      cancellationNote: "Storm veered west.",
      canceledBy: { operatorId: "ops_lead_01", role: "coordinator" },
      currentPlanState: "submitted",
      committedCents: 50000,
    };

    const res = cancelAndReleaseAllocations(req);
    expect(res.success).toBe(false);
    expect(res.actionTaken).toBe("ALREADY_SUBMITTED_CANNOT_UNCOMMIT");
    expect(res.releasedCents).toBe(0);
    expect(res.message).toContain("already been dispatched to PayPal");
  });

  it("REFUSES cancellation from unauthorized roles", () => {
    const req: FalseAlarmCancellationRequest = {
      activationId: "TBW:HU.W:0009",
      reason: "TRACK_DIVERGENCE",
      cancellationNote: "Storm veered west.",
      canceledBy: { operatorId: "anon_user", role: "finance" as any }, // Only coordinator or admin can cancel
      currentPlanState: "draft",
      committedCents: 50000,
    };

    const res = cancelAndReleaseAllocations(req);
    expect(res.success).toBe(false);
    expect(res.actionTaken).toBe("INVALID_ROLE");
  });
});

