/**
 * DETERMINISTIC RESPONSE SCENARIO SIMULATOR (§3, §4, M6)
 * Pure deterministic code — ZERO AI imports.
 * Simulates policy allocation what-if scenarios over verified data snapshots.
 */

import { evaluateFinancialReadiness, type FinancialReadinessResult } from "@/lib/treasury/readiness";
import { type HouseholdProfile, evaluateTranche1, type PolicyConfig } from "./engine";

export interface ScenarioDefinition {
  scenarioId: "BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS";
  title: string;
  description: string;
  reserveProtectedCents: number;
  payoutAmountCents: number;
  targetTiers?: number[]; // e.g. [1, 2] for priority focus
}

export interface SimulatedScenarioResult {
  scenarioId: string;
  title: string;
  description: string;
  payoutPerHouseholdFormatted: string;
  reserveProtectedFormatted: string;
  allocatableFormatted: string;
  requiredFundingFormatted: string;
  fundingGapFormatted: string;
  fundedHouseholdsCount: number;
  waitlistedHouseholdsCount: number;
  coveragePercentage: number;
  readinessState: string;
  isFullyFunded: boolean;
  notes: string;
}

export function simulateResponseScenarios({
  paypalAvailableCents,
  baseReserveProtectedCents,
  feesReservedCents,
  committedCents,
  contingentPledgesCents = 0,
  households,
  baseConfig,
}: {
  paypalAvailableCents: number;
  baseReserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  contingentPledgesCents?: number;
  households: HouseholdProfile[];
  baseConfig: PolicyConfig;
}): SimulatedScenarioResult[] {
  // Scenario 1: Baseline Standard
  const r1 = evaluateFinancialReadiness({
    paypalAvailableCents,
    reserveProtectedCents: baseReserveProtectedCents,
    feesReservedCents,
    committedCents,
    contingentPledgesCents,
    eligibleHouseholdsCount: households.length,
    costPerHouseholdCents: baseConfig.tranche1AmountCents + 225, // with fee
  });

  const p1 = evaluateTranche1({
    households,
    allocatableCents: r1.allocatableCents,
    config: baseConfig,
  });

  // Scenario 2: Constrained Reserve (reduces reserve by 50% to maximize immediate disbursement)
  const constrainedReserve = Math.round(baseReserveProtectedCents * 0.5);
  const r2 = evaluateFinancialReadiness({
    paypalAvailableCents,
    reserveProtectedCents: constrainedReserve,
    feesReservedCents,
    committedCents,
    contingentPledgesCents,
    eligibleHouseholdsCount: households.length,
    costPerHouseholdCents: baseConfig.tranche1AmountCents + 225,
  });

  const p2 = evaluateTranche1({
    households,
    allocatableCents: r2.allocatableCents,
    config: baseConfig,
  });

  // Scenario 3: Priority Focus (Tiers 1 and 2 only: Medical devices & Elderly living alone)
  const priorityHouseholds = households.filter((h) => h.hasMedicalDevice || h.isElderlyLivingAlone);
  const r3 = evaluateFinancialReadiness({
    paypalAvailableCents,
    reserveProtectedCents: baseReserveProtectedCents,
    feesReservedCents,
    committedCents,
    contingentPledgesCents,
    eligibleHouseholdsCount: priorityHouseholds.length,
    costPerHouseholdCents: baseConfig.tranche1AmountCents + 225,
  });

  const p3 = evaluateTranche1({
    households: priorityHouseholds,
    allocatableCents: r3.allocatableCents,
    config: baseConfig,
  });

  return [
    {
      scenarioId: "BASELINE",
      title: "Standard Tranche 1 (Full Scope)",
      description: `Default policy ($${(baseConfig.tranche1AmountCents / 100).toFixed(2)}/hh) across all ${households.length} enrolled households with standard $${(baseReserveProtectedCents / 100).toFixed(2)} protected reserve.`,
      payoutPerHouseholdFormatted: `$${(baseConfig.tranche1AmountCents / 100).toFixed(2)}`,
      reserveProtectedFormatted: `$${(baseReserveProtectedCents / 100).toFixed(2)}`,
      allocatableFormatted: `$${(r1.allocatableCents / 100).toFixed(2)}`,
      requiredFundingFormatted: `$${(r1.requiredFundingCents / 100).toFixed(2)}`,
      fundingGapFormatted: `$${(r1.fundingGapCents / 100).toFixed(2)}`,
      fundedHouseholdsCount: p1.fundedHouseholds.length,
      waitlistedHouseholdsCount: p1.waitlistedHouseholds.length,
      coveragePercentage: r1.coveragePercentage,
      readinessState: r1.state,
      isFullyFunded: r1.isFullyFunded,
      notes: r1.isFullyFunded
        ? "All eligible households can be disbursed immediately."
        : `${p1.waitlistedHouseholds.length} lower-priority households will be waitlisted until additional donations or pledges settle.`,
    },
    {
      scenarioId: "CONSTRAINED_RESERVE",
      title: "Reduced Reserve Buffer (50% Reserve)",
      description: `Temporarily lowers protected reserve to $${(constrainedReserve / 100).toFixed(2)} to release $${((baseReserveProtectedCents - constrainedReserve) / 100).toFixed(2)} additional liquid cash.`,
      payoutPerHouseholdFormatted: `$${(baseConfig.tranche1AmountCents / 100).toFixed(2)}`,
      reserveProtectedFormatted: `$${(constrainedReserve / 100).toFixed(2)}`,
      allocatableFormatted: `$${(r2.allocatableCents / 100).toFixed(2)}`,
      requiredFundingFormatted: `$${(r2.requiredFundingCents / 100).toFixed(2)}`,
      fundingGapFormatted: `$${(r2.fundingGapCents / 100).toFixed(2)}`,
      fundedHouseholdsCount: p2.fundedHouseholds.length,
      waitlistedHouseholdsCount: p2.waitlistedHouseholds.length,
      coveragePercentage: r2.coveragePercentage,
      readinessState: r2.state,
      isFullyFunded: r2.isFullyFunded,
      notes: "Requires formal Finance role sign-off because operating reserves are halved.",
    },
    {
      scenarioId: "PRIORITY_TIER_FOCUS",
      title: "Priority Tiers Only (P1 Medical & P2 Elderly)",
      description: `Targeted release prioritizing ${priorityHouseholds.length} acute high-vulnerability households (life-support devices and isolated seniors).`,
      payoutPerHouseholdFormatted: `$${(baseConfig.tranche1AmountCents / 100).toFixed(2)}`,
      reserveProtectedFormatted: `$${(baseReserveProtectedCents / 100).toFixed(2)}`,
      allocatableFormatted: `$${(r3.allocatableCents / 100).toFixed(2)}`,
      requiredFundingFormatted: `$${(r3.requiredFundingCents / 100).toFixed(2)}`,
      fundingGapFormatted: `$${(r3.fundingGapCents / 100).toFixed(2)}`,
      fundedHouseholdsCount: p3.fundedHouseholds.length,
      waitlistedHouseholdsCount: p3.waitlistedHouseholds.length,
      coveragePercentage: r3.coveragePercentage,
      readinessState: r3.state,
      isFullyFunded: r3.isFullyFunded,
      notes: "Ensures immediate cash to life-safety cases while remaining within constrained liquid balance.",
    },
  ];
}

