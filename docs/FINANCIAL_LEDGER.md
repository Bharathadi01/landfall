# Financial ledger, treasury and reconciliation

> Describes the code at commit `f8f21a7`. Sandbox money only: no real funds move in this deployment ([DATA_PROVENANCE.md](DATA_PROVENANCE.md)). Older milestone documents ([FINANCIAL_INTEGRITY.md](FINANCIAL_INTEGRITY.md), [PAYPAL_PAYOUT_STATUS_AUDIT.md](PAYPAL_PAYOUT_STATUS_AUDIT.md)) describe earlier states; this page replaces them as the current description.

## 1. What is built, in one paragraph

Landfall keeps its own double-entry ledger in PostgreSQL (`ledger_accounts`, `ledger_entries`). Money enters it from verified PayPal webhooks (donations, sustainer payments) and from PayPal's own payout item statuses (relief payments). Every posting is balanced, deterministic and idempotent. The Command Center's cash figures are *computed from this ledger*, and a reconciler compares the ledger's `paypal_available` balance with PayPal's Reporting API balance. The ledger is the book of record Landfall keeps; PayPal remains the authority on what actually happened.

## 2. Accounts

Declared in `lib/ledger/index.ts` (`AccountName`). Accounts are created on first use; `committed:<plan>` accounts are typed `LIABILITY`, all others `ASSET` in `ledger_accounts.account_type`. The **sign convention that matters** is in `getAccountBalance`: the accounts below marked *Dr+* are debit-positive; every other account is credit-positive.

| Account | Sign | Meaning | Written by |
|---|---|---|---|
| `paypal_available` | Dr+ | Cash PayPal reports as available to the fund | donations, sustainer sales, payout postings, opening journal |
| `payout_unclaimed` | Dr+ | Money PayPal holds for an UNCLAIMED payout item (recipient has not claimed it) | payout postings |
| `paid_out` | Dr+ | Money credited to a recipient's PayPal account (PayPal `SUCCESS`) | payout postings |
| `payout_fees` | Dr+ | PayPal fees booked on payout items | payout postings |
| `reserve_protected` | Cr+ | Protected reserve partition | donation and sustainer postings (credit) |
| `opening_balance` | Cr+ | Counter-entry for the opening journal | `lib/payouts/opening.ts` |
| `fees_reserved`, `committed:<id>`, `allocatable`, `returned`, `pledges_contingent`, `pledges_captured` | Cr+ | Declared; see "Declared but not written" below | partly by code paths that are not active in this deployment |

**Declared but not written by the current payout path:** `returned` is read by `getTreasuryWaterfall` but no payout posting writes it (a return restores `paypal_available` and clears `payout_unclaimed`). `pledges_*` accounts belong to the Vault pledge flow, which Sandbox permissions block ([PAYPAL_INTEGRATION.md](PAYPAL_INTEGRATION.md)). `ledger_accounts.balance` exists as a column but the code never writes it; balances are always derived by summing entries.

## 3. Journal entries and invariants

Each posting is a set of `ledger_entries` rows sharing a `transaction_id`: `account_id`, `direction` (`DEBIT`/`CREDIT`), `amount` (`numeric(14,2)`), `description`, `correlation_id`.

1. **Balanced.** `validateBalancedTransaction` sums debits and credits in integer cents and `recordLedgerTransaction` throws *before* any write if they differ. Tests: `tests/ledger/ledger.test.ts`, `tests/ledger/financial_integrity.test.ts` ("strictly rejects unbalanced entries and throws before database mutation").
2. **No negative amounts.** A negative entry throws (`tests/ledger/ledger.test.ts`). Postings with a zero or negative amount are never planned (`tests/payouts/status.test.ts`).
3. **Atomic.** All rows of one transaction are inserted in one database transaction, or inside the caller's transaction (the payout store posts inside the item's row-locked transaction).
4. **Integer cents in code.** Amounts are converted with `toCents`, which accepts only plain non-negative decimals with at most two places.
5. **Idempotent by id.** Transaction ids are deterministic, for example `payout_<senderItemId>_unclaimed`, `payout_<senderItemId>_success`, `payout_<senderItemId>_fee`, `tx_donation_capture_<orderId>`, `tx_sustainer_sale_<saleId>`, `tx_opening_<batchId>`. `isTransactionRecorded` is checked before posting.
6. **Append-only by construction.** No code updates or deletes `ledger_entries`. This is a property of the code, **not** enforced by the database: there is no trigger or constraint preventing an update, and `transaction_id` is not unique (one transaction has several rows). Idempotency is therefore an application-level guarantee, serialised for payouts by the item row lock and for webhooks by the `webhook_events` claim. See [LIMITATIONS.md](LIMITATIONS.md).

## 4. Payout lifecycle: which PayPal statuses post money

The mapping lives in `lib/payouts/status.ts` (`plannedPostings`) and is applied by `applyItemObservation` in `lib/payouts/store.ts`. PayPal's published item statuses are `SUCCESS, FAILED, PENDING, UNCLAIMED, RETURNED, ONHOLD, BLOCKED, REFUNDED, REVERSED`; webhook event names add aliases (`SUCCEEDED` → `SUCCESS`, `HELD` → `ONHOLD`) and `CANCELED`, `DENIED`, `PROCESSING`. Landfall adds one internal state, `SUBMITTED` ("we sent the batch and PayPal has not said anything about this item"), never sent to or received from PayPal.

| Transition (from → to) | Ledger entries posted | Why |
|---|---|---|
| → `SUBMITTED` | none | Requested, not provider-confirmed. |
| → `PENDING`, `ONHOLD`, `BLOCKED` | none | Recorded as state, not as money movement. |
| → `FAILED` | none | PayPal documents that funds were not deducted. A failed item can never later become `SUCCESS` (precedence guard). |
| → `UNCLAIMED` (not from `UNCLAIMED`/`SUCCESS`) | Dr `payout_unclaimed` / Cr `paypal_available` | PayPal holds the money pending a claim; it left available cash. |
| `UNCLAIMED` → `SUCCESS` | Dr `paid_out` / Cr `payout_unclaimed` | The held funds were claimed and credited. |
| any other → `SUCCESS` | Dr `paid_out` / Cr `paypal_available` | Credited directly. |
| `UNCLAIMED` → `RETURNED` or `CANCELED` | Dr `paypal_available` / Cr `payout_unclaimed` | Held funds came back to the fund. |
| `UNCLAIMED` → `REFUNDED` or `REVERSED` | Dr `paypal_available` / Cr `payout_unclaimed` | Same. |
| `SUCCESS` → `REFUNDED` or `REVERSED` | Dr `paypal_available` / Cr `paid_out` | Credited funds came back. |
| first `UNCLAIMED` or `SUCCESS`, if a fee is known | Dr `payout_fees` / Cr `paypal_available` | PayPal fee. **Assumption (documented in `lib/payouts/opening.ts`):** PayPal does not refund the fee on a return. |
| a return seen for an item we never saw deducted | none | We cannot know money left. |
| unrecognised status | none, flag `UNKNOWN_STATUS` | Never overwrites a recognised status. |

**Important distinction.** `paid_out` means *PayPal credited the recipient's PayPal account*. It does not mean the person withdrew or used the money. Resident confirmation is stored separately (`access_reports`, [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md#m-resident-portal)) and never changes PayPal's status or the ledger.

### The six stages, kept apart

| Stage | What it is | Recorded where | Moves the ledger? |
|---|---|---|---|
| Payment initiated | A two-person-approved proposal exists | `action_proposals`, `action_approvals` | No |
| Payment submitted | The Treasurer sent the batch; item is `SUBMITTED` | `payout_batch_records`, `payout_item_records` | No |
| Payment succeeded | PayPal item `SUCCESS` (credited) | `payout_item_records`, `payout_status_history` | Yes (`paid_out`) |
| Payment claimed | A previously `UNCLAIMED` item became `SUCCESS` | status history shows `UNCLAIMED → SUCCESS` | Yes (held → paid) |
| Recipient confirmed | The household says "I received it" | `access_reports` (resident-reported provenance) | No |
| Reconciliation completed | Ledger cash agrees with PayPal's reported balance and transactions | `audit_events` (`treasury.reconcile`) | No |

## 5. Out-of-order, duplicate, unknown and mismatched events

All handled in `applyItemObservation` (one transaction, row lock on the item):

| Situation | Behaviour | Test |
|---|---|---|
| Same observation twice | `unchanged`; nothing posted. | `tests/payouts/store.test.ts` "replaying the same observation changes nothing and posts nothing" |
| Ten identical concurrent events | Money posted exactly once (row lock). | "ten concurrent identical events post the money exactly once (row-locked)" |
| Older webhook arrives after a newer one | Ignored (`STALE_EVENT`, by PayPal `create_time`) or blocked by precedence (`STATUS_REGRESSION_BLOCKED`). | "an older webhook cannot overwrite a newer one at the same rank" |
| `SUCCESS` then `FAILED`, or a failure revived | Blocked; never downgrades `SUCCESS`, never revives a failure. | "never downgrades SUCCESS, never revives a failure…" |
| Amount or currency differs from what was approved | Flagged (`AMOUNT_MISMATCH`, `CURRENCY_NOT_USD`), audited, **posts nothing**. | "an amount or currency that disagrees … posts NOTHING" |
| Unknown PayPal status | Flagged, never overwrites a known status, moves no money. | "an unrecognised status is flagged…" |
| Item PayPal never told us about | A record is created only if the observation carries batch id, amount and currency. | "an event for an item we never recorded creates a record only when it carries enough to be trusted" |
| Payment that pre-dates the ledger (imported batch) | Positions enter through an **opening journal**, never as transitions, so cash PayPal had already reduced is not deducted twice. | `lib/payouts/opening.ts`, `tests/payouts/import.test.ts` |

The database-backed tests above are skipped unless `TEST_DATABASE_URL` points at a disposable database; they run in CI and were re-run locally for this documentation ([TESTING.md](TESTING.md)).

## 6. Treasury formulas

Pure functions, no I/O, no AI import.

**Allocatable cash** (`lib/ledger/allocatable.ts`):

```
allocatable = max(0, paypalAvailable − reserveProtected − feesReserved − committed)
```

The reserve is deducted in *every* tranche unless `allowReserveDrawdown` is explicitly passed; the Treasurer never passes it (`tests/ledger/ledger.test.ts`: "strictly protects reserve in Tranche 1 by default (zero leakage)", "allows reserve drawdown only when explicit fiduciary override is granted").

**Live treasury shown in the console** (`lib/relief/live-treasury.ts`), computed from ledger positions:

```
total       = cash + held-for-claim + credited + fees
reserve     = min(30% of total, available cash)          # POLICY_FLOOR_PCT = 30
allocatable = max(0, available − reserve)
```

**Policy amounts** (`lib/rules/engine.ts`, defaults in `lib/fixtures/households.ts`, policy `policy_v2024_milton`): Tranche 1 is a flat $100; Tranche 2 is `$250 + $50 × (members − 1) + $50 if any vulnerability flag`, capped at $500 per household per event; at most 2 households per address; fee estimate $0.25 per item. Priority tiers are assigned lexicographically (P1 medical device, P2 elderly living alone, P3 disability, P4 no vehicle in surge zone, P5 children under 5, P6 general), ties broken by enrolment time then household id; missing paperwork never lowers rank, it sets `needsReview`. In this Sandbox build proposals are additionally capped at $100 per item, $50 per proposal and 20 households (`lib/proposals/policy.ts`).

### Two treasury computations (a known inconsistency)

The console and the Treasurer's pre-send check use **`liveTreasury`** (a 30% policy floor on total funds). The Watch Officer's evidence and `GET /api/treasury/waterfall` use **`getTreasuryWaterfall`**, which reads the *ledger account* `reserve_protected`. Donation and sustainer postings credit `reserve_protected` by the full amount while debiting `paypal_available` by the same amount, so by that formula a donation raises cash and reserve together and does not by itself raise allocatable cash. The two views can therefore disagree. This is recorded in [LIMITATIONS.md](LIMITATIONS.md) as a design decision for the owner; it is not changed here.

## 7. Reconciliation

`lib/treasury/reconciler.ts`, exposed at `GET`/`POST /api/treasury/reconcile` and called by the Watch Officer's reconciliation tool.

1. Reads the ledger balance of `paypal_available` and its entries.
2. Calls PayPal Reporting `balances` (available USD) and `transactions` (default window: last 30 days). Calling PayPal writes `audit_events` rows.
3. Matches PayPal transactions to ledger entries by id heuristics (`correlation_id` equality or containment) **and** requires amounts to agree (PayPal outflows are negative, so absolute values are compared). Id agreement with an amount disagreement is reported as `Amount mismatch`, never as a match.
4. Classifies:

| Status | Rule | Meaning |
|---|---|---|
| `IN_SYNC` | balances equal and nothing unmatched | Strictly reconciled |
| `TIMING_DIFFERENCE` | balances equal but items unmatched, **or** a difference under $500.00 with unmatched items | Reporting lag; **not** counted as matched |
| `MISMATCH_ALERT` | a difference with no unmatched items, or ≥ $500.00 | Unexplained variance |
| `UNVERIFIED` | PayPal could not be queried | Nothing was compared; never a match |
| `FALLBACK_LEDGER_ONLY` | caller asked for a ledger-only view | Not a reconciliation; never a match |

The $500 threshold is a fixed heuristic in the code. A reconciliation run is recorded only as an `audit_events` row (`treasury.reconcile`); the `reconciliation_runs` table has no writer. Tests: `tests/treasury/reconciliation.test.ts`.

**Owner-provided live evidence.** [LIVE_PROOF.md](LIVE_PROOF.md) records two Sandbox runs on 2026-11-11 in which reconciliation reported a `TIMING_DIFFERENCE` of $100.00 and $2.04 while PayPal's balance report lagged, and was not shown as in sync. That file is the project owner's own record; it was not re-executed for this documentation (doing so would call PayPal).

## 8. Exceptions

An exception is any payment whose PayPal status is not `SUCCESS` or whose delivery evidence is missing. The recovery rules (`lib/recovery/decision.ts`, 18-rule matrix in [RECOVERY_DECISION_MATRIX.md](RECOVERY_DECISION_MATRIX.md)) say what is allowed: for example an `UNCLAIMED` payment inside its 30-day claim window cannot be cancelled or re-sent unless the resident has reported a barrier; a `RETURNED`/`FAILED` payment needs a *new* two-person-approved proposal; **no status produces an automatic second payout**. Those decisions are suggestions to a person; execution always goes through a proposal ([ARCHITECTURE.md §12](ARCHITECTURE.md#12-human-approval-workflow)).
