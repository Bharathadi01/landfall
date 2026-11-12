# HTTP API reference

> Generated from the code at commit `f8f21a7`: **49 route files, 63 method/route pairs** under [`app/api/`](../app/api/). Access levels come from the single policy table in [`lib/auth/policy.ts`](../lib/auth/policy.ts); the access column below was produced by running every route through that table, not typed by hand. A test (`tests/security/access-matrix.test.ts`) walks `app/api` so a route without a rule is denied by default. This is an application-internal API for the Landfall web app, not a versioned public API: shapes can change with the UI.

## 1. Conventions

**Authentication.** A signed, HttpOnly, `SameSite=Lax` cookie `lf_session` (HMAC-SHA-256 over a JSON payload; 8-hour life, 2 hours for residents; `Secure` in production). There are four roles: `coordinator`, `finance`, `viewer` (read-only), `resident` (one household). On this deployment operator sessions are obtained by choosing a **demo persona** ([SECURITY.md](../SECURITY.md#authentication-today-is-demo-only)); residents sign in with a case reference and a six-digit code.

**Access levels** (`Access` in the policy file):

| Level | Who may call |
|---|---|
| `public` | Anyone. The route validates input and rate-limits. |
| `webhook` | PayPal. Authenticity is the PayPal signature check inside the route. |
| `cron` | A caller bearing `CRON_SECRET` (constant-time check, fails closed when unset); a coordinator or finance session is also accepted. |
| `operator` | Any signed-in console user: coordinator, finance or viewer. |
| `staff` | Coordinator or finance. |
| `finance` | Finance only (no route currently needs it exclusively; the second approval's role rule is enforced inside the approval route). |
| `resident` | A resident session (own household only). |
| `resident-operator` | A resident session for the own household, or any operator. Note that this includes the read-only `viewer` role. |

**Middleware** (`middleware.ts`) runs before every route: unknown API paths are denied; for unsafe methods carrying a session cookie it rejects cross-site requests (`Origin` / `Sec-Fetch-Site` check, 403 `cross_origin_blocked`); console pages redirect to `/signin` without a session. Routes then re-check access themselves (defence in depth) where noted.

**Rate limiting.** In-memory sliding window per instance (default 60 s), keyed by session id when there is one, else by client IP (`TRUSTED_PROXY_HOPS`). Over the limit → `429` with `Retry-After`. Because it is in memory it resets on restart and is not shared between instances ([LIMITATIONS.md](LIMITATIONS.md)). Limits are listed per route below (requests per minute).

**Errors.** Most routes answer failures with `{ "error": "<code>", "message": "<human text>", "ref": "<8 hex>" }` through `safeError`, which logs the real error server-side with that reference and never returns upstream (PayPal, Groq), SQL or stack text. Validation errors return `400 { error: "invalid_request", issues: [{ path, message }] }`. A few older routes return `{ error: "<text>" }`. Status codes below are the ones visible in the code.

**Read-only vs mutating** is stated for each route; "PayPal" in the side-effects column means the route makes a call to PayPal (only the ones marked *writes* can change anything there).

## 2. Public: weather, entry points

| Method | Route | Purpose | Access / limit | Input | Output | Errors | Side effects |
|---|---|---|---|---|---|---|---|
| GET | `/api/alerts` | Stored NWS alerts plus feed health | public, 60 | `mode` (LIVE / HISTORICAL_REPLAY / SYNTHETIC), `tranche1Only=true` | `{ alerts, count, activationsCount, nwsHealth, feedStatus{lastSyncAt,isStale,stalenessNotice} }` | 500 | Read-only (one outbound NWS health check) |
| GET | `/api/sentinel/live` | Unified weather intelligence and privacy-preserving clusters | public, 60 | `fundId`, `mode` (LIVE / HISTORICAL_REPLAY) | `{ success, weather, clusters, timestamp }` (clusters are computed from the **synthetic** household fixtures) | 500 | Read-only; calls NWS/NHC/Open-Meteo as needed |
| GET | `/api/sentinel/imagery` | Latest NASA GIBS satellite and RainViewer radar frame times | public, 60 | none | imagery payload with `state` | 502 when `state=error`; cached 60 s | Read-only |
| GET | `/api/sentinel/forecast-grid` | 48-hour wind/rain/cloud grid (Open-Meteo) | public, 60 | none | grid with `state`; an upstream failure is reported **in the payload**, status stays 200 | none | Read-only |
| GET | `/api/auth/session` | Who am I | public, 20 | cookie | `{ authenticated, session? }` | none | Read-only |
| POST | `/api/auth/session` | Sign in as a **demo persona** | public, 20 | `{ persona }` ∈ `dana-ortiz` (coordinator), `sam-patel` (finance), `judge-viewer` (viewer) | `{ ok, session }` + `Set-Cookie lf_session` | 400 `unknown_persona`; 403 `demo_sign_in_disabled` when `JUDGE_MODE_ENABLED=false` | Issues a session; stores nothing |
| DELETE | `/api/auth/session` | Sign out | public, 20 | none | `{ ok }` | none | Clears the cookie |
| POST | `/api/resident/session` | Resident sign-in | public, 12 | `{ ref, code }` | `{ ok, caseRef }` + cookie | 400; 401 identical text for "no such case" and "wrong code"; 429 `locked` after repeated wrong codes | Issues a 2-hour resident session |
| GET | `/api/judge/demo-resident` | The featured synthetic household's reference and code (also printed on `/judges`) | public, none | none | `{ ref, code }` | 403 when `JUDGE_MODE_ENABLED=false` | Read-only |
| GET | `/api/auth/paypal/start` | Redirect to Log in with PayPal | public, 20 | `state`, `redirect_uri` | 302 to PayPal | none | None |
| GET | `/api/auth/paypal/callback` | Finish Log in with PayPal | public, 20 | `code`, `state`, `error` | JSON with payer id, user id, email, name, address, dedup key | 400; 500 | Calls PayPal (token exchange, user-info); writes one `audit_events` row. `state` is not verified ([PAYPAL_INTEGRATION.md §7a](PAYPAL_INTEGRATION.md#7a-log-in-with-paypal-identity-check)) |

## 3. Public: donations and giving

| Method | Route | Purpose | Limit | Input | Output | Errors | Side effects |
|---|---|---|---|---|---|---|---|
| POST | `/api/donations/orders` | Create a PayPal order for the Smart Buttons | 10 | `{ amountUsd: "NN.NN", fundId? }` | `{ orderId, status, debugId }` | 400 validation; 500 | PayPal *writes* (creates an order). No Landfall row |
| POST | `/api/donations/capture` | Capture an approved order | 10 | `{ orderId }` | `{ orderId, status, captureId, amount, debugId }` | 400; 409 `capture_incomplete` (nothing recorded); 500 | PayPal *writes* (capture); upserts `donations` |
| POST | `/api/subscriptions/create` | Create a sustainer subscription | 6 | `{ planId, donorEmail, returnUrl?, cancelUrl?, amountMonthly? }` | `{ subscriptionId, status, approveUrl }` | 400 | PayPal *writes*; inserts `subscriptions` (`APPROVAL_PENDING`) |
| POST | `/api/subscriptions/activate` | Record an approved subscription (PayPal's answer, not the browser's) | 6 | `{ subscriptionId: "I-…" }` | `{ subscriptionId, status }` | 400; 409 `not_active`; 502 | PayPal read; upserts `subscriptions` |
| POST | `/api/subscriptions/cancel` | Cancel a subscription | 6 | `{ subscriptionId, reason? }` | `{ status: "CANCELLED", subscriptionId }` | 400 | PayPal *writes* (cancel); updates `subscriptions`. **No ownership check** |
| POST | `/api/pledges/setup-token` | Start a Vault setup token | 6 | `{ returnUrl?, cancelUrl? }` | PayPal response, or a flagged simulated token (`isSimulated: true`) when Sandbox refuses | 500 | PayPal *writes* (setup token) |
| POST | `/api/pledges/create` | Save a pledge with consent text | 6 | `{ setupTokenId, donorEmail, amountPerEvent, seasonCap, consentText, consentVersion?, hazardScope? }` | `{ success, pledge, consent }` (the whole pledge row) | 400; 500 | PayPal Vault exchange (failure is swallowed and the setup token id is stored instead); inserts `pledge_consents` and `storm_pledges`. Nothing ever charges a pledge |
| POST | `/api/pledges/revoke` | Revoke a pledge | 6 | `{ pledgeId }` | `{ success, message, pledge }` | 400; 404 | Updates `storm_pledges`. **No ownership check** |
| POST | `/api/validate` | Stakeholder feedback (consent required) | 5 | role, orgType, `problemToday` (10–1000 chars), optional `wouldUse` 1–5, `comments`, `contact`, `consent: true` | `{ ok: true }` (201) | 400; 503 | Inserts `validation_responses` |
| GET | `/api/validate` | Count of responses | 5 | none | `{ responses }` (count only) | none | Read-only |

## 4. Resident intake and self-service

| Method | Route | Access / limit | Purpose and input | Output / errors | Side effects |
|---|---|---|---|---|---|
| POST | `/api/recipients/enroll` | public, 6 | Enrol a household (`name`, `address` required; evidence, consent, payment channel, language, optional volunteer attestation; **no CAPTCHA or authentication**) | `{ success, householdId, status, evidenceLevel, emailVerificationPending, … }`; 400 | Inserts `households`, consents, location history, attestations, an email-verification token hash. Creates a default `funds` row if none exists. The verification token is returned **only outside production** (`devEmailToken`); no email is sent |
| POST | `/api/recipients/verify-email` | public, 10 | `{ token, householdId }` | `{ success, email, … }`; 400; 404 | Marks token used; sets `recipientPath=EMAIL_CLAIM`, bumps `recipient_version` |
| GET | `/api/recipients/case` | resident-operator, 60 | `?ref=` (a resident session defaults to its own household) | Plain-language case view; **404 for both "unknown" and "not yours"** | Read-only |
| POST | `/api/recipients/access-report` | resident-operator, 20 | Resident says "received" or "can't access" (with reason) | `{ report, case }` (201); 403 for `viewer`; 404 | Stores an `access_reports` row; changes a *recipient-reported* indicator only, never PayPal's status |
| POST | `/api/recipients/appeal` | resident-operator, 10 | `{ householdId, reason, category? }` | `{ appealId, caseReference, slaDeadline, … }`; 400; 404 | Inserts `appeals` (24-hour SLA). The `viewer` role passes the access rule |
| POST | `/api/recipients/reconfirm` | resident-operator, 10 | `{ householdId, newAddress?, newLat?, newLng?, isDisplaced? }` | `{ success, recipientVersion, … }`; 404 | Updates `households`; appends `location_history`. The `viewer` role passes the access rule |
| POST | `/api/recipients/complaints` | public, 6 | Grievance (`householdId`, category, description ≥ 5 chars, `contactEmail`) | `{ success, complaint }`; 400 | **Stored in process memory only** |

## 5. Console: read and investigate (operator)

| Method | Route | Limit | Purpose | Input | Output | Side effects |
|---|---|---|---|---|---|---|
| GET | `/api/cases` | 60 | Case list for every console screen | `?source=live\|replay` (else cookie `lf_source`, else live Sandbox if real payments exist, else replay) | Snapshot naming its source and when PayPal was last asked | Read-only |
| POST | `/api/cases/:ref/investigate` | 6 per session | **AI Case Officer** investigation of one payment | `{ language?: en\|es\|vi\|ht }` | Structured result: evidence-cited facts, clamped recommended action, tool calls, `answeredBy` (`model` or `deterministic`), integrity report ([AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)) | Reads status history, the PayPal payout item and the PayPal transaction (read-only); writes one `audit_events` row. 404 `not_found`; 503 |
| GET | `/api/recipients` | 30 | Household directory, PII masked | `status`, `path`, `channel`, `isDisplaced`; `decrypt=true` is honoured **only** if the server sets `PII_DECRYPT_ENABLED=true` | `{ count, recipients[] }` with masked receiver and ~1 km coordinates | Read-only; writes `pii_access_log` only when reveal is enabled (actor is fixed as `demo_operator`) |
| GET | `/api/recipients/access-report` | none | Resident reports for coordinators | none | `{ reports }` | Read-only |
| GET | `/api/recipients/appeal` | 30 | Appeals | `householdId?` | `{ appeals }` | Read-only |
| GET | `/api/recipients/complaints` | none | Own complaints (with `householdId`), or the masked full list for operators | `householdId?` | `{ complaints }` | Read-only |
| GET | `/api/payouts` | 30 | Recorded payout batches and items (ids, statuses, amounts, sync times; never addresses) | none | `{ batches[] }` | Read-only. 503 when unavailable |
| GET | `/api/proposals` | none | Recent proposals | none | `{ proposals }` | Read-only |
| GET | `/api/proposals/:id` | none | One proposal | uuid | `{ proposal }` | Read-only. 404 |
| GET | `/api/proposals/routes` | none | Which households have a server-side payout route, and the caps | none | `{ households[], maxItemCents, maxTotalCents }` (never a receiver address) | Read-only |
| POST / GET | `/api/treasury/reconcile` | 6 | Compare the ledger with PayPal's reporting balance | optional `{ startDate, endDate, forceFallback, actor }` (**`actor` is caller-chosen** and is recorded) | Reconciliation report (classification, remainder, exceptions) | PayPal read (Reporting); writes `audit_events`. GET and POST both run a pass |
| GET | `/api/treasury/waterfall` | 30 | Treasury waterfall (available → reserve → fees → committed → allocatable) | none | Waterfall plus sustainer/pledge counts | Read-only; may call PayPal Reporting when the ledger shows zero |
| POST / GET | `/api/watch-officer` | POST 6 per session, GET 30 | **AI Watch Officer** briefing / the latest stored run | POST `{ query?, fundId?, alertId?, scenarioId?, useLiveModel? }` | POST `{ analysis, auditRunId, modelUsed, latencyMs, evidenceSummary }`; GET latest run + suggested questions; 422 `refused` when the input screen blocks the question | POST writes `watch_officer_runs` and `agent_events`; may create the default `funds` row. Read-only toward money |
| POST | `/api/studio-llm` | 30 | Model gateway for the AG Studio agent (returns requested tool calls; executes none) | `{ input[], instructions?, tools?, toolChoice?, responseFormat? }` (body ≤ 120 000 chars) | model turn; `{ refused: true }` (200) for money-moving requests or blocked input | 400; 413; 429; 503 `model_unavailable`. No state |
| GET / POST | `/api/rehearsal` | 20 | Storm Drill: simulate a past storm through the response steps | `stormId`, `scenarioId`, `step` | Rehearsal result, `mode: HISTORICAL_REPLAY`, disclaimer | No state, no PayPal |
| POST | `/api/workflow/golden` | 8 | Guided Response rehearsal, up to 8 steps, **simulated PayPal sender** | `{ targetStage?: 1–8, donationAmountUsd? }` | Stage results | 403 when `JUDGE_MODE_ENABLED=false`; 400; 405 on GET. No PayPal call, nothing persisted |
| GET | `/api/workflow/manifest` | none | Evidence/rehearsal manifest and its verification | `profile=rehearsal`, `format=redacted` | `{ manifest, verification }` | Read-only |

## 6. Console: staff actions (coordinator or finance)

| Method | Route | Limit | Purpose | Input | Output / errors | Side effects |
|---|---|---|---|---|---|---|
| POST | `/api/proposals` | 10 per session | Propose a payment or recovery action | `CreateProposalInput` (kind `NEW_PAYOUT` / `CANCEL_ITEM` / `REISSUE`, targets, amounts) | 201 `{ proposal, created }` (200 when the same idempotency key already exists); 400 validation or a rule refusal | Inserts `action_proposals`; audit row. **Moves no money** |
| POST | `/api/proposals/:id/approve/options` | 20 per session | Begin a passkey approval (challenge bound to the payload hash) | none | `{ options, payloadHash }`; 404; 409 `not_open` / `no_passkey` | Inserts a single-use `webauthn_challenges` row |
| POST | `/api/proposals/:id/approve` | 8 per session and 30 per IP | Record an approval; **the second valid approval executes through the Treasurer** | `{ method: "WEBAUTHN", response }` or `{ method: "DEMO_KEY", pin }` | 200 `{ proposal, executed, ok, message }` (502 when execution failed); 401 `bad_credentials`; 403 `demo_key_disabled` / role; 404; 409 `not_open` | Inserts `action_approvals`; on the second approval, calls PayPal Payouts *writes* via `lib/treasurer` and posts ledger rows |
| POST | `/api/payouts/refresh` | 6 | Ask PayPal (read-only GET) for the latest status of recorded batches | `{}` or `{ paypalBatchId }` (must already be recorded); invalid JSON → 400 | `{ refreshed[] }`; 403 when `PAYOUT_REFRESH_ENABLED=false`; 404 unknown batch; 502 if PayPal errored; GET → 405 | PayPal read; updates payout records, status history and ledger |
| POST | `/api/alerts/exposure` | 20 | Evaluate one household (or a point) against one alert | `{ alertId, householdId?, lat?, lng?, isDisplaced? }` | `{ success, evaluation }`; 400; 404 | Read-only |
| POST / GET | `/api/alerts/replay` | 10 | Load the Milton 2024 replay (POST ingests it; GET lists it) | POST `{ autoActivate? }` | Replay package, tagged `HISTORICAL_REPLAY`; "no real payments are executed" | POST **writes** replay alerts and may create activations |
| POST | `/api/auth/passkey/register-options`, `/register-verify` | 10 | Register a WebAuthn passkey for the signed-in persona | `{ response }` | `{ options }` / `{ ok, credentialId }`; 400; 403 | Inserts `passkey_credentials` |

## 7. Scheduler (cron) and webhook

| Method | Route | Access | Purpose | Notes |
|---|---|---|---|---|
| GET / POST | `/api/alerts/poll` | cron (secret or staff session) | Poll NWS for Florida alerts, ingest them, evaluate activation | **GET also mutates** (it calls POST). 500 with `{ status: "error" }` on failure |
| POST | `/api/payouts/refresh-due` | cron | Refresh up to 5 recorded batches not synced in 10 minutes | 503 `cron_not_configured` when `CRON_SECRET` is unset; 401; 403 when disabled. Not scheduled on the free Render plan |
| POST | `/api/paypal/webhook` | webhook | Receive a PayPal event | See [ARCHITECTURE.md §13](ARCHITECTURE.md#13-webhook-processing). 400 invalid JSON / missing event id; 401 missing or failed signature; 503 when the webhook id is not configured; 200 on success or duplicate. Unverified events are stored with `verified=false` and change nothing |

## 8. Routes that exist in the access policy but not in the code

The policy lists `/api/grid/ask`, `/api/export/*` and other `/api/resident/*` routes, but no route files implement them. They would be denied by default today and the rules are placeholders for features described in older documents.

## 9. Known gaps visible in this API

Collected from the sections above and expanded in [SECURITY.md](../SECURITY.md) and [LIMITATIONS.md](LIMITATIONS.md):

* Public routes that change PayPal or stored state without an ownership check: `subscriptions/cancel`, `pledges/revoke`.
* `recipients/appeal` and `recipients/reconfirm` accept the read-only `viewer` role.
* Complaints are not persisted.
* Rate limits are per process.
* `treasury/reconcile` records a caller-supplied `actor`.
