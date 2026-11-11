# Live proof (PayPal Sandbox, deployed app)

Everything below was done through the deployed app's own API/UI at https://landfall-web-t5rw.onrender.com on
2026-11-11, with PayPal **Sandbox** (no real money). Scripts: `scripts/register-webhook.ts`,
`scripts/import-sandbox-batch.ts`, `scripts/live-recovery-proof.mjs`, `scripts/judge-journey.mjs`, `scripts/judge-audit.mjs`.

| Step | Result |
|---|---|
| Webhook registered with PayPal | id `6HJ21518NN406061A` → `/api/paypal/webhook` (18 event types); the old webhook.site test hook was deleted |
| Import of existing batch `VTJG3SR5BY56C` (read-only toward PayPal) | 5 items recorded: 1 `SUCCESS`, 4 `UNCLAIMED`; opening ledger journal `tx_opening_VTJG3SR5BY56C` (cash $4,488.94 = PayPal's balance) |
| Resident reports "I can't claim it" (no PayPal account) for `hh_tbw_002` | stored as resident-reported evidence; the case's barrier becomes `NO_PAYPAL_ACCOUNT` |
| Coordinator proposes "cancel unclaimed item" | the deterministic rules allow it only because of that report (29 days were left, so it was refused before the report) |
| Approvals | wrong PIN → 401; viewer → 403; coordinator approves; Finance approves → the Treasurer executes once |
| PayPal | item `FTM6GK53DC4RQ` cancelled; PayPal reports `RETURNED`; the case is `RETURNED`, treasury available $4,488.94 → $4,588.94 |
| Reconciliation afterwards | `TIMING_DIFFERENCE` of $100.00: PayPal's balance report had not yet shown the return (Reporting API lag); not counted as matched |
| Proposal | `13ae6928-fb3b-4d67-8311-d9c931f1697a`, status `EXECUTED` |

## Second proof: a new $1 × 2 payout through two approvals, then PayPal's webhooks (2026-11-11)
| Step | Result |
|---|---|
| Viewer tries to propose | 403 |
| Dana proposes `NEW_PAYOUT` (`hh_live_001`, `hh_live_002`, $1.00 each) | proposal created; the server derived the plan, the caps ($100/item, $50/proposal) and the payout routes (receivers never leave the server) |
| First attempt | Sam's approval executed but the Treasurer **refused with `PAYLOAD_CHANGED`**: nothing was sent. Cause: the plan id (part of the plan hash) differed between proposal time and execution time. Fixed (`planIdFor`), covered by an end-to-end regression test, and failed proposals can now be retried |
| Retry: Dana approves, Sam (finance) approves | the Treasurer sent PayPal batch **`A2CEQ8RQXTVNS`** once (`persisted: true`) |
| Same payout again | **409 `duplicate_blocked`** (the households have payments in flight) |
| PayPal's webhooks | `PAYMENT.PAYOUTSBATCH.PROCESSING`, two `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTSBATCH.SUCCESS` all arrived at `/api/paypal/webhook` and were **verified through PayPal's `verify-webhook-signature` API** (`webhook_events.verified = true`) |
| Re-delivered `PAYMENT.PAYOUTS-ITEM.RETURNED` (the earlier cancel, via PayPal's resend API) | verified and recorded |
| Ledger | cash −$2.04 (= $2.00 + PayPal's 2¢ fee × 2); paid out $102.00 |
| Reconciliation | `TIMING_DIFFERENCE` of $2.04: PayPal's balance report had not yet reflected the payments (never counted as matched) |

## Honest gaps
- Reconciliation reports a small `TIMING_DIFFERENCE` while PayPal's Reporting balance lags; it is not shown as "in sync" until the remainder is explained.
- All money is Sandbox; the households are synthetic profiles. No customer validation is claimed.
- The free Render database expires on 2026-12-11 (before judging ends 2026-12-15): upgrade or re-import before then.
- Defect found by the first live attempt and fixed: the plan-id mismatch above. A missing database constraint ("one approval per person") on the deployed
  database was also found earlier and added by hand and in the schema.
