import type { LedgerEntryItem } from "@/lib/ledger/index";

/**
 * OPENING JOURNAL (pure).
 *
 * When Landfall starts tracking payments that PayPal already holds or has already paid, the ledger needs the
 * positions as they stood at that moment — not as new movements. Importing a $500 batch as ordinary
 * "UNCLAIMED/SUCCESS" transitions would deduct $503 from a cash balance that PayPal had already reduced.
 *
 *   Dr paypal_available   the PayPal available balance NOW (already net of those payouts)
 *   Dr payout_unclaimed   items PayPal reports UNCLAIMED (held, awaiting a claim)
 *   Dr paid_out           items PayPal reports SUCCESS (credited)
 *   Dr payout_fees        fees PayPal reports on those items
 *   Cr opening_balance    the sum — so the entry balances by construction
 *
 * After this, every later change flows through the normal idempotent postings, and the ledger cash equals PayPal's.
 */
export interface OpeningInput {
  /** PayPal available balance in cents at the moment of import. */
  paypalAvailableCents: number;
  items: Array<{ status: string; amountCents: number; feeCents: number | null }>;
}

export interface OpeningJournal {
  entries: LedgerEntryItem[];
  positions: { cash: number; unclaimed: number; paidOut: number; fees: number; total: number };
}

export function openingJournal(input: OpeningInput): OpeningJournal {
  let unclaimed = 0;
  let paidOut = 0;
  let fees = 0;
  for (const it of input.items) {
    if (it.status === "UNCLAIMED") unclaimed += it.amountCents;
    if (it.status === "SUCCESS") paidOut += it.amountCents;
    // PayPal charges the fee when an item is credited or held; items that are still PENDING/FAILED carry none we should book.
    if (it.status === "UNCLAIMED" || it.status === "SUCCESS") fees += it.feeCents ?? 0;
  }
  const cash = Math.max(0, input.paypalAvailableCents);
  const total = cash + unclaimed + paidOut + fees;
  const entries: LedgerEntryItem[] = [];
  const dr = (accountName: LedgerEntryItem["accountName"], amountCents: number) => {
    if (amountCents > 0) entries.push({ accountName, entryType: "DEBIT", amountCents });
  };
  dr("paypal_available", cash);
  dr("payout_unclaimed", unclaimed);
  dr("paid_out", paidOut);
  dr("payout_fees", fees);
  if (total > 0) entries.push({ accountName: "opening_balance", entryType: "CREDIT", amountCents: total });
  return { entries, positions: { cash, unclaimed, paidOut, fees, total } };
}
