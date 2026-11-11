/**
 * IMPORT A PRE-EXISTING PAYPAL BATCH (read-only toward PayPal).
 *
 * Reads the batch from PayPal (GET only), records it and its items, applies PayPal's statuses WITHOUT posting
 * transitions (source "import"), and writes ONE opening journal so the ledger equals PayPal's positions today.
 * Idempotent: running it twice records nothing twice (same ids, same opening transaction id).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ledgerEntries } from "@/lib/db/schema";
import type { GetPayoutBatchResponse } from "@/lib/paypal/payout-reads";
import { getPayoutBatch } from "@/lib/paypal/payout-reads";
import { recordLedgerTransaction } from "@/lib/ledger/index";
import { applyBatchSnapshot, applyItemObservation, recordBatchCreation } from "./store";
import { openingJournal } from "./opening";
import { toCents } from "./status";

export interface ImportDeps {
  fetchBatch?: (id: string, actor: string, o: { page: number; pageSize: number; totalRequired: boolean }) => Promise<{ data: GetPayoutBatchResponse }>;
  /** PayPal available balance (USD) right now — from the Reporting API. */
  getAvailableUsd: () => Promise<number>;
}

export interface ImportSummary {
  paypalBatchId: string;
  batchStatus: string;
  items: Array<{ paypalItemId: string; senderItemId: string; status: string; amountCents: number }>;
  opening: { posted: boolean; transactionId: string; positions: ReturnType<typeof openingJournal>["positions"] };
}

export async function importExistingBatch(paypalBatchId: string, deps: ImportDeps): Promise<ImportSummary> {
  const fetchBatch = deps.fetchBatch ?? ((id, actor, o) => getPayoutBatch(id, actor, o));
  const pageSize = 100;

  // 1) read every page from PayPal (no writes yet)
  const collected: GetPayoutBatchResponse["items"] = [];
  let header: GetPayoutBatchResponse["batch_header"] | undefined;
  for (let page = 1; page <= 200; page++) {
    const { data } = await fetchBatch(paypalBatchId, "batch_import", { page, pageSize, totalRequired: true });
    if (data.batch_header.payout_batch_id !== paypalBatchId) throw new Error("BATCH_ID_MISMATCH");
    header = data.batch_header;
    collected!.push(...(data.items ?? []));
    const more = data.total_pages !== undefined ? page < data.total_pages : (data.items?.length ?? 0) >= pageSize;
    if (!more) break;
  }
  if (!header) throw new Error("EMPTY_RESPONSE");

  const items = (collected ?? []).map((it) => ({
    paypalItemId: it.payout_item_id,
    senderItemId: it.payout_item?.sender_item_id ?? `paypal:${it.payout_item_id}`,
    status: it.transaction_status,
    amountCents: toCents(it.payout_item?.amount.value) ?? 0,
    currency: it.payout_item?.amount.currency ?? "USD",
    feeCents: toCents(it.payout_item_fee?.value),
    transactionId: it.transaction_id ?? null,
    providerTime: it.time_processed ? new Date(it.time_processed) : null,
  }));

  // 2) record batch + items (SUBMITTED), then apply PayPal's statuses without posting transitions
  await recordBatchCreation({
    paypalBatchId,
    senderBatchId: header.sender_batch_header.sender_batch_id,
    planId: "imported:pre-landfall",
    status: header.batch_status,
    currency: header.amount?.currency ?? "USD",
    items: items.map((i) => ({ senderItemId: i.senderItemId, amountCents: i.amountCents, currency: i.currency })),
  });
  for (const i of items) {
    await applyItemObservation({
      paypalItemId: i.paypalItemId,
      senderItemId: i.senderItemId,
      paypalBatchId,
      transactionId: i.transactionId,
      rawStatus: i.status,
      amountCents: i.amountCents,
      currency: i.currency,
      feeCents: i.feeCents,
      providerTime: i.providerTime,
      source: "import",
    });
  }
  await applyBatchSnapshot(paypalBatchId, {
    status: header.batch_status,
    amountCents: toCents(header.amount?.value),
    feeCents: toCents(header.fees?.value),
    itemCount: items.length,
    source: "refresh",
    error: null,
  });

  // 3) the opening journal — exactly once
  const transactionId = `tx_opening_${paypalBatchId}`;
  const exists = await db.select({ id: ledgerEntries.id }).from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId)).limit(1);
  const availableCents = Math.round((await deps.getAvailableUsd()) * 100);
  const journal = openingJournal({ paypalAvailableCents: availableCents, items });
  let posted = false;
  if (!exists.length && journal.entries.length) {
    await recordLedgerTransaction({
      hostId: "default",
      transactionId,
      description: `Opening positions imported from PayPal batch ${paypalBatchId}`,
      correlationId: paypalBatchId,
      entries: journal.entries,
    });
    posted = true;
  }
  return { paypalBatchId, batchStatus: header.batch_status, items: items.map(({ paypalItemId, senderItemId, status, amountCents }) => ({ paypalItemId, senderItemId, status, amountCents })), opening: { posted, transactionId, positions: journal.positions } };
}
