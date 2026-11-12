import { describe, it, expect } from "vitest";
import { enforceNumberIntegrity } from "@/lib/ai/watch-officer/integrity";
import type { AllToolEvidence } from "@/lib/ai/watch-officer/types";

/**
 * Money binding: the Watch Officer may not state a dollar figure the evidence does not contain, and a claim about the treasury must
 * match the treasury. (Regression: a live run said "Treasury balance is $0.00" while $4,587.86 was free to send, citing the storm feed.)
 */
describe("Watch Officer money binding", () => {
  const sampleToolEvidence: AllToolEvidence = {
    disaster: {
      hasActiveDisaster: true,
      event: "Hurricane Warning",
      eventKey: "TBW:HU.W:0009",
      severity: "Extreme",
      mode: "HISTORICAL_REPLAY",
      isTranche1Eligible: true,
      isStale: false,
      lastSyncedAt: new Date().toISOString(),
      evidenceId: "ev_disaster_001",
    },
    exposure: {
      totalHouseholds: 10,
      confirmedExposureCount: 8,
      outOfAreaCount: 1,
      needsReviewCount: 1,
      displacedHouseholdCount: 2,
      priorityDistribution: {
        tier1MedicalCount: 2,
        tier2ElderlyAloneCount: 3,
        tier3DisabilityCount: 1,
        tier4NoVehicleCount: 1,
        tier5ChildrenCount: 1,
        tier6GeneralCount: 2,
      },
      evidenceId: "ev_exposure_001",
    },
    treasury: {
      currency: "USD",
      paypalAvailableFormatted: "$800.00",
      paypalAvailableCents: 80000,
      reserveProtectedFormatted: "$500.00",
      reserveProtectedCents: 50000,
      committedFormatted: "$0.00",
      committedCents: 0,
      allocatableFormatted: "$800.00",
      allocatableCents: 80000,
      contingentPledgesFormatted: "$2,500.00",
      contingentPledgesCents: 250000,
      activePledgesCount: 5,
      confirmedDonationsFormatted: "$500.00",
      confirmedDonationsCount: 2,
      isStale: false,
      lastSyncedAt: new Date().toISOString(),
      evidenceId: "ev_treasury_001",
    },
    policy: {
      policyVersion: "1.0.0",
      tranche1PayoutPerHouseholdFormatted: "$100.00",
      tranche1PayoutPerHouseholdCents: 10000,
      totalEligibleHouseholds: 10,
      totalRequiredFundingFormatted: "$1,022.50",
      totalRequiredFundingCents: 102250,
      fundedHouseholdsCount: 7,
      waitlistedHouseholdsCount: 3,
      fundingGapFormatted: "$222.50",
      fundingGapCents: 22250,
      equitySummary: "Funded 7 of 10 households.",
      evidenceId: "ev_policy_001",
    },
    payouts: {
      hasActivePlan: true,
      planId: "plan_test_123",
      planHash: "hash_test_123",
      status: "rules_valid",
      approvalStatus: {
        hasCoordinatorApproval: true,
        hasFinanceApproval: false,
        isFullyApproved: false,
        remainingApprovalsRequired: 1,
      },
      itemsSummary: {
        totalItems: 7,
        successCount: 0,
        unclaimedCount: 0,
        pendingCount: 7,
        failedCount: 0,
      },
      evidenceId: "ev_payouts_001",
    },
    reconciliation: {
      status: "IN_SYNC",
      isMatched: true,
      ledgerBalanceFormatted: "$800.00",
      paypalBalanceFormatted: "$800.00",
      discrepancyFormatted: "$0.00",
      discrepancyCents: 0,
      unmatchedCount: 0,
      reconciliationNotes: "Ledger matches PayPal balance.",
      evidenceId: "ev_reconciliation_001",
    },
    scenarios: {
      scenarios: [
        {
          scenarioId: "BASELINE",
          title: "Standard Tranche 1",
          description: "Full scope",
          payoutPerHouseholdFormatted: "$100.00",
          reserveProtectedFormatted: "$500.00",
          allocatableFormatted: "$800.00",
          requiredFundingFormatted: "$1,022.50",
          fundingGapFormatted: "$222.50",
          fundedHouseholdsCount: 7,
          waitlistedHouseholdsCount: 3,
          coveragePercentage: 78,
          readinessState: "CONSTRAINED",
          isFullyFunded: false,
          notes: "3 households waitlisted",
        },
      ],
      evidenceId: "ev_scenarios_001",
    },
    items: [
      { id: "ev_disaster_001", source: "SENTINEL", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "Hurricane Warning", verifiedData: {} },
      { id: "ev_exposure_001", source: "RECIPIENTS", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "10 households", verifiedData: {} },
      { id: "ev_treasury_001", source: "TREASURY", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "Allocatable $800", verifiedData: {} },
      { id: "ev_policy_001", source: "POLICY", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "Funding gap $222.50", verifiedData: {} },
      { id: "ev_payouts_001", source: "PAYOUTS", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "Pending Finance signature", verifiedData: {} },
      { id: "ev_reconciliation_001", source: "RECONCILIATION", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "In sync", verifiedData: {} },
      { id: "ev_scenarios_001", source: "POLICY", timestamp: new Date().toISOString(), status: "VERIFIED", summary: "Scenarios", verifiedData: {} },
    ],
  };

  const base = () => {
    const m: any = {
        summary: "We have plenty of money, no problem at all.",
        eventContext: {
          hasActiveDisaster: true,
          eventName: "Hurricane Milton",
          severity: "Extreme",
          mode: "HISTORICAL_REPLAY",
          isTranche1Eligible: true,
        },
        financialReadiness: {
          state: "READY", // Hallucination! Truth is CONSTRAINED
          reason: "Model invented readiness",
          coveragePercentage: 100, // Hallucination! Truth is 78%
          isFullyFunded: true,
          isConstrained: false,
          evidenceId: "fake_ev_999", // Invalid evidenceId
        },
        fundingConstraints: {
          currency: "USD",
          allocatableFormatted: "$9,999.00", // Hallucinated number!
          requiredFundingFormatted: "$50.00", // Hallucinated number!
          fundingGapFormatted: "$0.00",
          contingentPledgesFormatted: "$99,999.00",
          reserveProtectedFormatted: "$0.00",
          isConstrained: false,
        },
        exposureSummary: {
          totalHouseholds: 999, // Hallucinated count!
          confirmedExposureCount: 888,
          outOfAreaCount: 0,
          needsReviewCount: 0,
          displacedCount: 0,
        },
        operationalBlockers: [],
        keyFindings: [
          {
            finding: "Claiming fake balance",
            evidenceId: "fake_ev_999",
            category: "TREASURY",
          },
        ],
        scenarioComparisons: [],
        recommendedHumanActions: [
          {
            role: "finance",
            priority: "HIGH",
            action: "Sign plan",
            reason: "Looks good",
          },
        ],
        evidenceReferences: [],
        warnings: [],
        dataFreshness: {
          isStale: false,
          lastSyncAt: null,
          source: "NWS",
        },
        generatedAt: new Date().toISOString(),
      };
    return m;
  };

  it("restates a wrong treasury balance from the ledger and cites the treasury", () => {
    const m = base();
    m.keyFindings = [{ finding: "Treasury balance is $0.00.", evidenceId: "ev_disaster_001", category: "TREASURY" }];
    const { verifiedResponse, numberIntegrityPass } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(numberIntegrityPass).toBe(false);
    expect(verifiedResponse.keyFindings[0].finding).toContain("$800.00");
    expect(verifiedResponse.keyFindings[0].finding).not.toContain("$0.00 is free");
    expect(verifiedResponse.keyFindings[0].evidenceId).toBe("ev_treasury_001");
  });

  it("corrects a citation when the figure lives in other evidence", () => {
    const m = base();
    m.keyFindings = [{ finding: "The funding gap is $222.50.", evidenceId: "ev_disaster_001", category: "POLICY" }];
    const { verifiedResponse } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(verifiedResponse.keyFindings[0].evidenceId).toBe("ev_policy_001");
  });

  it("removes a finding whose figures appear in no evidence", () => {
    const m = base();
    m.keyFindings = [{ finding: "Donors pledged $12,345 overnight.", evidenceId: "ev_policy_001", category: "POLICY" }];
    const { verifiedResponse } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(verifiedResponse.keyFindings).toHaveLength(0);
  });

  it("replaces a summary that invents an amount", () => {
    const m = base();
    m.summary = "Treasury balance and funding gap are $0.00; nothing to do.";
    const { verifiedResponse } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(verifiedResponse.summary).toContain("$800.00");
    expect(verifiedResponse.warnings.some((w) => w.includes("summary"))).toBe(true);
  });

  it("replaces a summary that calls a funded treasury empty, in words", () => {
    const m = base();
    m.summary = "No exposed households; treasury balance is zero, so no disbursement can occur.";
    const { verifiedResponse } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(verifiedResponse.summary).toContain("$800.00 is free to send");
  });

  it("keeps a correct, correctly cited finding untouched", () => {
    const m = base();
    m.keyFindings = [{ finding: "Allocatable cash is $800.", evidenceId: "ev_treasury_001", category: "TREASURY" }];
    m.summary = "A Hurricane Warning is active and the fund can pay part of the first tranche.";
    const { verifiedResponse } = enforceNumberIntegrity(m, sampleToolEvidence);
    expect(verifiedResponse.keyFindings[0].finding).toBe("Allocatable cash is $800.");
    expect(verifiedResponse.summary).toBe("A Hurricane Warning is active and the fund can pay part of the first tranche.");
  });
});
