/**
 * Safety caps for payouts created through proposals (PayPal Sandbox build). They stop a typo or a compromised
 * session from creating a large batch, and apply on top of the Treasurer's reserve / solvency / duplicate checks.
 */
export const MAX_ITEM_CENTS = Number(process.env.LIVE_PAYOUT_MAX_ITEM_CENTS ?? 10_000); // $100
export const MAX_TOTAL_CENTS = Number(process.env.LIVE_PAYOUT_MAX_TOTAL_CENTS ?? 5_000); // $50 per proposal
export const FEE_ESTIMATE_PER_ITEM_CENTS = 25;

export function checkPayoutCaps(items: Array<{ amountCents: number }>): string | null {
  if (!items.length) return "Add at least one household.";
  if (items.length > 20) return "At most 20 households per proposal.";
  for (const i of items) {
    if (!Number.isInteger(i.amountCents) || i.amountCents <= 0) return "Every amount must be a positive number of cents.";
    if (i.amountCents > MAX_ITEM_CENTS) return `Each payment is capped at $${(MAX_ITEM_CENTS / 100).toFixed(2)} in this Sandbox build.`;
  }
  const total = items.reduce((t, i) => t + i.amountCents, 0);
  if (total > MAX_TOTAL_CENTS) return `A proposal is capped at $${(MAX_TOTAL_CENTS / 100).toFixed(2)} in total in this Sandbox build.`;
  return null;
}
