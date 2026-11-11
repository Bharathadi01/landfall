import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { openingJournal } from "@/lib/payouts/opening";
import { validateBalancedTransaction, getAccountBalance } from "@/lib/ledger/index";
import { importExistingBatch } from "@/lib/payouts/import";
import { applyItemObservation, listItemRecords } from "@/lib/payouts/store";
import { db } from "@/lib/db/client";
import { ledgerEntries } from "@/lib/db/schema";
import type { GetPayoutBatchResponse } from "@/lib/paypal/payout-reads";

/** The real shape of batch VTJG3SR5BY56C as PayPal returned it (statuses, amounts, fees, ids) — recipients omitted. */
const item = (id: string, n: number, status: string, fee: string) => ({
  payout_item_id: `PI-${id}-${n}`,
  transaction_id: `TX-${id}-${n}`,
  transaction_status: status,
  payout_item_fee: { currency: "USD", value: fee },
  payout_item: { recipient_type: "EMAIL", amount: { currency: "USD", value: "100.00" }, receiver: "x@example.test", sender_item_id: `${id}:t1:hh_tbw_00${n}` },
  time_processed: "2026-11-09T17:56:28Z",
});
const BATCH = (id: string, sender: string): GetPayoutBatchResponse => ({
  batch_header: { payout_batch_id: id, batch_status: "SUCCESS", sender_batch_header: { sender_batch_id: sender }, amount: { currency: "USD", value: "500.00" }, fees: { currency: "USD", value: "3.00" } },
  items: [item(id, 1, "SUCCESS", "2.00"), item(id, 2, "UNCLAIMED", "0.25"), item(id, 3, "UNCLAIMED", "0.25"), item(id, 4, "UNCLAIMED", "0.25"), item(id, 5, "UNCLAIMED", "0.25")],
  total_items: 5,
  total_pages: 1,
}) as GetPayoutBatchResponse;

describe("opening journal (pure)", () => {
  it("is balanced by construction and carries exactly PayPal's positions", () => {
    const j = openingJournal({
      paypalAvailableCents: 448_894,
      items: [
        { status: "SUCCESS", amountCents: 10000, feeCents: 200 },
        { status: "UNCLAIMED", amountCents: 10000, feeCents: 25 },
        { status: "UNCLAIMED", amountCents: 10000, feeCents: 25 },
        { status: "FAILED", amountCents: 10000, feeCents: 25 },
        { status: "PENDING", amountCents: 10000, feeCents: null },
      ],
    });
    expect(validateBalancedTransaction(j.entries).balanced).toBe(true);
    expect(j.positions).toEqual({ cash: 448_894, unclaimed: 20000, paidOut: 10000, fees: 250, total: 479_144 });
  });
  it("books no fee for items that were never credited or held, and never a negative cash", () => {
    const j = openingJournal({ paypalAvailableCents: -5, items: [{ status: "FAILED", amountCents: 100, feeCents: 99 }] });
    expect(j.positions.fees).toBe(0);
    expect(j.positions.cash).toBe(0);
  });
});

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

run("importing a pre-existing PayPal batch (database)", () => {
  it("records the real shape, posts ONE opening journal, and the ledger cash then equals PayPal's", async () => {
    const id = `IMP${uid()}`;
    const before = { cash: await getAccountBalance("paypal_available"), unclaimed: await getAccountBalance("payout_unclaimed"), paid: await getAccountBalance("paid_out"), fees: await getAccountBalance("payout_fees") };
    const fetchBatch = async () => ({ data: BATCH(id, `batch_${id}_t1`) });
    const out = await importExistingBatch(id, { fetchBatch, getAvailableUsd: async () => 4488.94 });

    expect(out.batchStatus).toBe("SUCCESS");
    expect(out.items.map((i) => i.status)).toEqual(["SUCCESS", "UNCLAIMED", "UNCLAIMED", "UNCLAIMED", "UNCLAIMED"]);
    expect(out.opening).toMatchObject({ posted: true });

    // ledger deltas == PayPal positions; the import did NOT also post the transitions (which would double-count $503)
    expect((await getAccountBalance("paypal_available")) - before.cash).toBe(448_894);
    expect((await getAccountBalance("payout_unclaimed")) - before.unclaimed).toBe(40_000);
    expect((await getAccountBalance("paid_out")) - before.paid).toBe(10_000);
    expect((await getAccountBalance("payout_fees")) - before.fees).toBe(300);

    const rows = await listItemRecords(id);
    expect(rows.every((r) => r.paypalItemId && r.transactionId)).toBe(true);
    expect(rows.filter((r) => r.status === "UNCLAIMED")).toHaveLength(4);
  });

  it("is idempotent: importing again changes nothing and posts no second opening journal", async () => {
    const id = `IMP${uid()}`;
    const fetchBatch = async () => ({ data: BATCH(id, `batch_${id}_t1`) });
    await importExistingBatch(id, { fetchBatch, getAvailableUsd: async () => 100 });
    const cash = await getAccountBalance("paypal_available");
    const again = await importExistingBatch(id, { fetchBatch, getAvailableUsd: async () => 999 });
    expect(again.opening.posted).toBe(false);
    expect(await getAccountBalance("paypal_available")).toBe(cash);
    const opening = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, `tx_opening_${id}`));
    expect(opening.length).toBe(5); // 4 debits + 1 credit, once
  });

  it("after the import, a real later return flows through the normal posting: cash goes UP by the returned $100 and unclaimed DOWN", async () => {
    const id = `IMP${uid()}`;
    await importExistingBatch(id, { fetchBatch: async () => ({ data: BATCH(id, `batch_${id}_t1`) }), getAvailableUsd: async () => 1000 });
    const cash = await getAccountBalance("paypal_available");
    const unclaimed = await getAccountBalance("payout_unclaimed");

    const r = await applyItemObservation({ paypalItemId: `PI-${id}-2`, senderItemId: `${id}:t1:hh_tbw_002`, paypalBatchId: id, rawStatus: "RETURNED", amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date() });
    expect(r.outcome).toBe("updated");
    expect(r.from).toBe("UNCLAIMED");
    expect((await getAccountBalance("paypal_available")) - cash).toBe(10_000);
    expect((await getAccountBalance("payout_unclaimed")) - unclaimed).toBe(-10_000);
  });
});
