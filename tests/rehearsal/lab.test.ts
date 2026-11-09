import { describe, it, expect } from "vitest";
import {
  REHEARSAL_STORMS,
  REHEARSAL_SCENARIOS,
  runStormRehearsal,
  type RehearsalScenarioId,
} from "@/lib/rehearsal/lab";

describe("Phase 3 — Storm Rehearsal Lab (§7)", () => {
  it("provides authentic historical storms with documented lead times", () => {
    expect(REHEARSAL_STORMS.length).toBeGreaterThanOrEqual(3);
    const milton = REHEARSAL_STORMS.find((s) => s.stormId === "milton-2024");
    expect(milton).toBeDefined();
    expect(milton?.historicalLeadTimeHours).toBeGreaterThan(48); // ~52.4h warning lead time
    expect(milton?.peakCategory).toBe(5);
  });

  it("supports all seven required stress scenarios", () => {
    const requiredScenarios: RehearsalScenarioId[] = [
      "NORMAL_FUNDING",
      "FUNDING_SHORTFALL",
      "INCREASED_EXPOSURE",
      "DELAYED_VERIFICATION",
      "FAILED_PAYOUT",
      "FALSE_ALARM",
      "RESERVE_PROTECTION",
    ];

    for (const scId of requiredScenarios) {
      expect(REHEARSAL_SCENARIOS[scId]).toBeDefined();
      expect(REHEARSAL_SCENARIOS[scId].title).toBeTruthy();
      expect(REHEARSAL_SCENARIOS[scId].explanation).toBeTruthy();
    }
  });

  describe("Scenario 1: NORMAL_FUNDING", () => {
    it("disburses 100% of exposed households when liquidity is plentiful", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "NORMAL_FUNDING",
      });

      expect(res.rehearsalPayoutStatus).toBe("COMPLETED_SANDBOX");
      expect(res.exposedHouseholdsCount).toBeGreaterThan(0);
      expect(res.fundedCount).toBe(res.exposedHouseholdsCount);
      expect(res.waitlistedCount).toBe(0);
      expect(res.readiness.isFullyFunded).toBe(true);
      expect(res.reconciliationSummary.totalFeesFormatted).toBe("$1.25"); // 5 hh * $0.25 flat PayPal domestic fee
    });
  });

  describe("Scenario 2: FUNDING_SHORTFALL", () => {
    it("waitlists lower-tier households deterministically without AI or human bias", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "FUNDING_SHORTFALL",
      });

      expect(res.rehearsalPayoutStatus).toBe("COMPLETED_SANDBOX");
      expect(res.readiness.isFullyFunded).toBe(false);
      expect(res.waitlistedCount).toBeGreaterThan(0);
      expect(res.fundedCount).toBeGreaterThan(0);
      expect(res.fundedCount + res.waitlistedCount).toBe(res.exposedHouseholdsCount);
    });
  });

  describe("Scenario 3: INCREASED_EXPOSURE", () => {
    it("dynamically increases exposed count when hazard polygon expands inland", () => {
      const normalRes = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "NORMAL_FUNDING",
      });
      const expandedRes = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "INCREASED_EXPOSURE",
      });

      expect(expandedRes.exposedHouseholdsCount).toBeGreaterThan(normalRes.exposedHouseholdsCount);
    });
  });

  describe("Scenario 4: DELAYED_VERIFICATION", () => {
    it("holds unverified households in NEEDS_REVIEW without disbursing unauthorized cash", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "DELAYED_VERIFICATION",
      });

      expect(res.needsReviewCount).toBe(2);
      expect(res.fundedCount).toBeLessThan(res.exposedHouseholdsCount + res.needsReviewCount);
    });
  });

  describe("Scenario 5: FAILED_PAYOUT", () => {
    it("simulates account failure and flags unclaimed rollback", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "FAILED_PAYOUT",
      });

      expect(res.rehearsalPayoutStatus).toBe("FAILED_REVERTED");
      expect(res.reconciliationSummary.unclaimedOrFailedCount).toBe(1);
      expect(res.explanation).toContain("PAYMENT FAILED/UNCLAIMED");
    });
  });

  describe("Scenario 6: FALSE_ALARM", () => {
    it("halts money movement safely when warning is cancelled, disbursing $0.00", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "FALSE_ALARM",
      });

      expect(res.rehearsalPayoutStatus).toBe("HALTED_BY_POLICY");
      expect(res.disbursedAmountCents).toBe(0);
      expect(res.fundedCount).toBe(0);
      expect(res.explanation).toContain("ALERT CANCELLED");
    });
  });

  describe("Scenario 7: RESERVE_PROTECTION", () => {
    it("mathematically protects operating reserve against depletion", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "RESERVE_PROTECTION",
      });

      expect(res.readiness.waterfall.reserveProtectedCents).toBe(500000); // $5,000 locked
      expect(res.readiness.allocatableCents).toBeLessThanOrEqual(50000); // $50 allocatable
    });
  });

  describe("Rehearsal Safety & Provenance Invariants", () => {
    it("generates an immutable audit hash for every rehearsal batch", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "NORMAL_FUNDING",
      });

      expect(res.reconciliationSummary.immutableAuditHash).toContain("sha256_milton-2024_NORMAL_FUNDING");
      expect(res.reconciliationSummary.paypalBatchId).toContain("REHEARSAL-MILTON-2024");
    });

    it("requires two-person passkey signatures for authorization rehearsal", () => {
      const res = runStormRehearsal({
        stormId: "milton-2024",
        scenarioId: "NORMAL_FUNDING",
      });

      expect(res.dualApprovers.length).toBe(2);
      expect(res.dualApprovers[0].role).toBe("Disaster Fund Coordinator");
      expect(res.dualApprovers[1].role).toBe("Treasury Trustee");
    });
  });
});
