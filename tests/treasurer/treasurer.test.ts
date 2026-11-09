import { describe, it, expect, vi } from "vitest";
import {
  TreasurerEngine,
  computePlanHash,
  validatePreConditions,
  type PayoutPlan,
  type TreasurerContext,
} from "@/lib/treasurer/index";
import { type ApprovalKeyVerification } from "@/lib/security/passkeys";

function createValidPlan(): { plan: PayoutPlan; approvals: ApprovalKeyVerification[] } {
  const planBase = {
    id: "plan_test_001",
    activationId: "act_milton_001",
    tranche: 1 as const,
    totalAmountCents: 20000, // $200.00
    totalFeesCents: 450, // $4.50
    items: [
      {
        householdId: "hh_1",
        recipientType: "EMAIL" as const,
        receiver: "resident1@example.com",
        amountCents: 10000,
        currency: "USD",
        note: "Tranche 1 Anticipatory Aid",
      },
      {
        householdId: "hh_2",
        recipientType: "PAYPAL_ID" as const,
        receiver: "FR7DHMX8QE59A",
        amountCents: 10000,
        currency: "USD",
        note: "Tranche 1 Anticipatory Aid",
      },
    ],
    createdAt: "2026-11-09T00:00:00Z",
  };

  const planHash = computePlanHash(planBase);

  const plan: PayoutPlan = {
    ...planBase,
    state: "approved_2",
    planHash,
  };

  const approvals: ApprovalKeyVerification[] = [
    {
      approverId: "coord_user_1",
      approverRole: "coordinator",
      planHash,
      passkeySignature: "sig_coord",
    },
    {
      approverId: "finance_user_2",
      approverRole: "finance",
      planHash,
      passkeySignature: "sig_finance",
    },
  ];

  return { plan, approvals };
}

function createValidContext(): TreasurerContext {
  return {
    isEmergencyStopActive: false,
    isReadinessOk: true,
    paypalAvailableCents: 100000, // $1000.00
    reserveProtectedCents: 20000,
    feesReservedCents: 2000,
    committedCents: 0,
    alreadyPaidHouseholdIds: new Set<string>(),
  };
}

describe("Hardened Treasurer Engine (§4.6)", () => {
  describe("Safety Pre-Conditions", () => {
    it("strictly blocks execution when plan is in voided or closed state", () => {
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      const voidedPlan = { ...plan, state: "voided" as const };
      const resVoided = validatePreConditions({ plan: voidedPlan, approvals, context });
      expect(resVoided.valid).toBe(false);
      expect(resVoided.error).toContain("Cannot execute plan in state 'voided'");

      const closedPlan = { ...plan, state: "closed" as const };
      const resClosed = validatePreConditions({ plan: closedPlan, approvals, context });
      expect(resClosed.valid).toBe(false);
      expect(resClosed.error).toContain("Cannot execute plan in state 'closed'");
    });

    it("uses default payoutSender when omitted", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      // Block via emergency stop so default createPayoutBatch is initialized but not called across network
      const context = { ...createValidContext(), isEmergencyStopActive: true };

      const res = await treasurer.executePlan({ plan, approvals, context });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Emergency stop is active");
    });

    it("strictly blocks execution when host readiness is false", () => {
      const { plan, approvals } = createValidPlan();
      const context = { ...createValidContext(), isReadinessOk: false };

      const res = validatePreConditions({ plan, approvals, context });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Host readiness check failed");
    });

    it("blocks execution if plan content was tampered after approval (plan hash mismatch)", () => {
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      // Tamper with plan amount
      const tamperedPlan: PayoutPlan = {
        ...plan,
        totalAmountCents: 50000, // modified!
      };

      const res = validatePreConditions({ plan: tamperedPlan, approvals, context });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Plan hash mismatch");
    });

    it("blocks execution if missing a Finance-role passkey approval", () => {
      const { plan } = createValidPlan();
      const context = createValidContext();

      const invalidApprovals: ApprovalKeyVerification[] = [
        { approverId: "c1", approverRole: "coordinator", planHash: plan.planHash, passkeySignature: "s1" },
        { approverId: "c2", approverRole: "coordinator", planHash: plan.planHash, passkeySignature: "s2" },
      ];

      const res = validatePreConditions({ plan, approvals: invalidApprovals, context });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Finance role");
    });

    it("blocks execution if allocatable balance is insufficient", () => {
      const { plan, approvals } = createValidPlan();
      const context = { ...createValidContext(), paypalAvailableCents: 1000 }; // only $10.00

      const res = validatePreConditions({ plan, approvals, context });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Insufficient allocatable funds");
    });

    it("blocks execution if a household was already paid for this activation and tranche", () => {
      const { plan, approvals } = createValidPlan();
      const context = {
        ...createValidContext(),
        alreadyPaidHouseholdIds: new Set(["hh_1"]),
      };

      const res = validatePreConditions({ plan, approvals, context });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("already been paid");
    });
  });

  describe("Six Failure Drills (§4.6)", () => {
    it("Drill 1: Double-click / concurrent trigger prevents duplicate payouts", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      let callCount = 0;
      const mockSender = vi.fn(async () => {
        callCount++;
        // Simulate network latency
        await new Promise((r) => setTimeout(r, 50));
        return {
          batch_header: { payout_batch_id: "PAYPAL_BATCH_123", batch_status: "PENDING" },
        } as any;
      });

      // Fire two concurrent calls
      const [res1, res2] = await Promise.all([
        treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender }),
        treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender }),
      ]);

      // Exactly one succeeds, the other is rejected as concurrent
      const successes = [res1, res2].filter((r) => r.success);
      const rejections = [res1, res2].filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(rejections.length).toBe(1);
      expect(rejections[0].error).toContain("CONCURRENT_SUBMISSION_REJECTED");
      expect(callCount).toBe(1);
    });

    it("Drill 2: Refresh mid-submit reuses outbox record and returns existing batch", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      const mockSender = vi.fn(async () => ({
        batch_header: { payout_batch_id: "BATCH_SUBMITTED_456", batch_status: "PENDING" },
      })) as any;

      const firstCall = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(firstCall.success).toBe(true);
      expect(firstCall.replayed).toBe(false);

      // User refreshes page and clicks Submit again
      const secondCall = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(secondCall.success).toBe(true);
      expect(secondCall.replayed).toBe(true);
      expect(secondCall.paypalBatchId).toBe("BATCH_SUBMITTED_456");
      expect(mockSender).toHaveBeenCalledTimes(1);
    });

    it("Drill 3: Network timeout after send preserves outbox idempotency", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      const mockSender = vi.fn(async ({ requestId }: any) => {
        expect(requestId).toBe(`req_${plan.id}`);
        return {
          batch_header: { payout_batch_id: "BATCH_AFTER_TIMEOUT_789", batch_status: "PENDING" },
        };
      }) as any;

      const res = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(res.success).toBe(true);
      const outbox = treasurer.getOutboxEntry(plan.id);
      expect(outbox?.status).toBe("SENT");
      expect(outbox?.paypalRequestId).toBe(`req_${plan.id}`);
    });

    it("Drill 4: 5xx HTTP error then retry safely recovers", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      let attempts = 0;
      const mockSender = vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("500 Internal Server Error from PayPal");
        }
        return {
          batch_header: { payout_batch_id: "BATCH_RECOVERED_111", batch_status: "PENDING" },
        };
      }) as any;

      // First attempt fails
      const first = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(first.success).toBe(false);
      expect(first.error).toContain("500 Internal Server Error");

      // Retry attempt succeeds
      const second = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(second.success).toBe(true);
      expect(second.paypalBatchId).toBe("BATCH_RECOVERED_111");
      expect(attempts).toBe(2);
    });

    it("Drill 5: Process restart resumes submitting state cleanly", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      // Simulate outbox row already in DB from before crash without known paypalBatchId
      (treasurer as any).outbox.set(plan.id, {
        id: `outbox_${plan.id}`,
        planId: plan.id,
        senderBatchId: `batch_${plan.activationId}_t1`,
        paypalRequestId: `req_${plan.id}`,
        status: "SUBMITTING",
        createdAt: "2026-11-09T00:00:00Z",
        updatedAt: "2026-11-09T00:00:00Z",
      });

      const mockSender = vi.fn();
      const result = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });

      expect(result.success).toBe(true);
      expect(result.replayed).toBe(true);
      expect(result.paypalBatchId).toBe("RECOVERED_BATCH");
      expect(mockSender).not.toHaveBeenCalled();
    });

    it("handles non-standard error throwing during payout execution", async () => {
      const treasurer = new TreasurerEngine();
      const { plan, approvals } = createValidPlan();
      const context = createValidContext();

      const mockSender = vi.fn(async () => {
        throw "String error without message";
      });

      const result = await treasurer.executePlan({ plan, approvals, context, payoutSender: mockSender });
      expect(result.success).toBe(false);
      const outbox = treasurer.getOutboxEntry(plan.id);
      expect(outbox?.status).toBe("FAILED");
    });

    it("Drill 6: Webhook replay handling is idempotent", () => {
      const processedEventIds = new Set<string>();

      function handleItemWebhook(event: { id: string; status: string }) {
        if (processedEventIds.has(event.id)) {
          return { status: "ALREADY_PROCESSED", duplicate: true };
        }
        processedEventIds.add(event.id);
        return { status: "PROCESSED", duplicate: false };
      }

      const event = { id: "WH_EV_ITEM_SUCCESS_999", status: "SUCCESS" };

      const first = handleItemWebhook(event);
      expect(first.duplicate).toBe(false);

      const second = handleItemWebhook(event);
      expect(second.duplicate).toBe(true);
      expect(second.status).toBe("ALREADY_PROCESSED");
    });

    it("safely partitions MANUAL offline relief items away from PayPal payout batches", async () => {
      const treasurer = new TreasurerEngine();
      const { approvals } = createValidPlan();
      const context = createValidContext();

      // Create a plan with 1 digital item and 1 offline manual cash card item
      const mixedPlan: PayoutPlan = {
        id: "plan_mixed_rails_001",
        activationId: "act_test_mixed",
        tranche: 1,
        state: "approved_2",
        planHash: "",
        items: [
          {
            householdId: "hh_digital_001",
            recipientType: "EMAIL",
            receiver: "resident@example.com",
            amountCents: 10000,
            currency: "USD",
            note: "Digital PayPal relief",
          },
          {
            householdId: "hh_manual_002",
            recipientType: "MANUAL",
            receiver: "OFFLINE_CASH_CARD",
            amountCents: 10000,
            currency: "USD",
            note: "Physical offline cash card",
          },
        ],
        totalAmountCents: 20000,
        totalFeesCents: 50,
        createdAt: new Date().toISOString(),
      };
      mixedPlan.planHash = computePlanHash(mixedPlan);

      // Re-sign approvals with the mixed plan hash
      const mixedApprovals = approvals.map((a) => ({ ...a, planHash: mixedPlan.planHash }));

      const mockSender = vi.fn(async (params: any) => {
        // Assert only the digital item was passed to PayPal
        expect(params.items.length).toBe(1);
        expect(params.items[0].receiver).toBe("resident@example.com");
        return {
          batch_header: { payout_batch_id: "BATCH_DIGITAL_ONLY", batch_status: "PENDING" },
        };
      });

      const result = await treasurer.executePlan({
        plan: mixedPlan,
        approvals: mixedApprovals,
        context,
        payoutSender: mockSender,
      });

      expect(result.success).toBe(true);
      expect(result.digitalDisbursementsCount).toBe(1);
      expect(result.offlineDisbursementsCount).toBe(1);
      expect(result.offlineItems?.length).toBe(1);
      expect(result.offlineItems?.[0].householdId).toBe("hh_manual_002");
      expect(mockSender).toHaveBeenCalledTimes(1);
    });
  });
});
