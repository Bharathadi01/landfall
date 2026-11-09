import { describe, it, expect } from "vitest";
import { buildSecondTranchePlan, type PostEventEvidence } from "@/lib/treasury/second-tranche";
import { SYNTHETIC_HOUSEHOLDS, DEFAULT_POLICY_CONFIG } from "@/lib/fixtures/households";
import { validateTwoKeyApproval } from "@/lib/security/passkeys";

describe("Second Tranche Post-Disaster Relief Engine (§3, §4, §5)", () => {
  const households = SYNTHETIC_HOUSEHOLDS.map((h) => ({
    ...h,
    isExposureConfirmed: true,
  }));

  const sampleEvidence: PostEventEvidence[] = [
    {
      householdId: "hh_tbw_001",
      impactReportedAt: "2024-10-10T12:00:00Z",
      damageLevel: "SEVERE",
      powerOutageHours: 72,
      isDisplacedFromHome: true,
      reconfirmedByPhoneOrWeb: true,
    },
    {
      householdId: "hh_tbw_002",
      impactReportedAt: "2024-10-10T14:00:00Z",
      damageLevel: "MODERATE",
      floodDepthInches: 18,
      isDisplacedFromHome: false,
      reconfirmedByPhoneOrWeb: true,
    },
    {
      householdId: "hh_tbw_003",
      impactReportedAt: "2024-10-10T16:00:00Z",
      damageLevel: "MINOR", // Minor damage without displacement or reconfirmation
      isDisplacedFromHome: false,
      reconfirmedByPhoneOrWeb: false,
    },
  ];

  it("builds a distinct Tranche 2 plan with separate plan hash", () => {
    const result = buildSecondTranchePlan({
      activationId: "TBW:HU.W:0009",
      policy: DEFAULT_POLICY_CONFIG,
      households,
      impactEvidence: sampleEvidence,
      allocatableCents: 100000,
      alreadyPaidTranche1HouseholdIds: new Set(["hh_tbw_001", "hh_tbw_002"]),
      alreadyPaidTranche2HouseholdIds: new Set(),
    });

    expect(result.payoutPlan.tranche).toBe(2);
    expect(result.planHash.length).toBe(64);
    expect(result.eligibleCount).toBe(2); // hh_001 and hh_002 qualify; hh_003 has minor damage with no reconfirmation
    expect(result.exclusionReasons["hh_tbw_003"]).toBe("INSUFFICIENT_IMPACT_SEVERITY");
  });

  it("strictly deduplicates households already paid in Tranche 2", () => {
    const result = buildSecondTranchePlan({
      activationId: "TBW:HU.W:0009",
      policy: DEFAULT_POLICY_CONFIG,
      households,
      impactEvidence: sampleEvidence,
      allocatableCents: 100000,
      alreadyPaidTranche1HouseholdIds: new Set(["hh_tbw_001"]),
      alreadyPaidTranche2HouseholdIds: new Set(["hh_tbw_001"]), // Already paid Tranche 2
    });

    expect(result.exclusionReasons["hh_tbw_001"]).toBe("ALREADY_PAID_TRANCHE_2");
    expect(result.payoutPlan.items.find((i) => i.householdId === "hh_tbw_001")).toBeUndefined();
  });

  it("requires new passkey approvals specifically bound to Tranche 2 plan hash", () => {
    const result = buildSecondTranchePlan({
      activationId: "TBW:HU.W:0009",
      policy: DEFAULT_POLICY_CONFIG,
      households,
      impactEvidence: sampleEvidence,
      allocatableCents: 100000,
      alreadyPaidTranche1HouseholdIds: new Set(),
      alreadyPaidTranche2HouseholdIds: new Set(),
    });

    // An approval signed for Tranche 1 (different hash) must be rejected
    const oldApprovals = [
      {
        approverId: "ops_01",
        approverRole: "coordinator" as const,
        planHash: "tranche_1_old_hash_00000000000000000000000000000000000000000000000",
        passkeySignature: "sig_1",
      },
      {
        approverId: "fin_01",
        approverRole: "finance" as const,
        planHash: "tranche_1_old_hash_00000000000000000000000000000000000000000000000",
        passkeySignature: "sig_2",
      },
    ];

    const validation = validateTwoKeyApproval(oldApprovals, result.planHash);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Approval plan hash mismatch");
  });
});

