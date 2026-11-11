/**
 * LIVE SANDBOX CASES (server only).
 *
 * Builds ReliefCase records from what Landfall has STORED about real PayPal Sandbox payments:
 *   payout_item_records  (provider status, ids, amounts, fees)
 *   payout_status_history (every change, its source, the webhook event id, the ledger postings it caused)
 *   payout_batch_records (batch status, last sync)
 *   ledger_entries       (the postings themselves)
 * and feeds them through the SAME pure builder the replay data uses, so a status means the same thing in both.
 *
 * Nothing here calls PayPal and nothing here is invented: a fact we don't have is shown as Missing.
 */
import { LIVE_CASE_PREFIX_CLIENT } from "./live-ref";
import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutBatchRecords, payoutItemRecords, payoutStatusHistory, webhookEvents } from "@/lib/db/schema";
import { getAccountBalance } from "@/lib/ledger/index";
import { buildCase, type CaseInput } from "./case-builder";
import type { AccessReport, EvidenceRow, PayPalItemStatus, ReliefCase } from "./case-types";
import { liveTreasury, type LiveTreasury } from "./live-treasury";
import { householdFromRef } from "@/lib/auth/resident-code";
import { profileFor } from "./sandbox-profiles";

export const LIVE_CASE_PREFIX = LIVE_CASE_PREFIX_CLIENT;
export const liveCaseRefFor = (senderItemId: string) => `${LIVE_CASE_PREFIX}${senderItemId}`;

const KNOWN: PayPalItemStatus[] = ["SUCCESS", "PENDING", "UNCLAIMED", "FAILED", "RETURNED", "ONHOLD", "BLOCKED", "REFUNDED", "REVERSED"];

/** Map a stored status to the case model's vocabulary. SUBMITTED (sent, PayPal silent) and CANCELED read as what they are. */
export function caseStatusFor(stored: string): { status: PayPalItemStatus; note?: string } {
  const s = stored.toUpperCase();
  if ((KNOWN as string[]).includes(s)) return { status: s as PayPalItemStatus };
  if (s === "SUBMITTED") return { status: "PENDING", note: "Submitted to PayPal; PayPal has not reported this item yet" };
  if (s === "CANCELED" || s === "CANCELLED") return { status: "RETURNED", note: "Cancelled by Landfall while unclaimed; funds returned" };
  if (s === "DENIED") return { status: "FAILED", note: "PayPal denied the item" };
  return { status: "ONHOLD", note: `Unrecognised provider status "${stored}" — treated as a hold until a person checks` };
}

export function ageBandFor(hours: number): ReliefCase["ageBand"] {
  if (hours < 6) return "< 6 hrs";
  if (hours < 24) return "6 - 24 hrs";
  if (hours < 48) return "24 - 48 hrs";
  return "> 48 hrs";
}

const usd = (cents: number) => cents / 100;

export interface LiveSnapshot {
  cases: ReliefCase[];
  treasury: LiveTreasury;
  batches: Array<{ paypalBatchId: string; status: string; amountUsd: number | null; feeUsd: number | null; lastSyncedAt: string | null; lastSyncSource: string | null; lastSyncError: string | null; itemCount: number | null }>;
  lastSyncedAt: string | null;
  hasData: boolean;
}

export async function getLiveSnapshot(reports: AccessReport[] = [], now = Date.now()): Promise<LiveSnapshot> {
  const [items, batches] = await Promise.all([db.select().from(payoutItemRecords), db.select().from(payoutBatchRecords)]);
  const empty = !items.length;
  const itemKeys = items.map((i) => i.senderItemId);
  const history = itemKeys.length ? await db.select().from(payoutStatusHistory).where(inArray(payoutStatusHistory.senderItemId, itemKeys)).orderBy(asc(payoutStatusHistory.observedAt)) : [];
  const eventIds = [...new Set(history.map((h) => h.eventId).filter((x): x is string => !!x))];
  const events = eventIds.length ? await db.select({ id: webhookEvents.paypalEventId, type: webhookEvents.type, verified: webhookEvents.verified }).from(webhookEvents).where(inArray(webhookEvents.paypalEventId, eventIds)) : [];
  const eventById = new Map(events.map((e) => [e.id, e]));
  // Verified item webhooks, found by the item they are about. A webhook that arrives after a refresh already recorded
  // the same status changes nothing in the status history, but it IS evidence that PayPal told us.
  const itemEventRows = await db
    .select({ id: webhookEvents.paypalEventId, type: webhookEvents.type, payload: webhookEvents.payload, receivedAt: webhookEvents.receivedAt })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.verified, true), like(webhookEvents.type, "PAYMENT.PAYOUTS-ITEM.%")))
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(500);
  const verifiedItemEvent = new Map<string, { id: string; type: string; at: Date }>();
  for (const e of itemEventRows) {
    const r = (e.payload as { resource?: { payout_item_id?: string; payout_item?: { sender_item_id?: string }; sender_item_id?: string } } | null)?.resource;
    for (const key of [r?.payout_item_id, r?.payout_item?.sender_item_id, r?.sender_item_id]) {
      if (key && !verifiedItemEvent.has(key)) verifiedItemEvent.set(key, { id: e.id, type: e.type, at: e.receivedAt });
    }
  }
  const batchById = new Map(batches.map((b) => [b.paypalBatchId, b]));

  const cases = items.map((it) => {
    const hist = history.filter((h) => h.senderItemId === it.senderItemId);
    const { status, note } = caseStatusFor(it.status);
    const hh = householdFromRef(it.senderItemId) ?? it.senderItemId;
    const profile = profileFor(hh);
    const batch = batchById.get(it.paypalBatchId);
    const imported = batch?.planId?.startsWith("imported:") ?? false;
    const caseRef = liveCaseRefFor(it.senderItemId);
    const observedAt = it.providerTime ?? it.createdAt;
    const ageHours = Math.max(0, (now - observedAt.getTime()) / 3_600_000);

    const webhookRows = hist.filter((h) => h.source === "webhook" && h.eventId);
    const itemEvent = (it.paypalItemId ? verifiedItemEvent.get(it.paypalItemId) : undefined) ?? verifiedItemEvent.get(it.senderItemId);
    const hasWebhook = webhookRows.length > 0 || !!itemEvent;
    const ledgerIds = hist.flatMap((h) => h.ledgerTransactionIds ?? []);
    const postingExpected = ["SUCCESS", "UNCLAIMED", "RETURNED", "REFUNDED", "REVERSED"].includes(status);

    const evidenceBase: EvidenceRow[] = [
      {
        key: "obligation",
        title: "Relief obligation",
        state: imported ? "missing" : "present",
        provenance: "INTERNAL",
        ref: batch?.planId ?? undefined,
        detail: imported ? "Created before Landfall began tracking — imported from PayPal, no obligation record" : `Approved under plan ${batch?.planId ?? "unknown"}`,
      },
      {
        key: "approval",
        title: "Two-person approval",
        state: imported ? "missing" : "present",
        provenance: "INTERNAL",
        detail: imported ? "No approval record: this payment pre-dates Landfall (imported, not faked)" : "Approved by two people (see the plan's approvals)",
      },
      {
        key: "payout",
        title: "PayPal batch & item",
        state: "present",
        provenance: "PROVIDER",
        ref: `${it.paypalBatchId} · ${it.paypalItemId ?? "(item id not reported yet)"}`,
        detail: `${profile.wallet} · $${usd(it.amountCents).toFixed(2)} ${it.currency} · status ${it.status}${batch ? ` · batch ${batch.status}` : ""}${it.transactionId ? ` · tx ${it.transactionId}` : ""} · PayPal Sandbox (real response)${note ? ` · ${note}` : ""}`,
      },
      {
        key: "webhook",
        title: "Provider webhook",
        state: hasWebhook ? "present" : status === "PENDING" ? "not_expected" : "missing",
        provenance: "PROVIDER",
        ref: webhookRows[0]?.eventId ?? itemEvent?.id ?? undefined,
        detail:
          webhookRows.length > 0
            ? `${eventById.get(webhookRows[0].eventId!)?.type ?? "webhook event"} · signature verified by PayPal`
            : itemEvent
            ? `${itemEvent.type} · signature verified by PayPal · received ${itemEvent.at.toISOString().slice(0, 16).replace("T", " ")} UTC`
            : status === "PENDING"
            ? "PayPal sends no item webhook for PENDING — poll the item instead"
            : "No verified webhook received for this item; the status came from a read-only refresh of PayPal",
      },
      {
        key: "ledger",
        title: "Ledger entry",
        state: ledgerIds.length > 0 || (imported && postingExpected) ? "present" : postingExpected ? "missing" : "not_expected",
        provenance: "INTERNAL",
        ref: ledgerIds[0],
        detail:
          ledgerIds.length > 0
            ? `Posted ${ledgerIds.length} balanced journal entr${ledgerIds.length === 1 ? "y" : "ies"} from PayPal's status`
            : imported && postingExpected
            ? "Carried by the opening journal written when this batch was imported"
            : postingExpected
            ? "No ledger posting found for this status"
            : "No money movement to post for this status",
      },
      {
        key: "proof",
        title: "Recovery proof",
        state: "not_expected",
        provenance: "OPERATOR_ATTESTED",
        detail: "Recovery proofs are produced for approved plans; not applicable to this payment",
      },
    ];

    const input: CaseInput = {
      origin: "SANDBOX_LIVE",
      caseRef,
      itemId: it.paypalItemId ?? it.senderItemId,
      batchId: it.paypalBatchId,
      obligationId: imported ? "imported" : batch?.planId ?? "unknown",
      householdRef: hh,
      resident: profile.resident,
      zone: profile.zone,
      tier: profile.tier,
      tierLabel: profile.tierLabel,
      wallet: profile.wallet,
      amountUsd: usd(it.amountCents),
      status,
      ageHours,
      ageBand: ageBandFor(ageHours),
      seededConfirmation: false,
      reports: reports.filter((r) => r.caseRef === caseRef),
      evidenceBase,
      approved: !imported,
    };
    return buildCase(input);
  });

  // The ledger's real positions (posted from PayPal's statuses + the opening journal)
  const [cash, unclaimed, paid, fees] = await Promise.all([
    getAccountBalance("paypal_available"),
    getAccountBalance("payout_unclaimed"),
    getAccountBalance("paid_out"),
    getAccountBalance("payout_fees"),
  ]);
  const inFlightUsd = cases.filter((c) => ["UNCLAIMED", "ONHOLD", "BLOCKED", "PENDING"].includes(c.status)).reduce((t, c) => t + c.amountUsd, 0);
  const needsReissueUsd = cases.filter((c) => ["FAILED", "RETURNED", "REFUNDED", "REVERSED"].includes(c.status)).reduce((t, c) => t + c.amountUsd, 0);
  const treasury = liveTreasury({ cashCents: cash, unclaimedCents: unclaimed, paidOutCents: paid, feesCents: fees }, { inFlightUsd, needsReissueUsd });

  const syncTimes = batches.map((b) => b.lastSyncedAt?.getTime()).filter((t): t is number => !!t);
  return {
    cases,
    treasury,
    batches: batches.map((b) => ({
      paypalBatchId: b.paypalBatchId,
      status: b.status,
      amountUsd: b.amountCents != null ? usd(b.amountCents) : null,
      feeUsd: b.feeCents != null ? usd(b.feeCents) : null,
      lastSyncedAt: b.lastSyncedAt?.toISOString() ?? null,
      lastSyncSource: b.lastSyncSource,
      lastSyncError: b.lastSyncError,
      itemCount: b.itemCount,
    })),
    lastSyncedAt: syncTimes.length ? new Date(Math.max(...syncTimes)).toISOString() : null,
    hasData: !empty,
  };
}
