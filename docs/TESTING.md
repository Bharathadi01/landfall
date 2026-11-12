# Testing

> Everything in the "Recorded results" section was produced by running the commands shown, on the commit this documentation was written against (`f8f21a7`, plus uncommitted documentation files only), on 2026-11-12. Nothing here is estimated. See [DEVELOPMENT.md](DEVELOPMENT.md) for setup.

## 1. Recorded results

Environment: macOS, Node v24.21.0, pnpm 12.10.1 (CI uses Node 22), PostgreSQL 16 in a disposable Docker container used by nothing else. Environment variables were the test values CI uses (`PII_ENCRYPTION_KEY`, `SESSION_SECRET`, `WEBAUTHN_*`, placeholder PayPal ids); **no real PayPal or Groq credentials were provided to the test run** and no test calls either service.

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0, no output (TypeScript strict) |
| `pnpm lint` (`next lint`) | exit 0: "✔ No ESLint warnings or errors" |
| `pnpm test` (`vitest run`) with `TEST_DATABASE_URL` set | **exit 0. `Test Files 79 passed (79)`, `Tests 735 passed (735)`, none skipped. Duration 33.28 s** |
| `pnpm vitest run --coverage` (what CI runs) | exit 0. 79 files, 735 tests. All of `lib/**`: **85.02 % statements, 79.88 % branches, 89.23 % functions, 85.02 % lines**. `lib/rules` and `lib/treasurer`: **100 / 100 / 100 / 100** (the two enforced thresholds in `vitest.config.ts`) |
| `pnpm build` (`next build`) | exit 0: "✓ Compiled successfully"; lint and type validity checked; 20 page and asset routes plus 49 API routes built; middleware 33.3 kB; first-load JS shared by all pages 106 kB |

The CI workflow (`.github/workflows/ci.yml`) runs type-check, `db:push`, build and the coverage run against a Postgres service container on every push and pull request to `main`. An earlier CI run of the same code reported the same count (735 passing).

Tests per area (from the run above):

| Area | Files | Tests | What it covers |
|---|---|---|---|
| `security` | 11 | 145 | access matrix, sessions, passkeys, demo key, encryption, resident codes, cron auth, audit redaction, HTTP error hygiene, adversarial/"hostile invariants" cases |
| `ai` | 14 | 113 | Groq wrapper (retry, ladder), input screening, Watch Officer and number integrity, Case Officer, investigator, Studio adapter, gateway and tool slimming |
| `payouts` | 5 | 55 | status precedence, store (replay, concurrency, stale events), refresh, import (opening journal), routes |
| `studio` | 3 | 51 | Studio data, answers, refusal rules |
| `sentinel` | 3 | 46 | exposure evaluation, NWS normalisation, replay |
| `paypal` | 8 | 40 | client resilience, webhook gate and payouts handling, payout reads, Agent Toolkit, route safety |
| `treasurer` | 2 | 38 | the only spender: boundary, recovery executors, caps |
| `treasury` | 4 | 35 | readiness, waterfall, reconciliation, second tranche |
| `recovery` | 3 | 33 | decision matrix |
| `recipients` | 2 | 31 | enrolment checks, complaints |
| `relief` | 4 | 29 | case model and access reports |
| `rules` | 3 | 24 | the rules engine and protocols |
| `workflow` | 3 | 19 | guided rehearsal and manifest verification |
| `proposals` | 2 | 16 | proposal flow and approvals |
| `ledger` | 2 | 12 | double-entry and "financial integrity" invariants |
| others | 10 | 48 | rehearsal, subscriptions, tour safety, impact, architecture boundary (5), UI static checks, validate, donations |

## 2. How to run

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm lint
pnpm test                       # DB-backed suites are SKIPPED without TEST_DATABASE_URL
```

To run **everything**, including the suites that write to a database, point `TEST_DATABASE_URL` at a *disposable* PostgreSQL database that contains nothing you want to keep (the suites delete and insert rows):

```bash
docker run --rm -d --name landfall-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=landfall -p 55432:5432 postgres:16-alpine
export TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/landfall
DATABASE_URL=$TEST_DATABASE_URL pnpm db:push --force
pnpm test
```

`tests/setup/db-guard.ts` makes this safe by default: without `TEST_DATABASE_URL`, `DATABASE_URL` is pointed at an unreachable address so an accidental database access fails fast, and the database suites are skipped rather than run against your configured database.

## 3. What the tests protect (by invariant)

| Invariant | Main tests |
|---|---|
| Every API route has an explicit access rule; sensitive routes are never public | `tests/security/access-matrix.test.ts` |
| Only `lib/treasurer/` can call PayPal write functions | `tests/arch/boundary.test.ts` |
| Two distinct approvers, one Finance; approval bound to the payload | `tests/proposals/approvals.test.ts`, `flow.test.ts`, `tests/security/passkeys.test.ts`, `demo-key.test.ts` |
| Ledger entries balance and are idempotent; the six payment stages stay separate | `tests/ledger/ledger.test.ts`, `financial_integrity.test.ts` |
| Payout status never regresses; replay and concurrency post money once; mismatches post nothing | `tests/payouts/status.test.ts`, `store.test.ts` |
| Webhooks are rejected without a valid signature and processed once | `tests/paypal/webhook-gate.test.ts`, `webhooks.test.ts`, `webhook-payouts.test.ts` |
| Payment-creating PayPal calls are never blindly retried | `tests/paypal/client-resilience.test.ts` |
| AI cannot state unsupported numbers or exceed the allowed action | `tests/ai/watch-officer-money.test.ts`, `case-officer.test.ts` |
| Money-moving or injection prompts are refused | `tests/ai/safety-guard.test.ts`, `studio-agent-security.test.ts`, `tests/security/red_team_adversarial.test.ts` |
| Rules engine and Treasurer are fully covered | coverage thresholds (100 %) in `vitest.config.ts` |
| No raw palette colours or unregistered icons in the UI | `tests/ui/no-raw-palette.test.ts`, `icon-registry.test.ts` |
| The guided tour never triggers a real payout | `tests/tour/safety.test.ts` |

## 4. What is not tested (read this before relying on the numbers)

* **No end-to-end or browser tests run in the suite or in CI.** `tests/e2e/` is empty and there are only two static UI checks. Browser-driven checks do exist as **standalone scripts** that need a running deployment and are not part of `pnpm test`: `scripts/tour-e2e.mjs` (guided tour), `scripts/judge-journey.mjs` and `scripts/judge-audit.mjs` (a judge's walkthrough with console errors, overflow and axe violations), `scripts/ux-audit.mjs` (layout overlap), and `scripts/live-payout-proof.mjs` / `live-recovery-proof.mjs` (**these create real Sandbox payouts through the app's own API**; they were not run for this documentation). `scripts/capture-docs-assets.mjs` takes the documentation screenshots; it is not a test.
* **No live PayPal in tests.** PayPal calls are mocked or injected. The Sandbox batches and webhook deliveries in [PAYPAL_INTEGRATION.md §8](PAYPAL_INTEGRATION.md#8-evidence-register-owner-provided-not-re-executed) are owner-provided evidence, not something the suite re-runs.
* **No live model calls in the suite.** Groq is injected or mocked, so the AI tests check the guards around the model, not how good it is. The one live-model measurement is the 60-prompt input-screening eval (`scripts/eval-safety.ts`, results in [AI_EVAL_RESULTS.md](AI_EVAL_RESULTS.md), run by the project on 2026-11-11 and not repeated here).
* **No load, performance, accessibility-audit or visual-regression tests** in the suite. (`@axe-core/playwright` is a dev dependency; it is not wired into a test.)
* **No tests for the Smart Buttons or any third-party widget**, nor for the WebAuthn flow in a real browser with a real authenticator.
* **Coverage is measured for `lib/**` only** (not `app/` or `components/`), and only `lib/rules` and `lib/treasurer` have an enforced threshold. Overall branch coverage is 79.88 %.
* **Database-backed suites need a database.** Without `TEST_DATABASE_URL` they are skipped and the run still reports success, so check the "skipped" count when you run locally. The recorded run above had none skipped.
* Passing tests show the code does what the tests say, **not** that it is secure or fit for real funds ([SECURITY.md](../SECURITY.md), [LIMITATIONS.md](LIMITATIONS.md)).

## 5. Notes on running the build locally

`next build` and `next lint` rewrite `tsconfig.json` (adding the generated types folder) when `NEXT_DIST_DIR` is set to anything other than `.next`. That change is a side effect, not intended; discard it before committing (`git checkout -- tsconfig.json`).
