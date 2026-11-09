import { describe, it, expect } from "vitest";
import { evaluateReadiness, type ReadinessMonitorParams } from "@/lib/treasury/readiness-monitor";

describe("Pre-Disaster Readiness Monitor Engine (§4, §10, Priority 1)", () => {
  const healthyParams: ReadinessMonitorParams = {
    treasury: {
      totalCashCents: 100000, // $1,000.00
      reserveFloorPercentage: 0.3,
      feeReservePerItemCents: 250,
      committedCents: 0,
    },
    recipients: [
      { id: "hh_1", lat: 27.95, lng: -82.45, hasVerifiedEmailOrPayPal: true, lastReconfirmedAt: new Date().toISOString() },
      { id: "hh_2", lat: 27.96, lng: -82.46, hasVerifiedEmailOrPayPal: true, lastReconfirmedAt: new Date().toISOString() },
      { id: "hh_3", lat: 27.97, lng: -82.47, hasVerifiedEmailOrPayPal: true, lastReconfirmedAt: new Date().toISOString() },
    ],
    operational: {
      emergencyStopActive: false,
      operators: [
        { id: "ops_1", role: "coordinator", hasPasskeyRegistered: true },
        { id: "fin_1", role: "finance", hasPasskeyRegistered: true },
      ],
    },
    hazard: {
      lastPollAgeMinutes: 5,
      activeAlert: {
        eventKey: "TBW:HU.W:0009",
        phenomena: "HU",
        significance: "W",
        polygonCoordinates: [
          [-82.5, 27.8],
          [-82.3, 27.8],
          [-82.3, 28.1],
          [-82.5, 28.1],
        ],
      },
    },
  };

  it("evaluates a fully configured healthy system as READY with 100% score", () => {
    const res = evaluateReadiness(healthyParams);
    expect(res.status).toBe("READY");
    expect(res.overallScore).toBe(100);
    expect(res.allBlockingReasons.length).toBe(0);
    expect(res.financial.isSolvent).toBe(true);
    expect(res.operational.isDualCustodyReady).toBe(true);
    expect(res.hazard.triggerPhenomenonMatched).toBe(true);
  });

  it("BLOCKS readiness immediately when Emergency Stop is activated", () => {
    const blockedParams: ReadinessMonitorParams = {
      ...healthyParams,
      operational: {
        ...healthyParams.operational,
        emergencyStopActive: true,
      },
    };

    const res = evaluateReadiness(blockedParams);
    expect(res.status).toBe("BLOCKED");
    expect(res.operational.isEmergencyStopActive).toBe(true);
    expect(res.operational.isDualCustodyReady).toBe(false);
    expect(res.allBlockingReasons.some((r) => r.includes("EMERGENCY STOP"))).toBe(true);
  });

  it("BLOCKS readiness when treasury has zero cash", () => {
    const insolventParams: ReadinessMonitorParams = {
      ...healthyParams,
      treasury: {
        ...healthyParams.treasury,
        totalCashCents: 0,
      },
    };

    const res = evaluateReadiness(insolventParams);
    expect(res.status).toBe("BLOCKED");
    expect(res.financial.isSolvent).toBe(false);
    expect(res.financial.allocatableCents).toBe(0);
    expect(res.allBlockingReasons.some((r) => r.includes("zero available cash"))).toBe(true);
  });

  it("BLOCKS readiness when missing a Finance/Fiduciary passkey approver", () => {
    const missingFinParams: ReadinessMonitorParams = {
      ...healthyParams,
      operational: {
        ...healthyParams.operational,
        operators: [
          { id: "ops_1", role: "coordinator", hasPasskeyRegistered: true },
          // No finance role!
        ],
      },
    };

    const res = evaluateReadiness(missingFinParams);
    expect(res.status).toBe("BLOCKED");
    expect(res.operational.hasFinanceApprover).toBe(false);
    expect(res.operational.isDualCustodyReady).toBe(false);
    expect(res.allBlockingReasons.some((r) => r.includes("Finance/Fiduciary"))).toBe(true);
  });

  it("marks status DEGRADED when NWS feed is stale (> 60 minutes)", () => {
    const staleFeedParams: ReadinessMonitorParams = {
      ...healthyParams,
      hazard: {
        ...healthyParams.hazard,
        lastPollAgeMinutes: 120, // 2 hours old
      },
    };

    const res = evaluateReadiness(staleFeedParams);
    expect(res.status).toBe("DEGRADED");
    expect(res.hazard.isSentinelFeedFresh).toBe(false);
    expect(res.allBlockingReasons.some((r) => r.includes("stale"))).toBe(true);
  });
});

