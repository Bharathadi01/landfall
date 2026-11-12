# PayPal integration

> Describes the code at commit `f8f21a7`. **Everything runs against the PayPal Sandbox** (`api-m.sandbox.paypal.com`) with synthetic households. Sandbox transactions are play money: they are not humanitarian donations or disbursements. The host is chosen by `PAYPAL_ENV` (`sandbox` by default; `live` selects `api-m.paypal.com`), with a single credential pair, so environment separation is by deployment, not by code (`lib/paypal/client.ts`). Evidence labelled *owner-provided* comes from the project's own records and was **not** re-executed for this documentation, because re-running it would call PayPal.

## 1. Where PayPal is used, at a glance

| PayPal capability | Used for | Implementation | Status in this repository |
|---|---|---|---|
| OAuth 2.0 (client credentials) | Every server-to-PayPal call | `lib/paypal/client.ts` | Implemented; token cached, refreshed 5 minutes early, single-flight |
| **Orders v2 + Smart Buttons** | One-time donations | `lib/paypal/orders.ts`, `app/api/donations/*`, `components/donate/PayPalCheckout.tsx` | Implemented; renders on the public site (verified for this documentation) |
| **Subscriptions** | Monthly sustainer ($25) | `lib/paypal/subscriptions.ts`, `app/api/subscriptions/*`, `components/donate/PayPalSubscribe.tsx` | Implemented; activation re-checks PayPal server-side |
| **Payouts v1** | Relief payments, cancelling an unclaimed item | `lib/paypal/payouts.ts`, `lib/treasurer/` | Implemented; Treasurer-only; Sandbox batches recorded by the owner (§8) |
| Payouts reads | Status of batches and items | `lib/paypal/payout-reads.ts`, `lib/payouts/refresh.ts` | Implemented; paginated; read-only |
| **Webhooks** | Authoritative status pushes | `app/api/paypal/webhook/route.ts`, `lib/paypal/webhooks.ts` | Implemented; signature verified through PayPal's API; registration script `scripts/register-webhook.ts` |
| **Reporting** (balances, transactions) | Reconciliation | `lib/paypal/reporting.ts`, `lib/treasury/reconciler.ts` | Implemented; subject to PayPal's reporting lag |
| **Agent Toolkit** (`@paypal/agent-toolkit` 1.11) | The Case Officer reads PayPal's own transaction record | `lib/paypal/agent-toolkit.ts` | Implemented; **read-only**: only `transactions.list` is enabled |
| Vault v3 | Contingent "storm pledges" | `lib/paypal/vault.ts`, `lib/pledges/`, `app/api/pledges/*` | **Partly built, not operational.** Setup-token, create and revoke endpoints exist (no UI page calls them); the charge function `executeVaultOrderCapture` is called only from tests, so no pledge is ever charged. In Sandbox the setup-token call returns `403 NOT_AUTHORIZED` (needs PayPal underwriting; owner-provided) and the route then returns a clearly flagged simulated token (`isSimulated: true`) |
| Log in with PayPal | Verifies that a resident controls a PayPal account | `lib/paypal/identity.ts`, `lib/paypal/oauth.ts`, `app/api/auth/paypal/*` | Implemented as a verify-and-return step; **not persisted** (§7a). Not exercised for this documentation |

## 2. Donations in (Orders v2)

```
Browser (PayPal Smart Buttons)  ──createOrder──►  POST /api/donations/orders
                                                  └─► PayPal POST /v2/checkout/orders  (intent CAPTURE, USD, 2-decimal string)
donor approves inside PayPal's own window
Browser                         ──onApprove────►  POST /api/donations/capture
                                                  └─► PayPal POST /v2/checkout/orders/{id}/capture
                                                  └─► refuses unless status == COMPLETED and a capture exists (409 capture_incomplete)
                                                  └─► upsert `donations` (status, amount, sha256 of payer email)
PayPal                          ──webhook──────►  PAYMENT.CAPTURE.COMPLETED  (verified, claimed, idempotent)
                                                  └─► upsert donation + ledger tx_donation_capture_<order>
```

Server-side checks: the amount must be a two-decimal USD string (`^\d+\.\d{2}$`); both routes are rate-limited (10 per minute); the browser never supplies a status, only an order id. **The ledger posting happens on the verified webhook, not in the capture route**, so a donation whose webhook never arrives is recorded in `donations` but not in the ledger. Unapproved orders never reach the ledger. For one-time donations the payer's email is stored only as an unsalted SHA-256 hash in `donations.donor_email_hash`. The route sets no minimum or maximum amount beyond the two-decimal format.

## 3. Monthly sustainers (Subscriptions)

`POST /api/subscriptions/create` creates a billing subscription for a caller-supplied plan id and donor email, and inserts an `APPROVAL_PENDING` row (the donor email is stored **as typed**, in clear). The donor approves in PayPal's window. `POST /api/subscriptions/activate` takes **only the subscription id from the browser** (`^I-[A-Z0-9]{8,24}$`), asks PayPal for the subscription (status, plan, amount) and records *PayPal's* answer, only if `ACTIVE` or `APPROVED`. On a row that does not exist yet it stores the email as `sha256:<hash>`; on the normal path (the row was created a step earlier) the upsert only updates status and time, so the clear-text email from the create step remains. Lifecycle webhooks (`BILLING.SUBSCRIPTION.CREATED/ACTIVATED/CANCELLED/SUSPENDED/EXPIRED`) update the status through an out-of-order guard (`shouldUpdateSubscriptionStatus`); `PAYMENT.SALE.COMPLETED` posts `tx_sustainer_sale_<sale>` to the ledger. Activation itself moves no money. `POST /api/subscriptions/cancel` calls PayPal's cancel for any well-formed subscription id the caller sends, with **no check that the caller owns it** (the route is public and rate-limited to 6 per minute); see [SECURITY.md](../SECURITY.md) and [LIMITATIONS.md](LIMITATIONS.md).

## 4. Relief out (Payouts v1)

Only `lib/treasurer/` may call `createPayoutBatch`/`cancelPayoutItem` (architecture test, [ARCHITECTURE.md §1](ARCHITECTURE.md#architectural-invariants-and-how-each-is-enforced)). Read-only calls live in `lib/paypal/payout-reads.ts` so other modules can use them.

### Sending a batch

1. A coordinator **proposes** (`POST /api/proposals`); the server derives the plan from case data and server-side payout routes (receivers never leave the server), checks caps and duplicates, and stores a hash of the exact payload.
2. Two different people approve ([ARCHITECTURE.md §12](ARCHITECTURE.md#12-human-approval-workflow)); the second approval triggers `executeProposal`.
3. The Treasurer re-checks: hash equals the approved payload; no household already has a payment in `SUBMITTED/PENDING/UNCLAIMED/ONHOLD/BLOCKED`; emergency stop off; allocatable cash covers amounts plus fees with the reserve intact.
4. It writes an outbox entry **before** the network call, then sends **one** `POST /v1/payments/payouts` with `sender_batch_header.sender_batch_id` (≤ 30 chars, deterministic per activation and tranche) which is also sent as the `PayPal-Request-Id`. Items are `recipient_type` `EMAIL` or `PAYPAL_ID`; items routed to a MANUAL channel are not sent through PayPal.
5. The returned `payout_batch_id` and one `SUBMITTED` row per item are persisted (`payout_batch_records`, `payout_item_records`), idempotently.

### Idempotency, end to end

| Layer | Mechanism |
|---|---|
| Proposal | `action_proposals.idempotency_key` is unique; creating the same proposal returns the existing one. |
| Approval | One approval per person per proposal (`action_approvals_one_per_person` unique constraint). |
| Execution | `APPROVED → EXECUTING` is an atomic claim; a double click or two simultaneous second approvals execute once. |
| PayPal call | `PayPal-Request-Id` = `sender_batch_id`; PayPal itself rejects a repeated `sender_batch_id`. |
| Retry policy | `lib/paypal/client.ts` retries (max 2) only GETs and POSTs that carry a request id; a payment-creating POST without a key is never retried. On an unknown outcome the proposal becomes `FAILED` with "do not resend". |
| Household | The Treasurer refuses a household that already has a payment in flight. |
| Re-delivery | Every status observation is idempotent ([FINANCIAL_LEDGER.md §5](FINANCIAL_LEDGER.md#5-out-of-order-duplicate-unknown-and-mismatched-events)). |

### Unclaimed, returned, failed

* **UNCLAIMED** (recipient has no PayPal account or has not claimed; PayPal auto-returns after 30 days): the ledger holds the money in `payout_unclaimed`; the recovery rules forbid re-sending, and cancelling is allowed only when a barrier is reported or the window has run out. A cancel is a `CANCEL_ITEM` proposal; the Treasurer first **re-reads the item at PayPal** (`GET /v1/payments/payouts-item/{id}`) because the resident may have claimed it a minute ago, then `POST /v1/payments/payouts-item/{id}/cancel`; PayPal's confirmed status drives the ledger.
* **RETURNED / REFUNDED / REVERSED**: funds back to `paypal_available`.
* **FAILED / BLOCKED / ONHOLD / PENDING**: recorded; no money posted; flagged for a person. A replacement is a new `REISSUE` proposal with the original `sender_item_id` as lineage.

## 5. Status in: webhooks and refresh

Two routes feed the same store (`applyItemObservation`): the **verified webhook** (primary) and the **read-only refresh** (`GET /v1/payments/payouts/{id}` walking `page`/`page_size=100` with `total_required`, checking that the response names the batch we asked for and that the item count matches). Refresh has a 15-second per-batch cool-down, only touches batches Landfall itself recorded, and a PayPal error leaves stored statuses untouched. `POST /api/payouts/refresh` is operator-triggered; `POST /api/payouts/refresh-due` is a scheduler backstop (not scheduled by this deployment).

### Webhook receiver

Registered events (`scripts/register-webhook.ts`): `PAYMENT.PAYOUTSBATCH.{DENIED,PROCESSING,SUCCESS}`, `PAYMENT.PAYOUTS-ITEM.{BLOCKED,CANCELED,FAILED,HELD,REFUNDED,RETURNED,SUCCEEDED,UNCLAIMED}`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.{CREATED,ACTIVATED,CANCELLED,SUSPENDED,EXPIRED}` (18 types). Processing order and failure behaviour: [ARCHITECTURE.md §13](ARCHITECTURE.md#13-webhook-processing). A batch event records the batch header and then asks PayPal (read-only GET) for the items, so a batch event brings every item up to date.

## 6. Reconciliation (Reporting API)

`GET /v1/reporting/balances?currency_code=USD` and `GET /v1/reporting/transactions` feed `runTreasuryReconciliation`. Classification and limits: [FINANCIAL_LEDGER.md §7](FINANCIAL_LEDGER.md#7-reconciliation). PayPal's reporting balance lags, so freshly paid items usually show as `TIMING_DIFFERENCE` first.

## 7. The PayPal Agent Toolkit (AI, read-only)

`lib/paypal/agent-toolkit.ts` builds a `PayPalAgentToolkit` with exactly one action, `transactions.list`. The server fixes the arguments from a stored transaction id (30-day window, `page_size` 5, id validated against `^[A-Z0-9]{10,24}$`); the model never supplies them. Every write action (orders, payouts, invoices, subscriptions, refunds) stays disabled. The AI Case Officer uses it to show PayPal's own record of the payment next to Landfall's.

## 7a. Log in with PayPal (identity check)

`GET /api/auth/paypal/start` redirects to PayPal's authorisation URL; `GET /api/auth/paypal/callback` exchanges the authorisation code, reads the PayPal user-info (`payer_id`, `user_id`, `email`, `verified_account`, address), writes an `audit_events` row (`paypal_lipp_verified`: payer id, user id, verified flags) and **returns the result as JSON to the caller**, including a de-duplication key (`payer_id`, or `user_id:sha256(email)` when no payer id exists). What the code does **not** do, as read from the source:

* It does not write the `identity_links` table (defined in the schema, referenced by no application code), so a verified identity is not attached to a household record by this route.
* It does not check the `state` value against anything it issued; `state` is caller-supplied, defaulting to `lipp_<timestamp>`, and is only logged. The callback response also includes the email address and address PayPal returns. Both routes are classified `public` in the API access policy (`lib/auth/policy.ts`) and rate-limited to 20 requests per minute per client ([SECURITY.md](../SECURITY.md)).
* `redirect_uri` is accepted from the query string and passed to PayPal, which only honours URIs registered on the app.

Treat it as a working prototype of the identity check, not as a completed enrolment step ([LIMITATIONS.md](LIMITATIONS.md)).

## 8. Evidence register (owner-provided, not re-executed)

These rows are quoted from the project's own records ([LIVE_PROOF.md](LIVE_PROOF.md), [PAYPAL_EVIDENCE.md](PAYPAL_EVIDENCE.md), [PAYPAL_EVIDENCE_MANIFEST.md](PAYPAL_EVIDENCE_MANIFEST.md), the previous README). They are Sandbox facts.

| Item | Recorded evidence |
|---|---|
| Payouts batch `VTJG3SR5BY56C` | $500 total, 5 × $100. PayPal reported batch `SUCCESS` while only 1 of 5 items was `SUCCESS`, 3 `UNCLAIMED` and (after a cancellation run through the app) 1 `RETURNED`. Batch `SUCCESS` therefore did not mean "every household credited". |
| Payouts batch `A2CEQ8RQXTVNS` | $1 × 2 created through two server-verified approvals; `PROCESSING`, two `ITEM.SUCCEEDED` and `BATCH.SUCCESS` webhooks arrived at the deployed receiver and were verified through `verify-webhook-signature`. A repeated attempt returned `409 duplicate_blocked`. |
| Webhook registration | id `6HJ21518NN406061A` → `/api/paypal/webhook` (18 event types). |
| First live attempt | The Treasurer **refused** with `PAYLOAD_CHANGED` (plan id differed between proposal and execution); nothing was sent; fixed and covered by a regression test. |
| Orders / Subscriptions | An Orders v2 order and a subscription product/plan were created in Sandbox (ids in [PAYPAL_EVIDENCE.md](PAYPAL_EVIDENCE.md)). |
| Vault v3 | `POST /v3/vault/setup-tokens` returned `403 NOT_AUTHORIZED` in Sandbox. |

What this documentation itself verified: the Smart Buttons render on the live site; the webhook route's gating logic by reading the source and running its tests; the full suite against a disposable database ([TESTING.md](TESTING.md)). What it did **not** do: any PayPal call that writes, any payout, capture or refund.

## 9. Known restrictions and limits

* Sandbox only; fees seen in Sandbox are not a guide to live fees (the owner's batch showed $3.00 on $500, i.e. $2.00 on the credited item and $0.25 on each of four others; the code assumes fees are not refunded on a return).
* Payouts need a Sandbox business account with the Payouts product enabled, and Sandbox receivers configured server-side (`SANDBOX_RECEIVERS`). Households without a configured route cannot be paid (`NO_PAYOUT_ROUTE`).
* `PAYMENT.PAYOUTS-ITEM.*` statuses for a household with **no PayPal account** surface as `UNCLAIMED` for up to 30 days.
* The Reporting API can lag behind payouts, producing `TIMING_DIFFERENCE`.
* Vault-based pledges are not exercisable in Sandbox ([LIMITATIONS.md](LIMITATIONS.md)).
* The Agent Toolkit lookup uses a 30-day search window per PayPal's rules.
