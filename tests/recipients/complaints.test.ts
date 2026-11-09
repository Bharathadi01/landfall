import { describe, it, expect } from "vitest";
import {
  registerComplaint,
  resolveComplaint,
  checkPlanInvalidation,
  type RecipientComplaint,
} from "@/lib/recipients/complaints";

describe("Humanitarian Appeals & Complaints System (§11, Priority 3)", () => {
  it("registers a new recipient appeal with RECEIVED status", () => {
    const complaint = registerComplaint({
      householdId: "hh_tbw_001",
      category: "PAYMENT_METHOD_CHANGE",
      description: "Updated primary PayPal email to sb-new-email@personal.example.com",
      contactEmail: "resident@example.com",
    });

    expect(complaint.complaintId).toMatch(/^cmp_/);
    expect(complaint.status).toBe("RECEIVED");
    expect(complaint.householdId).toBe("hh_tbw_001");
  });

  it("invalidates pending payout plan when appeal resolves with material change", () => {
    const raw = registerComplaint({
      householdId: "hh_tbw_002",
      category: "VULNERABILITY_UPDATE",
      description: "Resident now requires electricity-dependent nebulizer.",
      contactEmail: "hh2@example.com",
    });

    const resolved = resolveComplaint(raw, {
      resolvedBy: "caseworker_sarah",
      actionTaken: "Verified medical documentation. Upgraded from Tier 4 to Tier 1.",
      isMaterialChange: true,
      tierAdjustment: 1,
    });

    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolutionDetails?.isMaterialChange).toBe(true);

    const planHouseholds = ["hh_tbw_001", "hh_tbw_002", "hh_tbw_003"];
    const check = checkPlanInvalidation(resolved, planHouseholds);

    expect(check.shouldInvalidatePlan).toBe(true);
    expect(check.reason).toContain("Material change from resolved appeal");
    expect(check.affectedHouseholdId).toBe("hh_tbw_002");
  });

  it("does NOT invalidate plan when appeal resolution is non-material (e.g. general inquiry)", () => {
    const raw = registerComplaint({
      householdId: "hh_tbw_001",
      category: "GENERAL_INQUIRY",
      description: "When does the storm warning take effect?",
      contactEmail: "hh1@example.com",
    });

    const resolved = resolveComplaint(raw, {
      resolvedBy: "support_bot",
      actionTaken: "Provided NWS warning timeline link.",
      isMaterialChange: false,
    });

    const check = checkPlanInvalidation(resolved, ["hh_tbw_001"]);
    expect(check.shouldInvalidatePlan).toBe(false);
  });
});

