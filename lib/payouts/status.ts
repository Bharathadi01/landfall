/**
 * PAYOUT ITEM STATUS VOCABULARY + LEDGER RULES (pure, no I/O).
 *
 * Source of truth for PayPal's item statuses is the published Payouts v1 schema
 * (`transaction_status`). Landfall adds ONE internal state, SUBMITTED, for "we sent the batch and
 * PayPal has not yet told us anything about this item". It is never sent to or received from PayPal.
 *
 * Money is only posted to the ledger on provider-confirmed states, so "requested", "submitted",
 * "processing", "credited", "returned" and "unresolved" stay distinct financial states.
 */
import type { LedgerEntryItem } from "@/lib/ledger/index";

/** PayPal's published payout item statuses. */
export const OFFICIAL_ITEM_STATUSES = [
  "SUCCESS",
  "FAILED",
  "PENDING",
  "UNCLAIMED",
  "RETURNED",
  "ONHOLD",
  "BLOCKED",
  "REFUNDED",
  "REVERSED",
] as const;
export type OfficialItemStatus = (typeof OFFICIAL_ITEM_STATUSES)[number];

/** Landfall-only pre-provider state. */
export const INTERNAL_SUBMITTED = "SUBMITTED";

/**
 * Statuses that arrive in webhook event names or batch payloads but are not item statuses in the
 * published enum. They are accepted, mapped where PayPal documents a mapping, and otherwise flagged.
 */
const EVENT_ALIASES: Record<string, string> = {
  SUCCEEDED: "SUCCESS",
  HELD: "ONHOLD",
};
const ACCEPTED_EVENT_ONLY = new Set(["CANCELED", "DENIED", "PROCESSING"]);

export interface NormalizedStatus {
  status: string;
  /** True when the value is in PayPal's published item enum (or is our internal SUBMITTED). */
  recognised: boolean;
}

export function normalizeItemStatus(raw: string | null | undefined): NormalizedStatus {
  const upper = String(raw ?? "").trim().toUpperCase();
  const mapped = EVENT_ALIASES[upper] ?? upper;
  const recognised =
    (OFFICIAL_ITEM_STATUSES as readonly string[]).includes(mapped) || mapped === INTERNAL_SUBMITTED || ACCEPTED_EVENT_ONLY.has(mapped);
  return { status: mapped || "UNKNOWN", recognised: recognised && mapped !== "" };
}

export function isTerminalStatus(status: string): boolean {
  return ["SUCCESS", "FAILED", "RETURNED", "REFUNDED", "REVERSED", "DENIED", "CANCELED"].includes(status.toUpperCase());
}

/* ----------------------------- money helpers ----------------------------- */

/** "100.00" → 10000. Returns null for anything that is not a plain non-negative decimal. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/* ----------------------------- ledger postings ----------------------------- */

export interface PostingContext {
  senderItemId: string;
  from: string | null;
  to: string;
  amountCents: number;
  feeCents: number | null;
}

export interface PlannedPosting {
  transactionId: string;
  description: string;
  entries: LedgerEntryItem[];
}

const RETURN_STATES = new Set(["RETURNED", "REFUNDED", "REVERSED", "CANCELED"]);

/**
 * The journal entries implied by moving an item from `from` to `to`.
 *
 * Accounts (debit-positive): paypal_available (cash), payout_unclaimed (held by PayPal awaiting a
 * claim), paid_out (credited to a recipient), payout_fees (PayPal fees).
 *
 *   → UNCLAIMED            Dr payout_unclaimed / Cr paypal_available
 *   → SUCCESS from UNCLAIMED   Dr paid_out / Cr payout_unclaimed
 *   → SUCCESS otherwise        Dr paid_out / Cr paypal_available
 *   → RETURNED|CANCELED from UNCLAIMED        Dr paypal_available / Cr payout_unclaimed
 *   → REFUNDED|REVERSED from SUCCESS          Dr paypal_available / Cr paid_out
 *   first UNCLAIMED/SUCCESS, if a fee is known   Dr payout_fees / Cr paypal_available
 *
 * No posting for SUBMITTED, PENDING, ONHOLD, BLOCKED, FAILED (PayPal: "funds were not deducted") or
 * an unrecognised status: those are recorded as state, not as money movement. A return observed for
 * an item we never saw deducted is also not posted (we cannot know money left).
 * Every transaction id is deterministic per (item, target state) so replays are no-ops.
 */
export function plannedPostings(ctx: PostingContext): PlannedPosting[] {
  const { senderItemId, from, to, amountCents, feeCents } = ctx;
  const id = senderItemId.replace(/[^A-Za-z0-9:_.-]/g, "_");
  const out: PlannedPosting[] = [];
  if (amountCents <= 0) return out;

  const dr = (accountName: LedgerEntryItem["accountName"], cents: number): LedgerEntryItem => ({ accountName, entryType: "DEBIT", amountCents: cents });
  const cr = (accountName: LedgerEntryItem["accountName"], cents: number): LedgerEntryItem => ({ accountName, entryType: "CREDIT", amountCents: cents });

  if (to === "UNCLAIMED" && from !== "UNCLAIMED" && from !== "SUCCESS") {
    out.push({
      transactionId: `payout_${id}_unclaimed`,
      description: `Payout ${senderItemId}: UNCLAIMED, funds held by PayPal pending recipient claim`,
      entries: [dr("payout_unclaimed", amountCents), cr("paypal_available", amountCents)],
    });
  } else if (to === "SUCCESS" && from !== "SUCCESS") {
    out.push({
      transactionId: `payout_${id}_success`,
      description: `Payout ${senderItemId}: SUCCESS, credited to the recipient's PayPal account`,
      entries: from === "UNCLAIMED" ? [dr("paid_out", amountCents), cr("payout_unclaimed", amountCents)] : [dr("paid_out", amountCents), cr("paypal_available", amountCents)],
    });
  } else if (RETURN_STATES.has(to) && from === "UNCLAIMED") {
    out.push({
      transactionId: `payout_${id}_${to.toLowerCase()}`,
      description: `Payout ${senderItemId}: ${to}, held funds returned to the sender`,
      entries: [dr("paypal_available", amountCents), cr("payout_unclaimed", amountCents)],
    });
  } else if ((to === "REFUNDED" || to === "REVERSED") && from === "SUCCESS") {
    out.push({
      transactionId: `payout_${id}_${to.toLowerCase()}`,
      description: `Payout ${senderItemId}: ${to}, credited funds returned to the sender`,
      entries: [dr("paypal_available", amountCents), cr("paid_out", amountCents)],
    });
  }

  if ((to === "UNCLAIMED" || to === "SUCCESS") && feeCents && feeCents > 0) {
    out.push({
      transactionId: `payout_${id}_fee`,
      description: `Payout ${senderItemId}: PayPal fee`,
      entries: [dr("payout_fees", feeCents), cr("paypal_available", feeCents)],
    });
  }
  return out;
}
