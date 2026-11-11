import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutBatchRecords, payoutItemRecords, payoutStatusHistory, ledgerEntries } from "@/lib/db/schema";
import { applyItemObservation, recordBatchCreation, listItemRecords, listStatusHistory } from "@/lib/payouts/store";
import { getAccountBalance } from "@/lib/ledger/index";

/**
 * Database-backed: these write payout records and ledger entries, so they only run against
 * TEST_DATABASE_URL (see tests/setup/db-guard.ts). Ids are unique per run; balances are asserted as deltas.
 */
const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

async function seedBatch(items = 1, amountCents = 10000) {
  const tag = uid();
  const paypalBatchId = `B${tag}`;
  const senderItemIds = Array.from({ length: items }, (_, i) => `act_${tag}:t1:hh_${i + 1}`);
  await recordBatchCreation({
    paypalBatchId,
    senderBatchId: `batch_${tag}_t1`,
    planId: `plan_${tag}`,
    status: "PENDING",
    items: senderItemIds.map((senderItemId) => ({ senderItemId, amountCents, currency: "USD" })),
  });
  return { tag, paypalBatchId, senderItemIds };
}

const balances = async () => ({
  cash: await getAccountBalance("paypal_available"),
  paidOut: await getAccountBalance("paid_out"),
  unclaimed: await getAccountBalance("payout_unclaimed"),
  fees: await getAccountBalance("payout_fees"),
});

run("durable payout records (D-1)", () => {
  it("records a batch and one SUBMITTED item per payment, idempotently", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(3);
    let items = await listItemRecords(paypalBatchId);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.status === "SUBMITTED" && i.paypalItemId === null)).toBe(true);

    // replaying the creation record (e.g. duplicate sender_batch_id recovery) inserts nothing new
    const again = await recordBatchCreation({
      paypalBatchId,
      senderBatchId: (await db.select().from(payoutBatchRecords).where(eq(payoutBatchRecords.paypalBatchId, paypalBatchId)))[0].senderBatchId,
      status: "PENDING",
      items: senderItemIds.map((senderItemId) => ({ senderItemId, amountCents: 10000, currency: "USD" })),
    });
    expect(again).toEqual({ batchInserted: false, itemsInserted: 0 });
    items = await listItemRecords(paypalBatchId);
    expect(items).toHaveLength(3);
    const hist = await listStatusHistory(senderItemIds[0]);
    expect(hist).toHaveLength(1);
    expect(hist[0].toStatus).toBe("SUBMITTED");
  });
});

run("status observations and the ledger (D-2, D-5)", () => {
  it("walks SUBMITTED → UNCLAIMED → SUCCESS and posts each money state exactly once", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1, 10000);
    const [senderItemId] = senderItemIds;
    const before = await balances();

    const unclaimed = await applyItemObservation({
      senderItemId, paypalItemId: `I${uid()}`, paypalBatchId, transactionId: "TX1", rawStatus: "UNCLAIMED",
      amountCents: 10000, currency: "USD", feeCents: 25, source: "refresh",
    });
    expect(unclaimed.outcome).toBe("updated");
    expect(unclaimed.from).toBe("SUBMITTED");
    expect(unclaimed.ledgerTransactionIds.length).toBe(2); // held funds + fee

    let after = await balances();
    expect(after.unclaimed - before.unclaimed).toBe(10000);
    expect(after.paidOut - before.paidOut).toBe(0); // unclaimed is NOT paid
    expect(after.cash - before.cash).toBe(-10025);
    expect(after.fees - before.fees).toBe(25);

    const success = await applyItemObservation({ senderItemId, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", feeCents: 25, source: "webhook", eventId: "WH-1", eventTime: new Date() });
    expect(success.outcome).toBe("updated");
    expect(success.ledgerTransactionIds).toHaveLength(1); // fee already posted
    after = await balances();
    expect(after.paidOut - before.paidOut).toBe(10000);
    expect(after.unclaimed - before.unclaimed).toBe(0);
    expect(after.cash - before.cash).toBe(-10025);

    const hist = await listStatusHistory(senderItemId);
    expect(hist.map((h) => `${h.fromStatus}>${h.toStatus}`)).toEqual([`null>SUBMITTED`, `SUBMITTED>UNCLAIMED`, `UNCLAIMED>SUCCESS`]);
    expect(hist[2].source).toBe("webhook");
    expect(hist[2].eventId).toBe("WH-1");
  });

  it("replaying the same observation changes nothing and posts nothing", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const obs = { senderItemId: senderItemIds[0], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", feeCents: 200, source: "refresh" as const };
    await applyItemObservation(obs);
    const mid = await balances();
    const replay = await applyItemObservation(obs);
    expect(replay.outcome).toBe("unchanged");
    expect(replay.ledgerTransactionIds).toEqual([]);
    expect(await balances()).toEqual(mid);
  });

  it("ten concurrent identical events post the money exactly once (row-locked)", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const before = await balances();
    const obs = { senderItemId: senderItemIds[0], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", feeCents: null, source: "webhook" as const, eventTime: new Date() };
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => applyItemObservation({ ...obs, eventId: `WH-C-${i}` })));
    expect(results.filter((r) => r.outcome === "updated")).toHaveLength(1);
    const after = await balances();
    expect(after.paidOut - before.paidOut).toBe(10000);
    expect(after.cash - before.cash).toBe(-10000);
    const hist = await listStatusHistory(senderItemIds[0]);
    expect(hist.filter((h) => h.toStatus === "SUCCESS")).toHaveLength(1);
  });

  it("never downgrades SUCCESS, never revives a failure, and records nothing for a blocked regression", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const [senderItemId] = senderItemIds;
    await applyItemObservation({ senderItemId, paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", source: "refresh" });
    const mid = await balances();
    for (const stale of ["PENDING", "UNCLAIMED", "FAILED", "RETURNED", "ONHOLD"]) {
      const r = await applyItemObservation({ senderItemId, rawStatus: stale, amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date() });
      expect(r.outcome, stale).toBe("ignored");
      expect(r.reason, stale).toBe("STATUS_REGRESSION_BLOCKED");
    }
    expect(await balances()).toEqual(mid);
    const [row] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId));
    expect(row.status).toBe("SUCCESS");

    // …but PayPal's documented SUCCESS → REFUNDED is accepted and restores the cash
    const refund = await applyItemObservation({ senderItemId, rawStatus: "REFUNDED", amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date() });
    expect(refund.outcome).toBe("updated");
    const end = await balances();
    expect(end.paidOut - mid.paidOut).toBe(-10000);
    expect(end.cash - mid.cash).toBe(10000);
  });

  it("FAILED and PENDING move no money; FAILED cannot later become SUCCESS", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(2);
    const before = await balances();
    await applyItemObservation({ senderItemId: senderItemIds[0], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "PENDING", amountCents: 10000, currency: "USD", source: "refresh" });
    await applyItemObservation({ senderItemId: senderItemIds[1], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "FAILED", amountCents: 10000, currency: "USD", source: "refresh" });
    expect(await balances()).toEqual(before);
    const revive = await applyItemObservation({ senderItemId: senderItemIds[1], rawStatus: "SUCCESS", amountCents: 10000, currency: "USD", source: "refresh" });
    expect(revive.outcome).toBe("ignored");
    expect(await balances()).toEqual(before);
  });

  it("UNCLAIMED → RETURNED hands the held funds back to available cash", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const [senderItemId] = senderItemIds;
    const before = await balances();
    await applyItemObservation({ senderItemId, paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "UNCLAIMED", amountCents: 10000, currency: "USD", source: "refresh" });
    await applyItemObservation({ senderItemId, rawStatus: "RETURNED", amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date() });
    const after = await balances();
    expect(after.cash - before.cash).toBe(0);
    expect(after.unclaimed - before.unclaimed).toBe(0);
    expect(after.paidOut - before.paidOut).toBe(0);
  });

  it("an amount or currency that disagrees with what was approved is flagged and posts NOTHING", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(2, 10000);
    const before = await balances();
    const wrongAmount = await applyItemObservation({ senderItemId: senderItemIds[0], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 99999, currency: "USD", source: "refresh" });
    expect(wrongAmount.flags).toContain("AMOUNT_MISMATCH");
    expect(wrongAmount.ledgerTransactionIds).toEqual([]);
    const wrongCurrency = await applyItemObservation({ senderItemId: senderItemIds[1], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 10000, currency: "EUR", source: "refresh" });
    expect(wrongCurrency.flags).toContain("AMOUNT_MISMATCH");
    expect(await balances()).toEqual(before);
  });

  it("an unrecognised status is flagged, never overwrites a known one, and moves no money", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const [senderItemId] = senderItemIds;
    await applyItemObservation({ senderItemId, paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "PENDING", amountCents: 10000, currency: "USD", source: "refresh" });
    const before = await balances();
    const r = await applyItemObservation({ senderItemId, rawStatus: "TELEPORTED", amountCents: 10000, currency: "USD", source: "refresh" });
    expect(r.outcome).toBe("ignored");
    expect(r.flags).toContain("UNKNOWN_STATUS");
    const [row] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId));
    expect(row.status).toBe("PENDING");
    expect(await balances()).toEqual(before);
  });

  it("an older webhook cannot overwrite a newer one at the same rank", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1);
    const [senderItemId] = senderItemIds;
    const t = Date.now();
    await applyItemObservation({ senderItemId, paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "ONHOLD", amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date(t) });
    const stale = await applyItemObservation({ senderItemId, rawStatus: "BLOCKED", amountCents: 10000, currency: "USD", source: "webhook", eventTime: new Date(t - 60_000) });
    expect(stale.outcome).toBe("ignored");
    expect(stale.reason).toBe("STALE_EVENT");
    const [row] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId));
    expect(row.status).toBe("ONHOLD");
  });

  it("an event for an item we never recorded creates a record only when it carries enough to be trusted", async () => {
    const tag = uid();
    const thin = await applyItemObservation({ paypalItemId: `I${tag}`, rawStatus: "SUCCESS", source: "webhook" });
    expect(thin.outcome).toBe("ignored");
    expect(thin.reason).toBe("UNKNOWN_ITEM_INSUFFICIENT_DATA");
    const full = await applyItemObservation({ paypalItemId: `I${tag}`, senderItemId: `x_${tag}:t1:hh_9`, paypalBatchId: `B${tag}`, rawStatus: "SUCCESS", amountCents: 5000, currency: "USD", source: "webhook" });
    expect(full.outcome).toBe("created");
    expect(full.ledgerTransactionIds).toHaveLength(1);
  });

  it("every ledger transaction the store writes is balanced (debits = credits)", async () => {
    const { paypalBatchId, senderItemIds } = await seedBatch(1, 12345);
    const r = await applyItemObservation({ senderItemId: senderItemIds[0], paypalItemId: `I${uid()}`, paypalBatchId, rawStatus: "SUCCESS", amountCents: 12345, currency: "USD", feeCents: 200, source: "refresh" });
    expect(r.ledgerTransactionIds.length).toBeGreaterThan(0);
    for (const id of r.ledgerTransactionIds) {
      const rows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, id));
      const dr = rows.filter((x) => x.direction === "DEBIT").reduce((n, x) => n + Math.round(parseFloat(x.amount) * 100), 0);
      const cr = rows.filter((x) => x.direction === "CREDIT").reduce((n, x) => n + Math.round(parseFloat(x.amount) * 100), 0);
      expect(dr).toBe(cr);
      expect(dr).toBeGreaterThan(0);
    }
    // history is append-only and points at the postings it caused
    const hist = await db.select().from(payoutStatusHistory).where(eq(payoutStatusHistory.senderItemId, senderItemIds[0]));
    expect(hist.flatMap((h) => h.ledgerTransactionIds ?? [])).toEqual(expect.arrayContaining(r.ledgerTransactionIds));
  });
});
