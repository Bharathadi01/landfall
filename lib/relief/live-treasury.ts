/**
 * LIVE TREASURY (pure). Same shape the replay `TREASURY` uses, but computed from the ledger's real balances
 * (which the payout store posts from PayPal's own statuses) — nothing typed in.
 *
 *   total      = everything the fund holds or has paid: cash + held-for-claim + credited + fees
 *   available  = PayPal available cash
 *   reserve    = the policy floor (30% of total) — a protected partition of cash, enforced by the allocation rules
 *   allocatable= available cash above the reserve
 */
export const POLICY_FLOOR_PCT = 30;

export interface LedgerPositions {
  cashCents: number;
  unclaimedCents: number;
  paidOutCents: number;
  feesCents: number;
}

export interface CaseMoney {
  /** UNCLAIMED + ONHOLD + BLOCKED + PENDING (sent, not settled) — in dollars. */
  inFlightUsd: number;
  /** FAILED + RETURNED + REFUNDED + REVERSED — funds that did not land and are owed again, in dollars. */
  needsReissueUsd: number;
}

export function liveTreasury(p: LedgerPositions, c: CaseMoney) {
  const usd = (cents: number) => Math.round(cents) / 100;
  const total = usd(p.cashCents + p.unclaimedCents + p.paidOutCents + p.feesCents);
  const available = usd(p.cashCents);
  const requiredReserve = Math.round((total * POLICY_FLOOR_PCT) / 100 * 100) / 100;
  const reserve = Math.min(requiredReserve, available);
  return {
    total,
    available,
    reserve,
    policyFloorPct: POLICY_FLOOR_PCT,
    requiredReserve,
    reserveHeadroom: Math.round((reserve - requiredReserve) * 100) / 100,
    paidOut: usd(p.paidOutCents),
    inFlight: c.inFlightUsd,
    needsReissue: c.needsReissueUsd,
    allocatable: Math.max(0, Math.round((available - reserve) * 100) / 100),
    feesPaid: usd(p.feesCents),
  };
}

export type LiveTreasury = ReturnType<typeof liveTreasury>;
