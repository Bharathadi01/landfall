import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canChargePledge,
  validateConsentForHazard,
  PledgeCallerEngine,
  executeVaultOrderCapture,
  realVaultOrderCapture,
  type StormPledge,
  type PledgeChargeRecord,
} from "@/lib/pledges/index";
import * as paypalClient from "@/lib/paypal/client";
import { computeTreasuryWaterfall } from "@/lib/treasury/waterfall";
import { runTreasuryReconciliation } from "@/lib/treasury/reconciler";

function makePledge(partial: Partial<StormPledge>): StormPledge {
  return {
    id: partial.id || "pledge_001",
    donorEmail: partial.donorEmail || "donor@example.com",
    vaultPaymentToken: partial.vaultPaymentToken || "v_token_12345",
    amountPerEventCents: partial.amountPerEventCents ?? 2500, // $25.00
    seasonCapCents: partial.seasonCapCents ?? 10000, // $100.00
    chargedThisSeasonCents: partial.chargedThisSeasonCents ?? 0,
    hazardScope: partial.hazardScope !== undefined ? partial.hazardScope : ["HURRICANE", "FLOOD", "STORM_SURGE"],
    status: partial.status || "ACTIVE",
    expiresAt: partial.expiresAt,
    createdAt: "2026-11-09T00:00:00Z",
  };
}

describe("Storm Treasury & Pledge Engine (§4.2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Pledge Eligibility and Caps", () => {
    it("allows full event charge when within season cap", () => {
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 2500 });
      const check = canChargePledge({ pledge, hazard: "HURRICANE" });

      expect(check.eligible).toBe(true);
      expect(check.chargeableAmountCents).toBe(2500);
    });

    it("clamps charge to remaining cap when near limit", () => {
      // $10 remaining cap, but per-event amount is $25 -> should only charge $10!
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 9000 });
      const check = canChargePledge({ pledge, hazard: "HURRICANE" });

      expect(check.eligible).toBe(true);
      expect(check.chargeableAmountCents).toBe(1000); // 10000 - 9000 = 1000 ($10)
    });

    it("rejects charge when season cap is already exhausted", () => {
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 10000 });
      const check = canChargePledge({ pledge, hazard: "HURRICANE" });

      expect(check.eligible).toBe(false);
      expect(check.chargeableAmountCents).toBe(0);
      expect(check.reason).toContain("cap");
    });

    it("rejects non-active pledges (PAUSED, REVOKED, EXPIRED)", () => {
      const paused = makePledge({ status: "PAUSED" });
      const revoked = makePledge({ status: "REVOKED" });
      const expiredStatus = makePledge({ status: "EXPIRED" });

      expect(canChargePledge({ pledge: paused }).eligible).toBe(false);
      expect(canChargePledge({ pledge: revoked }).eligible).toBe(false);
      expect(canChargePledge({ pledge: expiredStatus }).eligible).toBe(false);
    });

    it("rejects pledge when current time is past expiration date", () => {
      const pastDate = "2025-01-01T00:00:00Z";
      const expired = makePledge({ expiresAt: pastDate });
      const check = canChargePledge({ pledge: expired, now: new Date("2026-11-09T00:00:00Z") });

      expect(check.eligible).toBe(false);
      expect(check.reason).toContain("expired");
    });

    it("allows pledge when current time is before expiration date", () => {
      const futureDate = "2029-01-01T00:00:00Z";
      const valid = makePledge({ expiresAt: futureDate });
      const check = canChargePledge({ pledge: valid, now: new Date("2026-11-09T00:00:00Z") });

      expect(check.eligible).toBe(true);
      expect(check.chargeableAmountCents).toBe(2500);
    });

    it("rejects charge when hazard is outside approved donor consent scope", () => {
      // Donor only approved FLOOD, but trigger is WILDFIRE
      const floodOnlyPledge = makePledge({ hazardScope: ["FLOOD"] });
      const check = canChargePledge({ pledge: floodOnlyPledge, hazard: "WILDFIRE" });

      expect(check.eligible).toBe(false);
      expect(check.reason).toContain("not covered by donor's approved scope");

      // Empty scope
      const emptyScopePledge = makePledge({ hazardScope: [] });
      expect(canChargePledge({ pledge: emptyScopePledge, hazard: "FLOOD" }).eligible).toBe(false);

      // Undefined scope
      const undefinedScopePledge = makePledge({ hazardScope: null as any });
      const undefinedCheck = validateConsentForHazard(undefinedScopePledge, "HURRICANE");
      expect(undefinedCheck.valid).toBe(false);
      expect(undefinedCheck.reason).toContain("no approved hazard scope");
    });

    it("matches hazard scope case-insensitively", () => {
      const pledge = makePledge({ hazardScope: ["hurricane"] });
      const check = validateConsentForHazard(pledge, "HURRICANE");
      expect(check.valid).toBe(true);
    });
  });

  describe("Vault Order Capture Implementations", () => {
    it("realVaultOrderCapture queries PayPal and extracts capture ID when available", async () => {
      const spy = vi.spyOn(paypalClient, "paypalFetch").mockResolvedValueOnce({
        data: {
          id: "ORD_PAYPAL_REAL_1",
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [{ id: "CAP_PAYPAL_REAL_1" }],
              },
            },
          ],
        },
        status: 201,
      });

      const res = await realVaultOrderCapture({
        payload: {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: "ref", description: "desc", amount: { currency_code: "USD", value: "25.00" } }],
          payment_source: { token: { id: "tok_123", type: "PAYMENT_METHOD_TOKEN" } },
        },
        idempotencyKey: "idem_real_1",
      });

      expect(res.id).toBe("ORD_PAYPAL_REAL_1");
      expect(res.captureId).toBe("CAP_PAYPAL_REAL_1");
      expect(res.status).toBe("COMPLETED");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("realVaultOrderCapture gracefully returns undefined captureId when captures array is missing", async () => {
      const spy = vi.spyOn(paypalClient, "paypalFetch").mockResolvedValueOnce({
        data: {
          id: "ORD_PAYPAL_REAL_2",
          status: "APPROVED",
          purchase_units: [],
        },
        status: 200,
      });

      const res = await realVaultOrderCapture({
        payload: {
          intent: "CAPTURE",
          purchase_units: [],
          payment_source: { token: { id: "tok_123", type: "PAYMENT_METHOD_TOKEN" } },
        },
        idempotencyKey: "idem_real_2",
      });

      expect(res.id).toBe("ORD_PAYPAL_REAL_2");
      expect(res.captureId).toBeUndefined();
      expect(res.status).toBe("APPROVED");
    });

    it("executeVaultOrderCapture falls back to generated captureId if captureId is not returned", async () => {
      const mockOrderCreator = vi.fn(async () => ({
        id: "ORD_NO_CAPTURE_ID",
        status: "COMPLETED",
        captureId: undefined,
      }));

      const res = await executeVaultOrderCapture({
        vaultToken: "tok_no_cap",
        amountCents: 5000,
        activationId: "act_test",
        incidentId: "inc_test",
        idempotencyKey: "idem_no_cap",
        orderCreator: mockOrderCreator,
      });

      expect(res.orderId).toBe("ORD_NO_CAPTURE_ID");
      expect(res.captureId).toBe("cap_ORD_NO_CAPTURE_ID");
      expect(res.status).toBe("COMPLETED");
    });

    it("executeVaultOrderCapture uses default realVaultOrderCapture when orderCreator is omitted", async () => {
      const spy = vi.spyOn(paypalClient, "paypalFetch").mockResolvedValueOnce({
        data: {
          id: "ORD_DEFAULT_CALL",
          status: "COMPLETED",
          purchase_units: [{ payments: { captures: [{ id: "CAP_DEFAULT" }] } }],
        },
        status: 201,
      });

      const res = await executeVaultOrderCapture({
        vaultToken: "tok_default",
        amountCents: 2500,
        activationId: "act_default",
        incidentId: "inc_default",
        idempotencyKey: "idem_default",
      });

      expect(res.orderId).toBe("ORD_DEFAULT_CALL");
      expect(res.captureId).toBe("CAP_DEFAULT");
    });
  });

  describe("Deterministic Pledge Caller Engine & Adversarial Tests", () => {
    it("strictly blocks pledge calling when initial emergency stop is active (boolean or function)", async () => {
      const engine = new PledgeCallerEngine();
      const pledge = makePledge({});

      // Boolean check
      await expect(
        engine.callPledgesForActivation({
          activationId: "act_001",
          incidentId: "inc_milton_2024",
          pledges: [pledge],
          isEmergencyStopActive: true,
        })
      ).rejects.toThrow("emergency stop is active");

      // Function check
      await expect(
        engine.callPledgesForActivation({
          activationId: "act_001",
          incidentId: "inc_milton_2024",
          pledges: [pledge],
          isEmergencyStopActive: () => true,
        })
      ).rejects.toThrow("emergency stop is active");
    });

    it("aborts remaining charges immediately if emergency stop is triggered mid-processing", async () => {
      const engine = new PledgeCallerEngine();
      const p1 = makePledge({ id: "p1", amountPerEventCents: 2500 });
      const p2 = makePledge({ id: "p2", amountPerEventCents: 2500 });

      let callCount = 0;
      // First call for initial check is false, then second check before p1 is false,
      // but turns true before p2!
      const dynamicStop = () => {
        callCount++;
        return callCount > 2; // Returns true starting at pledge p2
      };

      const mockOrderCreator = vi.fn(async () => ({
        id: "ord_mid_stop",
        captureId: "cap_mid_stop",
        status: "COMPLETED",
      }));

      const res = await engine.callPledgesForActivation({
        activationId: "act_dyn_stop",
        incidentId: "inc_dyn_stop",
        pledges: [p1, p2],
        isEmergencyStopActive: dynamicStop,
        orderCreator: mockOrderCreator,
      });

      expect(res.charges.length).toBe(2);
      expect(res.charges[0].success).toBe(true);
      expect(res.charges[1].success).toBe(false);
      expect(res.charges[1].error).toContain("Emergency stop activated mid-processing");
      expect(mockOrderCreator).toHaveBeenCalledTimes(1); // p2 was NOT charged!
    });

    it("prevents charging if donor revokes immediately prior to dispatch (in-flight revocation race)", async () => {
      const engine = new PledgeCallerEngine();
      const p1 = makePledge({ id: "p_revoking", amountPerEventCents: 2500 });

      const mockGetStatus = vi.fn(async (id: string) => "REVOKED" as const);
      const mockOrderCreator = vi.fn();

      const res = await engine.callPledgesForActivation({
        activationId: "act_revocation_race",
        incidentId: "inc_revocation_race",
        pledges: [p1],
        isEmergencyStopActive: false,
        getPledgeStatus: mockGetStatus,
        orderCreator: mockOrderCreator,
      });

      expect(res.skippedRevoked).toBe(1);
      expect(res.charges[0].success).toBe(false);
      expect(res.charges[0].error).toContain("Pledge revoked prior to dispatch");
      expect(mockOrderCreator).not.toHaveBeenCalled();
    });

    it("handles seasonal cap races when multiple pledges exceed cap", async () => {
      const engine = new PledgeCallerEngine();
      // Donor has $50 cap total
      const p1 = makePledge({ id: "p_race_1", amountPerEventCents: 5000, seasonCapCents: 5000, chargedThisSeasonCents: 0 });
      // Same donor or second pledge exhausted
      const p2 = makePledge({ id: "p_race_2", amountPerEventCents: 2500, seasonCapCents: 5000, chargedThisSeasonCents: 5000 });

      const mockOrderCreator = vi.fn(async () => ({
        id: "ord_cap_race",
        captureId: "cap_cap_race",
        status: "COMPLETED",
      }));

      const res = await engine.callPledgesForActivation({
        activationId: "act_cap_race",
        incidentId: "inc_cap_race",
        pledges: [p1, p2],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res.charges.length).toBe(1);
      expect(res.charges[0].amountChargedCents).toBe(5000);
      expect(res.skippedOverCap).toBe(1);
      expect(mockOrderCreator).toHaveBeenCalledTimes(1);
    });

    it("handles concurrent pledge charge attempts via idempotency cache replay", async () => {
      const engine = new PledgeCallerEngine();
      const p1 = makePledge({ id: "p_concurrent", amountPerEventCents: 2500 });
      const pOutOfScope = makePledge({ id: "p_scope_mismatch", hazardScope: ["FLOOD"] });

      const mockOrderCreator = vi.fn(async () => ({
        id: "ord_concurrent",
        captureId: "cap_concurrent",
        status: "COMPLETED",
      }));

      // Simulate first execution completing
      const res1 = await engine.callPledgesForActivation({
        activationId: "act_concurrent",
        incidentId: "inc_concurrent",
        hazard: "HURRICANE",
        pledges: [p1, pOutOfScope],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res1.charges[0].replayed).toBe(false);
      expect(res1.skippedOutOfScope).toBe(1);
      expect(mockOrderCreator).toHaveBeenCalledTimes(1);

      // Verify getChargeRecord
      const record = engine.getChargeRecord("pledge_charge_inc_concurrent_p_concurrent");
      expect(record).toBeDefined();
      expect(record?.status).toBe("CAPTURED");

      // Concurrent / replayed second execution with identical incident and pledge ID
      const res2 = await engine.callPledgesForActivation({
        activationId: "act_concurrent",
        incidentId: "inc_concurrent",
        hazard: "HURRICANE",
        pledges: [p1],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res2.charges[0].replayed).toBe(true);
      expect(res2.charges[0].orderId).toBe("ord_concurrent");
      expect(mockOrderCreator).toHaveBeenCalledTimes(1); // Never called again!
    });

    it("handles timeout after PayPal accepts request (SUBMITTING recovery with or without orderId)", async () => {
      const engine = new PledgeCallerEngine();
      const p1 = makePledge({ id: "p_submitting_with_id", amountPerEventCents: 2500 });
      const p2 = makePledge({ id: "p_submitting_no_id", amountPerEventCents: 2500 });

      const key1 = "pledge_charge_inc_timeout_p_submitting_with_id";
      const key2 = "pledge_charge_inc_timeout_p_submitting_no_id";

      engine.setChargeRecord({
        id: "chg_1",
        pledgeId: "p_submitting_with_id",
        incidentId: "inc_timeout",
        amountCents: 2500,
        status: "SUBMITTING",
        paypalOrderId: "ORDER_KNOWN_123",
        idempotencyKey: key1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      engine.setChargeRecord({
        id: "chg_2",
        pledgeId: "p_submitting_no_id",
        incidentId: "inc_timeout",
        amountCents: 2500,
        status: "SUBMITTING",
        paypalOrderId: undefined,
        idempotencyKey: key2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockOrderCreator = vi.fn();
      const res = await engine.callPledgesForActivation({
        activationId: "act_timeout",
        incidentId: "inc_timeout",
        pledges: [p1, p2],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res.charges[0].replayed).toBe(true);
      expect(res.charges[0].orderId).toBe("ORDER_KNOWN_123");

      expect(res.charges[1].replayed).toBe(true);
      expect(res.charges[1].orderId).toBe("RECOVERED_ORDER");

      expect(mockOrderCreator).not.toHaveBeenCalled();
    });

    it("handles diverse capture failure types (Error instance, raw string, and empty object)", async () => {
      const engine = new PledgeCallerEngine();
      const p1 = makePledge({ id: "p_err_obj", amountPerEventCents: 1000 });
      const p2 = makePledge({ id: "p_err_str", amountPerEventCents: 2000 });
      const p3 = makePledge({ id: "p_err_unk", amountPerEventCents: 3000 });

      let attempt = 0;
      const mockOrderCreator = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error("Card declined by bank");
        } else if (attempt === 2) {
          throw "Raw string error message";
        } else {
          throw {}; // Non-standard falsy error
        }
      });

      const res = await engine.callPledgesForActivation({
        activationId: "act_errors",
        incidentId: "inc_errors",
        pledges: [p1, p2, p3],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res.charges[0].success).toBe(false);
      expect(res.charges[0].error).toBe("Card declined by bank");

      expect(res.charges[1].success).toBe(false);
      expect(res.charges[1].error).toBe("Raw string error message");

      expect(res.charges[2].success).toBe(false);
      expect(res.charges[2].error).toBe("Vault MIT capture failed");
    });
  });

  describe("Treasury Waterfall Visualizer", () => {
    it("computes coverage percentage and waterfall deductions", () => {
      const waterfall = computeTreasuryWaterfall({
        paypalAvailableCents: 50000,
        reserveProtectedCents: 15000,
        feesReservedCents: 2000,
        committedCents: 0,
        contingentPledgesCents: 25000,
        activePledgesCount: 10,
        eligibleHouseholdsCount: 5,
        tranche1CostPerHouseholdCents: 10225,
      });

      expect(waterfall.allocatableCents).toBe(33000);
      expect(waterfall.coveragePercentage).toBe(65);
      expect(waterfall.contingentPledgesCents).toBe(25000);
    });
  });

  describe("Treasury Reconciliation", () => {
    it("reports in sync when ledger matches reporting balance", async () => {
      const res = await runTreasuryReconciliation({
        ledgerBalanceCents: 100000,
        fallbackToLedgerOnly: true,
      });

      expect(res.isMatched).toBe(true);
      expect(res.status).toBe("FALLBACK_LEDGER_ONLY");
    });
  });
});
