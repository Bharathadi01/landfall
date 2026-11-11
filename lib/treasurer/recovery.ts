/**
 * TREASURER — recovery executors. The ONLY code that may cancel a payout or send a payout batch on behalf of an
 * approved proposal. (Lives under lib/treasurer so the architecture rule "only the Treasurer imports the PayPal
 * module that can create/cancel payouts" still holds.)
 *
 * Both executors are idempotent and defensive: they re-check PayPal's current state before acting, refuse anything
 * that is not exactly what was approved, and never retry a send on an unknown outcome.
 */
import { and, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutItemRecords } from "@/lib/db/schema";
import { cancelPayoutItem } from "@/lib/paypal/payouts";
import { getPayoutItem, type PayoutItemDetails } from "@/lib/paypal/payout-reads";
import { applyItemObservation, type ObservationResult } from "@/lib/payouts/store";
import { toCents } from "@/lib/payouts/status";
import { getAccountBalance } from "@/lib/ledger/index";
import { liveTreasury } from "@/lib/relief/live-treasury";
import { TreasurerEngine, type ExecutionResult } from "./index";
import { buildPlanFromPayload, type ReceiverResolver } from "@/lib/proposals/payload";
import { receiverFor } from "@/lib/proposals/receivers";
import type { ApprovalRecord, CancelPayload, PayoutPayload } from "@/lib/proposals/types";

/* ───────────────────────────── cancel an UNCLAIMED item ───────────────────────────── */

export interface CancelDeps {
  getItem?: (paypalItemId: string) => Promise<{ data: PayoutItemDetails }>;
  cancel?: (paypalItemId: string) => Promise<{ data: PayoutItemDetails }>;
  apply?: typeof applyItemObservation;
}

export type CancelOutcome =
  | { ok: true; outcome: "CANCELLED" | "ALREADY_RETURNED"; providerStatus: string; observation: ObservationResult }
  | { ok: false; error: "NOT_UNCLAIMED" | "PROVIDER_ERROR"; providerStatus?: string; message: string };

export async function cancelUnclaimedItem(payload: CancelPayload, deps: CancelDeps = {}): Promise<CancelOutcome> {
  const getItem = deps.getItem ?? ((id: string) => getPayoutItem(id, "treasurer_cancel"));
  const cancel = deps.cancel ?? ((id: string) => cancelPayoutItem(id, "treasurer_cancel"));
  const apply = deps.apply ?? applyItemObservation;

  const observe = (rawStatus: string, source: "cancel" | "refresh", tx?: string | null, fee?: string) =>
    apply({
      paypalItemId: payload.paypalItemId,
      senderItemId: payload.senderItemId,
      paypalBatchId: payload.paypalBatchId,
      transactionId: tx ?? null,
      rawStatus,
      amountCents: payload.amountCents,
      currency: payload.currency,
      feeCents: toCents(fee),
      source,
    });

  // 1) PayPal's CURRENT state, not our stored copy: the resident may have claimed it a minute ago.
  let current: PayoutItemDetails;
  try {
    current = (await getItem(payload.paypalItemId)).data;
  } catch (e) {
    return { ok: false, error: "PROVIDER_ERROR", message: "PayPal could not be reached to check the payment's current status. Nothing was cancelled." };
  }
  const status = current.transaction_status.toUpperCase();

  if (status === "RETURNED" || status === "CANCELED") {
    // Already back (e.g. a retry after a crash): record it, do not act again.
    return { ok: true, outcome: "ALREADY_RETURNED", providerStatus: status, observation: await observe(status, "refresh", current.transaction_id) };
  }
  if (status !== "UNCLAIMED") {
    await observe(status, "refresh", current.transaction_id);
    return { ok: false, error: "NOT_UNCLAIMED", providerStatus: status, message: `PayPal now reports this payment as ${status}, so it can’t be cancelled. The case has been updated.` };
  }

  // 2) cancel at PayPal (idempotent in effect: a second call on a RETURNED item is refused by PayPal and handled above)
  try {
    const res = await cancel(payload.paypalItemId);
    const after = res.data.transaction_status?.toUpperCase() || "RETURNED";
    return { ok: true, outcome: "CANCELLED", providerStatus: after, observation: await observe(after, "cancel", res.data.transaction_id ?? current.transaction_id) };
  } catch (e) {
    return { ok: false, error: "PROVIDER_ERROR", message: "PayPal did not confirm the cancellation. Nothing was changed in the ledger; refresh to see the real status." };
  }
}

/* ───────────────────────────── send an approved payout batch ───────────────────────────── */

const ACTIVE_STATUSES = ["SUBMITTED", "PENDING", "UNCLAIMED", "ONHOLD", "BLOCKED"];

/** Households that already have a payment in flight (or unclaimed): sending to them again would be a duplicate. */
export async function householdsWithActivePayments(householdIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!householdIds.length) return out;
  for (const hh of householdIds) {
    const rows = await db
      .select({ s: payoutItemRecords.status })
      .from(payoutItemRecords)
      .where(and(like(payoutItemRecords.senderItemId, `%:${hh}`), inArray(payoutItemRecords.status, ACTIVE_STATUSES)))
      .limit(1);
    if (rows.length) out.add(hh);
  }
  return out;
}

export interface PayoutDeps {
  engine?: TreasurerEngine;
  receiverFor?: ReceiverResolver;
  payoutSender?: (params: unknown) => Promise<unknown>;
  recordBatch?: (rec: import("@/lib/payouts/store").BatchCreationRecord) => Promise<{ persisted: boolean; error?: string }>;
  activeHouseholds?: (ids: string[]) => Promise<Set<string>>;
  balances?: () => Promise<{ cash: number; unclaimed: number; paid: number; fees: number }>;
  emergencyStop?: boolean;
}

const shared = new TreasurerEngine();

export type PayoutOutcome =
  | { ok: true; paypalBatchId: string; senderBatchId: string; items: number; totalCents: number; persisted: boolean; replayed: boolean }
  | { ok: false; error: string };

export async function executeApprovedPayout(proposalId: string, payload: PayoutPayload, payloadHash: string, approvals: ApprovalRecord[], deps: PayoutDeps = {}): Promise<PayoutOutcome> {
  const resolve = deps.receiverFor ?? ((hh: string) => receiverFor(hh));
  const { plan, missing } = buildPlanFromPayload(`prop_${proposalId}`, payload, resolve);
  if (missing.length) return { ok: false, error: `NO_PAYOUT_ROUTE: no payout route is configured for ${missing.join(", ")}.` };
  // Whatever was approved must be EXACTLY what is about to be sent.
  if (plan.planHash !== payloadHash) return { ok: false, error: "PAYLOAD_CHANGED: the plan no longer matches what was approved. Create a new proposal." };

  const active = await (deps.activeHouseholds ?? householdsWithActivePayments)(payload.items.map((i) => i.householdId));
  if (active.size) return { ok: false, error: `DUPLICATE_BLOCKED: ${[...active].join(", ")} already has a payment in flight or unclaimed.` };

  const b = await (deps.balances ?? defaultBalances)();
  const t = liveTreasury({ cashCents: b.cash, unclaimedCents: b.unclaimed, paidOutCents: b.paid, feesCents: b.fees }, { inFlightUsd: 0, needsReissueUsd: 0 });

  const res: ExecutionResult = await (deps.engine ?? shared).executePlan({
    plan,
    approvals: approvals.map((a) => ({ approverId: a.approverId, approverRole: a.role, planHash: a.payloadHash, passkeySignature: `${a.method}:${a.credentialId ?? "server-verified"}` })),
    context: {
      isEmergencyStopActive: deps.emergencyStop ?? process.env.EMERGENCY_STOP === "true",
      isReadinessOk: true,
      paypalAvailableCents: b.cash,
      reserveProtectedCents: Math.round(t.reserve * 100),
      feesReservedCents: 0,
      committedCents: 0,
      alreadyPaidHouseholdIds: new Set<string>(),
    },
    ...(deps.payoutSender ? { payoutSender: deps.payoutSender as never } : {}),
    ...(deps.recordBatch ? { recordBatch: deps.recordBatch } : {}),
  });
  if (!res.success || !res.paypalBatchId) return { ok: false, error: res.error ?? "The Treasurer did not submit the batch." };
  return { ok: true, paypalBatchId: res.paypalBatchId, senderBatchId: res.batchId ?? "", items: plan.items.length, totalCents: plan.totalAmountCents, persisted: res.persisted === true, replayed: res.replayed === true };
}

async function defaultBalances() {
  const [cash, unclaimed, paid, fees] = await Promise.all([getAccountBalance("paypal_available"), getAccountBalance("payout_unclaimed"), getAccountBalance("paid_out"), getAccountBalance("payout_fees")]);
  return { cash, unclaimed, paid, fees };
}
