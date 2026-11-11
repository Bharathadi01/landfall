import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { webhookEvents, payoutItemRecords } from "@/lib/db/schema";

/**
 * Accept-path tests for payout events at the webhook receiver (D-3, D-5). PayPal's signature API is faked
 * (verification itself is covered in webhook-gate.test.ts); everything else is real: route, store, ledger,
 * database. Database-backed, so TEST_DATABASE_URL only.
 */
const verify = vi.fn();
const refresh = vi.fn();
let failNextItemApply = false;

vi.mock("@/lib/paypal/webhooks", async (orig) => ({
  ...(await orig<typeof import("@/lib/paypal/webhooks")>()),
  verifyWebhookSignature: (...a: unknown[]) => verify(...a),
}));
vi.mock("@/lib/payouts/refresh", () => ({ refreshPayoutBatch: (...a: unknown[]) => refresh(...a) }));
vi.mock("@/lib/payouts/store", async (orig) => {
  const real = await orig<typeof import("@/lib/payouts/store")>();
  return {
    ...real,
    applyItemObservation: (...a: Parameters<typeof real.applyItemObservation>) => {
      if (failNextItemApply) {
        failNextItemApply = false;
        throw new Error("simulated handler crash");
      }
      return real.applyItemObservation(...a);
    },
  };
});

import { POST } from "@/app/api/paypal/webhook/route";
import { recordBatchCreation } from "@/lib/payouts/store";
import { getAccountBalance } from "@/lib/ledger/index";

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();
const HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/C",
  "paypal-transmission-id": "t",
  "paypal-transmission-sig": "s",
  "paypal-transmission-time": "2026-11-11T00:00:00Z",
};
const post = (event: unknown) => POST(new NextRequest("http://localhost/api/paypal/webhook", { method: "POST", headers: HEADERS, body: JSON.stringify(event) }));

async function seed() {
  const tag = uid();
  const paypalBatchId = `B${tag}`;
  const senderItemId = `act_${tag}:t1:hh_1`;
  await recordBatchCreation({ paypalBatchId, senderBatchId: `batch_${tag}_t1`, status: "PENDING", items: [{ senderItemId, amountCents: 10000, currency: "USD" }] });
  return { tag, paypalBatchId, senderItemId };
}
const itemEvent = (id: string, type: string, tag: string, paypalBatchId: string, senderItemId: string, extra: Record<string, unknown> = {}, status?: string) => ({
  id,
  event_type: type,
  create_time: new Date().toISOString(),
  resource: {
    payout_item_id: `PI${tag}`,
    payout_batch_id: paypalBatchId,
    transaction_id: `TX${tag}`,
    transaction_status: status ?? type.split(".").pop(),
    payout_item_fee: { currency: "USD", value: "0.25" },
    payout_item: { amount: { currency: "USD", value: "100.00" }, sender_item_id: senderItemId },
    ...extra,
  },
});
const statusOf = async (senderItemId: string) => (await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId)))[0]?.status;

run("webhook → payout records + ledger", () => {
  beforeEach(() => {
    verify.mockReset().mockResolvedValue(true);
    refresh.mockReset().mockResolvedValue({ ok: true });
    failNextItemApply = false;
    process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
  });

  it("a verified PAYOUTS-ITEM.SUCCEEDED event updates the item record and posts the money once", async () => {
    const { tag, paypalBatchId, senderItemId } = await seed();
    const cash = await getAccountBalance("paypal_available");
    const res = await post(itemEvent(`WH-${tag}-1`, "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", tag, paypalBatchId, senderItemId, {}, "SUCCESS"));
    expect(res.status).toBe(200);
    expect(await statusOf(senderItemId)).toBe("SUCCESS");
    expect(await getAccountBalance("paypal_available")).toBe(cash - 10000 - 25);
    const [ev] = await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, `WH-${tag}-1`));
    expect(ev.verified).toBe(true);
    expect(ev.processedAt).not.toBeNull();
  });

  it("a PayPal redelivery of a processed event is acknowledged and not applied twice", async () => {
    const { tag, paypalBatchId, senderItemId } = await seed();
    const ev = itemEvent(`WH-${tag}-2`, "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", tag, paypalBatchId, senderItemId, {}, "SUCCESS");
    await post(ev);
    const cash = await getAccountBalance("paypal_available");
    const again = await post(ev);
    expect(again.status).toBe(200);
    expect((await again.json()).message).toMatch(/already processed/);
    expect(await getAccountBalance("paypal_available")).toBe(cash);
  });

  it("a crash mid-handling does NOT lose the event: PayPal's retry is processed, not acknowledged as a duplicate", async () => {
    const { tag, paypalBatchId, senderItemId } = await seed();
    const ev = itemEvent(`WH-${tag}-3`, "PAYMENT.PAYOUTS-ITEM.UNCLAIMED", tag, paypalBatchId, senderItemId, {}, "UNCLAIMED");

    failNextItemApply = true;
    const first = await post(ev);
    expect(first.status).toBe(500);
    expect(await statusOf(senderItemId)).toBe("SUBMITTED"); // nothing applied
    const [pending] = await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, `WH-${tag}-3`));
    expect(pending.processedAt).toBeNull(); // still open

    const retry = await post(ev);
    expect(retry.status).toBe(200);
    expect(await statusOf(senderItemId)).toBe("UNCLAIMED"); // the update was not lost
    const [done] = await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, `WH-${tag}-3`));
    expect(done.processedAt).not.toBeNull();
  });

  it("an out-of-order event cannot downgrade a credited item", async () => {
    const { tag, paypalBatchId, senderItemId } = await seed();
    await post(itemEvent(`WH-${tag}-4a`, "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", tag, paypalBatchId, senderItemId, {}, "SUCCESS"));
    const cash = await getAccountBalance("paypal_available");
    const late = await post(itemEvent(`WH-${tag}-4b`, "PAYMENT.PAYOUTS-ITEM.UNCLAIMED", tag, paypalBatchId, senderItemId, {}, "UNCLAIMED"));
    expect(late.status).toBe(200);
    expect(await statusOf(senderItemId)).toBe("SUCCESS");
    expect(await getAccountBalance("paypal_available")).toBe(cash);
  });

  it("HELD maps to ONHOLD; the event is recorded without moving money", async () => {
    const { tag, paypalBatchId, senderItemId } = await seed();
    const cash = await getAccountBalance("paypal_available");
    // no transaction_status in the resource: the status must come from the event name
    const ev = itemEvent(`WH-${tag}-5`, "PAYMENT.PAYOUTS-ITEM.HELD", tag, paypalBatchId, senderItemId);
    delete (ev.resource as Record<string, unknown>).transaction_status;
    await post(ev);
    expect(await statusOf(senderItemId)).toBe("ONHOLD");
    expect(await getAccountBalance("paypal_available")).toBe(cash);
  });

  it("a batch event records the batch status and asks PayPal (read-only) for the items", async () => {
    const { tag, paypalBatchId } = await seed();
    const res = await post({
      id: `WH-${tag}-6`,
      event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS",
      create_time: new Date().toISOString(),
      resource: { batch_header: { payout_batch_id: paypalBatchId, batch_status: "SUCCESS" } },
    });
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(paypalBatchId);
  });

  it("a failed follow-up refresh does not fail the webhook (the event is still recorded)", async () => {
    const { tag, paypalBatchId } = await seed();
    refresh.mockRejectedValue(new Error("PayPal unavailable"));
    const res = await post({
      id: `WH-${tag}-7`,
      event_type: "PAYMENT.PAYOUTSBATCH.PROCESSING",
      create_time: new Date().toISOString(),
      resource: { batch_header: { payout_batch_id: paypalBatchId, batch_status: "PROCESSING" } },
    });
    expect(res.status).toBe(200);
    const [ev] = await db.select().from(webhookEvents).where(eq(webhookEvents.paypalEventId, `WH-${tag}-7`));
    expect(ev.processedAt).not.toBeNull();
  });
});
