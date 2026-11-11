# Landfall — PayPal Payout Status & Financial Reconciliation Audit

**Date:** 2026-11-11 · **Branch audited:** `feat/delivery-assurance` (HEAD `a17b3fd`) · **Method:** read-only source inspection, read-only SQL (`SET default_transaction_read_only = on`) against the configured database, safe local tests with PayPal credentials blanked, and PayPal's published API schema.
**Not done, by design:** no payout, no PayPal API call of any kind (not even a GET, because the client writes an audit row per call), no code or data modified, no commit, no deploy. Beneficiary emails and names are deliberately not reproduced here.

Evidence labels used throughout: **[CODE]** read in source · **[DB]** found in existing database rows · **[TEST-MOCK]** passes only against mocked PayPal responses · **[SANDBOX]** real PayPal Sandbox response persisted in the audit log · **[REPORTED]** claimed in docs, not independently verified · **[UNVERIFIED]** no evidence either way.

---

## A. Executive verdict

> **UPDATE 2026-11-11 (after remediation, Appendix 6): IMPLEMENTED BUT PARTIALLY VERIFIED.**
> Every defect below except D-6's historical rows has been fixed in the working tree (uncommitted) and is covered by tests: durable payout records, status refresh with pagination, atomic webhook updates, ledger postings, an honest reconciler, no fabricated ids. **What is still not proven:** (1) a PayPal-originated webhook delivered to the app's public receiver; (2) the refresh route run against real PayPal (only the single approved GET was made; the same response was replayed through the new code on a disposable database); (3) the new tables exist only on the disposable test database. The shared database needs `pnpm db:push` first.
>
> The text below is the original finding, kept unchanged for the record.

**ORIGINAL VERDICT (before remediation): PARTIALLY IMPLEMENTED.**

- The PayPal **client functions** for batch status (`getPayoutBatch`) and item status (`getPayoutItem`) exist and are correct for the endpoints they call. They have been run against the real Sandbox, by a developer script and by a diagnostic page, and 5 real GET responses were captured **[SANDBOX]**.
- But the **application never refreshes payout status as part of its own workflow**. Nothing in the product path calls those functions (`getPayoutItem` is called by nothing at all). The payout tables (`payout_batches`, `payout_items`) are **never written by any code**, so the webhook handler's `UPDATE payout_items` can never match a row, the Watch Officer's payout tool reads empty tables, and **no payout status, in any state, ever reaches the ledger**.
- Everything the user sees about individual payout statuses in Command Center, Studio, the resident page and the investigator comes from a **hand-written replay dataset** (`lib/studio/landfall-studio-data.ts`), not from PayPal.
- The $500 / five-recipient batch **`VTJG3SR5BY56C` was created for real**. *Update 2026-11-11:* after this audit was first written, one authorised read-only GET retrieved it (Appendix 4). PayPal reports the batch `SUCCESS` ($500.00, fees $3.00), but only **1 of 5 items is `SUCCESS`; 4 are `UNCLAIMED`** ($400 still claimable, auto-returns after 30 days). "Batch SUCCESS" therefore does not mean five households were credited.

What is genuinely strong: Payouts v1 creation with idempotency keys, PayPal-side duplicate rejection (proven 45 times in the audit log), a correct and tested status-precedence guard, signature-gated webhook intake, and a recovery decision table that forbids automatic re-payment.

---

## B. Capability matrix

| Capability | Implementation status | Source file | Test evidence | Finding |
|---|---|---|---|---|
| Payout creation | **Implemented, real Sandbox proven** | `lib/paypal/payouts.ts:111-128`; called from `lib/treasurer/index.ts:262` | [TEST-MOCK] `tests/treasurer/treasurer.test.ts`; [SANDBOX] 5 batches created (audit log) | `POST /v1/payments/payouts`, Zod-validated, `PayPal-Request-Id` = `sender_batch_id`. |
| Batch ID persistence | **Not implemented (durable)** | `lib/treasurer/index.ts:176,294-296` | [TEST-MOCK] only | Held in an **in-memory `Map`** outbox (lost on restart). `payout_batches` table exists but has **0 writers** and **0 rows** [DB]. Only durable trace is the generic `audit_events` log. |
| GET batch status retrieval | **Function exists; not wired into product** | `lib/paypal/payouts.ts:133-146` | **No test.** [SANDBOX] 29 captured calls from `scripts/spike-paypal.ts:207` and `app/spike/page.tsx:64` | Real, correct endpoint. Only callers are a spike script and a public diagnostic page hard-coded to one batch. No refresh route, no job. |
| Individual item retrieval | **Function exists; never called** | `lib/paypal/payouts.ts:151-164`; duplicate `lib/paypal/webhooks.ts:176-189` | None (imported in `tests/paypal/webhooks.test.ts:5-6` but not exercised) | Zero callers in `app/`, `lib/`, `scripts/`. Items are only seen as the `items[]` embedded in a batch GET. |
| Pagination | **Not implemented** | `lib/paypal/payouts.ts:133-146,99-103` | None | No `page` / `page_size` / `total_required` sent. Response schema omits `total_items` / `total_pages`, so Zod **strips** them. Batches over one page would be silently truncated. |
| Status persistence | **Not implemented** | `app/api/paypal/webhook/route.ts:95-111`; `lib/db/schema.ts:263-273` | Precedence logic [TEST-MOCK]; route path **untested** | The only writer is an `UPDATE` that needs a pre-existing row. No code inserts `payout_items` rows. In practice a no-op. |
| Webhook verification | **Implemented** | `app/api/paypal/webhook/route.ts:29-60`; `lib/paypal/webhooks.ts:23-42` | [TEST-MOCK] `tests/paypal/webhook-gate.test.ts` (3 reject paths). [SANDBOX] 5 `verify-webhook-signature` calls logged, incl. from simulated events | Server-side, via PayPal's verify API; 503 if `PAYPAL_WEBHOOK_ID` unset, 401 if headers missing or verification fails. No test of the **accept** path. A real PayPal-originated delivery to this receiver is **UNVERIFIED**. |
| Webhook event processing | **Partially implemented** | `app/api/paypal/webhook/route.ts:62-144` | Precedence [TEST-MOCK]; accept path only in DB-gated suite (skipped) | Item and batch events handled; dedupe is atomic. See defects D-3 (event loss on failure) and D-5 (non-atomic status update). |
| Double-entry reconciliation | **Implemented for donations/pledges only** | `lib/ledger/index.ts:85-122`; `lib/treasury/reconciler.ts:51-264` | [TEST-MOCK] `tests/ledger/ledger.test.ts`; DB-gated integrity suite skipped | Payout events **never post to the ledger**. `paid_out` / `returned` accounts are declared (`ledger/index.ts:13-14`) but never written. Reconciler compares **one balance** (`paypal_available`), not per-item amounts. |
| Idempotency | **Implemented, proven** | `lib/paypal/client.ts:145-147`; `lib/treasurer/index.ts:195-225,233` | [TEST-MOCK] six failure drills; [SANDBOX] 45 `USER_BUSINESS_ERROR: Batch with given sender_batch_id already exists` for `batch_TBW:HU.W:0009_t1` | Works at PayPal, which is the authoritative check. Local outbox is memory-only. |
| Exception investigation | **Implemented on replay data only** | `lib/ai/investigator/agent.ts:77`; `app/console/war-room/widgets/RecipientRescueQueue.tsx:89` | [TEST-MOCK] `tests/ai/investigator.test.ts` | The UI runs `runOfflineInvestigation` **in the browser** over the replay cases. It reads neither the DB nor PayPal. Watch Officer tool `get_payout_status` reads the empty tables (`lib/ai/watch-officer/tools.ts:361-478`). |
| Recovery safeguards | **Implemented** | `lib/recovery/decision.ts`; `lib/recovery/engine.ts` | [TEST-MOCK] `tests/recovery/*`, `tests/relief/cases.test.ts` | Strong: UNCLAIMED bars reissue; no status yields an automatic second payout. Dual-approval UI is demo-grade (passkeys not server-verified). |

---

## C. Actual execution traces

### 1. Creating a payout
`POST /api/workflow/golden` (`app/api/workflow/golden/route.ts`, POST-only, rate-limited, `JUDGE_MODE_ENABLED` switch) → `runGoldenWorkflow` stage 7 (`lib/workflow/golden.ts:362-404`, `executePlan` at `:385`) → `TreasurerEngine.executePlan` (`lib/treasurer/index.ts:183`): in-flight guard `:195`, outbox replay `:204-225`, `validatePreConditions` `:228` (emergency stop, readiness, plan-hash, two-key, allocatable, already-paid) → `senderBatchId = batch_${activationId}_t${tranche}` `:233` → outbox entry written *before* the call `:237-247` → `createPayoutBatch` (`lib/paypal/payouts.ts:111`) → `paypalFetch` POST `/v1/payments/payouts` (`lib/paypal/client.ts:128`), OAuth via `getClientCredentialsToken` `:42-114` (5-minute early refresh), `PayPal-Request-Id` header `:145` → response Zod-parsed → `paypalBatchId = batch_header.payout_batch_id` `:282` → outbox set to `SENT` in memory `:294-296`.
**Persistence reached:** in-memory outbox, plus one `audit_events` row per HTTP call (`client.ts:173-179`). **No `payout_batches`/`payout_items` row. No ledger entry.**
Environments: `PAYPAL_ENV === "live"` selects the live host, otherwise Sandbox (`client.ts:4-7`); one credential pair, switched by env var, so separation is by deployment, not by code.

### 2. Retrieving batch status
There is **no production trace**. Callers of `getPayoutBatch`: `scripts/spike-paypal.ts:207` (manual polling script) and `app/spike/page.tsx:64` (server-rendered diagnostic page for the fixed id `7Y5GP4ETNLCUQ`; each page view calls PayPal and writes an audit row). The id comes from a literal, not a persisted record. The response is Zod-validated (`GetPayoutBatchResponseSchema`, `payouts.ts:99`) but never stored by the app.

### 3. Retrieving individual item statuses
No trace exists. `getPayoutItem` and `fetchPayoutItemDetails` have no call sites. Item statuses are only visible via `items[]` inside a batch GET.

### 4. Processing a webhook
`POST /api/paypal/webhook` (`route.ts:12`) → parse → require `event.id` → require `PAYPAL_WEBHOOK_ID` (503) → require five PayPal headers (401) → `verifyWebhookSignature` → PayPal `POST /v1/notifications/verify-webhook-signature` (`webhooks.ts:23`) → on failure 401 → **`INSERT ... ON CONFLICT DO NOTHING` into `webhook_events` (`route.ts:63-74`)**, duplicate → 200 "already processed" → branch on `event_type`.

### 5. Updating the database (payout item event)
`route.ts:84-113`: `SELECT` item by `paypalItemId` → `shouldUpdatePayoutStatus(current, new)` (`webhooks.ts:70-96`) → `UPDATE payout_items SET status, lastEventAt`. Maps `SUCCEEDED→SUCCESS`, `HELD→ONHOLD` (`route.ts:91-92`). **If no row exists nothing happens, silently.** Batch events (`:116-144`) update items only if the payload carries an `items[]` array, which PayPal batch webhooks generally do not.

### 6. Reconciling the ledger
`POST/GET /api/treasury/reconcile` and Watch Officer `get_reconciliation_status` → `runTreasuryReconciliation` (`lib/treasury/reconciler.ts:51`): reads ledger balance of `paypal_available`, then PayPal `GET /v1/reporting/balances` and `/v1/reporting/transactions`, matches ledger entries to PayPal transactions by loose id containment (`:155-160`), reports discrepancy as the difference of two **balances**. Payout items take no part. In the golden flow, stage 8 (`golden.ts:406-440`) computes `ledgerDebit = ledgerCredit = totalOutflowCents` and declares "BALANCED" (`:423-425`): a number compared with itself. The code labels the webhook "SIMULATED", but the ledger line is still presented as an audit result.

### 7. Investigating an exception with AI
UI: `RecipientRescueQueue.tsx:89` → `runOfflineInvestigation` (client-side, deterministic) over `RELIEF_CASES` (replay data) → `evaluateRecoveryAction`. `can_reissue_now` is computed by the deterministic engine, not the model (`agent.ts` invariant 4). Watch Officer: 7 read-only tools — `get_disaster_context`, `get_exposure_summary`, `get_treasury_snapshot`, `get_policy_evaluation`, `get_payout_status`, `get_reconciliation_status`, `compare_response_scenarios` (`groq-client.ts:68-140`). No money, approval or ledger-write tool exists, and `tests/arch/boundary.test.ts` enforces that statically. `get_payout_status` reads empty tables; `get_reconciliation_status` is hard-wired to `fallbackToLedgerOnly: true` (`tools.ts:490`), so it never compares with PayPal yet marks its evidence `VERIFIED` when `isMatched` (`:510`).

---

## D. Missing or partial functionality

| # | Severity | Finding | Consequence |
|---|---|---|---|
| D-1 | **CRITICAL** | **No durable record of any payout.** `payout_batches`/`payout_items` have no writer [CODE, DB: 0 rows]. Outbox is in memory. Schema FKs (`payoutBatches.planId → payout_plans`, `payoutItems.householdId → households` uuid) cannot be satisfied by the golden flow's string ids. | Restart loses the batch id; webhooks cannot update anything; the Watch Officer sees "no payouts"; nothing ties PayPal state to a household. |
| D-2 | **CRITICAL** | **No payout state reaches the ledger.** No posting for submitted / credited / failed / returned / unclaimed; `paid_out` / `returned` unused. | "Reconciled" claims about payouts are unsupported. Requested, submitted, credited, returned and unresolved are not represented as distinct financial states. |
| D-3 | **HIGH** | **Webhook event can be lost.** The dedupe row is inserted (with `processedAt` set) *before* handling (`route.ts:63-78`) and not in a transaction. If handling throws (500), PayPal's retry hits the conflict and is acknowledged as "already processed". | A transient DB error permanently drops a status update. |
| D-4 | **HIGH** | **No status polling / recovery path** for missing or delayed webhooks, and PayPal sends no item event for `PENDING`. | Statuses can stay stale forever; the only fix is a manual script. |
| D-5 | **HIGH** | **Non-atomic status update** (`SELECT` then `UPDATE`, `route.ts:95-109`); `lastEventAt` uses receipt time, not the event's `create_time`; ordering relies on rank only. | Two concurrent events can overwrite each other; history is not preserved (no status-history table). |
| D-6 | **HIGH — FIXED locally 2026-11-11 (uncommitted; Appendix 5)** | **`/api/spike` and `/spike` were public** (no middleware, no auth) and return the latest 30 `audit_events` rows. Payout POST audit rows contain receiver addresses unredacted (60 rows with a `receiver` field; 27 batch-GET rows with email-like strings) [DB]. | Personal/sandbox recipient addresses and PayPal debug data readable by anyone who finds the URL. `requestRedacted` in `client.ts:171` does not actually redact. |
| D-7 | **HIGH** | **Reconciler reports success on failure.** The `catch` at `reconciler.ts:239-262` returns `isMatched: true`, `discrepancyCents: 0`, status `FALLBACK_LEDGER_ONLY`; the Watch Officer forces the fallback. | An outage or credential problem reads as "matched". |
| D-8 | **MEDIUM** | **Treasurer fabricates identifiers.** A replayed `SUBMITTING` entry returns `paypalBatchId: "RECOVERED_BATCH"` (`treasurer/index.ts:220`); a response without an id becomes `batch_${senderBatchId}` (`:282`); both are reported as success and the latter is even covered by a test. | A made-up id could be stored or displayed as a PayPal batch id. |
| D-9 | **MEDIUM** | **No pagination** and `total_items`/`total_pages` stripped by Zod (see matrix). | Large batches (PayPal allows up to 15 000 items) would be incomplete. |
| D-10 | **MEDIUM** | **Replay data is attached to a real batch id.** All 8 synthetic $500 items carry `BATCH-7Y5GP4ETNLCUQ` (`lib/studio/landfall-studio-data.ts:65…`), but PayPal's real `7Y5GP4ETNLCUQ` is a **$2.00, 2-item** batch [SANDBOX]. `PayoutHealthWidget` hard-codes real batch/item/tx ids and sandbox receiver addresses in client code. | A judge who looks up that batch finds a different amount and item count. |
| D-11 | **MEDIUM** | `transaction_status` is validated as free `z.string()` (`payouts.ts:72`); unknown statuses are accepted silently and the precedence table gives them rank 0. A stray comment lists `HELD`/`CANCELED`/`DENIED`, which are **not** in PayPal's item enum. | New or unexpected statuses would not raise an exception. |
| D-12 | **MEDIUM** | Test hygiene: tests with mocked `fetch` write to the real audit log (137 `actor=system … DUPLICATE_BATCH "Duplicate sender batch ID"` rows with empty bodies, a non-PayPal error shape; **inference**, not proven). The only `webhook_events` row is an unverified test fixture. | The audit log mixes mock and real traffic; do not cite it unfiltered. |
| D-13 | **LOW** | Golden flow stage 8 and docs describe "ledger reconciliation" as proof; passkeys are not server-verified (labelled "demo"). | Overstated assurance if presented without the label. |
| D-14 | **LOW** | Sender batch id is `batch_<activationId>_t<n>` with a 30-char cap enforced by Zod (`payouts.ts:20`); a long activation id would fail validation rather than truncate. | Operational edge case. |

---

## E. Hackathon demo readiness

| Claim to demonstrate | Status | Why |
|---|---|---|
| 1. A real PayPal Sandbox payout batch | **VERIFIED** | Real `POST /v1/payments/payouts` responses persisted [SANDBOX]: `DT5LUFX353YBU`, `CYX4HC52K54WN`, `WWN9FJ4KDJCHS`, `VTJG3SR5BY56C` ($500 plan, 5 items), `YK4N42RDMN8AY`, all returned `PENDING`. |
| 2. Provider-side item statuses | **VERIFIED for the $500 batch and four $1 batches (captured by script/GET, not by the product workflow)** | Real GET responses captured for the $500 batch (Appendix 4) and four **$1-scale** batches: `7Y5GP4ETNLCUQ` = batch `SUCCESS`, items `SUCCESS` + `UNCLAIMED`, both with transaction ids, fees 0.02 / 0.25; `CYX4HC52K54WN` item `SUCCESS` with tx id; `YK4N42RDMN8AY` `SUCCESS` + `UNCLAIMED`; `WWN9FJ4KDJCHS` `UNCLAIMED`. These were obtained by script/diagnostic page, not by the product workflow. |
| 3. Five individual payout records | **VERIFIED (2026-11-11 GET, Appendix 4)** | PayPal returned five items for `VTJG3SR5BY56C`, each $100.00 USD with an item id and transaction id: 1 `SUCCESS`, 4 `UNCLAIMED`. Captured once by an authorised read-only GET; not by the product workflow. |
| 4. Provider-to-ledger reconciliation | **UNVERIFIED / not implemented** | No payout posting exists; the ledger in the database holds 6 test-fixture pledge rows and zero payout rows [DB]; stage 8 is a self-comparison. A balance-level Reporting API comparison exists in code but has no persisted success run beyond 16 balance GETs. |
| 5. A genuine unclaimed or failed exception | **VERIFIED at $100 scale** | Four real `UNCLAIMED` $100 items in `VTJG3SR5BY56C` (Appendix 4), plus real `UNCLAIMED` $1 items (`2FN4JTY2SF8A2`, `3V9SN3NPZ2FBW`, `R6DYACGQ2V7FN`) and a real `FAILED` $1 item (`8WQLCJXZNPQF6`, batch `DENIED`). The 8-household exception cases shown in the UI are still replay data, not these items. |
| 6. AI-assisted exception investigation | **PARTIALLY VERIFIED** | Works and is safe, but on **replay cases, client-side, offline engine**. Live Groq path exists; no persisted provider evidence feeds it. |
| 7. Safe recovery with human authorisation | **PARTIALLY VERIFIED** | Recovery rules are strong and tested; the human-approval gate is real in the UI but passkeys are not verified server-side, and no recovery payout path is implemented to demonstrate. |

**Honest framing for judges:** "Landfall created real Sandbox payout batches and we have captured real provider item statuses — including a real UNCLAIMED payment — for small test batches. The Command Center's eight-household case view is a labelled replay dataset built to those provider semantics."

---

## F. Recommended improvements (smallest safe set, reuse existing code)

1. **Persist what PayPal returns** *(closes D-1; ~1-2 h)*. Add one idempotent writer that upserts `payout_batches`/`payout_items` from a batch response. Because the FKs need real plan/household rows, either relax them (nullable plan/household + a text `case_ref` = existing `sender_item_id`) or write to a new small `payout_observations` table keyed by `(paypal_batch_id, paypal_item_id)` that stores status, tx id, amount, currency and `observed_at`. Reuse `shouldUpdatePayoutStatus`.
2. **Add a read-only refresh** *(closes D-4, D-9; ~1 h)*. `POST /api/payouts/refresh` (rate-limited, no payout capability): `GET /v1/payments/payouts/{id}?page_size=…&total_required=true`, follow pages, validate, hand to the writer in (1). Add `total_items`/`total_pages` to the response schema. Use `getPayoutItem` only for single-item follow-up. Add Zod `transaction_status` enum + an "unknown status" exception.
3. **Do this once for batch `VTJG3SR5BY56C`** to obtain real item ids/statuses/tx ids for the $500 five-item batch — a read-only GET, then record it. This is the single most valuable evidence item for the video.
4. **Fix webhook ordering** *(closes D-3, D-5; ~1 h)*: perform dedupe + processing in one DB transaction (or insert the event only after success), use a single conditional `UPDATE … WHERE status IN (allowed prior states)`, store the event's `create_time`.
5. **Post payout states to the ledger idempotently** *(closes D-2; ~1-2 h)*: transaction ids like `payout_item_<id>_<status>` so replays are no-ops (existing `isTransactionRecorded`): submitted → committed, `SUCCESS` → `paid_out`, `RETURNED`/`REFUNDED`/`REVERSED` → `returned`, with `UNCLAIMED`/`PENDING` as in-flight, not paid.
6. **Make the reconciler honest** *(closes D-7)*: on error return `UNKNOWN`/`FAILED_TO_RECONCILE`, never `isMatched: true`; stop forcing `fallbackToLedgerOnly` in the Watch Officer; compare amount and currency per item.
7. **Close the data exposure** *(closes D-6; minutes)*: remove or auth-gate `app/api/spike/route.ts` and `app/spike/page.tsx`, and redact `receiver` (and any email-like value) in `paypalFetch` before `logAuditEvent`.
8. **Stop inventing ids** *(closes D-8)*: replace `RECOVERED_BATCH` and `batch_${senderBatchId}` with an explicit `UNKNOWN_BATCH_ID` state that triggers a lookup via the duplicate-batch `self` link.
9. **Stop mislabelling replay data** *(closes D-10)*: give replay items a clearly synthetic batch id; keep real ids only on a "real Sandbox test payouts" view.
10. **Gate tests that write the audit log** to the test database (extends the existing `TEST_DATABASE_URL` guard) *(D-12)*.

If time is short, do **3, 7 and the honest framing above**; they need almost no code and fix the biggest credibility and exposure risks.

---

## G. Final assessment

1. **Does Landfall already retrieve the latest PayPal payout status?** Only in a manual/diagnostic sense. `getPayoutBatch` is correct and has real Sandbox responses behind it, but the product never calls it as part of the workflow, so the app does not itself keep status current.
2. **Does it retrieve individual payout item statuses?** Not directly: `getPayoutItem` has no callers. It sees items only as `items[]` inside a batch GET, and only in the spike script/page.
3. **Does it rely only on the original creation response?** For product behaviour, yes: the only PayPal data the workflow keeps is the creation response in an in-memory outbox. The status shown across the UI is replay data.
4. **Does it use webhooks to update payout records?** The handler is written and correctly gated and de-duplicated, but it updates `payout_items` rows that nothing ever creates, so in practice it updates nothing. No real PayPal-originated delivery to the receiver is evidenced. (The only stored webhook row is an unverified test fixture.)
5. **Does it reconcile actual provider transaction evidence against the double-entry ledger?** No, not for payouts. The ledger records donations/pledges only; reconciliation compares one balance and falls back to "matched" on error; stage 8 of the guided flow compares a number with itself.
6. **Can we demonstrate these capabilities reliably during the hackathon?** The following can be shown honestly today: real batch creation with idempotency and PayPal's duplicate rejection; real captured item statuses including a genuine `UNCLAIMED` for the small test batches; correct status-precedence and recovery rules; the read-only AI refusing to move money. These cannot be shown honestly as implemented: live status refresh in the app, persisted payout records, webhook-driven updates, or provider-to-ledger payout reconciliation.
7. **What exactly should be improved before submission?** Priority order: (a) ~~fetch and record the real item statuses for batch `VTJG3SR5BY56C`~~ **done 2026-11-11 (Appendix 4)** — the finding is that the batch is `SUCCESS` with 1 credited and 4 `UNCLAIMED`, so the $500 wording must change; (b) ~~close the public `/api/spike` exposure and redact receivers in audit logs~~ **done locally 2026-11-11, uncommitted (Appendix 5)**; (c) add the read-only refresh route + persistence (items 1-2 above) so the app can show "refreshed from PayPal at <time>" for real batches; (d) fix the reconciler's false "matched" fallback and webhook event-loss window; (e) relabel replay data so it never shares a real PayPal batch id; (f) state plainly in the Devpost text that Command Center cases are replay data and that live webhook delivery and payout-to-ledger posting are not yet demonstrated.

---

## Appendix 1 — Status handling (PayPal item `transaction_status` per published schema)

PayPal's published values: `SUCCESS`, `FAILED`, `PENDING`, `UNCLAIMED`, `RETURNED`, `ONHOLD`, `BLOCKED`, `REFUNDED`, `REVERSED`. Webhook event names (published): `PAYMENT.PAYOUTS-ITEM.` + `BLOCKED`, `CANCELED`, `FAILED`, `HELD`, `REFUNDED`, `RETURNED`, `SUCCEEDED`, `UNCLAIMED`; batch events `DENIED`, `PROCESSING`, `SUCCESS`. There is no item event for `PENDING`, and no `REVERSED`/`ONHOLD` item event name in that list (the code handles them from `resource.transaction_status`).

| Status | Recognised (precedence table `webhooks.ts:49-63`) | Persisted in practice | Updates internal record | Ledger effect | Exception / recovery decision (`lib/recovery/decision.ts`) | Resident UI | Subsequent changes |
|---|---|---|---|---|---|---|---|
| SUCCESS | Yes (5) | **No** (no rows) | Only if row exists | **None** | Close / ask resident to confirm | Replay data | Only → REFUNDED/REVERSED allowed |
| PENDING | Yes (1) | No | Only if row exists | None | Wait and monitor | Replay data | Any higher rank accepted |
| UNCLAIMED | Yes (4) | No | Only if row exists | None | Bars reissue; contact recipient | Replay data (days-left clock) | → SUCCESS/RETURNED allowed |
| FAILED | Yes (6, terminal) | No | Only if row exists | None | New approved payout (human) | Replay data | Locked |
| RETURNED | Yes (6, terminal) | No | Only if row exists | None | Corrected retry after ledger confirmation | Replay data | Locked |
| ONHOLD | Yes (3) | No | Only if row exists | None | Escalate | Replay data | → higher ranks allowed |
| BLOCKED | Yes (3) | No | Only if row exists | None | Escalate | Replay data | → higher ranks allowed |
| REFUNDED | Yes (6, terminal) | No | Only if row exists | None | Handled in decision table | Replay data | Locked |
| REVERSED | Yes (6, terminal) | No | Only if row exists | None | Handled in decision table | Replay data | Locked |
| Unknown / other | Rank 0, accepted by schema (`z.string`) | — | — | — | `default` branch in decision table | — | **UNHANDLED: no exception raised** |
| `HELD`/`CANCELED`/`DENIED`/`PROCESSING` | Ranked, but not PayPal item statuses (they come from event suffixes / batch status) | — | — | — | — | — | Mapped `HELD→ONHOLD` only in the route |

**Provider-evidence limit (must stay visible in the product):** `SUCCESS` means funds were credited to the recipient's PayPal account. It is not evidence of withdrawal or of physical receipt of assistance. The delivery-assurance model keeps this as `PROVIDER` provenance and requires a separate `RECIPIENT_REPORTED` fact; this is covered by `tests/relief/cases.test.ts` ("PayPal SUCCESS is never treated as recipient-confirmed").

## Appendix 2 — Evidence inventory

**Real Sandbox POST responses [SANDBOX] (audit log):** 5 created batches (all `PENDING` at creation). 197 total POST attempts logged: 5 OK, 46 PayPal `USER_BUSINESS_ERROR` duplicates (45 for the golden-flow id — all rejected, no money created), 9 `VALIDATION_ERROR`, 137 `DUPLICATE_BATCH` rows of unclear origin (likely mocks, see D-12).

**Real Sandbox GET responses [SANDBOX]:** 29 batch GETs across 5 batches; item statuses as in section E; transaction ids present for `SUCCESS` and `UNCLAIMED` items, absent while `PENDING`. `7Y5GP4ETNLCUQ`: batch amount 2.00 USD, fees 0.27 USD, created 2026-11-08T22:31:56Z, completed 22:32:29Z.

**Database [DB], at audit time:** `payout_batches` 0, `payout_items` 0, `payout_plans` 0, `approvals` 0, `webhook_events` 1 (unverified test fixture, type `BILLING.SUBSCRIPTION.CREATED`), `ledger_entries` 6 (test-fixture pledge captures, 3 balanced pairs, none payout-related), `ledger_accounts` 3, `audit_events` 1 950.

**Tests run (credentials blanked, DB guard active, no network):**
`PAYPAL_CLIENT_ID= PAYPAL_CLIENT_SECRET= PAYPAL_WEBHOOK_ID= pnpm exec vitest run tests/paypal tests/treasurer tests/workflow tests/recovery tests/ledger tests/treasury tests/ai/investigator.test.ts tests/relief tests/subscriptions`
Result: **16 files / 129 tests passed; 3 files / 23 tests skipped; 0 failed.** DB-dependent tests (`tests/ledger/financial_integrity.test.ts`, `tests/subscriptions/*`, 3 in `tests/treasury/pledges.test.ts`) were **skipped** because `TEST_DATABASE_URL` is unset — deliberately, since those suites write rows. All executed tests are **[TEST-MOCK]** (mocked senders/fetch or pure functions). There is **no** test of `getPayoutBatch`, `getPayoutItem`, pagination, the webhook accept path with payout items, or any payout-to-ledger posting. `tests/workflow/manifest-verifier.test.ts` checks the structure of static manifest fixtures, not live PayPal data.

**Facts previously reported, now checked against PayPal:** that batch `VTJG3SR5BY56C` "completed $500 across five recipients" — **only partly true**: the batch status is `SUCCESS`, but 4 of 5 items are `UNCLAIMED` (Appendix 4). README wording ("Completed $500.00 USD (5 items) … `SUCCESS`, `UNCLAIMED`") should be corrected.

**Facts previously reported but still not independently verified:** that "webhook `6PH637488P683361F` verified live RSA-SHA256 signatures" (the registration and five verify calls are in the log, but the registration pointed at a third-party inspector and no PayPal-originated delivery to the app receiver is recorded); README/Devpost statements of payout-to-ledger reconciliation.

**Facts still requiring PayPal's Sandbox dashboard:** whether the four `UNCLAIMED` items' recipient accounts exist/can claim (the API only says "recipient does not have a PayPal account"); the dashboard's view of the debit and fees (the API reports fees $3.00).

## Appendix 3 — Disclosure

The audit log shows 45 repeat submissions of the same golden-flow batch id after the first success. PayPal rejected every one as a duplicate, so no extra money moved, and this is the idempotency control working. They are consistent with repeated runs of the guided workflow (including automated UI audits). Before this audit's earlier hardening, `GET /api/workflow/golden` could trigger a submission; it no longer can (`tests/paypal/route-safety.test.ts`).

## Appendix 4 — Verification of batch `VTJG3SR5BY56C` (2026-11-11, authorised)

**Authorisation:** one GET, no payout creation, no retries; the one resulting append-only audit entry approved.
**Method:** `getPayoutBatch("VTJG3SR5BY56C")` (`lib/paypal/payouts.ts:133`) run once via a throw-away script outside the repo, sandbox host, `PAYPAL_ENV` guard against live, no retry loop. HTTP **200**, PayPal `paypal-debug-id` **`f103819686f84`**. Response `payout_batch_id` **matches** the requested id.

| Field | Value (from PayPal) |
|---|---|
| Batch | `VTJG3SR5BY56C` · `batch_status` **SUCCESS** · `sender_batch_id` `batch_TBW:HU.W:0009_t1` |
| Amount / fees | **500.00 USD** / **3.00 USD** (= 2.00 + 4 × 0.25, consistent with item fees) |
| Created / completed | 2026-11-09T17:56:03Z / 2026-11-09T17:56:36Z |
| Items returned | **5**; HATEOAS links: `self` only (no `next`, so one page) |

| # | `payout_item_id` | `transaction_id` | `transaction_status` | Amount | Item fee | `sender_item_id` |
|---|---|---|---|---|---|---|
| 1 | `WMPFRHQ3EY2QQ` | `7UY263785W054201W` | **SUCCESS** | 100.00 USD | 2.00 | `TBW:HU.W:0009:t1:hh_tbw_001` |
| 2 | `FTM6GK53DC4RQ` | `75T85158X6122100W` | **UNCLAIMED** | 100.00 USD | 0.25 | `…:hh_tbw_002` |
| 3 | `9LHJK5CHQ28L2` | `7CB07045KK2710414` | **UNCLAIMED** | 100.00 USD | 0.25 | `…:hh_tbw_003` |
| 4 | `HUVCNGQV67X3A` | `4R824497CF5483216` | **UNCLAIMED** | 100.00 USD | 0.25 | `…:hh_tbw_004` |
| 5 | `CJHE7X4UEA65S` | `7P739657VA043154A` | **UNCLAIMED** | 100.00 USD | 0.25 | `…:hh_tbw_005` |

**What it proves:** the five-recipient $500 batch is real; PayPal credited **$100 (1 item)** and holds **$400 (4 items) as UNCLAIMED**, which PayPal returns to the sender if unclaimed for 30 days (about 2026-12-09). Item ids map to the app's deterministic `sender_item_id` pattern. **What it does not prove:** that the one credited household withdrew or received anything, or that the four unclaimed recipients can claim.
**Contradicts earlier material:** README/Devpost wording implying a completed $500 disbursement; the Command Center replay (3 `SUCCESS`, 5 non-success of 8 × $500) is a different, synthetic dataset and must not be presented as this batch's result.

**Audit trail (append-only, nothing edited or deleted).** `audit_events` went from **1 952 to 1 954** rows: exactly (1) `paypal_oauth_token_success` (actor `system`) and (2) `paypal_get__v1_payments_payouts_VTJG3SR5BY56C` (actor `audit_verification_approved`, debug id `f103819686f84`). The OAuth row exists because the app's client must fetch a client-credentials token before any authenticated call (the fresh process had no cached token); it is a token request, moves no money, and stores no secret. It was a second PayPal HTTP call beyond the single GET and should have been stated in the approval request.
**Redaction check on the new row:** stored response has 5 items, **0 `@` characters, 5 `[redacted-recipient]` markers**, ids/statuses/amounts intact.
**Observation (LOW, not changed):** `audit_events.created_at` is about 5 h 30 min behind true UTC (audit says 12:26:04Z for the POST that PayPal timestamps 17:56:03Z). Use PayPal's timestamps as authoritative.

## Appendix 5 — Exposure fix (2026-11-11, local, uncommitted)

| Change | File |
|---|---|
| Removed public diagnostics API that returned the latest 30 audit rows | `app/api/spike/route.ts` (deleted) |
| Removed public diagnostics page that rendered audit rows, webhook rows and made a live PayPal GET per view | `app/spike/page.tsx` (deleted) |
| Removed the now-dead "Money Trail" nav item and `/spike` shell special-case | `components/layout/UnifiedAppShell.tsx` |
| New pure redactor: recipient-type keys (`receiver`, `email`, `email_address`, `payer_email`, `recipient_email`, `donor_email`, `phone`, `phone_number`, `national_number`) become `[redacted-recipient]`; any email-like substring in any string becomes `[redacted-email]`; input never mutated | `lib/db/audit-redact.ts` (new) |
| `logAuditEvent` redacts request and response before insert (covers every PayPal call and every other audit writer) | `lib/db/audit.ts` |
| Tests: redaction (3) + guard that the spike routes no longer exist (1) | `tests/security/audit-redact.test.ts` (new) |

No authentication system exists in the app, so "authenticate" would have meant building one; removal was the minimal safe fix. **Historical audit rows are untouched and still contain unredacted recipient values** (60 payout-POST rows, 27 batch-GET rows at audit time); they are now unreachable through the app, but remain in the database until separately approved for cleanup. Two other things are unchanged by design: `scripts/*` that visit `/spike` (dev recorders) now point at a 404, and `scripts/verify-unified-navigation.ts` still lists `/spike`.

## Appendix 6 — Remediation (2026-11-11, working tree, uncommitted)

Verification environment: a throwaway `postgres:16-alpine` container on port 55432 (schema from `drizzle-kit push`); the shared dev database was **not** touched (audit rows still 1 954, ledger rows 6, no new tables there). PayPal was faked in every test; no payout, retry or other PayPal call was made by the fixes.

| ID | Finding | Fix | Where | Test evidence |
|---|---|---|---|---|
| D-1 | No durable payout record | New tables `payout_batch_records`, `payout_item_records`, `payout_status_history`; Treasurer records the accepted batch + one `SUBMITTED` item per payment right after PayPal accepts (also on duplicate-id recovery); persistence failure is reported, never fatal, never causes a resend | `lib/db/schema.ts`, `lib/payouts/store.ts`, `lib/treasurer/index.ts` | `tests/treasurer/treasurer.test.ts` (durable recording ×5), `tests/payouts/store.test.ts` |
| D-2 | No payout state reached the ledger | Idempotent, balanced journal entries on provider-confirmed states only (UNCLAIMED → held; SUCCESS → paid_out; RETURNED/REFUNDED/REVERSED → cash restored; fees posted); FAILED/PENDING/ONHOLD/BLOCKED post nothing; amount/currency mismatch blocks posting | `lib/payouts/status.ts`, `lib/ledger/index.ts` (+ accounts `payout_unclaimed`, `payout_fees`; `paid_out` now debit-positive, it had no postings) | `tests/payouts/status.test.ts` (16), `store.test.ts` |
| D-3 | Webhook event lost if handling crashed | Event is claimed with `processed_at = NULL` and marked processed only at the end; a retry of an unfinished event is processed, a finished one is acknowledged | `app/api/paypal/webhook/route.ts` | `tests/paypal/webhook-payouts.test.ts` (crash → 500 → retry applies the update) |
| D-4 | No way to refresh status / recover a missed webhook | `POST /api/payouts/refresh` + `refreshPayoutBatch`: read-only GET, only for batches Landfall recorded, per-batch cool-down, rate limit, kill switch `PAYOUT_REFRESH_ENABLED=false`; a batch webhook triggers it best-effort; `GET /api/payouts` lists stored records (no recipient data) | `lib/payouts/refresh.ts`, `app/api/payouts/*` | `tests/payouts/refresh.test.ts` (11), `routes.test.ts` (9) |
| D-5 | Non-atomic update, no history | Row lock (`SELECT … FOR UPDATE`) in one transaction with precedence guard, history row and ledger posting; webhook events ordered by PayPal `create_time` | `lib/payouts/store.ts` | 10 concurrent identical events → money posted once; stale/regression/revive cases |
| D-6 | Public audit exposure | Done earlier (Appendix 5) | | `tests/security/audit-redact.test.ts` |
| D-7 | Reconciler reported "matched" on failure | Failure → `UNVERIFIED`, `isMatched:false`; explicit ledger-only view is labelled and also never "matched"; matched transactions must agree on amount; Watch Officer no longer forces the fallback and only marks `VERIFIED` for a genuine `IN_SYNC` | `lib/treasury/reconciler.ts`, `lib/ai/watch-officer/tools.ts` | `tests/treasury/reconciliation.test.ts`, `pledges.test.ts` |
| **NEW** | `getAccountBalances` **invented a $5,000.00 balance** when PayPal failed, so the reconciler compared the ledger with made-up provider data (and the treasury waterfall could show $5,000) | Fallback removed: it now throws; callers already handled errors | `lib/paypal/reporting.ts` | reconciliation tests (UNVERIFIED path) |
| D-8 | Treasurer invented ids | An unresolved `SUBMITTING` entry or a response with no `payout_batch_id` returns `SUBMISSION_UNRESOLVED` (success:false), keeps the outbox closed to resends, and never fabricates `RECOVERED_BATCH` / `batch_<id>` | `lib/treasurer/index.ts` | `treasurer.test.ts` (Drill 5, missing id + retry-does-not-resend) |
| D-9 | No pagination; totals stripped | `getPayoutBatch(id, actor, {page, pageSize, totalRequired})`; schema keeps `total_items`/`total_pages`; refresh walks all pages, flags `ITEM_COUNT_MISMATCH` | `lib/paypal/payout-reads.ts` | `payout-reads.test.ts`, `refresh.test.ts` (3 pages, count mismatch) |
| D-10 | Replay data carried a real batch id | Replay batches renamed `REPLAY-BATCH-A/B`; PayPal batch ref shows "replay · no PayPal batch"; lifecycle widget no longer claims webhook/passkey verification for replay rows; payout widget now shows the **real** `VTJG3SR5BY56C` snapshot (1 credited, 4 unclaimed) with no recipient addresses | `lib/studio/landfall-studio-data.ts`, widgets | studio tests updated; browser check |
| D-11 | Unknown statuses accepted silently | Official-status enum + `normalizeItemStatus`; unknown values are flagged, audited, never overwrite a known status, never post money | `lib/payouts/status.ts` | `status.test.ts`, `store.test.ts` |
| D-12 | Tests wrote to the real audit log | Already prevented by the DB guard (`tests/setup/db-guard.ts`): audit rows stayed at 1 954 across all runs; DB suites only run against `TEST_DATABASE_URL` | | verified by row count before/after |
| D-13 | Golden stage 8 compared a number with itself | Builds the journal entries the plan implies (same rules as the live store) and checks their own debit/credit sums; labelled "rehearsal journal, not posted" | `lib/workflow/golden.ts` | `tests/workflow/golden.test.ts` |
| D-14 | sender_batch_id could exceed 30 chars | `makeSenderBatchId`: readable id when it fits (existing ids unchanged), stable hash otherwise | `lib/treasurer/index.ts` | `status.test.ts` |

Also changed: read-only PayPal calls moved to `lib/paypal/payout-reads.ts` so the architecture rule "only `lib/treasurer` imports the module that can create/cancel payouts" still holds while refresh code uses the GET (`tests/arch/boundary.test.ts` passes; a new test asserts the read module contains no write method). The refresh route rejects a malformed JSON body with 400 (found during manual testing: it had treated it as "refresh everything").

**Results.** `tsc` exit 0 · lint clean · production build OK (`/api/payouts`, `/api/payouts/refresh` present, `/spike` gone) · **405 tests pass without a database (84 skipped), 489/489 with a disposable database**. End to end on the disposable database: the real `VTJG3SR5BY56C` response (Appendix 4) replayed through the new refresh service produced 1 SUCCESS + 4 UNCLAIMED, batch `SUCCESS` $500.00 / fees $3.00, and ledger `paypal_available −50 300¢ = paid_out 10 000¢ + payout_unclaimed 40 000¢ + payout_fees 300¢` (balanced). Browser pass: 7 routes, 0 console errors, 0 HTTP 5xx, no horizontal overflow, `/spike` 404, golden flow stages 1-6 complete.

**Known limits (not fixed, by design).**
- The three new tables must be created on the shared database (`pnpm db:push`) and on Render before the Treasurer persists or webhooks update payout items; until then persistence reports `persisted:false` and a payout-item webhook returns 500 (PayPal retries; nothing is lost because the event stays open).
- Fees are posted when first seen and are not reversed on a return. `returned` ledger account and `waterfall.returnedCents` remain unused (returns restore `paypal_available` instead).
- The refresh/webhook paths were exercised against fakes plus one replay of a real response; a live PayPal-originated webhook to a public URL is still undemonstrated.
- Historical `audit_events` rows (60 payout-POST, 27 batch-GET) still contain unredacted recipient values; they are unreachable through the app. Cleanup needs separate approval.
- **Disclosure:** during manual testing a malformed curl body made the (since-fixed) refresh route run against a server holding the placeholder credentials `fake:fake`. That caused two OAuth token requests to PayPal's Sandbox, which were rejected; no payout API was called, no real credentials were used, and the writes went to the disposable database only.
