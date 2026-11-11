import { describe, it, expect } from "vitest";
import { importExistingBatch } from "@/lib/payouts/import";
import { applyItemObservation } from "@/lib/payouts/store";
import { getLiveSnapshot, caseStatusFor, ageBandFor, liveCaseRefFor } from "@/lib/relief/live-cases.server";
import { liveTreasury } from "@/lib/relief/live-treasury";
import { getAccountBalance } from "@/lib/ledger/index";
import { db } from "@/lib/db/client";
import { webhookEvents } from "@/lib/db/schema";
import { summarizeCases } from "@/lib/relief/cases";
import type { GetPayoutBatchResponse } from "@/lib/paypal/payout-reads";

const item = (id: string, n: number, status: string, fee: string) => ({
  payout_item_id: `PI-${id}-${n}`,
  transaction_id: `TX-${id}-${n}`,
  transaction_status: status,
  payout_item_fee: { currency: "USD", value: fee },
  payout_item: { recipient_type: "EMAIL", amount: { currency: "USD", value: "100.00" }, receiver: "x@example.test", sender_item_id: `${id}:t1:hh_tbw_00${n}` },
  time_processed: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
});
const batch = (id: string): GetPayoutBatchResponse =>
  ({
    batch_header: { payout_batch_id: id, batch_status: "SUCCESS", sender_batch_header: { sender_batch_id: `batch_${id}_t1` }, amount: { currency: "USD", value: "500.00" }, fees: { currency: "USD", value: "3.00" } },
    items: [item(id, 1, "SUCCESS", "2.00"), item(id, 2, "UNCLAIMED", "0.25"), item(id, 3, "UNCLAIMED", "0.25"), item(id, 4, "UNCLAIMED", "0.25"), item(id, 5, "UNCLAIMED", "0.25")],
    total_items: 5,
    total_pages: 1,
  }) as GetPayoutBatchResponse;

describe("live case helpers (pure)", () => {
  it("maps stored statuses into the case vocabulary without inventing success", () => {
    expect(caseStatusFor("SUCCESS").status).toBe("SUCCESS");
    expect(caseStatusFor("SUBMITTED")).toMatchObject({ status: "PENDING" });
    expect(caseStatusFor("CANCELED")).toMatchObject({ status: "RETURNED" });
    expect(caseStatusFor("TELEPORTED")).toMatchObject({ status: "ONHOLD" }); // unknown never becomes SUCCESS
    expect(caseStatusFor("TELEPORTED").note).toContain("TELEPORTED");
  });
  it("age bands match the replay vocabulary", () => {
    expect([ageBandFor(2), ageBandFor(10), ageBandFor(30), ageBandFor(100)]).toEqual(["< 6 hrs", "6 - 24 hrs", "24 - 48 hrs", "> 48 hrs"]);
  });
  it("live treasury is derived from ledger positions and conserves money", () => {
    const t = liveTreasury({ cashCents: 448_894, unclaimedCents: 40_000, paidOutCents: 10_000, feesCents: 300 }, { inFlightUsd: 400, needsReissueUsd: 0 });
    expect(t.total).toBe(4991.94);
    expect(t.available).toBe(4488.94);
    expect(t.paidOut).toBe(100);
    expect(t.inFlight).toBe(400);
    expect(t.requiredReserve).toBe(1497.58);
    expect(t.allocatable).toBe(Math.round((4488.94 - 1497.58) * 100) / 100);
    expect(t.reserve + t.allocatable).toBeCloseTo(t.available, 2);
  });
});

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

run("live Sandbox cases from stored PayPal records (database)", () => {
  it("builds one case per payment with PayPal's real statuses, and never marks 'batch SUCCESS' as 5 successes", async () => {
    const id = `LIV${uid()}`;
    await importExistingBatch(id, { fetchBatch: async () => ({ data: batch(id) }), getAvailableUsd: async () => 4488.94 });
    const snap = await getLiveSnapshot([]);
    const mine = snap.cases.filter((c) => c.batchId === id);
    expect(mine).toHaveLength(5);
    expect(mine.filter((c) => c.status === "SUCCESS")).toHaveLength(1);
    expect(mine.filter((c) => c.status === "UNCLAIMED")).toHaveLength(4);
    expect(mine.every((c) => c.origin === "SANDBOX_LIVE")).toBe(true);
    expect(mine.reduce((t, c) => t + c.amountUsd, 0)).toBe(500);

    const credited = mine.find((c) => c.status === "SUCCESS")!;
    expect(credited.stagesReached.CREDITED).toBe(true);
    expect(credited.stagesReached.CONFIRMED).toBe(false); // PayPal SUCCESS is not "received"
    expect(credited.nextAction.safeAction).toBe("ASK_RECIPIENT_TO_CONFIRM");
    const unclaimed = mine.find((c) => c.status === "UNCLAIMED")!;
    expect(unclaimed.nextAction.plain).toMatch(/Help the resident claim it/);
    expect(unclaimed.claimDaysLeft).toBeLessThanOrEqual(27);
    expect(unclaimed.claimDaysLeft).toBeGreaterThanOrEqual(26);
  });

  it("is honest about what an imported payment does NOT have: no obligation, no approval, no fabricated proof", async () => {
    const id = `LIV${uid()}`;
    await importExistingBatch(id, { fetchBatch: async () => ({ data: batch(id) }), getAvailableUsd: async () => 1000 });
    const c = (await getLiveSnapshot([])).cases.find((x) => x.batchId === id)!;
    const by = (k: string) => c.evidence.find((e) => e.key === k)!;
    expect(by("obligation").state).toBe("missing");
    expect(by("obligation").detail).toMatch(/before Landfall/);
    expect(by("approval").state).toBe("missing");
    expect(by("payout").state).toBe("present");
    expect(by("payout").provenance).toBe("PROVIDER");
    expect(by("payout").detail).toMatch(/PayPal Sandbox \(real response\)/);
    expect(by("payout").detail).toContain(`TX-${id}-`);
    expect(by("webhook").state).toBe("missing"); // none received — and we say so
    expect(by("proof").state).toBe("not_expected");
    expect(c.stagesReached.APPROVED).toBe(false);
    expect(JSON.stringify(c)).not.toMatch(/@/); // no recipient address anywhere in a case
  });

  it("a verified webhook becomes evidence, and a resident's report is a separate, labelled fact", async () => {
    const id = `LIV${uid()}`;
    await importExistingBatch(id, { fetchBatch: async () => ({ data: batch(id) }), getAvailableUsd: async () => 1000 });
    await applyItemObservation({ paypalItemId: `PI-${id}-2`, senderItemId: `${id}:t1:hh_tbw_002`, paypalBatchId: id, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", source: "webhook", eventId: `WH-${id}`, eventTime: new Date() });
    const ref = liveCaseRefFor(`${id}:t1:hh_tbw_002`);
    const snap = await getLiveSnapshot([{ caseRef: ref, kind: "RECEIVED", createdAt: new Date().toISOString() }]);
    const c = snap.cases.find((x) => x.caseRef === ref)!;
    expect(c.status).toBe("SUCCESS");
    expect(c.evidence.find((e) => e.key === "ledger")!.state).toBe("present");
    expect(c.evidence.find((e) => e.key === "recipient")!.provenance).toBe("RECIPIENT_REPORTED");
    expect(c.stagesReached.CONFIRMED).toBe(true);
    expect(c.openIssue).toBe(false);
    // the provider fact is untouched by the resident's report
    expect(c.evidence.find((e) => e.key === "payout")!.provenance).toBe("PROVIDER");
  });

  it("a verified webhook that arrives AFTER a refresh already recorded the status still counts as evidence (found by item id)", async () => {
    const id = `LIV${uid()}`;
    await importExistingBatch(id, { fetchBatch: async () => ({ data: batch(id) }), getAvailableUsd: async () => 1000 });
    const itemId = `PI-${id}-2`;
    await applyItemObservation({ paypalItemId: itemId, senderItemId: `${id}:t1:hh_tbw_002`, paypalBatchId: id, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", source: "refresh" });
    // the webhook now repeats a status we already know: no history row, but PayPal did tell us
    await db.insert(webhookEvents).values({ paypalEventId: `WH-late-${id}`, type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", verified: true, payload: { resource: { payout_item_id: itemId } } });
    // an UNVERIFIED event must never count
    await db.insert(webhookEvents).values({ paypalEventId: `WH-unverified-${id}`, type: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED", verified: false, payload: { resource: { payout_item_id: `PI-${id}-3` } } });
    const snap = await getLiveSnapshot([]);
    const by = (n: number) => snap.cases.find((x) => x.caseRef === liveCaseRefFor(`${id}:t1:hh_tbw_00${n}`))!.evidence.find((e) => e.key === "webhook")!;
    expect(by(2).state).toBe("present");
    expect(by(2).ref).toBe(`WH-late-${id}`);
    expect(by(2).detail).toMatch(/signature verified by PayPal/);
    expect(by(3).state).toBe("missing");
  });

  it("summaries and treasury come from the same records, so figures cannot disagree", async () => {
    const snap = await getLiveSnapshot([]);
    const s = summarizeCases(snap.cases);
    expect(s.households).toBe(snap.cases.length);
    // total is exactly the ledger's own positions (cash + held-for-claim + credited + fees): nothing typed in
    const [cash, held, paid, fees] = await Promise.all([getAccountBalance("paypal_available"), getAccountBalance("payout_unclaimed"), getAccountBalance("paid_out"), getAccountBalance("payout_fees")]);
    expect(snap.treasury.total).toBeCloseTo((cash + held + paid + fees) / 100, 2);
    expect(snap.treasury.available).toBeCloseTo(cash / 100, 2);
    expect(snap.treasury.reserve + snap.treasury.allocatable).toBeLessThanOrEqual(snap.treasury.available + 0.01);
    expect(snap.hasData).toBe(true);
    expect(snap.batches.length).toBeGreaterThan(0);
  });
});
