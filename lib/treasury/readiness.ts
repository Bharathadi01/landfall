/**
 * DETERMINISTIC FINANCIAL READINESS EVALUATOR (§3, M6)
 * Pure code service — ZERO AI imports.
 * Invariants:
 * 1. Evaluates whether a relief fund can safely release a policy tranche.
 * 2. States: READY, CONSTRAINED, INSUFFICIENT_FUNDS, STALE_DATA, RECONCILIATION_REQUIRED, INSUFFICIENT_DATA.
 * 3. Never confuses captured with available, or contingent pledges with liquid cash.
 */

import { computeTreasuryWaterfall, type WaterfallBreakdown } from "./waterfall";
import { isWeatherFeedStale } from "@/lib/sentinel/normalize";

export type FinancialReadinessState =
  | "READY"
  | "CONSTRAINED"
  | "INSUFFICIENT_FUNDS"
  | "STALE_DATA"
  | "RECONCILIATION_REQUIRED"
  | "INSUFFICIENT_DATA";

export interface FinancialReadinessInput {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  contingentPledgesCents?: number;
  activePledgesCount?: number;
  eligibleHouseholdsCount: number;
  costPerHouseholdCents?: number; // Default: $100 payout + estimated fee
  hasUnreconciledDiscrepancy?: boolean;
  isReconciliationStale?: boolean;
  weatherLastSyncedAt?: Date | string | null;
  treasuryLastSyncedAt?: Date | string | null;
}

export interface FinancialReadinessResult {
  state: FinancialReadinessState;
  reason: string;
  coverageRatio: number; // 0.0 to 1.0 (or > 1.0)
  coveragePercentage: number; // 0% to 100%
  allocatableCents: number;
  requiredFundingCents: number;
  fundingGapCents: number;
  isFullyFunded: boolean;
  isConstrained: boolean;
  contingentPledgesCents: number;
  waterfall: WaterfallBreakdown;
  evidenceId: string;
  evaluatedAt: string;
}

export function evaluateFinancialReadiness(
  input: FinancialReadinessInput
): FinancialReadinessResult {
  const evaluatedAt = new Date().toISOString();
  const evidenceId = `readiness_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Default cost per household in Tranche 1 ($100 disbursement + $0.25 flat PayPal domestic fee)
  const costPerHouseholdCents = input.costPerHouseholdCents ?? 10025;

  const waterfall = computeTreasuryWaterfall({
    paypalAvailableCents: input.paypalAvailableCents,
    reserveProtectedCents: input.reserveProtectedCents,
    feesReservedCents: input.feesReservedCents,
    committedCents: input.committedCents,
    contingentPledgesCents: input.contingentPledgesCents ?? 0,
    activePledgesCount: input.activePledgesCount ?? 0,
    eligibleHouseholdsCount: input.eligibleHouseholdsCount,
    tranche1CostPerHouseholdCents: costPerHouseholdCents,
  });

  const allocatableCents = waterfall.allocatableCents;
  const requiredFundingCents = input.eligibleHouseholdsCount * costPerHouseholdCents;
  const fundingGapCents = Math.max(0, requiredFundingCents - allocatableCents);
  const coverageRatio =
    requiredFundingCents > 0
      ? Number((allocatableCents / requiredFundingCents).toFixed(2))
      : 1.0;
  const coveragePercentage = waterfall.coveragePercentage;
  const isFullyFunded = allocatableCents >= requiredFundingCents;
  const isConstrained = !isFullyFunded && allocatableCents > 0;

  // 1. Data Freshness Check
  const isWeatherStale = input.weatherLastSyncedAt
    ? isWeatherFeedStale(input.weatherLastSyncedAt)
    : false;
  const isTreasuryStale = input.treasuryLastSyncedAt
    ? isWeatherFeedStale(input.treasuryLastSyncedAt)
    : false;

  if (isWeatherStale || isTreasuryStale) {
    return {
      state: "STALE_DATA",
      reason: `Financial telemetry or disaster alerts are stale (last synced > 10 min ago). Fresh sync required prior to plan approval.`,
      coverageRatio,
      coveragePercentage,
      allocatableCents,
      requiredFundingCents,
      fundingGapCents,
      isFullyFunded,
      isConstrained,
      contingentPledgesCents: waterfall.contingentPledgesCents,
      waterfall,
      evidenceId,
      evaluatedAt,
    };
  }

  // 2. Reconciliation Discrepancy Check
  if (input.hasUnreconciledDiscrepancy || input.isReconciliationStale) {
    return {
      state: "RECONCILIATION_REQUIRED",
      reason: `Outstanding ledger discrepancy or unverified transaction timing difference detected. Finance must review reconciliation report.`,
      coverageRatio,
      coveragePercentage,
      allocatableCents,
      requiredFundingCents,
      fundingGapCents,
      isFullyFunded,
      isConstrained,
      contingentPledgesCents: waterfall.contingentPledgesCents,
      waterfall,
      evidenceId,
      evaluatedAt,
    };
  }

  // 3. Insufficient Data Check
  if (input.paypalAvailableCents < 0 || input.eligibleHouseholdsCount < 0) {
    return {
      state: "INSUFFICIENT_DATA",
      reason: `Incomplete fund parameters or invalid negative balance detected.`,
      coverageRatio: 0,
      coveragePercentage: 0,
      allocatableCents: 0,
      requiredFundingCents: 0,
      fundingGapCents: 0,
      isFullyFunded: false,
      isConstrained: false,
      contingentPledgesCents: 0,
      waterfall,
      evidenceId,
      evaluatedAt,
    };
  }

  // 4. Insufficient Funds Check (Zero or negative allocatable cash)
  if (allocatableCents <= 0 && requiredFundingCents > 0) {
    return {
      state: "INSUFFICIENT_FUNDS",
      reason: `Allocatable balance is $0.00 after accounting for protected reserves ($${(input.reserveProtectedCents / 100).toFixed(2)}) and committed funds ($${(input.committedCents / 100).toFixed(2)}).`,
      coverageRatio: 0,
      coveragePercentage: 0,
      allocatableCents: 0,
      requiredFundingCents,
      fundingGapCents: requiredFundingCents,
      isFullyFunded: false,
      isConstrained: false,
      contingentPledgesCents: waterfall.contingentPledgesCents,
      waterfall,
      evidenceId,
      evaluatedAt,
    };
  }

  // 5. Constrained Funds Check (Partial coverage)
  if (allocatableCents < requiredFundingCents) {
    return {
      state: "CONSTRAINED",
      reason: `Allocatable balance ($${(allocatableCents / 100).toFixed(2)}) covers ${coveragePercentage}% of the $${(requiredFundingCents / 100).toFixed(2)} requirement for ${input.eligibleHouseholdsCount} households. Funding gap is $${(fundingGapCents / 100).toFixed(2)}.`,
      coverageRatio,
      coveragePercentage,
      allocatableCents,
      requiredFundingCents,
      fundingGapCents,
      isFullyFunded: false,
      isConstrained: true,
      contingentPledgesCents: waterfall.contingentPledgesCents,
      waterfall,
      evidenceId,
      evaluatedAt,
    };
  }

  // 6. Ready State (100% or greater coverage)
  return {
    state: "READY",
    reason: `Verified allocatable balance ($${(allocatableCents / 100).toFixed(2)}) fully covers the $${(requiredFundingCents / 100).toFixed(2)} requirement (${coveragePercentage}% coverage). Reserve is protected.`,
    coverageRatio,
    coveragePercentage,
    allocatableCents,
    requiredFundingCents,
    fundingGapCents: 0,
    isFullyFunded: true,
    isConstrained: false,
    contingentPledgesCents: waterfall.contingentPledgesCents,
    waterfall,
    evidenceId,
    evaluatedAt,
  };
}

