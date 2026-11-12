# Limitations

> The honest list. Everything here was verified against the code at commit `f8f21a7` or observed while writing the documentation, unless marked *(maintainer to confirm)*. Nothing here is hidden elsewhere: the claims on the README and in [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) are bounded by this page. Security-specific gaps are in [SECURITY.md](../SECURITY.md) and [THREAT_MODEL.md](THREAT_MODEL.md).

## 1. What Landfall is not (yet)

* **Not a production system.** It runs against the **PayPal Sandbox**, with **synthetic households** and a **historical replay** (Hurricane Milton, 2024). No real donation was taken, no real family was paid, and no humanitarian outcome is claimed anywhere in this repository. See [DATA_PROVENANCE.md](DATA_PROVENANCE.md).
* **Not independently reviewed.** No external security review, accessibility audit, load test or financial audit has been done.
* **No user or pilot results.** `validation_responses` stores consented feedback, but this documentation reports no count and claims no adoption, savings or speed-up.

## 2. Demo-grade controls that must change before real use

(Full detail in [SECURITY.md](../SECURITY.md#known-gaps-verified-in-the-code-not-yet-fixed).)

| # | Limitation |
|---|---|
| 1 | **No production authentication.** Operators sign in by choosing a fictional persona (`JUDGE_MODE_ENABLED=true` on the demo); turning that off leaves no operator sign-in at all. |
| 2 | **Public demo approval PIN** (`246810`) in the repo and on the judge card; disabled automatically only when `PAYPAL_ENV=live`. |
| 3 | **PII encryption key falls back to a constant in the source** when `PII_ENCRYPTION_KEY` is unset (not set in `render.yaml`). Payment receivers and coordinates are stored in clear text. |
| 4 | **Rate limits, resident lockouts and complaints are in process memory.** They reset on restart and are not shared between instances. |
| 5 | **Public state-changing endpoints without ownership checks:** subscription cancel, pledge revoke. The read-only `viewer` role can post appeals and reconfirmations. |
| 6 | **Public enrolment has no abuse control** beyond a per-address rate limit. |
| 7 | **Passkeys are covered by tests but not demonstrated** on the deployment (relying-party settings are left to the maintainer, *to confirm*). |

## 3. Features that are partly built or not wired in

| Area | State |
|---|---|
| **Storm pledges (Vault)** | API endpoints and tables exist; **no page uses them and nothing ever charges a pledge** (`executeVaultOrderCapture` is called only from tests). In Sandbox the Vault setup call is refused (`403 NOT_AUTHORIZED`, owner-provided); the route then returns a flagged simulated token. `pledge_charges` is unused. |
| **Log in with PayPal** | Verify-and-return only. Nothing is stored against a household (`identity_links` unused), `state` is not verified, and the response carries the user's email and address. |
| **Email verification of a household's PayPal address** | A token is generated and hashed, but **no email or SMS is sent** by any code; outside development the token is not returned either, so the flow cannot complete. `messages` is unused. |
| **Resident messages** | The Case Officer *drafts* a message in four languages; the application sends nothing. |
| **Voice reporting** | The data model has a `voice` channel (transcript, translation) and the speech-to-text model is configured, but no code path records or transcribes audio. |
| **Complaints** | Accepted and listed, but kept in memory only; lost on restart. |
| **Resident sign-in** | Resolves a case reference against the case snapshot (replay and recorded Sandbox payments). A household enrolled through the form is stored but does not receive a code or appear as a case by itself. |
| **Scheduled refresh** | `payouts/refresh-due` and `alerts/poll` need an external scheduler; the free Render plan has none (`scripts/poll-alerts.mjs` can be run from any scheduler with `CRON_SECRET`). Without it, statuses update from webhooks or the "Refresh from PayPal" button. |
| **AI modules** | `lib/ai/communication.ts`, `hazard-briefing.ts` and `plan-review.ts` have tests but no caller. The deterministic investigator widget (`RecipientRescueQueue`) and seven other war-room widgets are not mounted by any page. |
| **Database tables** | 11 of 44 tables are unused by application code ([DATA_MODEL.md §2](DATA_MODEL.md#2-table-inventory)). |
| **Policy placeholders** | The API access table lists `/api/grid/ask` and `/api/export/*`, which have no implementation. |
| **Declared but unused dependencies** | `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`, `ai`, `@paypal/paypal-js` and `geist` are in `package.json` but imported nowhere in the application. The README's technology list excludes them. |

## 4. Known display and data issues

* **Landing "Relief board" card is static**, drawn from the replay dataset, with no "replay" label on the card itself; its coverage ring does not vary with the data.
* **Storm Desk layers depend on third parties.** During this documentation, NASA GIBS satellite imagery returned HTTP 504 and Open-Meteo returned 429 to the deployment's address; the desk reported those layers unavailable.
* **Payments → "Money trail" tab** showed layout defects at 1440 px wide when captured, so it is not in the screenshot gallery.
* **Two treasury computations** (the ledger waterfall and the live-treasury reading with a 30 % floor) can give different "allocatable" figures ([FINANCIAL_LEDGER.md §6](FINANCIAL_LEDGER.md#two-treasury-computations-a-known-inconsistency)). The Watch Officer's integrity check assumes a fixed $25 fee reserve and $2.25 per household.
* **AG Grid Enterprise / AG Studio licence keys** are supplied by environment variable and none is in the repository; without a valid key AG's evaluation notice stays visible. *(Maintainer to confirm the deployment has valid keys.)*
* **Money amounts use several representations** (numeric dollars, integer cents, text); conversions are tested but not unified.

## 5. Financial and integration limits

* **Sandbox only.** Fees, delays and statuses seen in Sandbox are not a guide to live behaviour. Caps (`LIVE_PAYOUT_MAX_ITEM_CENTS` $100, `…_TOTAL_CENTS` $50 per proposal as deployed) are deliberately tiny; the variable names say "LIVE" but the demonstration is Sandbox.
* **A household can be paid only if the server has a payout route for it** (`SANDBOX_RECEIVERS`); the demo has only the few the maintainer configured.
* **PayPal Reporting lags**, so fresh payments often reconcile first as `TIMING_DIFFERENCE`.
* **Unclaimed payouts** stay claimable for 30 days; Landfall deliberately does not resend or cancel while the window is open and no barrier is reported.
* **The fee assumption** (fees are not refunded when a payment is returned) is a modelling choice, not confirmed live behaviour.
* **Webhook freshness** is not enforced (no maximum event age); replay protection relies on event ids, idempotent ledger ids and status precedence ([THREAT_MODEL.md T2](THREAT_MODEL.md)).

## 6. AI limits

* The model providers are external and the free tier rate-limits; fallbacks are labelled.
* The input-screening eval is 60 author-written prompts; the Watch Officer and Case Officer answers have **no quality evaluation** ([AI_ARCHITECTURE.md §5](AI_ARCHITECTURE.md#5-what-is-not-claimed)).
* Input screening fails open when its models are unreachable (read-only assistants only).

## 7. Operations and process

* **No migrations**; `drizzle-kit push` only. **No backup or restore procedure.** The Render free database is not intended for production.
* **No end-to-end tests in CI**; browser audit scripts exist but are manual ([TESTING.md §4](TESTING.md#4-what-is-not-tested-read-this-before-relying-on-the-numbers)).
* **No dependency vulnerability scan** was run for this documentation.
* **No observability beyond logs:** errors are logged with a short reference; there is no metrics, tracing or alerting service.
* **Repository hygiene:** `scripts/` holds many one-off capture, recording and verification scripts from earlier phases (some with machine-specific default paths, for example `capture-all-screenshots.ts`), and the repository root contains a stray `test_warroom_studio.png`. Many files in `docs/` are older milestone and audit reports that predate the current code; use [docs/README.md](README.md) to find the current set and treat the rest as history.
* **Accessibility and performance** were checked during development with browser scripts but no results are recorded in the repository and **none is claimed here**.
