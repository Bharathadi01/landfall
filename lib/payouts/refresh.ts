/**
 * READ-ONLY PAYOUT STATUS REFRESH (audit D-4, D-9).
 *
 * Asks PayPal — `GET /v1/payments/payouts/{id}` — for the latest status of a batch we ourselves
 * persisted, walks every page, and feeds each item through the same store the webhook uses.
 * It cannot create, retry or cancel a payout: the only PayPal call it makes is that GET.
 *
 * Safety properties:
 *  - the batch id must exist in payout_batch_records (a trusted persisted record, not user input);
 *  - the response must name the same batch id we asked for;
 *  - a PayPal error leaves every stored status untouched and is recorded on the batch row;
 *  - observations are monotonic (see store.ts), so a partial or repeated refresh cannot corrupt state;
 *  - a per-batch cool-down stops a caller hammering PayPal.
 */
import { getPayoutBatch, type GetPayoutBatchResponse } from "@/lib/paypal/payout-reads";
import { applyBatchSnapshot, applyItemObservation, getBatchRecord, type ObservationResult } from "./store";
import { toCents } from "./status";

export const REFRESH_PAGE_SIZE = 100;
export const MAX_PAGES = 200;
export const REFRESH_COOLDOWN_MS = 15_000;

export interface RefreshDeps {
  fetchBatch?: (batchId: string, actor: string, opts: { page: number; pageSize: number; totalRequired: boolean }) => Promise<{ data: GetPayoutBatchResponse }>;
  now?: () => number;
  cooldownMs?: number;
}

export interface RefreshSummary {
  ok: boolean;
  paypalBatchId: string;
  skipped?: "COOLDOWN";
  error?: string;
  batchStatus?: string;
  pagesFetched: number;
  itemsSeen: number;
  totalItemsReported?: number;
  complete: boolean;
  /** Item-level changes only; never includes recipient identifiers. */
  changes: Array<{ senderItemId?: string; from: string | null; to: string | null; outcome: string }>;
  flags: string[];
}

export async function refreshPayoutBatch(paypalBatchId: string, deps: RefreshDeps = {}): Promise<RefreshSummary> {
  const now = deps.now ?? Date.now;
  const fetchBatch = deps.fetchBatch ?? ((id, actor, o) => getPayoutBatch(id, actor, o));
  const summary: RefreshSummary = { ok: false, paypalBatchId, pagesFetched: 0, itemsSeen: 0, complete: false, changes: [], flags: [] };

  const record = await getBatchRecord(paypalBatchId);
  if (!record) {
    summary.error = "UNKNOWN_BATCH: only batches Landfall has recorded can be refreshed";
    return summary;
  }
  const cooldown = deps.cooldownMs ?? REFRESH_COOLDOWN_MS;
  // Cool-down is about repeated PayPal GETs, so only a previous *refresh* counts (not creation or a webhook).
  if (record.lastSyncedAt && record.lastSyncSource === "refresh" && now() - record.lastSyncedAt.getTime() < cooldown) {
    summary.ok = true;
    summary.skipped = "COOLDOWN";
    summary.batchStatus = record.status;
    return summary;
  }

  let page = 1;
  let totalPages: number | undefined;
  let header: GetPayoutBatchResponse["batch_header"] | undefined;
  const seenItemIds = new Set<string>();

  try {
    for (; page <= MAX_PAGES; page++) {
      const { data } = await fetchBatch(paypalBatchId, "payout_refresh", { page, pageSize: REFRESH_PAGE_SIZE, totalRequired: true });
      if (data.batch_header.payout_batch_id !== paypalBatchId) {
        throw new Error(`BATCH_ID_MISMATCH: asked for ${paypalBatchId}, PayPal returned ${data.batch_header.payout_batch_id}`);
      }
      header = data.batch_header;
      summary.pagesFetched += 1;
      if (data.total_items !== undefined) summary.totalItemsReported = data.total_items;
      if (data.total_pages !== undefined) totalPages = data.total_pages;

      const items = data.items ?? [];
      for (const it of items) {
        seenItemIds.add(it.payout_item_id);
        summary.itemsSeen += 1;
        const res: ObservationResult = await applyItemObservation({
          paypalItemId: it.payout_item_id,
          senderItemId: it.payout_item?.sender_item_id,
          paypalBatchId,
          transactionId: it.transaction_id ?? null,
          rawStatus: it.transaction_status,
          amountCents: toCents(it.payout_item?.amount.value),
          currency: it.payout_item?.amount.currency ?? null,
          feeCents: toCents(it.payout_item_fee?.value),
          providerTime: it.time_processed ? new Date(it.time_processed) : null,
          source: "refresh",
        });
        if (res.outcome !== "unchanged") summary.changes.push({ senderItemId: res.senderItemId, from: res.from, to: res.to, outcome: res.outcome });
        for (const f of res.flags) if (!summary.flags.includes(f)) summary.flags.push(f);
      }

      const morePages = totalPages !== undefined ? page < totalPages : items.length >= REFRESH_PAGE_SIZE;
      if (!morePages) {
        summary.complete = true;
        break;
      }
    }
    if (!summary.complete) summary.flags.push("PAGE_LIMIT_REACHED");
    if (summary.totalItemsReported !== undefined && seenItemIds.size !== summary.totalItemsReported) {
      summary.complete = false;
      summary.flags.push("ITEM_COUNT_MISMATCH");
    }

    await applyBatchSnapshot(paypalBatchId, {
      status: header?.batch_status,
      amountCents: toCents(header?.amount?.value),
      feeCents: toCents(header?.fees?.value),
      itemCount: summary.totalItemsReported ?? seenItemIds.size,
      source: "refresh",
      error: null,
    });
    summary.ok = true;
    summary.batchStatus = header?.batch_status;
    return summary;
  } catch (err) {
    // Temporary PayPal/network failure: stored statuses stay exactly as they were.
    const message = err instanceof Error ? err.message : String(err);
    summary.error = message;
    try {
      await applyBatchSnapshot(paypalBatchId, { source: "refresh", error: message.slice(0, 300) });
    } catch {
      /* recording the error is best effort */
    }
    return summary;
  }
}
