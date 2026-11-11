import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutBatchRecords, payoutItemRecords } from "@/lib/db/schema";
import { recordBatchCreation, applyBatchSnapshot, getBatchRecord, listItemRecords } from "@/lib/payouts/store";
import { refreshPayoutBatch, REFRESH_PAGE_SIZE } from "@/lib/payouts/refresh";
import { getAccountBalance } from "@/lib/ledger/index";
import type { GetPayoutBatchResponse } from "@/lib/paypal/payout-reads";

/** Database-backed (throwaway DB only). PayPal is replaced by a fake page source: no network, no money. */
const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

function paypalItem(batchTag: string, n: number, status: string, amount = "100.00") {
  return {
    payout_item_id: `PI${batchTag}${n}`,
    transaction_id: status === "PENDING" ? undefined : `TX${batchTag}${n}`,
    transaction_status: status,
    payout_item_fee: { currency: "USD", value: status === "SUCCESS" ? "2.00" : "0.25" },
    payout_item: { recipient_type: "EMAIL", amount: { currency: "USD", value: amount }, receiver: "x@example.test", sender_item_id: `act_${batchTag}:t1:hh_${n}` },
    time_processed: "2026-11-09T17:56:28Z",
  };
}

function page(batchId: string, items: ReturnType<typeof paypalItem>[], extra: Partial<GetPayoutBatchResponse> = {}): { data: GetPayoutBatchResponse } {
  return {
    data: {
      batch_header: { payout_batch_id: batchId, batch_status: "SUCCESS", sender_batch_header: { sender_batch_id: `batch_${batchId}_t1` }, amount: { currency: "USD", value: "500.00" }, fees: { currency: "USD", value: "3.00" } },
      items,
      links: [{ rel: "self", href: "x" }],
      ...extra,
    } as GetPayoutBatchResponse,
  };
}

async function seed(n: number, amountCents = 10000) {
  const tag = uid();
  const paypalBatchId = `B${tag}`;
  await recordBatchCreation({
    paypalBatchId,
    senderBatchId: `batch_${tag}_t1`,
    status: "PENDING",
    items: Array.from({ length: n }, (_, i) => ({ senderItemId: `act_${tag}:t1:hh_${i + 1}`, amountCents, currency: "USD" })),
  });
  return { tag, paypalBatchId };
}

run("status refresh from PayPal (D-4, D-9)", () => {
  it("refreshes a recorded batch: five items, one credited and four unclaimed (the real VTJG3SR5BY56C shape)", async () => {
    const { tag, paypalBatchId } = await seed(5);
    const cashBefore = await getAccountBalance("paypal_available");
    const items = [paypalItem(tag, 1, "SUCCESS"), ...[2, 3, 4, 5].map((n) => paypalItem(tag, n, "UNCLAIMED"))];
    const fetchBatch = vi.fn(async () => page(paypalBatchId, items, { total_items: 5, total_pages: 1 }));

    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });

    expect(res.ok).toBe(true);
    expect(res.complete).toBe(true);
    expect(res.pagesFetched).toBe(1);
    expect(res.itemsSeen).toBe(5);
    expect(res.batchStatus).toBe("SUCCESS");
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    expect(fetchBatch).toHaveBeenCalledWith(paypalBatchId, "payout_refresh", { page: 1, pageSize: REFRESH_PAGE_SIZE, totalRequired: true });

    const rows = await listItemRecords(paypalBatchId);
    expect(rows.filter((r) => r.status === "SUCCESS")).toHaveLength(1);
    expect(rows.filter((r) => r.status === "UNCLAIMED")).toHaveLength(4);
    expect(rows.every((r) => r.paypalItemId && r.transactionId)).toBe(true);

    const batch = await getBatchRecord(paypalBatchId);
    expect(batch?.status).toBe("SUCCESS");
    expect(batch?.amountCents).toBe(50000);
    expect(batch?.feeCents).toBe(300);
    expect(batch?.lastSyncSource).toBe("refresh");
    expect(batch?.lastSyncError).toBeNull();

    // cash: 5 × $100 held/paid + fees (2.00 + 4 × 0.25) all left available cash
    const cashAfter = await getAccountBalance("paypal_available");
    expect(cashAfter - cashBefore).toBe(-(50000 + 200 + 4 * 25));
  });

  it("a second refresh after the cool-down is a no-op for unchanged items and posts nothing again", async () => {
    const { tag, paypalBatchId } = await seed(2);
    const items = [paypalItem(tag, 1, "SUCCESS"), paypalItem(tag, 2, "UNCLAIMED")];
    const fetchBatch = vi.fn(async () => page(paypalBatchId, items, { total_items: 2, total_pages: 1 }));
    await refreshPayoutBatch(paypalBatchId, { fetchBatch, cooldownMs: 0 });
    const cash = await getAccountBalance("paypal_available");
    const second = await refreshPayoutBatch(paypalBatchId, { fetchBatch, cooldownMs: 0 });
    expect(second.ok).toBe(true);
    expect(second.changes).toEqual([]);
    expect(await getAccountBalance("paypal_available")).toBe(cash);
  });

  it("walks every page when PayPal reports more than one (no silent truncation)", async () => {
    const { tag, paypalBatchId } = await seed(5);
    const all = Array.from({ length: 5 }, (_, i) => paypalItem(tag, i + 1, "SUCCESS"));
    const fetchBatch = vi.fn(async (_id: string, _a: string, o: { page: number }) =>
      page(paypalBatchId, all.slice((o.page - 1) * 2, o.page * 2), { total_items: 5, total_pages: 3 })
    );
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(res.pagesFetched).toBe(3);
    expect(res.itemsSeen).toBe(5);
    expect(res.complete).toBe(true);
    expect((await listItemRecords(paypalBatchId)).filter((r) => r.status === "SUCCESS")).toHaveLength(5);
  });

  it("reports an incomplete result when PayPal's item total does not match what was received", async () => {
    const { tag, paypalBatchId } = await seed(3);
    const fetchBatch = vi.fn(async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS")], { total_items: 3, total_pages: 1 }));
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(res.complete).toBe(false);
    expect(res.flags).toContain("ITEM_COUNT_MISMATCH");
  });

  it("rejects a response that names a different batch than the one requested", async () => {
    const { tag, paypalBatchId } = await seed(1);
    const fetchBatch = vi.fn(async () => page("SOMEOTHERBATCH", [paypalItem(tag, 1, "SUCCESS")]));
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("BATCH_ID_MISMATCH");
    expect((await listItemRecords(paypalBatchId))[0].status).toBe("SUBMITTED");
  });

  it("a temporary PayPal error leaves every stored status exactly as it was and records the error", async () => {
    const { tag, paypalBatchId } = await seed(2);
    // establish real state first
    await refreshPayoutBatch(paypalBatchId, {
      fetchBatch: async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS"), paypalItem(tag, 2, "UNCLAIMED")], { total_items: 2, total_pages: 1 }),
      cooldownMs: 0,
    });
    const cash = await getAccountBalance("paypal_available");
    const snapshot = JSON.stringify((await listItemRecords(paypalBatchId)).map((r) => [r.senderItemId, r.status]).sort());

    const failing = vi.fn(async () => {
      throw Object.assign(new Error("PayPal API error: Service Unavailable (503)"), { status: 503 });
    });
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch: failing, cooldownMs: 0 });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("503");
    expect(failing).toHaveBeenCalledTimes(1); // no hidden retry loop
    expect(JSON.stringify((await listItemRecords(paypalBatchId)).map((r) => [r.senderItemId, r.status]).sort())).toBe(snapshot);
    expect(await getAccountBalance("paypal_available")).toBe(cash);
    const batch = await getBatchRecord(paypalBatchId);
    expect(batch?.lastSyncError).toContain("503");
    expect(batch?.status).toBe("SUCCESS"); // last good value preserved
  });

  it("refuses to refresh a batch Landfall never recorded, without calling PayPal", async () => {
    const fetchBatch = vi.fn();
    const res = await refreshPayoutBatch(`NOPE${uid()}`, { fetchBatch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("UNKNOWN_BATCH");
    expect(fetchBatch).not.toHaveBeenCalled();
  });

  it("does not hammer PayPal: a second refresh inside the cool-down is skipped", async () => {
    const { tag, paypalBatchId } = await seed(1);
    const fetchBatch = vi.fn(async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS")], { total_items: 1, total_pages: 1 }));
    await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    const second = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(second.skipped).toBe("COOLDOWN");
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it("a webhook batch snapshot does not trigger the refresh cool-down (so the follow-up refresh runs)", async () => {
    const { tag, paypalBatchId } = await seed(1);
    await applyBatchSnapshot(paypalBatchId, { status: "PROCESSING", source: "webhook" });
    const fetchBatch = vi.fn(async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS")], { total_items: 1, total_pages: 1 }));
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(res.skipped).toBeUndefined();
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it("flags an item whose amount differs from what was approved and does not post it", async () => {
    const { tag, paypalBatchId } = await seed(1, 10000);
    const cash = await getAccountBalance("paypal_available");
    const fetchBatch = async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS", "250.00")], { total_items: 1, total_pages: 1 });
    const res = await refreshPayoutBatch(paypalBatchId, { fetchBatch });
    expect(res.flags).toContain("AMOUNT_MISMATCH");
    expect(await getAccountBalance("paypal_available")).toBe(cash);
  });

  it("never stores recipient addresses", async () => {
    const { tag, paypalBatchId } = await seed(1);
    await refreshPayoutBatch(paypalBatchId, { fetchBatch: async () => page(paypalBatchId, [paypalItem(tag, 1, "SUCCESS")], { total_items: 1, total_pages: 1 }) });
    const rows = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.paypalBatchId, paypalBatchId));
    const batch = await db.select().from(payoutBatchRecords).where(eq(payoutBatchRecords.paypalBatchId, paypalBatchId));
    expect(JSON.stringify([rows, batch])).not.toMatch(/@/);
  });
});
