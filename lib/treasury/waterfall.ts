import { calculateAllocatable } from "@/lib/ledger/index";

export interface WaterfallBreakdown {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  allocatableCents: number;
  contingentPledgesCents: number;
  activePledgesCount: number;
  eligibleHouseholdsCount: number;
  tranche1CostPerHouseholdCents: number;
  coveragePercentage: number; // Percentage of eligible households covered by allocatable funds
}

export function computeTreasuryWaterfall({
  paypalAvailableCents,
  reserveProtectedCents,
  feesReservedCents,
  committedCents,
  contingentPledgesCents = 0,
  activePledgesCount = 0,
  eligibleHouseholdsCount = 0,
  tranche1CostPerHouseholdCents = 10225, // $100 payout + $2.25 fee
}: {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  contingentPledgesCents?: number;
  activePledgesCount?: number;
  eligibleHouseholdsCount?: number;
  tranche1CostPerHouseholdCents?: number;
}): WaterfallBreakdown {
  // Tranche 1 can draw on reserve_protected
  const allocatableCents = calculateAllocatable({
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    isTranche1: true,
  });

  const totalDemandCents = eligibleHouseholdsCount * tranche1CostPerHouseholdCents;
  const coveragePercentage =
    totalDemandCents > 0
      ? Math.min(100, Math.round((allocatableCents / totalDemandCents) * 100))
      : 100;

  return {
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    allocatableCents,
    contingentPledgesCents,
    activePledgesCount,
    eligibleHouseholdsCount,
    tranche1CostPerHouseholdCents,
    coveragePercentage,
  };
}
