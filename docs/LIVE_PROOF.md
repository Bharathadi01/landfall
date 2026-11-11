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

## Honest gaps
- No PayPal webhook for the cancel had been delivered to the app when this was written (`webhook_events` was empty).
  Statuses are recorded from PayPal's own response and read-only refreshes; webhook delivery is therefore **not yet demonstrated**.
- `PAYPAL_WEBHOOK_ID` must be set on the deployment for webhooks to verify (the receiver returns 4xx/5xx without it).
- A defect found during this run and fixed: the database lacked the "one approval per person" constraint on the deployed
  database (the app still required two *different* people); added by hand and in the schema.
- The new $1×2 payout batch has not been sent (needs `SANDBOX_RECEIVERS` on the deployment).
