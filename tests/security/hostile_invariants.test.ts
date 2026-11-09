import { describe, it, expect, vi } from "vitest";
import {
  TreasurerEngine,
  computePlanHash,
  type PayoutPlan,
  type TreasurerContext,
} from "@/lib/treasurer/index";
import { validateTwoKeyApproval, type ApprovalKeyVerification } from "@/lib/security/passkeys";
import { validateBalancedTransaction, type LedgerEntryItem } from "@/lib/ledger/index";

describe("Hostile Security Invariants & Adversarial Attack Suite (§2, §3, §4, §9)", () => {
  const basePlan: Omit<PayoutPlan, "planHash" | "state"> = {
    id: "plan_hostile_test_001",
    activationId: "TBW:HU.W:0009",
    tranche: 1,
    totalAmountCents: 10000,
    totalFeesCents: 25,
    items: [
      {
        householdId: "hh_tbw_001",
        recipientType: "EMAIL",
        receiver: "victim@example.com",
        amountCents: 10000,
        currency: "USD",
        note: "Relief",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const planHash = computePlanHash(basePlan);

  const validPlan: PayoutPlan = {
    ...basePlan,
    state: "approved_2",
    planHash,
  };

  const validApprovals: ApprovalKeyVerification[] = [
    {
      approverId: "ops_lead_01",
      approverRole: "coordinator",
      planHash,
      passkeySignature: "sig_ops_valid_mock",
    },
    {
      approverId: "fiduciary_lead_01",
      approverRole: "finance",
      planHash,
      passkeySignature: "sig_fin_valid_mock",
    },
  ];

  const validContext: TreasurerContext = {
    isEmergencyStopActive: false,
    isReadinessOk: true,
    paypalAvailableCents: 50000,
    reserveProtectedCents: 15000,
    feesReservedCents: 5000,
    committedCents: 0,
    alreadyPaidHouseholdIds: new Set<string>(),
  };

  it("Attack 1: Plan hash tampering rejects modified recipient or payout amounts", async () => {
    const treasurer = new TreasurerEngine();

    // Adversary modifies the recipient receiver address to their own account
    const tamperedPlan: PayoutPlan = {
      ...validPlan,
      items: [
        {
          ...validPlan.items[0],
          receiver: "attacker@evil.com", // Tampered receiver!
        },
      ],
    };

    const result = await treasurer.executePlan({
      plan: tamperedPlan,
      approvals: validApprovals,
      context: validContext,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Plan hash mismatch");
  });

  it("Attack 2: Dual-custody bypass fails when one user attempts to self-approve with two signatures", async () => {
    const treasurer = new TreasurerEngine();

    // Rogue user signs twice under different roles but same approver ID
    const rogueApprovals: ApprovalKeyVerification[] = [
      {
        approverId: "rogue_operator_01",
        approverRole: "coordinator",
        planHash,
        passkeySignature: "sig_1",
      },
      {
        approverId: "rogue_operator_01", // Same person!
        approverRole: "finance",
        planHash,
        passkeySignature: "sig_2",
      },
    ];

    const result = await treasurer.executePlan({
      plan: validPlan,
      approvals: rogueApprovals,
      context: validContext,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Approvals must be signed by two distinct individuals");
  });

  it("Attack 3: Hostile approval without a Finance or Admin key is blocked", async () => {
    const treasurer = new TreasurerEngine();

    // Two distinct operators, but neither holds the Finance fiduciary role
    const nonFinanceApprovals: ApprovalKeyVerification[] = [
      {
        approverId: "ops_operator_01",
        approverRole: "coordinator",
        planHash,
        passkeySignature: "sig_1",
      },
      {
        approverId: "ops_operator_02",
        approverRole: "coordinator", // Non-finance!
        planHash,
        passkeySignature: "sig_2",
      },
    ];

    const result = await treasurer.executePlan({
      plan: validPlan,
      approvals: nonFinanceApprovals,
      context: validContext,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("At least one approver must hold the host's Finance role");
  });

  it("Attack 4: Concurrent double-submission of the exact same plan is blocked by race guard", async () => {
    const treasurer = new TreasurerEngine();

    let resolveFirstCall: (val: any) => void;
    const slowSender = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveFirstCall = resolve;
      });
    });

    // Start first submission (in flight)
    const firstPromise = treasurer.executePlan({
      plan: validPlan,
      approvals: validApprovals,
      context: validContext,
      payoutSender: slowSender,
    });

    // Attempt concurrent second submission while first is still in flight
    const concurrentResult = await treasurer.executePlan({
      plan: validPlan,
      approvals: validApprovals,
      context: validContext,
      payoutSender: slowSender,
    });

    expect(concurrentResult.success).toBe(false);
    expect(concurrentResult.error).toContain("CONCURRENT_SUBMISSION_REJECTED");

    // Complete the first call
    resolveFirstCall!({
      batch_header: {
        payout_batch_id: "BATCH_COMPLETED_001",
        batch_status: "SUCCESS",
      },
    });

    const firstResult = await firstPromise;
    expect(firstResult.success).toBe(true);
  });

  it("Attack 5: Solvency breach is blocked when payout requires more funds than allocatable", async () => {
    const treasurer = new TreasurerEngine();

    // Context with very low cash ($50 available, but $100.25 required)
    const insolventContext: TreasurerContext = {
      ...validContext,
      paypalAvailableCents: 5000, // Only $50.00
      feesReservedCents: 1000,
    };

    const result = await treasurer.executePlan({
      plan: validPlan,
      approvals: validApprovals,
      context: insolventContext,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient allocatable funds");
  });

  it("Attack 6: Emergency Stop completely halts payouts regardless of valid signatures", async () => {
    const treasurer = new TreasurerEngine();

    const emergencyContext: TreasurerContext = {
      ...validContext,
      isEmergencyStopActive: true, // Emergency Stop Active!
    };

    const result = await treasurer.executePlan({
      plan: validPlan,
      approvals: validApprovals,
      context: emergencyContext,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Emergency stop is active");
  });

  it("Attack 7: Double-entry ledger strictly rejects unbalanced transactions", () => {
    const unbalancedEntries: LedgerEntryItem[] = [
      { accountName: "paypal_available", entryType: "DEBIT", amountCents: 10000 },
      { accountName: "paid_out", entryType: "CREDIT", amountCents: 9000 }, // Discrepancy of 1000¢ ($10.00)
    ];

    const result = validateBalancedTransaction(unbalancedEntries);
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(1000);
    expect(result.totalDebits).toBe(10000);
    expect(result.totalCredits).toBe(9000);
  });
});
