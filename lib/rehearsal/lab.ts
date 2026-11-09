/**
 * LANDFALL STORM REHEARSAL LAB ORCHESTRATOR (§7)
 * Signature Product Innovation:
 * Allows community relief coordinators to practise a complete anticipatory disaster-relief
 * financial workflow using authentic historical storm data and stress scenarios.
 *
 * Invariants:
 * 1. Rehearsal Mode is strictly isolated: NEVER initiates live PayPal payments.
 * 2. Simulated scenario calculations are visibly distinguished from empirical PayPal sandbox receipts.
 * 3. Deterministic Turf.js spatial exposure and policy rules — AI NEVER decides eligibility or moves money.
 */

import { SYNTHETIC_HOUSEHOLDS, type SyntheticHousehold } from "@/lib/fixtures/households";
import { isPointInsideAlertGeometry, type GeoPoint } from "@/lib/geo/resolver";
import { evaluateTranche1, type HouseholdProfile, type PolicyConfig } from "@/lib/rules/engine";
import { evaluateFinancialReadiness, type FinancialReadinessResult } from "@/lib/treasury/readiness";
import type { NormalizedAlert } from "@/lib/sentinel/types";

export type RehearsalScenarioId =
  | "NORMAL_FUNDING"
  | "FUNDING_SHORTFALL"
  | "INCREASED_EXPOSURE"
  | "DELAYED_VERIFICATION"
  | "FAILED_PAYOUT"
  | "FALSE_ALARM"
  | "RESERVE_PROTECTION";

export type RehearsalStep =
  | "WATCH_ISSUANCE"
  | "WARNING_UPGRADE"
  | "EXPOSURE_EVALUATION"
  | "PLAN_GENERATION"
  | "AI_PLAN_REVIEW"
  | "DUAL_PASSKEY_APPROVAL"
  | "SANDBOX_PAYOUT_REHEARSAL"
  | "RECONCILIATION";

export interface RehearsalStormMeta {
  stormId: string;
  name: string;
  year: number;
  peakCategory: number;
  landfallWfo: string;
  landfallTime: string;
  historicalLeadTimeHours: number;
  summary: string;
}

export const REHEARSAL_STORMS: RehearsalStormMeta[] = [
  {
    stormId: "milton-2024",
    name: "Hurricane Milton",
    year: 2024,
    peakCategory: 5,
    landfallWfo: "TBW (Tampa Bay)",
    landfallTime: "2024-10-10T00:30:00Z",
    historicalLeadTimeHours: 52.4,
    summary: "Record rapid-intensification Gulf hurricane; official hurricane watch issued ~52 hours before Siesta Key landfall.",
  },
  {
    stormId: "helene-2024",
    name: "Hurricane Helene",
    year: 2024,
    peakCategory: 4,
    landfallWfo: "TAE (Tallahassee / Big Bend)",
    landfallTime: "2024-09-27T03:10:00Z",
    historicalLeadTimeHours: 48.0,
    summary: "Historic storm surge and catastrophic inland flood across Florida Big Bend and Southeast Appalachia.",
  },
  {
    stormId: "idalia-2023",
    name: "Hurricane Idalia",
    year: 2023,
    peakCategory: 3,
    landfallWfo: "TAE (Keaton Beach)",
    landfallTime: "2023-08-30T11:45:00Z",
    historicalLeadTimeHours: 41.5,
    summary: "Severe Category 3 landfall in Taylor County with unprecedented storm surge in Cedar Key and Tampa Bay.",
  },
];

export interface RehearsalScenarioConfig {
  id: RehearsalScenarioId;
  title: string;
  description: string;
  explanation: string;
  initialPayPalCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  contingentPledgesCents: number;
  expandExposurePolygon: boolean;
  unverifiedHouseholdsCount: number;
  simulatePayoutFailure: boolean;
  simulateFalseAlarmDowngrade: boolean;
}

export const REHEARSAL_SCENARIOS: Record<RehearsalScenarioId, RehearsalScenarioConfig> = {
  NORMAL_FUNDING: {
    id: "NORMAL_FUNDING",
    title: "Normal Available Funding",
    description: "Standard operating state with adequate treasury reserves and 100% coverage.",
    explanation: "Treasury holds $25,000 liquid PayPal balance, easily covering all exposed enrolled households ($100 each) while maintaining full $5,000 reserve.",
    initialPayPalCents: 2500000,
    reserveProtectedCents: 500000,
    feesReservedCents: 5000,
    contingentPledgesCents: 1000000,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: false,
  },
  FUNDING_SHORTFALL: {
    id: "FUNDING_SHORTFALL",
    title: "Funding Shortfall & Waitlisting",
    description: "Liquid treasury is constrained, forcing deterministic tier-based prioritization.",
    explanation: "Liquid balance is restricted to $250. Tier 1 (medical device) and Tier 2 (elderly living alone) are funded first; lower tiers are automatically waitlisted without human bias.",
    initialPayPalCents: 25000,
    reserveProtectedCents: 5000,
    feesReservedCents: 1000,
    contingentPledgesCents: 200000,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: false,
  },
  INCREASED_EXPOSURE: {
    id: "INCREASED_EXPOSURE",
    title: "Increased Hazard Exposure (Expanded Cone)",
    description: "Warning polygon expands eastward, adding inland households to exposure zone.",
    explanation: "NWS issues an updated warning polygon encompassing inland Orlando households (hh_orl_006). Spatial engine automatically identifies newly exposed households and recalculates required capital.",
    initialPayPalCents: 2000000,
    reserveProtectedCents: 500000,
    feesReservedCents: 5000,
    contingentPledgesCents: 500000,
    expandExposurePolygon: true,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: false,
  },
  DELAYED_VERIFICATION: {
    id: "DELAYED_VERIFICATION",
    title: "Delayed Beneficiary Verification",
    description: "Certain households have incomplete documentation, holding them in NEEDS_REVIEW.",
    explanation: "Two households have pending utility bills or unverified PayPal IDs. Policy engine holds them in NEEDS_REVIEW with an automatic appeal link, preventing unauthorized disbursement.",
    initialPayPalCents: 2000000,
    reserveProtectedCents: 500000,
    feesReservedCents: 5000,
    contingentPledgesCents: 500000,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 2,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: false,
  },
  FAILED_PAYOUT: {
    id: "FAILED_PAYOUT",
    title: "Failed / Unclaimed Payout Route",
    description: "Simulates recipient PayPal account lock or unclaimed transfer timeout.",
    explanation: "A simulated payout to an unverified email transitions to UNCLAIMED after timeout. The system automatically rolls back unspent cash and drafts claim assistance instructions.",
    initialPayPalCents: 2000000,
    reserveProtectedCents: 500000,
    feesReservedCents: 5000,
    contingentPledgesCents: 500000,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: true,
    simulateFalseAlarmDowngrade: false,
  },
  FALSE_ALARM: {
    id: "FALSE_ALARM",
    title: "False Alarm / Warning Downgrade",
    description: "Warning is cancelled or downgraded prior to two-person payout authorization.",
    explanation: "NWS cancels Hurricane Warning before passkey approval. Sentinel identifies messageType='Cancel', instantly halting Tranche 1 and returning treasury to STANDBY with zero money spent.",
    initialPayPalCents: 2000000,
    reserveProtectedCents: 500000,
    feesReservedCents: 5000,
    contingentPledgesCents: 500000,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: true,
  },
  RESERVE_PROTECTION: {
    id: "RESERVE_PROTECTION",
    title: "Strict Operating Reserve Protection",
    description: "Prevents coordinator from depleting minimum operating liquidity.",
    explanation: "Policy mandates $5,000 reserve protection. Even when disaster need is high, the system mathematically locks reserve funds against disbursement, preserving fund solvency.",
    initialPayPalCents: 502500,
    reserveProtectedCents: 500000,
    feesReservedCents: 2500,
    contingentPledgesCents: 0,
    expandExposurePolygon: false,
    unverifiedHouseholdsCount: 0,
    simulatePayoutFailure: false,
    simulateFalseAlarmDowngrade: false,
  },
};

export interface RehearsalExecutionResult {
  storm: RehearsalStormMeta;
  scenario: RehearsalScenarioConfig;
  step: RehearsalStep;
  householdsEvaluated: number;
  exposedHouseholdsCount: number;
  unexposedHouseholdsCount: number;
  needsReviewCount: number;
  readiness: FinancialReadinessResult;
  fundedCount: number;
  waitlistedCount: number;
  disbursedAmountCents: number;
  rehearsalPayoutStatus: "COMPLETED_SANDBOX" | "HALTED_BY_POLICY" | "FAILED_REVERTED";
  dualApprovers: Array<{ name: string; role: string; passkeySignedAt: string }>;
  reconciliationSummary: {
    paypalBatchId: string;
    totalAmountGrossFormatted: string;
    totalFeesFormatted: string;
    netReliefDeliveredFormatted: string;
    unclaimedOrFailedCount: number;
    discrepancyCount: number;
    immutableAuditHash: string;
  };
  explanation: string;
}

/**
 * Runs a complete rehearsal simulation for the chosen storm and scenario.
 */
export function runStormRehearsal({
  stormId = "milton-2024",
  scenarioId = "NORMAL_FUNDING",
  targetStep = "RECONCILIATION",
}: {
  stormId?: string;
  scenarioId?: RehearsalScenarioId;
  targetStep?: RehearsalStep;
}): RehearsalExecutionResult {
  const storm = REHEARSAL_STORMS.find((s) => s.stormId === stormId) || REHEARSAL_STORMS[0];
  const scenario = REHEARSAL_SCENARIOS[scenarioId] || REHEARSAL_SCENARIOS.NORMAL_FUNDING;

  // Base Warning Polygon (Tampa Bay coastal area)
  // If expanded exposure scenario, include inland Orlando
  const basePolygonCoordinates = scenario.expandExposurePolygon
    ? [
        [
          [-83.10, 27.20],
          [-81.10, 27.20],
          [-81.10, 28.80],
          [-83.10, 28.80],
          [-83.10, 27.20],
        ],
      ]
    : [
        [
          [-82.95, 27.60],
          [-82.30, 27.60],
          [-82.30, 28.25],
          [-82.95, 28.25],
          [-82.95, 27.60],
        ],
      ];

  const simulatedAlert: NormalizedAlert = {
    id: `rehearsal_${storm.stormId}`,
    nwsId: `https://api.weather.gov/alerts/rehearsal-${storm.stormId}`,
    eventKey: `TBW:HU.W:0009`,
    phenomena: "HU",
    significance: "W",
    office: "TBW",
    etn: "0009",
    event: "Hurricane Warning",
    headline: `${storm.name} Rehearsal Warning issued by NWS TBW`,
    status: "Exercise",
    messageType: scenario.simulateFalseAlarmDowngrade ? "Cancel" : "Alert",
    severity: "Extreme",
    urgency: "Immediate",
    certainty: "Observed",
    effective: "2024-10-09T00:00:00Z",
    expires: "2024-10-10T12:00:00Z",
    areaDesc: "Tampa Bay coastal zones",
    geometry: {
      type: "Polygon",
      coordinates: basePolygonCoordinates,
    },
    isTranche1Eligible: !scenario.simulateFalseAlarmDowngrade,
    mode: "HISTORICAL_REPLAY",
    source: "replay",
    ingestedAt: new Date().toISOString(),
  };

  // Evaluate household exposure with Turf.js point-in-polygon
  const evaluatedHouseholds: HouseholdProfile[] = [];
  let exposedCount = 0;
  let unexposedCount = 0;
  let needsReviewCount = 0;

  SYNTHETIC_HOUSEHOLDS.forEach((hh, idx) => {
    const pt: GeoPoint = { lat: hh.lat, lng: hh.lng };
    const isInside = isPointInsideAlertGeometry(pt, simulatedAlert.geometry);

    let isEligible = isInside;
    let hasDocs = !hh.hasMissingDocs;

    // Delayed verification scenario: artificially mark selected households unverified
    if (scenario.unverifiedHouseholdsCount > 0 && idx < scenario.unverifiedHouseholdsCount) {
      hasDocs = false;
      needsReviewCount++;
      isEligible = false;
    } else if (isInside) {
      exposedCount++;
    } else {
      unexposedCount++;
    }

    evaluatedHouseholds.push({
      ...hh,
      isExposureConfirmed: isEligible && !scenario.simulateFalseAlarmDowngrade,
      hasMissingDocs: !hasDocs,
    });
  });

  // Policy configuration ($100 Tranche 1 grant, flat $0.25 PayPal domestic fee)
  const policyConfig: PolicyConfig = {
    version: "2024.1",
    tranche1AmountCents: 10000,
    tranche2BaseAmountCents: 25000,
    tranche2PerPersonCents: 5000,
    tranche2VulnerabilityAddOnCents: 5000,
    maxPerHouseholdPerEventCents: 50000,
    maxHouseholdsPerAddress: 2,
    feePerItemCents: 25, // PayPal flat fee domestic $0.25
    feePercentage: 0.0,
  };

  // Evaluate financial readiness (strict reserve deduction when testing reserve protection)
  const costPerHh = policyConfig.tranche1AmountCents + policyConfig.feePerItemCents;
  const committedCents = scenario.id === "RESERVE_PROTECTION" ? scenario.reserveProtectedCents : 0;

  const readiness = evaluateFinancialReadiness({
    paypalAvailableCents: scenario.initialPayPalCents,
    reserveProtectedCents: scenario.reserveProtectedCents,
    feesReservedCents: scenario.feesReservedCents,
    committedCents,
    contingentPledgesCents: scenario.contingentPledgesCents,
    eligibleHouseholdsCount: exposedCount,
    costPerHouseholdCents: costPerHh,
  });

  // Evaluate Tranche 1 allocation
  const eligibleExposedHouseholds = evaluatedHouseholds.filter(
    (h) => h.isExposureConfirmed && !h.hasMissingDocs
  );
  const trancheResult = evaluateTranche1({
    households: eligibleExposedHouseholds,
    allocatableCents: scenario.simulateFalseAlarmDowngrade ? 0 : readiness.allocatableCents,
    config: policyConfig,
  });

  // Determine rehearsal payout status
  let payoutStatus: "COMPLETED_SANDBOX" | "HALTED_BY_POLICY" | "FAILED_REVERTED" = "COMPLETED_SANDBOX";
  let explanation = scenario.explanation;

  if (scenario.simulateFalseAlarmDowngrade) {
    payoutStatus = "HALTED_BY_POLICY";
    explanation = "ALERT CANCELLED: Rehearsal safely halted. Warning was cancelled by issuing office; zero funds were disbursed.";
  } else if (scenario.simulatePayoutFailure) {
    payoutStatus = "FAILED_REVERTED";
    explanation = "PAYMENT FAILED/UNCLAIMED: Simulated receiver account was unregistered. Ledger held funds, rolled back allocation, and initiated claim assistance.";
  }

  const fundedCount = trancheResult.fundedHouseholds.length;
  const waitlistedCount = trancheResult.waitlistedHouseholds.length;
  const disbursedCents = fundedCount * policyConfig.tranche1AmountCents;
  const totalFeesCents = fundedCount * policyConfig.feePerItemCents;

  return {
    storm,
    scenario,
    step: targetStep,
    householdsEvaluated: SYNTHETIC_HOUSEHOLDS.length,
    exposedHouseholdsCount: exposedCount,
    unexposedHouseholdsCount: unexposedCount,
    needsReviewCount,
    readiness,
    fundedCount,
    waitlistedCount,
    disbursedAmountCents: disbursedCents,
    rehearsalPayoutStatus: payoutStatus,
    dualApprovers: [
      {
        name: "Dr. Sarah Lin (Coordinator) [DEMO PERSONA]",
        role: "Disaster Fund Coordinator",
        passkeySignedAt: "2024-10-09T01:15:00Z",
      },
      {
        name: "Marcus Vance (Finance Director) [DEMO PERSONA]",
        role: "Treasury Trustee",
        passkeySignedAt: "2024-10-09T01:22:00Z",
      },
    ],
    reconciliationSummary: {
      paypalBatchId: `REHEARSAL-${storm.stormId.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      totalAmountGrossFormatted: `$${((disbursedCents + totalFeesCents) / 100).toFixed(2)}`,
      totalFeesFormatted: `$${(totalFeesCents / 100).toFixed(2)}`,
      netReliefDeliveredFormatted: `$${(disbursedCents / 100).toFixed(2)}`,
      unclaimedOrFailedCount: scenario.simulatePayoutFailure ? 1 : 0,
      discrepancyCount: 0,
      immutableAuditHash: `sha256_${storm.stormId}_${scenario.id}_${fundedCount}_rehearsal_audit`,
    },
    explanation,
  };
}
