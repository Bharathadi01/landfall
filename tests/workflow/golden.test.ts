import { describe, it, expect, vi } from "vitest";
import { executeGoldenWorkflow, SYNTHETIC_HOUSEHOLDS } from "@/lib/workflow/golden";
import { TreasurerEngine, computePlanHash } from "@/lib/treasurer/index";

describe("M7 Golden Workflow End-to-End Test Suite (§3, §4, §5, §6)", () => {
  it("executes all 8 stages successfully to completion", async () => {
    const treasurer = new TreasurerEngine();
    const mockSender = vi.fn().mockResolvedValue({
      batch_header: {
        payout_batch_id: "SANDBOX_BATCH_TEST_001",
        batch_status: "SUCCESS",
        time_created: new Date().toISOString(),
      },
    });

    const result = await executeGoldenWorkflow({
      targetStage: 8,
      donationAmountUsd: 1500.0,
      treasurerInstance: treasurer,
      mockPayPalPayoutSender: mockSender,
    });

    expect(result.currentStage).toBe(8);
    expect(result.mode).toBe("SANDBOX_REHEARSAL");
    expect(result.reconciliationBalanced).toBe(true);
    expect(result.stages.length).toBe(8);

    // Verify all stages completed
    for (const stage of result.stages) {
      expect(stage.status).toBe("COMPLETED");
      expect(stage.timestamp).toBeDefined();
    }

    // Verify Stage 1: Donation Inflow
    const s1 = result.stages[0];
    expect(s1.details.amountCents).toBe(150000);
    expect(s1.details.ledgerAccount).toContain("DONOR_INFLOW");

    // Verify Stage 2: Treasury Waterfall
    const s2 = result.stages[1];
    expect(s2.details.reserveProtectedCents).toBeGreaterThan(0);
    expect(s2.details.allocatableCents).toBeGreaterThan(0);

    // Verify Stage 3: Sentinel Warning
    const s3 = result.stages[2];
    expect(s3.details.eventKey).toBe("TBW:HU.W:0009");
    expect(s3.details.rehearsalMode).toBe(true);

    // Verify Stage 4: Exposure Resolution
    const s4 = result.stages[3];
    expect(s4.details.confirmedCount).toBe(5);
    expect(s4.details.excludedCount).toBe(1); // Orlando household excluded

    // Verify Stage 5: Deterministic Policy
    const s5 = result.stages[4];
    expect(s5.details.fundedCount).toBe(5);
    expect(s5.details.totalCommittedCents).toBe(50000); // 5 * $100

    // Verify Stage 6: Dual Custody
    const s6 = result.stages[5];
    expect(result.planHash).toBeDefined();
    expect(result.planHash?.length).toBe(64); // SHA-256 hex
    expect(s6.details.planHash).toBe(result.planHash);

    // Verify Stage 7: Hardened Treasurer Outbox
    const s7 = result.stages[6];
    expect(s7.details.paypalBatchId).toBeDefined();
    expect(s7.details.itemsCount).toBe(5);

    // Verify Stage 8: Ledger Reconciliation
    const s8 = result.stages[7];
    expect(s8.details.ledgerAuditStatus).toBe("BALANCED");
    expect(s8.details.discrepancyCents).toBe(0);
  });

  it("supports partial stepping through individual stages", async () => {
    const stage3Result = await executeGoldenWorkflow({ targetStage: 3 });
    expect(stage3Result.currentStage).toBe(3);
    expect(stage3Result.stages[0].status).toBe("COMPLETED");
    expect(stage3Result.stages[1].status).toBe("COMPLETED");
    expect(stage3Result.stages[2].status).toBe("COMPLETED");
    expect(stage3Result.stages[3].status).toBe("PENDING");
    expect(stage3Result.stages[4].status).toBe("PENDING");
  });

  it("safely excludes households located outside warning polygons", async () => {
    const result = await executeGoldenWorkflow({ targetStage: 4 });
    const s4 = result.stages[3];
    const excluded = s4.details.excludedHouseholds;
    expect(excluded.length).toBe(1);
    expect(excluded[0].id).toBe("hh_orl_006");
  });

  it("enforces plan hash immutability", () => {
    const plan = {
      id: "test_plan_01",
      activationId: "TBW:HU.W:0009",
      tranche: 1 as const,
      totalAmountCents: 10000,
      totalFeesCents: 25,
      items: [
        {
          householdId: "hh_01",
          recipientType: "EMAIL" as const,
          receiver: "user@example.com",
          amountCents: 10000,
          currency: "USD",
          note: "Relief",
        },
      ],
      createdAt: "2024-10-09T18:00:00Z",
    };

    const hash1 = computePlanHash(plan);
    const hash2 = computePlanHash(plan);
    expect(hash1).toBe(hash2);

    // Any modification changes the hash
    const tampered = { ...plan, totalAmountCents: 20000 };
    const hashTampered = computePlanHash(tampered);
    expect(hashTampered).not.toBe(hash1);
  });
});
