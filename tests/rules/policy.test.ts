import { describe, it, expect } from "vitest";
import {
  assignPriority,
  calculatePayoutAmount,
  calculateItemFee,
  evaluatePolicy,
  type HouseholdProfile,
  type PolicyConfig,
} from "@/lib/rules/engine";
import { generateEquityReport } from "@/lib/rules/equity";

const defaultPolicy: PolicyConfig = {
  version: "2026.11-v1",
  tranche1AmountCents: 10000, // $100.00
  tranche2BaseAmountCents: 25000, // $250.00
  tranche2PerPersonCents: 5000, // $50.00
  tranche2VulnerabilityAddOnCents: 5000, // $50.00
  maxPerHouseholdPerEventCents: 50000, // $500.00
  maxHouseholdsPerAddress: 2,
  feePerItemCents: 25, // $0.25
  feePercentage: 0.02, // 2%
};

function makeHousehold(partial: Partial<HouseholdProfile>): HouseholdProfile {
  return {
    id: partial.id || "hh_test",
    address: partial.address || "100 Main St, Tampa FL",
    zone: partial.zone || "Zone A",
    language: partial.language || "en",
    recipientPath: partial.recipientPath || "LINKED_PAYPAL",
    evidenceLevel: partial.evidenceLevel || "SELF_DECLARED",
    enrolledAt: partial.enrolledAt || "2026-10-01T12:00:00Z",
    hasMedicalDevice: partial.hasMedicalDevice ?? false,
    isElderlyLivingAlone: partial.isElderlyLivingAlone ?? false,
    hasDisability: partial.hasDisability ?? false,
    hasNoVehicleInSurgeZone: partial.hasNoVehicleInSurgeZone ?? false,
    hasChildrenUnder5: partial.hasChildrenUnder5 ?? false,
    numMembers: partial.numMembers ?? 1,
    hasMissingDocs: partial.hasMissingDocs ?? false,
    isExposureConfirmed: partial.isExposureConfirmed ?? true,
  };
}

describe("Deterministic Policy Engine (§4.7)", () => {
  describe("Priority Tier Assignment", () => {
    it("assigns Tier 1 to households with medical device dependencies", () => {
      const h = makeHousehold({ hasMedicalDevice: true });
      const priority = assignPriority(h);
      expect(priority.tier).toBe(1);
      expect(priority.code).toBe("P1_MEDICAL_DEVICE");
    });

    it("assigns Tier 2 to elderly living alone", () => {
      const h = makeHousehold({ isElderlyLivingAlone: true });
      const priority = assignPriority(h);
      expect(priority.tier).toBe(2);
      expect(priority.code).toBe("P2_ELDERLY_ALONE");
    });

    it("assigns Tier 3 to disability", () => {
      const h = makeHousehold({ hasDisability: true });
      const priority = assignPriority(h);
      expect(priority.tier).toBe(3);
      expect(priority.code).toBe("P3_DISABILITY");
    });

    it("assigns Tier 4 to no vehicle in surge zone", () => {
      const h = makeHousehold({ hasNoVehicleInSurgeZone: true });
      const priority = assignPriority(h);
      expect(priority.tier).toBe(4);
      expect(priority.code).toBe("P4_NO_VEHICLE_SURGE");
    });

    it("assigns Tier 5 to families with children under 5", () => {
      const h = makeHousehold({ hasChildrenUnder5: true });
      const priority = assignPriority(h);
      expect(priority.tier).toBe(5);
      expect(priority.code).toBe("P5_CHILDREN_UNDER_5");
    });

    it("assigns Tier 6 to general households", () => {
      const h = makeHousehold({});
      const priority = assignPriority(h);
      expect(priority.tier).toBe(6);
      expect(priority.code).toBe("P6_GENERAL");
    });

    it("PROPERTY TEST: Missing documentation never lowers priority rank (Golden Rule #4)", () => {
      const withDocs = makeHousehold({ hasMedicalDevice: true, hasMissingDocs: false });
      const missingDocs = makeHousehold({ hasMedicalDevice: true, hasMissingDocs: true });

      const pWith = assignPriority(withDocs);
      const pMissing = assignPriority(missingDocs);

      expect(pWith.tier).toBe(pMissing.tier);
      expect(pWith.code).toBe(pMissing.code);
    });
  });

  describe("Payout Amount Formulas", () => {
    it("computes fixed Tranche 1 amount regardless of household size", () => {
      const h1 = makeHousehold({ numMembers: 1 });
      const h4 = makeHousehold({ numMembers: 4 });

      expect(calculatePayoutAmount(h1, defaultPolicy, 1)).toBe(10000);
      expect(calculatePayoutAmount(h4, defaultPolicy, 1)).toBe(10000);
    });

    it("computes Tranche 2 needs-based amount with member and vulnerability additions", () => {
      // 1 member, no vulnerability: $250 base
      const h1 = makeHousehold({ numMembers: 1 });
      expect(calculatePayoutAmount(h1, defaultPolicy, 2)).toBe(25000);

      // 3 members (2 additional = +$100), has disability (+ $50) = $400 total
      const h3 = makeHousehold({ numMembers: 3, hasDisability: true });
      expect(calculatePayoutAmount(h3, defaultPolicy, 2)).toBe(40000);

      // Capped at maxPerHouseholdPerEventCents ($500)
      const hLarge = makeHousehold({ numMembers: 10, hasMedicalDevice: true });
      expect(calculatePayoutAmount(hLarge, defaultPolicy, 2)).toBe(50000);
    });

    it("computes per-item PayPal fee accurately", () => {
      // $100 disbursement: 25¢ flat + 2% ($2.00) = 225¢ ($2.25)
      expect(calculateItemFee(10000, defaultPolicy)).toBe(225);
    });
  });

  describe("Full Policy Evaluation & Constraints", () => {
    it("excludes households not in warning area", () => {
      const h = makeHousehold({ id: "hh_out", isExposureConfirmed: false });
      const res = evaluatePolicy({
        households: [h],
        policy: defaultPolicy,
        allocatableCents: 50000,
        tranche: 1,
      });

      expect(res.ineligibleHouseholds.length).toBe(1);
      expect(res.ineligibleHouseholds[0].reasonCodes).toContain("INELIGIBLE_OUT_OF_AREA");
    });

    it("enforces max households per address cap", () => {
      const h1 = makeHousehold({ id: "hh_1", address: "404 Florida Ave" });
      const h2 = makeHousehold({ id: "hh_2", address: "404 Florida Ave" });
      const h3 = makeHousehold({ id: "hh_3", address: "404 Florida Ave" });

      const res = evaluatePolicy({
        households: [h1, h2, h3],
        policy: defaultPolicy, // maxHouseholdsPerAddress is 2
        allocatableCents: 100000,
        tranche: 1,
      });

      expect(res.fundedHouseholds.length).toBe(2);
      expect(res.ineligibleHouseholds.length).toBe(1);
      expect(res.ineligibleHouseholds[0].householdId).toBe("hh_3");
      expect(res.ineligibleHouseholds[0].reasonCodes).toContain("CAP_REACHED_ADDRESS_LIMIT");
    });

    it("flags needsReview and NEEDS_REVIEW_MISSING_DOCS in evaluatePolicy for households with missing docs", () => {
      const hMissing = makeHousehold({
        id: "hh_missing_doc",
        hasMedicalDevice: true,
        hasMissingDocs: true,
      });

      const res = evaluatePolicy({
        households: [hMissing],
        policy: defaultPolicy,
        allocatableCents: 50000,
        tranche: 1,
      });

      expect(res.fundedHouseholds.length).toBe(1);
      expect(res.fundedHouseholds[0].needsReview).toBe(true);
      expect(res.fundedHouseholds[0].reasonCodes).toContain("NEEDS_REVIEW_MISSING_DOCS");
      expect(res.fundedHouseholds[0].reasonCodes).toContain("P1_MEDICAL_DEVICE");
    });

    it("strictly waitlists when budget is exhausted, preserving priority order", () => {
      const hMed = makeHousehold({ id: "hh_med", address: "101 Main St", hasMedicalDevice: true });
      const hElder = makeHousehold({ id: "hh_elder", address: "102 Main St", isElderlyLivingAlone: true });
      const hGen = makeHousehold({ id: "hh_gen", address: "103 Main St" });

      // Budget for exactly 2 households ($100 + $2.25 = $102.25 each -> 20450 cents total for 2)
      const allocatable = 20500;

      const res = evaluatePolicy({
        households: [hGen, hElder, hMed], // unsorted input
        policy: defaultPolicy,
        allocatableCents: allocatable,
        tranche: 1,
      });

      expect(res.fundedHouseholds.map((f) => f.householdId)).toEqual(["hh_med", "hh_elder"]);
      expect(res.waitlistedHouseholds.map((w) => w.householdId)).toEqual(["hh_gen"]);
      expect(res.waitlistedHouseholds[0].reasonCodes).toContain("WAITLISTED_BUDGET");
    });

    it("breaks ties deterministically using enrollment time, then household ID", () => {
      const hOlder = makeHousehold({
        id: "hh_b",
        address: "201 Elm St",
        enrolledAt: "2026-09-01T00:00:00Z",
      });
      const hNewer = makeHousehold({
        id: "hh_a",
        address: "202 Elm St",
        enrolledAt: "2026-09-02T00:00:00Z",
      });
      const hSameTimeA = makeHousehold({
        id: "hh_same_a",
        address: "203 Elm St",
        enrolledAt: "2026-09-01T00:00:00Z",
      });

      const res = evaluatePolicy({
        households: [hNewer, hOlder, hSameTimeA],
        policy: defaultPolicy,
        allocatableCents: 500000,
        tranche: 1,
      });

      const ids = res.fundedHouseholds.map((f) => f.householdId);
      expect(ids).toEqual(["hh_b", "hh_same_a", "hh_a"]);
    });

    it("handles empty lists in equity report without throwing", () => {
      const report = generateEquityReport({
        households: [],
        fundedList: [],
        waitlistedList: [],
      });
      expect(report.overallFundedRatePct).toBe(0);
      expect(report.disparateImpactDetected).toBe(false);
    });
  });

  describe("Equity Reporting (§4.7)", () => {
    it("calculates breakdown and identifies disparate impact under 80% rule", () => {
      const hEn1 = makeHousehold({ id: "en_1", language: "en" });
      const hEn2 = makeHousehold({ id: "en_2", language: "en" });
      const hEn3 = makeHousehold({ id: "en_3", language: "en" });

      const hEs1 = makeHousehold({ id: "es_1", language: "es" });
      const hEs2 = makeHousehold({ id: "es_2", language: "es" });
      const hEs3 = makeHousehold({ id: "es_3", language: "es" });

      // Simulate funded: all 3 EN funded (100%), but only 1 of 3 ES funded (33.3%)
      // Overall: 4/6 = 66.7%. 80% threshold = 53.3%. ES (33.3%) < 53.3% -> Disparate impact!
      const funded = [
        { householdId: "en_1" },
        { householdId: "en_2" },
        { householdId: "en_3" },
        { householdId: "es_1" },
      ] as any;

      const waitlisted = [
        { householdId: "es_2" },
        { householdId: "es_3" },
      ] as any;

      const report = generateEquityReport({
        households: [hEn1, hEn2, hEn3, hEs1, hEs2, hEs3],
        fundedList: funded,
        waitlistedList: waitlisted,
      });

      expect(report.overallFundedRatePct).toBeCloseTo(66.7, 1);
      expect(report.disparateImpactDetected).toBe(true);
      const esBreakdown = report.byLanguage.find((b) => b.key === "es");
      expect(esBreakdown?.isDisparateImpact).toBe(true);
      expect(report.notes.some((n) => n.includes("es"))).toBe(true);
    });
  });
});
