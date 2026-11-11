import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutItemRecords } from "@/lib/db/schema";
import { applyItemObservation, recordBatchCreation } from "@/lib/payouts/store";
import { getAccountBalance } from "@/lib/ledger/index";
import { TreasurerEngine } from "@/lib/treasurer/index";
import { cancelUnclaimedItem, executeApprovedPayout, householdsWithActivePayments } from "@/lib/treasurer/recovery";
import { buildPlanFromPayload, planIdFor } from "@/lib/proposals/payload";
import type { ApprovalRecord, CancelPayload, PayoutPayload } from "@/lib/proposals/types";

// PayPal is never reached: both modules are replaced.
const getItemMock = vi.fn();
const cancelMock = vi.fn();
vi.mock("@/lib/paypal/payout-reads", () => ({ getPayoutItem: (...a: unknown[]) => getItemMock(...a) }));
vi.mock("@/lib/paypal/payouts", () => ({ cancelPayoutItem: (...a: unknown[]) => cancelMock(...a), createPayoutBatch: vi.fn() }));

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

async function unclaimed() {
  const tag = uid();
  const senderItemId = `act_${tag}:t1:hh_rec_${tag.toLowerCase()}`;
  const paypalBatchId = `B${tag}`;
  const paypalItemId = `I${tag}`;
  await recordBatchCreation({ paypalBatchId, senderBatchId: `batch_${tag}`, planId: `imported:${tag}`, status: "SUCCESS", items: [{ senderItemId, amountCents: 10000, currency: "USD" }] });
  await applyItemObservation({ senderItemId, paypalItemId, paypalBatchId, transactionId: `T${tag}`, rawStatus: "UNCLAIMED", amountCents: 10000, currency: "USD", source: "refresh" });
  const payload: CancelPayload = { kind: "CANCEL_ITEM", senderItemId, paypalItemId, paypalBatchId, amountCents: 10000, currency: "USD", reason: "test" };
  return { tag, senderItemId, payload };
}

beforeEach(() => {
  getItemMock.mockReset();
  cancelMock.mockReset();
});

run("cancelUnclaimedItem (default PayPal read/cancel wiring)", () => {
  it("cancels an UNCLAIMED item and records RETURNED", async () => {
    const { payload, senderItemId } = await unclaimed();
    getItemMock.mockResolvedValue({ data: { transaction_status: "UNCLAIMED", transaction_id: "TX1" } });
    cancelMock.mockResolvedValue({ data: { transaction_status: "RETURNED", transaction_id: "TX1" } });
    const r = await cancelUnclaimedItem(payload);
    expect(r).toMatchObject({ ok: true, outcome: "CANCELLED", providerStatus: "RETURNED" });
    expect(cancelMock).toHaveBeenCalledWith(payload.paypalItemId, "treasurer_cancel");
    const [row] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId));
    expect(row.status).toBe("RETURNED");
  });

  it("treats a cancel response without a status as RETURNED and falls back to the earlier transaction id", async () => {
    const { payload } = await unclaimed();
    getItemMock.mockResolvedValue({ data: { transaction_status: "UNCLAIMED", transaction_id: "TX2" } });
    cancelMock.mockResolvedValue({ data: {} });
    const r = await cancelUnclaimedItem(payload);
    expect(r).toMatchObject({ ok: true, outcome: "CANCELLED", providerStatus: "RETURNED" });
  });

  it("does nothing when PayPal already returned it", async () => {
    const { payload } = await unclaimed();
    getItemMock.mockResolvedValue({ data: { transaction_status: "RETURNED", transaction_id: "TX3" } });
    const r = await cancelUnclaimedItem(payload);
    expect(r).toMatchObject({ ok: true, outcome: "ALREADY_RETURNED" });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("records a returned item even when PayPal sends no transaction id", async () => {
    const { payload } = await unclaimed();
    getItemMock.mockResolvedValue({ data: { transaction_status: "RETURNED" } });
    expect(await cancelUnclaimedItem(payload)).toMatchObject({ ok: true, outcome: "ALREADY_RETURNED" });
  });

  it("refuses when PayPal says it was claimed, and updates the stored status", async () => {
    const { payload, senderItemId } = await unclaimed();
    getItemMock.mockResolvedValue({ data: { transaction_status: "SUCCESS", transaction_id: "TX4", payout_item_fee: { value: "0.25", currency: "USD" } } });
    const r = await cancelUnclaimedItem(payload);
    expect(r).toMatchObject({ ok: false, error: "NOT_UNCLAIMED", providerStatus: "SUCCESS" });
    expect(cancelMock).not.toHaveBeenCalled();
    const [row] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId));
    expect(row.status).toBe("SUCCESS");
  });

  it("changes nothing when PayPal can't be asked or won't confirm the cancel", async () => {
    const { payload } = await unclaimed();
    getItemMock.mockRejectedValueOnce(new Error("down"));
    expect(await cancelUnclaimedItem(payload)).toMatchObject({ ok: false, error: "PROVIDER_ERROR" });
    getItemMock.mockResolvedValue({ data: { transaction_status: "UNCLAIMED", transaction_id: "TX5" } });
    cancelMock.mockRejectedValueOnce(new Error("422"));
    expect(await cancelUnclaimedItem(payload)).toMatchObject({ ok: false, error: "PROVIDER_ERROR" });
  });
});

run("householdsWithActivePayments", () => {
  it("returns only households with a payment in flight or unclaimed", async () => {
    expect((await householdsWithActivePayments([])).size).toBe(0);
    const a = await unclaimed();
    const hh = a.senderItemId.split(":").pop()!;
    const found = await householdsWithActivePayments([hh, "hh_nobody_here"]);
    expect([...found]).toEqual([hh]);
    // once it is returned, the household is free again
    await applyItemObservation({ senderItemId: a.senderItemId, rawStatus: "RETURNED", source: "refresh" });
    expect((await householdsWithActivePayments([hh])).size).toBe(0);
  });
});

const payloadFor = (hh: string[], cents = 100): PayoutPayload => ({
  kind: "NEW_PAYOUT",
  activationId: `lf${uid().toLowerCase()}`,
  tranche: 1,
  items: hh.map((householdId) => ({ householdId, amountCents: cents, currency: "USD" as const, note: "n" })),
  totalAmountCents: hh.length * cents,
  totalFeesCents: hh.length * 25,
});
const receivers = (hh: string) => `${hh}@example.com`;
const approvals = (hash: string): ApprovalRecord[] => [
  { approverId: "dana-ortiz", approverName: "Dana", role: "coordinator", method: "DEMO_KEY", payloadHash: hash },
  { approverId: "sam-patel", approverName: "Sam", role: "finance", method: "WEBAUTHN", credentialId: "cred1", payloadHash: hash },
];
const okSender = async () => ({ data: { batch_header: { payout_batch_id: "PAYBATCH1", batch_status: "PENDING" } } });

describe("executeApprovedPayout", () => {
  it("refuses a household with no payout route, and a plan that changed after approval", async () => {
    const p = payloadFor(["hh_a"]);
    const noRoute = await executeApprovedPayout("p1", p, "x", [], { receiverFor: () => null });
    expect(noRoute).toMatchObject({ ok: false });
    expect((noRoute as { error: string }).error).toMatch(/NO_PAYOUT_ROUTE/);
    const changed = await executeApprovedPayout("p1", p, "0".repeat(64), approvals("0".repeat(64)), { receiverFor: receivers });
    expect((changed as { error: string }).error).toMatch(/PAYLOAD_CHANGED/);
  });

  it("blocks duplicates for households that already have a payment active", async () => {
    const p = payloadFor(["hh_a"]);
    const { plan } = buildPlanFromPayload(planIdFor(p), p, receivers);
    const r = await executeApprovedPayout("p2", p, plan.planHash, approvals(plan.planHash), { receiverFor: receivers, activeHouseholds: async () => new Set(["hh_a"]) });
    expect((r as { error: string }).error).toMatch(/DUPLICATE_BLOCKED/);
  });

  it("sends once through the Treasurer with the approved plan (fake sender and recorder)", async () => {
    const p = payloadFor(["hh_a", "hh_b"]);
    const { plan } = buildPlanFromPayload(planIdFor(p), p, receivers);
    const sender = vi.fn(okSender);
    const recordBatch = vi.fn(async () => ({ persisted: true }));
    const r = await executeApprovedPayout("p3", p, plan.planHash, approvals(plan.planHash), {
      receiverFor: receivers,
      activeHouseholds: async () => new Set(),
      balances: async () => ({ cash: 100_000, unclaimed: 0, paid: 0, fees: 0 }),
      engine: new TreasurerEngine(),
      payoutSender: sender,
      recordBatch,
      emergencyStop: false,
    });
    expect(r).toMatchObject({ ok: true, paypalBatchId: "PAYBATCH1", items: 2, totalCents: 200, persisted: true, replayed: false });
    expect(sender).toHaveBeenCalledTimes(1);
    expect(recordBatch).toHaveBeenCalledTimes(1);
  });

  it("reports the Treasurer's refusal (emergency stop) and an engine failure without a message", async () => {
    const p = payloadFor(["hh_a"]);
    const { plan } = buildPlanFromPayload(planIdFor(p), p, receivers);
    const common = { receiverFor: receivers, activeHouseholds: async () => new Set<string>(), balances: async () => ({ cash: 100_000, unclaimed: 0, paid: 0, fees: 0 }) };
    const stopped = await executeApprovedPayout("p4", p, plan.planHash, approvals(plan.planHash), { ...common, emergencyStop: true });
    expect((stopped as { error: string }).error).toMatch(/Emergency stop/);
    const noMessage = { executePlan: async () => ({ success: false, state: "approved_2" }) } as unknown as TreasurerEngine;
    const r = await executeApprovedPayout("p4", p, plan.planHash, approvals(plan.planHash), { ...common, engine: noMessage });
    expect((r as { error: string }).error).toMatch(/did not submit/);
  });

  it("an engine success without persistence flags reports persisted=false, replayed=false", async () => {
    const p = payloadFor(["hh_a"]);
    const { plan } = buildPlanFromPayload(planIdFor(p), p, receivers);
    const engine = { executePlan: async () => ({ success: true, paypalBatchId: "PB9" }) } as unknown as TreasurerEngine;
    const r = await executeApprovedPayout("p5", p, plan.planHash, approvals(plan.planHash), { receiverFor: receivers, activeHouseholds: async () => new Set(), balances: async () => ({ cash: 1, unclaimed: 0, paid: 0, fees: 0 }), engine });
    expect(r).toMatchObject({ ok: true, paypalBatchId: "PB9", persisted: false, replayed: false, senderBatchId: "" });
  });
});

run("executeApprovedPayout (database defaults)", () => {
  beforeEach(() => {
    process.env.SANDBOX_RECEIVERS = JSON.stringify({ hh_default_route: "route@example.com" });
  });
  it("uses the configured receivers, DB balances and DB duplicate check when no deps are given", async () => {
    const p = payloadFor(["hh_default_route"]);
    const { plan } = buildPlanFromPayload(planIdFor(p), p, () => "route@example.com");
    const before = await getAccountBalance("paypal_available");
    expect(typeof before).toBe("number");
    // Real default engine: the ledger has little cash in a test DB, so the Treasurer refuses for solvency — and never calls PayPal.
    const r = await executeApprovedPayout("p6", p, plan.planHash, approvals(plan.planHash));
    expect(r.ok).toBe(false);
  });
});
