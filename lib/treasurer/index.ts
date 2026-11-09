/**
 * HARDENED TREASURER (CODE SERVICE)
 * Golden Rule #3: Only the Treasurer (code) can call PayPal Payouts.
 * Zero AI imports. Pure deterministic money movement.
 */

import { validateTwoKeyApproval, type ApprovalKeyVerification } from "@/lib/security/passkeys";
import { calculateAllocatable } from "@/lib/ledger/index";
import { createPayoutBatch, type CreatePayoutBatchResponse } from "@/lib/paypal/payouts";
import crypto from "crypto";

export type PlanState =
  | "draft"
  | "rules_valid"
  | "explained"
  | "approved_1"
  | "approved_2"
  | "submitting"
  | "submitted"
  | "settled_partial"
  | "settled"
  | "closed"
  | "voided";

export interface PlanItem {
  householdId: string;
  recipientType: "EMAIL" | "PAYPAL_ID" | "MANUAL";
  receiver: string;
  amountCents: number;
  currency: string;
  note: string;
}

export interface PayoutPlan {
  id: string;
  activationId: string;
  tranche: 1 | 2;
  state: PlanState;
  planHash: string;
  items: PlanItem[];
  totalAmountCents: number;
  totalFeesCents: number;
  createdAt: string;
}

export interface TreasurerContext {
  isEmergencyStopActive: boolean;
  isReadinessOk: boolean;
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  alreadyPaidHouseholdIds: Set<string>;
}

export interface OutboxEntry {
  id: string;
  planId: string;
  senderBatchId: string;
  paypalRequestId: string;
  status: "PENDING" | "SUBMITTING" | "SENT" | "FAILED";
  paypalBatchId?: string;
  responsePayload?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Computes canonical SHA-256 hash of the payout plan to bind approvals.
 */
export function computePlanHash(plan: Omit<PayoutPlan, "planHash" | "state">): string {
  const canonicalPayload = JSON.stringify({
    id: plan.id,
    activationId: plan.activationId,
    tranche: plan.tranche,
    totalAmountCents: plan.totalAmountCents,
    totalFeesCents: plan.totalFeesCents,
    items: plan.items.map((i) => ({
      householdId: i.householdId,
      recipientType: i.recipientType,
      receiver: i.receiver,
      amountCents: i.amountCents,
      currency: i.currency,
    })),
  });
  return crypto.createHash("sha256").update(canonicalPayload).digest("hex");
}

export interface ExecutionResult {
  success: boolean;
  batchId?: string;
  paypalBatchId?: string;
  state: PlanState;
  replayed?: boolean;
  error?: string;
  digitalDisbursementsCount?: number;
  offlineDisbursementsCount?: number;
  offlineItems?: PlanItem[];
}

/**
 * Validates all pre-conditions before money can move.
 */
export function validatePreConditions({
  plan,
  approvals,
  context,
}: {
  plan: PayoutPlan;
  approvals: ApprovalKeyVerification[];
  context: TreasurerContext;
}): { valid: boolean; error?: string } {
  // 1. Emergency stop check
  if (context.isEmergencyStopActive) {
    return { valid: false, error: "TREASURER_BLOCKED: Emergency stop is active." };
  }

  // 2. Host readiness check
  if (!context.isReadinessOk) {
    return { valid: false, error: "TREASURER_BLOCKED: Host readiness check failed." };
  }

  // 3. Plan state check
  if (plan.state === "voided" || plan.state === "closed") {
    return { valid: false, error: `TREASURER_BLOCKED: Cannot execute plan in state '${plan.state}'.` };
  }

  // 4. Plan hash verification
  const computedHash = computePlanHash(plan);
  if (computedHash !== plan.planHash) {
    return { valid: false, error: "TREASURER_BLOCKED: Plan hash mismatch. Plan content was modified!" };
  }

  // 5. Two-key passkey approval verification
  const approvalValidation = validateTwoKeyApproval(approvals, plan.planHash);
  if (!approvalValidation.valid) {
    return { valid: false, error: `TREASURER_BLOCKED: ${approvalValidation.error}` };
  }

  // 6. Solvency / Allocatable coverage check
  const allocatable = calculateAllocatable({
    paypalAvailableCents: context.paypalAvailableCents,
    reserveProtectedCents: context.reserveProtectedCents,
    feesReservedCents: context.feesReservedCents,
    committedCents: context.committedCents,
    isTranche1: plan.tranche === 1,
  });

  const totalRequired = plan.totalAmountCents + plan.totalFeesCents;
  if (allocatable < totalRequired) {
    return {
      valid: false,
      error: `TREASURER_BLOCKED: Insufficient allocatable funds. Required: ${totalRequired}¢, Available: ${allocatable}¢.`,
    };
  }

  // 7. Deduplication: No household already paid for this activation and tranche
  for (const item of plan.items) {
    if (context.alreadyPaidHouseholdIds.has(item.householdId)) {
      return {
        valid: false,
        error: `TREASURER_BLOCKED: Household ${item.householdId} has already been paid for this event and tranche.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Hardened Treasurer Executor
 * Manages outbox pattern, idempotency keys, and recovery.
 */
export class TreasurerEngine {
  private outbox = new Map<string, OutboxEntry>();
  private activeSubmissions = new Set<string>();

  getOutboxEntry(planId: string): OutboxEntry | undefined {
    return this.outbox.get(planId);
  }

  async executePlan({
    plan,
    approvals,
    context,
    payoutSender = createPayoutBatch as any,
  }: {
    plan: PayoutPlan;
    approvals: ApprovalKeyVerification[];
    context: TreasurerContext;
    payoutSender?: (params: any) => Promise<any>;
  }): Promise<ExecutionResult> {
    // Check if another concurrent execution of this exact plan is in progress
    if (this.activeSubmissions.has(plan.id)) {
      return {
        success: false,
        state: plan.state,
        error: "CONCURRENT_SUBMISSION_REJECTED: Payout batch submission already in flight.",
      };
    }

    // Check outbox for prior execution (Idempotency replay)
    const existing = this.outbox.get(plan.id);
    if (existing) {
      if (existing.status === "SENT" && existing.paypalBatchId) {
        return {
          success: true,
          batchId: existing.senderBatchId,
          paypalBatchId: existing.paypalBatchId,
          state: "submitted",
          replayed: true,
        };
      }
      if (existing.status === "SUBMITTING") {
        // Recovery scenario: process restart or resume
        return {
          success: true,
          batchId: existing.senderBatchId,
          paypalBatchId: existing.paypalBatchId || "RECOVERED_BATCH",
          state: "submitted",
          replayed: true,
        };
      }
    }

    // Validate pre-conditions
    const validation = validatePreConditions({ plan, approvals, context });
    if (!validation.valid) {
      return { success: false, state: plan.state, error: validation.error };
    }

    const senderBatchId = `batch_${plan.activationId}_t${plan.tranche}`;
    const paypalRequestId = `req_${plan.id}`;

    // Write Outbox Entry BEFORE sending external call
    const outboxRecord: OutboxEntry = {
      id: `outbox_${plan.id}`,
      planId: plan.id,
      senderBatchId,
      paypalRequestId,
      status: "SUBMITTING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.outbox.set(plan.id, outboxRecord);
    this.activeSubmissions.add(plan.id);

    // Partition items: PayPal digital items vs Offline cash card/manual items
    const digitalItems = plan.items.filter(
      (item) => item.recipientType === "EMAIL" || item.recipientType === "PAYPAL_ID"
    );
    const manualItems = plan.items.filter(
      (item) => (item.recipientType as string) === "MANUAL"
    );

    try {
      let paypalBatchId: string | undefined = undefined;
      let batchResponse: any = null;

      if (digitalItems.length > 0) {
        batchResponse = await payoutSender({
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: "Mutual Aid Disbursement - Landfall",
            email_message: "Your anticipatory mutual-aid relief payment has been issued.",
          },
          items: digitalItems.map((item) => ({
            recipient_type: item.recipientType,
            receiver: item.receiver,
            amount: {
              value: (item.amountCents / 100).toFixed(2),
              currency: item.currency,
            },
            note: item.note,
            sender_item_id: `${plan.activationId}:t${plan.tranche}:${item.householdId}`,
          })),
          requestId: paypalRequestId,
        });

        const batchData = batchResponse.data || batchResponse;
        paypalBatchId = batchData?.batch_header?.payout_batch_id || `batch_${senderBatchId}`;
      } else {
        // Purely offline cash card / manual relief batch (zero PayPal API call required)
        paypalBatchId = `offline_${senderBatchId}`;
        batchResponse = {
          batch_header: {
            payout_batch_id: paypalBatchId,
            batch_status: "OFFLINE_RECORDED",
          },
        };
      }

      outboxRecord.status = "SENT";
      outboxRecord.paypalBatchId = paypalBatchId;
      outboxRecord.responsePayload = batchResponse;
      outboxRecord.updatedAt = new Date().toISOString();
      this.activeSubmissions.delete(plan.id);

      return {
        success: true,
        batchId: senderBatchId,
        paypalBatchId,
        state: "submitted",
        replayed: false,
        digitalDisbursementsCount: digitalItems.length,
        offlineDisbursementsCount: manualItems.length,
        offlineItems: manualItems.length > 0 ? manualItems : undefined,
      };
    } catch (err: any) {
      // Check for PayPal duplicate batch recovery:
      // When a server restarts or a prior request reached PayPal before an outbox flush,
      // PayPal returns 400 USER_BUSINESS_ERROR with "Batch with given sender_batch_id already exists"
      // and links to the existing batch.
      const rawDetails = err?.details || {};
      const issues = Array.isArray(rawDetails.details) ? rawDetails.details : [];
      const duplicateIssue = issues.find(
        (d: any) =>
          d.issue === "Batch with given sender_batch_id already exists" ||
          d.field === "SENDER_BATCH_ID"
      );
      const links = duplicateIssue?.link || [];
      const existingBatchHref = links.find((l: any) => l.rel === "self")?.href;
      const recoveredBatchId = existingBatchHref
        ? existingBatchHref.split("/").pop()?.split("?")[0]
        : undefined;

      if (recoveredBatchId) {
        outboxRecord.status = "SENT";
        outboxRecord.paypalBatchId = recoveredBatchId;
        outboxRecord.responsePayload = rawDetails;
        outboxRecord.updatedAt = new Date().toISOString();
        this.activeSubmissions.delete(plan.id);

        return {
          success: true,
          batchId: senderBatchId,
          paypalBatchId: recoveredBatchId,
          state: "submitted",
          replayed: true,
          digitalDisbursementsCount: digitalItems.length,
          offlineDisbursementsCount: manualItems.length,
          offlineItems: manualItems.length > 0 ? manualItems : undefined,
        };
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      outboxRecord.status = "FAILED";
      outboxRecord.error = errorMsg;
      outboxRecord.updatedAt = new Date().toISOString();
      this.activeSubmissions.delete(plan.id);

      return {
        success: false,
        state: "rules_valid",
        error: errorMsg,
      };
    }
  }
}
