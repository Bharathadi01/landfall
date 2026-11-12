# Development guide

> Verified by running the commands below on macOS with Node v24.21.0 and pnpm 12.10.1 (CI uses Node 22). Related: [TESTING.md](TESTING.md), [DEPLOYMENT.md](DEPLOYMENT.md), [CONTRIBUTING.md](../CONTRIBUTING.md).

## Prerequisites

* **Node.js 22+** and **pnpm 12.x** (`pnpm-workspace.yaml` allows the `esbuild` and `sharp` build scripts).
* **PostgreSQL 16.** The simplest route is Docker; any local Postgres works.
* Optional, for the features that call out: a **PayPal Sandbox** app (client id and secret), a **Groq** API key, an **AG Grid Enterprise** licence key and an **AG Studio** key. Without them the app still runs: PayPal screens that need credentials report the problem, AI surfaces show their labelled deterministic fallbacks, and AG Grid/Studio show AG's evaluation notice.

## First run

```bash
git clone https://github.com/Bharathadi01/landfall.git
cd landfall
pnpm install

# a throw-away database
docker run -d --name landfall-dev-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=landfall -p 5432:5432 postgres:16-alpine

cp .env.example .env.local        # then edit: see the minimum below
pnpm db:push --force              # create the 44 tables from lib/db/schema.ts (there are no migrations)
pnpm dev                          # http://localhost:3000
```

### Minimum `.env.local`

| Variable | Why |
|---|---|
| `DATABASE_URL` | Defaults to `postgres://postgres:postgres@localhost:5432/landfall` |
| `PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | The settings schema requires a non-empty value; CI uses `test_client_id`. Real Sandbox credentials are needed for donations, payouts and webhooks |
| `SESSION_SECRET` | 16+ characters; required in production, a fixed development value is used otherwise |
| `PII_ENCRYPTION_KEY` | Set one even in development so you never rely on the source-code fallback (see [SECURITY.md](../SECURITY.md)) |
| `JUDGE_MODE_ENABLED=true` | Enables the one-click demo personas used to sign in |

Everything else is optional; each variable is explained in [`.env.example`](../.env.example). **Never commit `.env.local`.**

### Signing in locally

Open `/signin` and choose a persona (Dana Ortiz, coordinator; Sam Patel, finance; or the read-only Judge), or visit `/judges` for the test card with demo references, resident codes and the demo approval PIN (`246810` by default). Residents sign in with a case reference and code at `/r/enroll?tab=status`.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development, build, production server |
| `pnpm exec tsc --noEmit` | Type-check (strict) |
| `pnpm lint` | `next lint` |
| `pnpm test` | Unit and integration tests (DB suites need `TEST_DATABASE_URL`; see [TESTING.md](TESTING.md)) |
| `pnpm test:coverage` | Tests with the enforced 100 % thresholds on `lib/rules` and `lib/treasurer` |
| `pnpm db:push` | Apply `lib/db/schema.ts` to `DATABASE_URL` |
| `pnpm cron:poll` | Calls `/api/alerts/poll` and `/api/payouts/refresh-due` on `APP_URL` using `CRON_SECRET` |

Two gotchas: setting `NEXT_DIST_DIR` (for a second server) makes `next build` and `next lint` rewrite `tsconfig.json`; discard that change. And never point `TEST_DATABASE_URL` at a database you care about.

## Useful scripts (`scripts/`)

| Script | Purpose | Safe to run? |
|---|---|---|
| `register-webhook.ts <url>` | Lists (dry run) or registers (`--apply`) the PayPal Sandbox webhook; prints the id for `PAYPAL_WEBHOOK_ID` | Dry run reads only; `--apply` writes to PayPal Sandbox |
| `import-sandbox-batch.ts` | Imports an existing Sandbox payout batch into Landfall's records and ledger (reads PayPal, writes your database) | Writes to your database |
| `eval-safety.ts` | Runs the 60-prompt input-screening eval against Groq | Calls Groq |
| `capture-docs-assets.mjs`, `docs-assets.py` | Regenerate the documentation screenshots and preview GIF | Read-only toward the target; see the header comments |
| `judge-journey.mjs`, `judge-audit.mjs`, `tour-e2e.mjs`, `ux-audit.mjs` | Browser walkthroughs and audits of a running deployment | Read-mostly; they act like a visitor |
| `live-payout-proof.mjs`, `live-recovery-proof.mjs` | **Create real Sandbox payouts** through the app's API | **No** unless you mean to |
| Others (`record-*`, `capture-*`, `verify-*`) | Earlier recording, capture and verification scripts, kept as history; some have machine-specific default paths | Read before running |

## Code map

See the annotated tree in the [README](../README.md#repository-map) and [ARCHITECTURE.md](ARCHITECTURE.md). The two rules that matter most when changing code: money moves only through `lib/treasurer/` (a test enforces it), and AI code gets read tools only ([AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)).
