/**
 * DURABLE PAYOUT STORE (audit D-1, D-2, D-5, D-11).
 *
 * Every PayPal observation about a payment — from the batch-creation response, a status refresh
 * (GET batch) or a verified webhook — goes through `applyItemObservation`. In ONE transaction it:
 *   1. locks the item's row (so concurrent webhook + refresh serialise instead of overwriting),
 *   2. applies the status-precedence guard (never downgrades SUCCESS, never un-fails a failure, …),
 *   3. updates the record and appends a status-history row,
 *   4. posts the implied journal entries to the double-entry ledger, idempotently.
 * Nothing here calls PayPal and nothing here can create a payout.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutBatchRecords, payoutItemRecords, payoutStatusHistory } from "@/lib/db/schema";
import { shouldUpdatePayoutStatus } from "@/lib/paypal/webhooks";
import { isTransactionRecorded, recordLedgerTransaction } from "@/lib/ledger/index";
import { logAuditEvent } from "@/lib/db/audit";
import { INTERNAL_SUBMITTED, normalizeItemStatus, plannedPostings } from "./status";

/**
 * Where an observation came from. "import" = a payment that already existed at PayPal before Landfall's ledger began;
 * its money positions are carried by the opening journal, so an import NEVER posts a transition (no double deduction).
 * "cancel" = our own Treasurer cancelled an unclaimed item and PayPal confirmed it.
 */
export type ObservationSource = "creation" | "refresh" | "webhook" | "import" | "cancel";

export interface ItemObservation {
  senderItemId?: string;
  paypalItemId?: string;
  paypalBatchId?: string;
  transactionId?: string | null;
  rawStatus: string;
  amountCents?: number | null;
  currency?: string | null;
  feeCents?: number | null;
  /** PayPal `time_processed` for the item. */
  providerTime?: Date | null;
  /** PayPal webhook `create_time`. Only used to order webhook events against each other. */
  eventTime?: Date | null;
  source: ObservationSource;
  eventId?: string | null;
}

export type ObservationOutcome = "created" | "updated" | "unchanged" | "ignored";

export interface ObservationResult {
  outcome: ObservationOutcome;
  reason?: string;
  senderItemId?: string;
  from: string | null;
  to: string | null;
  ledgerTransactionIds: string[];
  flags: string[];
}

type Tx = any;

async function findLocked(tx: Tx, obs: ItemObservation) {
  if (obs.paypalItemId) {
    const [byPaypal] = await tx.select().from(payoutItemRecords).where(eq(payoutItemRecords.paypalItemId, obs.paypalItemId)).for("update").limit(1);
    if (byPaypal) return byPaypal;
  }
  if (obs.senderItemId) {
    const [bySender] = await tx.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, obs.senderItemId)).for("update").limit(1);
    if (bySender) return bySender;
  }
  return undefined;
}

export async function applyItemObservation(obs: ItemObservation): Promise<ObservationResult> {
  const norm = normalizeItemStatus(obs.rawStatus);
  const flags: string[] = [];
  if (!norm.recognised) flags.push("UNKNOWN_STATUS");

  const ignored = (reason: string, from: string | null = null): ObservationResult => ({
    outcome: "ignored",
    reason,
    from,
    to: null,
    ledgerTransactionIds: [],
    flags: [...flags, reason],
  });

  const result: ObservationResult = await db.transaction(async (tx: Tx) => {
    let row = await findLocked(tx, obs);
    const now = new Date();

    // ---- unknown item: create it only if the observation carries everything a record needs ----
    if (!row) {
      if (!obs.senderItemId && !obs.paypalItemId) return ignored("NO_ITEM_KEY");
      if (!obs.paypalBatchId || obs.amountCents == null || !obs.currency) return ignored("UNKNOWN_ITEM_INSUFFICIENT_DATA");
      const key = obs.senderItemId ?? `paypal:${obs.paypalItemId}`;
      await tx
        .insert(payoutItemRecords)
        .values({
          senderItemId: key,
          paypalBatchId: obs.paypalBatchId,
          paypalItemId: obs.paypalItemId ?? null,
          transactionId: obs.transactionId ?? null,
          status: norm.status,
          amountCents: obs.amountCents,
          currency: obs.currency,
          feeCents: obs.feeCents ?? null,
          providerTime: obs.providerTime ?? null,
          lastEventTime: obs.source === "webhook" ? obs.eventTime ?? null : null,
          lastObservedAt: now,
        })
        .onConflictDoNothing();
      row = await findLocked(tx, { ...obs, senderItemId: key });
      if (!row) return ignored("INSERT_RACE_LOST");
      return await finish(tx, row, null, norm.status, true, obs, flags, now);
    }

    // ---- known item ----
    const current: string = row.status;
    const incoming = norm.status;

    if (obs.paypalItemId && row.paypalItemId && obs.paypalItemId !== row.paypalItemId) {
      return ignored("ITEM_ID_CONFLICT", current);
    }
    if (incoming === current) {
      return await finish(tx, row, current, current, false, obs, flags, now);
    }
    if (!norm.recognised) {
      // never overwrite a recognised status with a value we do not understand; flag it for an operator
      return ignored("UNKNOWN_STATUS", current);
    }
    if (obs.source === "webhook" && obs.eventTime && row.lastEventTime && obs.eventTime < row.lastEventTime) {
      return ignored("STALE_EVENT", current);
    }
    if (current !== INTERNAL_SUBMITTED && !shouldUpdatePayoutStatus(current, incoming)) {
      return ignored("STATUS_REGRESSION_BLOCKED", current);
    }
    return await finish(tx, row, current, incoming, true, obs, flags, now);
  });

  if (result.flags.some((f) => ["UNKNOWN_STATUS", "AMOUNT_MISMATCH", "CURRENCY_NOT_USD", "ITEM_ID_CONFLICT", "STATUS_REGRESSION_BLOCKED", "STALE_EVENT"].includes(f))) {
    // Outside the transaction: an audit write must never roll back or block the state update.
    await logAuditEvent({
      actor: "payout_store",
      action: "payout_observation_flag",
      requestRedacted: { senderItemId: obs.senderItemId, paypalItemId: obs.paypalItemId, source: obs.source, rawStatus: obs.rawStatus, eventId: obs.eventId },
      responseRedacted: { outcome: result.outcome, flags: result.flags, from: result.from, to: result.to },
    });
  }
  return result;
}

async function finish(
  tx: Tx,
  row: any,
  from: string | null,
  to: string,
  statusChanged: boolean,
  obs: ItemObservation,
  flags: string[],
  now: Date
): Promise<ObservationResult> {
  const created = from === null;

  // Amount / currency must agree with what we approved before any money is posted.
  const amountMismatch = obs.amountCents != null && obs.amountCents !== row.amountCents;
  const currencyMismatch = obs.currency != null && obs.currency !== row.currency;
  if (amountMismatch || currencyMismatch) flags.push("AMOUNT_MISMATCH");
  if (row.currency !== "USD") flags.push("CURRENCY_NOT_USD");
  const mayPost = !amountMismatch && !currencyMismatch && row.currency === "USD" && obs.source !== "import";

  const feeCents = obs.feeCents ?? row.feeCents ?? null;
  const patch: Record<string, unknown> = {
    lastObservedAt: now,
    paypalItemId: row.paypalItemId ?? obs.paypalItemId ?? null,
    transactionId: obs.transactionId ?? row.transactionId ?? null,
    feeCents,
    providerTime: obs.providerTime ?? row.providerTime ?? null,
  };
  if (statusChanged) {
    patch.status = to;
    if (obs.source === "webhook") patch.lastEventTime = obs.eventTime ?? row.lastEventTime ?? null;
  }
  if (!created) await tx.update(payoutItemRecords).set(patch).where(eq(payoutItemRecords.id, row.id));

  // Journal entries: the transition itself, plus a fee entry if a fee has become known.
  const ledgerIds: string[] = [];
  if (mayPost) {
    const postings = statusChanged || created
      ? plannedPostings({ senderItemId: row.senderItemId, from, to, amountCents: row.amountCents, feeCents })
      : plannedPostings({ senderItemId: row.senderItemId, from: to, to, amountCents: row.amountCents, feeCents });
    // An item that was IMPORTED already has its fee inside the opening journal (and PayPal's cash balance, which the
    // journal starts from, is already net of it). Posting the per-item fee again would deduct it from cash twice.
    const feeAlreadyInOpening = postings.some((p) => p.transactionId.endsWith("_fee")) && !created && (await wasImported(tx, row.senderItemId));
    for (const p of postings) {
      if (feeAlreadyInOpening && p.transactionId.endsWith("_fee")) continue;
      if (await isTransactionRecorded(p.transactionId, tx)) continue;
      await recordLedgerTransaction(
        { hostId: "default", transactionId: p.transactionId, description: p.description, correlationId: row.paypalItemId ?? obs.paypalItemId ?? row.senderItemId, entries: p.entries },
        tx
      );
      ledgerIds.push(p.transactionId);
    }
  }

  if (statusChanged || created) {
    await tx.insert(payoutStatusHistory).values({
      senderItemId: row.senderItemId,
      paypalItemId: (patch.paypalItemId as string | null) ?? null,
      fromStatus: from,
      toStatus: to,
      source: obs.source,
      eventId: obs.eventId ?? null,
      providerTime: obs.providerTime ?? null,
      ledgerTransactionIds: ledgerIds,
      note: flags.length ? flags.join(",") : null,
    });
  }

  return {
    outcome: created ? "created" : statusChanged ? "updated" : "unchanged",
    senderItemId: row.senderItemId,
    from,
    to,
    ledgerTransactionIds: ledgerIds,
    flags,
  };
}

/* ------------------------------ batch records ------------------------------ */

export interface BatchCreationRecord {
  paypalBatchId: string;
  senderBatchId: string;
  planId?: string;
  status: string;
  currency?: string;
  items: Array<{ senderItemId: string; amountCents: number; currency: string }>;
}

/**
 * Persist what PayPal returned when a batch was created, plus one SUBMITTED item per payment.
 * Idempotent: replays (including recovery from a duplicate sender_batch_id) insert nothing twice.
 */
export async function recordBatchCreation(rec: BatchCreationRecord): Promise<{ batchInserted: boolean; itemsInserted: number }> {
  return await db.transaction(async (tx: Tx) => {
    const inserted = await tx
      .insert(payoutBatchRecords)
      .values({
        paypalBatchId: rec.paypalBatchId,
        senderBatchId: rec.senderBatchId,
        planId: rec.planId ?? null,
        status: rec.status,
        amountCents: rec.items.reduce((s, i) => s + i.amountCents, 0),
        currency: rec.currency ?? "USD",
        itemCount: rec.items.length,
        lastSyncedAt: new Date(),
        lastSyncSource: "creation",
      })
      .onConflictDoNothing()
      .returning({ id: payoutBatchRecords.id });

    let itemsInserted = 0;
    for (const it of rec.items) {
      const ins = await tx
        .insert(payoutItemRecords)
        .values({ senderItemId: it.senderItemId, paypalBatchId: rec.paypalBatchId, status: INTERNAL_SUBMITTED, amountCents: it.amountCents, currency: it.currency })
        .onConflictDoNothing()
        .returning({ id: payoutItemRecords.id });
      if (ins.length) {
        itemsInserted += 1;
        await tx.insert(payoutStatusHistory).values({ senderItemId: it.senderItemId, fromStatus: null, toStatus: INTERNAL_SUBMITTED, source: "creation" });
      }
    }
    return { batchInserted: inserted.length > 0, itemsInserted };
  });
}

/** Never throws: the payout has already happened, so a persistence failure must be reported, not rethrown. */
export async function tryRecordBatchCreation(rec: BatchCreationRecord): Promise<{ persisted: boolean; error?: string }> {
  try {
    await recordBatchCreation(rec);
    return { persisted: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (!process.env.VITEST) console.error("[payout-store] FAILED to persist batch", rec.paypalBatchId, error);
    return { persisted: false, error };
  }
}

export async function applyBatchSnapshot(
  paypalBatchId: string,
  snap: { status?: string; amountCents?: number | null; feeCents?: number | null; itemCount?: number | null; source: ObservationSource; error?: string | null }
): Promise<void> {
  // lastSyncedAt only moves on a successful sync, so it always means "PayPal's answer as of this time".
  const set: Record<string, unknown> = { lastSyncSource: snap.source, lastSyncError: snap.error ?? null };
  if (!snap.error) set.lastSyncedAt = new Date();
  if (snap.status) set.status = snap.status;
  if (snap.amountCents != null) set.amountCents = snap.amountCents;
  if (snap.feeCents != null) set.feeCents = snap.feeCents;
  if (snap.itemCount != null) set.itemCount = snap.itemCount;
  await db.update(payoutBatchRecords).set(set).where(eq(payoutBatchRecords.paypalBatchId, paypalBatchId));
}

/* ------------------------------ read side (no PII) ------------------------------ */

export async function getBatchRecord(paypalBatchId: string) {
  const [row] = await db.select().from(payoutBatchRecords).where(eq(payoutBatchRecords.paypalBatchId, paypalBatchId)).limit(1);
  return row;
}

export async function listBatchRecords(limit = 20) {
  return db.select().from(payoutBatchRecords).orderBy(desc(payoutBatchRecords.createdAt)).limit(limit);
}

export async function listItemRecords(paypalBatchId: string) {
  return db.select().from(payoutItemRecords).where(eq(payoutItemRecords.paypalBatchId, paypalBatchId));
}

export async function listStatusHistory(senderItemId: string) {
  return db
    .select()
    .from(payoutStatusHistory)
    .where(and(eq(payoutStatusHistory.senderItemId, senderItemId)))
    .orderBy(payoutStatusHistory.observedAt);
}

/** True if this item entered Landfall through an import (its money positions, fee included, are in the opening journal). */
async function wasImported(tx: Tx, senderItemId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: payoutStatusHistory.id })
    .from(payoutStatusHistory)
    .where(and(eq(payoutStatusHistory.senderItemId, senderItemId), eq(payoutStatusHistory.source, "import")))
    .limit(1);
  return rows.length > 0;
}
