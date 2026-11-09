import { describe, it, expect } from "vitest";
import { computeOperationalImpact, calculateDomesticPayoutFee } from "@/lib/impact/metrics";

describe("Measurable Operational Impact Framework (§12, Priority 3, Trust Fix)", () => {
  it("calculates exact mathematical rail efficiency for 5 x $100 disaster grants (0.25% fee overhead)", () => {
    const now = Date.now();
    const timestamps = {
      nwsAlertIssuedAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      sentinelActivatedAt: new Date(now - 47.5 * 3600 * 1000).toISOString(),
      firstApprovalAt: new Date(now - 47 * 3600 * 1000).toISOString(),
      secondApprovalAt: new Date(now - 46.8 * 3600 * 1000).toISOString(),
      paypalBatchSubmittedAt: new Date(now - 46.7 * 3600 * 1000).toISOString(),
      projectedLandfallAt: new Date(now).toISOString(), // 46.7 hours ahead of landfall
    };

    // 5 households @ $100 = $500.00. Fee is 5 x $0.25 = $1.25 (125¢)
    const feesCents = calculateDomesticPayoutFee(5);
    expect(feesCents).toBe(125);

    const payoutStats = {
      totalItems: 5,
      successCount: 4,
      unclaimedCount: 1,
      returnedCount: 0,
      failedCount: 0,
      unclaimedRescuedCount: 1,
      totalDisbursedCents: 50000, // $500.00
      totalFeesCents: feesCents, // $1.25
    };

    const impact = computeOperationalImpact({
      timestamps,
      payoutStats,
      provenance: "MODELLED_HISTORICAL_REPLAY",
    });

    expect(impact.forecastLeadTimeHours).toBeCloseTo(46.7, 1);
    expect(impact.provenance).toBe("MODELLED_HISTORICAL_REPLAY");
    // $1.25 / $500.00 = exactly 0.25%
    expect(impact.feeToDisbursementRatioPercentage).toBe(0.25);
    // Direct relief reaching recipient PayPal account is 99.75%
    expect(impact.directReliefPercentage).toBe(99.75);
    expect(impact.humanitarianMultiplier).toContain("99.75% of committed capital credited directly");
    expect(impact.settlementChannelStatus).toBe("DISBURSED_TO_VERIFIED_PAYPAL_ACCOUNT");
  });

  it("calculates exact mathematical overhead for a single $1.00 empirical test payout (25.0% fee overhead)", () => {
    const now = Date.now();
    const timestamps = {
      nwsAlertIssuedAt: new Date(now - 2 * 3600 * 1000).toISOString(),
      sentinelActivatedAt: new Date(now - 1.8 * 3600 * 1000).toISOString(),
      firstApprovalAt: new Date(now - 1.5 * 3600 * 1000).toISOString(),
      secondApprovalAt: new Date(now - 1.2 * 3600 * 1000).toISOString(),
      paypalBatchSubmittedAt: new Date(now - 1.0 * 3600 * 1000).toISOString(),
      projectedLandfallAt: new Date(now + 24 * 3600 * 1000).toISOString(),
    };

    // 1 item @ $1.00 = $1.00 (100¢). Fee is $0.25 (25¢)
    const payoutStats = {
      totalItems: 1,
      successCount: 1,
      unclaimedCount: 0,
      returnedCount: 0,
      failedCount: 0,
      unclaimedRescuedCount: 0,
      totalDisbursedCents: 100, // $1.00
      totalFeesCents: 25, // $0.25 flat fee
    };

    const impact = computeOperationalImpact({
      timestamps,
      payoutStats,
      provenance: "EMPIRICAL_SANDBOX",
    });

    // $0.25 on $1.00 net disbursement = 25.0%
    expect(impact.feeToDisbursementRatioPercentage).toBe(25.0);
    // $0.25 on $1.25 gross funds = 20.0% overhead
    expect(impact.overheadRatioPercentage).toBe(20.0);
    expect(impact.directReliefPercentage).toBe(80.0);
  });
});
