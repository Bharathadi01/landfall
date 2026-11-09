# Financial Integrity & Accounting Architecture

## 1. Executive Summary

In disaster relief finance, moving money without strict accounting controls invites catastrophe: double-disbursements, unbacked commitments, reserve exhaustion, and unreconciled donor funds.

Landfall enforces strict financial invariants implemented in deterministic TypeScript and protected by database constraints and static AST boundary tests.

---

## 2. Inviolable Financial Invariants

### Invariant 1: Integer Minor Units & Single-Currency Accounting
- Every financial amount is stored as an integer minor unit (e.g., cents in USD: $100.00 = `10000`).
- JavaScript floating point math is strictly barred from all financial paths (`Math.round`, integer division only).
- Multi-currency amounts are never summed without explicit, auditable foreign exchange conversion records.

### Invariant 2: Double-Entry Balancing (`Debits == Credits`)
- The internal general ledger (`lib/ledger/index.ts`) enforces double-entry bookkeeping.
- Every transaction requires balanced debits and credits across assets, liabilities, and equity accounts.
- Unbalanced transactions throw runtime errors prior to any database mutation.

### Invariant 3: Zero Reserve Leakage (Inviolable 30% Floor)
- Operating reserve floor (`reserveProtectedCents`) is strictly deducted from available liquid funds in all tranches:
  $$\text{allocatableCents} = \max(0, \text{paypalAvailableCents} - \text{reserveProtectedCents} - \text{feesReservedCents} - \text{committedCents})$$
- Even in extreme disaster scenarios, Landfall's treasury engine never breaches the 30% operating reserve floor.

### Invariant 4: Segregation of Contingent Standby Pledges
- Contingent standby pledges (committed donor pledges awaiting storm trigger) are strictly segregated from liquid cash.
- Contingent pledges are never included in Tranche 1 allocatable funds.
- Pledges are only recognized as liquid cash after verified PayPal Vault capture.

### Invariant 5: Durable Outbox & Restart-Safe Idempotency
- External money-moving requests are written to the durable outbox in the `PREPARED` state before network I/O.
- Each request carries an immutable internal idempotency key and stable `sender_batch_id`.
- If a crash or network timeout occurs, the worker recovers the state using the original `sender_batch_id`, preventing duplicate payout creation.

### Invariant 6: Authoritative PayPal Orders v2 Accounting
- An approved PayPal order is not treated as liquid funds.
- Funds are only credited to the general ledger after verified `COMPLETED` capture status or cryptographically verified webhook delivery (`PAYMENT.CAPTURE.COMPLETED`).
- Unapproved orders remain segregated and excluded from treasury balances.

