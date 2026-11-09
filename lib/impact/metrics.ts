/**
 * MEASURABLE OPERATIONAL IMPACT FRAMEWORK (§12, Priority 3, Phase 1 Trust Fix)
 * Quantifies operational performance, speed-to-payout velocity, payment rail efficiency,
 * and delivery success across anticipatory humanitarian relief operations.
 *
 * Mathematical Integrity Invariants:
 * - PayPal Payouts domestic USD flat fee is $0.25 (25¢) per disbursement item.
 * - On a $100.00 grant: fee is $0.25 = 0.25% of disbursement (99.75% direct relief).
 * - On a $1.00 test payout: fee is $0.25 = 25.0% of disbursement (80.0% net capital efficiency of gross).
 * - Distinguishes between successful PayPal disbursement and physical cash-in-hand utilization.
 */

export interface OperationalTimelineTimestamps {
  nwsAlertIssuedAt: string;
  sentinelActivatedAt: string;
  firstApprovalAt: string;
  secondApprovalAt: string;
  paypalBatchSubmittedAt: string;
  paypalFirstItemSettledAt?: string;
  projectedLandfallAt: string;
}

export interface PayoutSettlementStats {
  totalItems: number;
  successCount: number;
  unclaimedCount: number;
  returnedCount: number;
  failedCount: number;
  unclaimedRescuedCount: number;
  totalDisbursedCents: number;
  totalFeesCents: number;
}

export interface OperationalImpactReport {
  generatedAt: string;
  provenance: "MODELLED_HISTORICAL_REPLAY" | "EMPIRICAL_SANDBOX" | "PRODUCTION";

  // Velocity Metrics
  forecastLeadTimeHours: number; // Hours before projected storm landfall funds were dispatched
  alertToDualApprovalMinutes: number; // Governance latency
  approvalToPayoutMinutes: number; // Execution latency
  totalTriggerToDisbursementMinutes: number; // End-to-end velocity

  // Capital & Rail Efficiency Metrics (Exact Math)
  totalGrossCents: number;
  overheadRatioPercentage: number; // Fees as % of gross funds committed
  feeToDisbursementRatioPercentage: number; // Fees as % of net relief disbursed
  directReliefPercentage: number; // % of donor capital directly credited to recipient accounts
  humanitarianMultiplier: string;

  // Delivery & Safeguard Metrics
  deliverySuccessRatePercentage: number;
  unclaimedRescueRatePercentage: number;
  settlementChannelStatus: string;
  performanceGrade: "EXCEPTIONAL" | "ACCEPTABLE" | "NEEDS_IMPROVEMENT";
}

/**
 * Calculates standard PayPal Payouts domestic flat fee (25¢ per item).
 */
export function calculateDomesticPayoutFee(itemCount: number): number {
  return itemCount * 25; // 25 cents per item
}

export function computeOperationalImpact({
  timestamps,
  payoutStats,
  provenance = "MODELLED_HISTORICAL_REPLAY",
}: {
  timestamps: OperationalTimelineTimestamps;
  payoutStats: PayoutSettlementStats;
  provenance?: "MODELLED_HISTORICAL_REPLAY" | "EMPIRICAL_SANDBOX" | "PRODUCTION";
}): OperationalImpactReport {
  const alertMs = new Date(timestamps.sentinelActivatedAt).getTime();
  const secondApprovalMs = new Date(timestamps.secondApprovalAt).getTime();
  const payoutSubmittedMs = new Date(timestamps.paypalBatchSubmittedAt).getTime();
  const landfallMs = new Date(timestamps.projectedLandfallAt).getTime();

  // Forecast lead time: hours from payout submission to projected storm landfall
  const leadTimeMs = Math.max(0, landfallMs - payoutSubmittedMs);
  const forecastLeadTimeHours = Math.round((leadTimeMs / (1000 * 60 * 60)) * 10) / 10;

  // Alert to dual approval: minutes
  const alertToApprovalMs = Math.max(0, secondApprovalMs - alertMs);
  const alertToDualApprovalMinutes = Math.round(alertToApprovalMs / (1000 * 60));

  // Approval to payout submission: minutes
  const approvalToPayoutMs = Math.max(0, payoutSubmittedMs - secondApprovalMs);
  const approvalToPayoutMinutes = Math.round(approvalToPayoutMs / (1000 * 60));

  // Total trigger to disbursement: minutes
  const totalTriggerToDisbursementMinutes = alertToDualApprovalMinutes + approvalToPayoutMinutes;

  // Capital efficiency (Exact mathematical calculation)
  const totalGrossCents = payoutStats.totalDisbursedCents + payoutStats.totalFeesCents;
  const overheadRatioPercentage =
    totalGrossCents > 0
      ? Math.round((payoutStats.totalFeesCents / totalGrossCents) * 10000) / 100
      : 0;

  const feeToDisbursementRatioPercentage =
    payoutStats.totalDisbursedCents > 0
      ? Math.round((payoutStats.totalFeesCents / payoutStats.totalDisbursedCents) * 10000) / 100
      : 0;

  const directReliefPercentage = Math.round((100 - overheadRatioPercentage) * 100) / 100;
  const humanitarianMultiplier = `${directReliefPercentage.toFixed(2)}% of committed capital credited directly to recipient PayPal accounts (${feeToDisbursementRatioPercentage.toFixed(2)}% flat rail overhead)`;

  // Delivery Success
  const deliverySuccessRatePercentage =
    payoutStats.totalItems > 0
      ? Math.round((payoutStats.successCount / payoutStats.totalItems) * 100)
      : 100;

  const unclaimedRescueRatePercentage =
    payoutStats.unclaimedCount > 0
      ? Math.round((payoutStats.unclaimedRescuedCount / payoutStats.unclaimedCount) * 100)
      : 100;

  // Performance Grade
  let performanceGrade: OperationalImpactReport["performanceGrade"] = "EXCEPTIONAL";
  if (forecastLeadTimeHours < 12 || deliverySuccessRatePercentage < 80) {
    performanceGrade = "NEEDS_IMPROVEMENT";
  } else if (forecastLeadTimeHours < 24 || deliverySuccessRatePercentage < 90) {
    performanceGrade = "ACCEPTABLE";
  }

  return {
    generatedAt: new Date().toISOString(),
    provenance,
    forecastLeadTimeHours,
    alertToDualApprovalMinutes,
    approvalToPayoutMinutes,
    totalTriggerToDisbursementMinutes,
    totalGrossCents,
    overheadRatioPercentage,
    feeToDisbursementRatioPercentage,
    directReliefPercentage,
    humanitarianMultiplier,
    deliverySuccessRatePercentage,
    unclaimedRescueRatePercentage,
    settlementChannelStatus: "DISBURSED_TO_VERIFIED_PAYPAL_ACCOUNT",
    performanceGrade,
  };
}
