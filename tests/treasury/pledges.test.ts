import { describe, it, expect, vi } from "vitest";
import {
  canChargePledge,
  callStormPledgesForActivation,
  type StormPledge,
} from "@/lib/pledges/index";
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
    status: partial.status || "ACTIVE",
    createdAt: "2026-11-09T00:00:00Z",
  };
}

describe("Storm Treasury & Pledge Engine (§4.2)", () => {
  describe("Pledge Eligibility and Caps", () => {
    it("allows full event charge when within season cap", () => {
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 2500 });
      const check = canChargePledge(pledge);

      expect(check.eligible).toBe(true);
      expect(check.chargeableAmountCents).toBe(2500);
    });

    it("clamps charge to remaining cap when near limit", () => {
      // $10 remaining cap, but per-event amount is $25 -> should only charge $10!
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 9000 });
      const check = canChargePledge(pledge);

      expect(check.eligible).toBe(true);
      expect(check.chargeableAmountCents).toBe(1000); // 10000 - 9000 = 1000 ($10)
    });

    it("rejects charge when season cap is already exhausted", () => {
      const pledge = makePledge({ amountPerEventCents: 2500, seasonCapCents: 10000, chargedThisSeasonCents: 10000 });
      const check = canChargePledge(pledge);

      expect(check.eligible).toBe(false);
      expect(check.chargeableAmountCents).toBe(0);
      expect(check.reason).toContain("Season cap reached");
    });

    it("rejects non-active pledges (PAUSED or REVOKED)", () => {
      const paused = makePledge({ status: "PAUSED" });
      const revoked = makePledge({ status: "REVOKED" });

      expect(canChargePledge(paused).eligible).toBe(false);
      expect(canChargePledge(revoked).eligible).toBe(false);
    });
  });

  describe("Pledge Caller Execution", () => {
    it("strictly blocks pledge calling when emergency stop is active", async () => {
      const pledge = makePledge({});
      await expect(
        callStormPledgesForActivation({
          activationId: "act_001",
          pledges: [pledge],
          isEmergencyStopActive: true,
        })
      ).rejects.toThrow("Emergency stop is active");
    });

    it("charges eligible pledges and accumulates total charged cents", async () => {
      const p1 = makePledge({ id: "p1", donorEmail: "p1@example.com", amountPerEventCents: 2500, seasonCapCents: 10000 });
      const p2 = makePledge({ id: "p2", donorEmail: "p2@example.com", amountPerEventCents: 5000, seasonCapCents: 10000 });
      const pMaxed = makePledge({ id: "p3", chargedThisSeasonCents: 10000, seasonCapCents: 10000 });

      const mockOrderCreator = vi.fn(async (params: any) => {
        const val = params.purchase_units[0].amount.value;
        return { id: `order_for_${val}`, status: "COMPLETED" };
      });

      const res = await callStormPledgesForActivation({
        activationId: "act_milton",
        pledges: [p1, p2, pMaxed],
        isEmergencyStopActive: false,
        orderCreator: mockOrderCreator,
      });

      expect(res.totalPledgesEvaluated).toBe(3);
      expect(res.charges.length).toBe(2);
      expect(res.totalChargedCents).toBe(7500); // $25 + $50 = $75.00
      expect(res.skippedOverCap).toBe(1);
      expect(mockOrderCreator).toHaveBeenCalledTimes(2);
    });
  });

  describe("Treasury Waterfall Visualizer", () => {
    it("computes coverage percentage and waterfall deductions", () => {
      // $50,000 available ($500), $2,000 fees reserved, $0 committed
      // Tranche 1 allocatable = $50,000 - $2,000 = $48,000
      // 5 eligible households @ $102.25 ($10,225 cents each) = $51,125 total demand
      // Coverage = 48000 / 51125 = 94%
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

      expect(waterfall.allocatableCents).toBe(48000);
      expect(waterfall.coveragePercentage).toBe(94);
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
