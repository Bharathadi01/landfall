# Landfall — Cash Before the Storm. Ready Before the Warning.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript Strict](https://img.shields.io/badge/typescript-strict-blue.svg)](tsconfig.json)
[![Tests](https://img.shields.io/badge/tests-684%20passing-brightgreen.svg)](tests/)
[![AI Inference Cost](https://img.shields.io/badge/AI%20Cost-%240.00%20(Groq%20Free)-success.svg)](docs/M6_ZERO_COST_VERIFICATION.md)

> **"Cash before the storm. Accounted for on every payout state."**  
> Landfall is an open-source, PayPal-native relief payout recovery and assurance platform for community relief organisations. It turns official hazard intelligence into a transparent, policy-constrained, human-authorized cash response — and ensures every relief obligation remains provably accounted for, even when a payout fails, remains unclaimed, or is held.

---

## Try it (no setup)

**Live demo:** https://landfall-web-t5rw.onrender.com — open the **[judge test card](https://landfall-web-t5rw.onrender.com/judges)**.
The free server sleeps when idle, so the first request can take ~30 s.

**Fastest way in:** press the orange **Take the tour** button at the bottom right of any page. Landfall signs you in read-only and walks the whole product by itself (13 steps, about 2½ minutes), with a badge on every screen saying whether you are looking at real PayPal Sandbox data, live feeds, live AI, replay data or a simulation. It cannot pay, approve, refresh PayPal or change data; Esc exits.

Or go manually:

1. **Sign in** as a demo persona (Dana = coordinator, Sam = finance, Judge = read-only). The server enforces each role.
2. **Command Center → Cases**: five *real* PayPal Sandbox payments (batch `VTJG3SR5BY56C`): one credited, three unclaimed and one returned (PayPal's current statuses). The live Cases view also includes two $1 Sandbox payouts from a separate batch. Open one and press **Investigate with AI**: a `gpt-oss-120b` agent reads the stored evidence, PayPal's live item status and PayPal's own transaction record (through the official **PayPal Agent Toolkit**), cites every fact, and drafts a resident message in EN/ES/VI/HT. It cannot change anything.
3. **Be the resident** (codes on the judge card): see the status, report "I can't get to it".
4. **Recover**: as Dana, propose cancelling the unclaimed payment (the rules allow it only because of that report); approve as Dana, then as Sam (demo PIN on the card). The Treasurer cancels it at PayPal once and the ledger returns the funds. This was done live: see [docs/LIVE_PROOF.md](docs/LIVE_PROOF.md).

What is real vs. simulated is labelled on every screen. Honest limits are in [docs/LIVE_PROOF.md](docs/LIVE_PROOF.md#honest-gaps) and [docs/AI_EVAL_RESULTS.md](docs/AI_EVAL_RESULTS.md).

---

## The Core Thesis & System Flow

```mermaid
flowchart TD
    subgraph ExternalOfficial["1. Official Hazard Data (NOAA / NWS / NHC)"]
        NWS["NWS Active Warnings\n(/alerts/active)"]
        NHC["NHC Tropical Cyclone GIS\n(120h Track & Cone GeoJSON)"]
        Radar["NOAA nowCOAST WMS\n(Base Reflectivity Mosaic)"]
    end

    subgraph DeterministicCore["2. Deterministic TypeScript Engines (No AI)"]
        Geo["Turf.js Spatial Engine\n(Masked Centroid Clustered Exposure)"]
        Treasury["Treasury Waterfall Engine\n(Available vs Reserves vs Contingent)"]
        Rules["Policy Allocation Engine\n($100 Base + Tiers / Waitlisting)"]
        Ledger["Double-Entry General Ledger\n(Immutable Audit Trail)"]
    end

    subgraph AIAdvisor["3. Bounded AI Operational Scrutiny (Groq Free $0)"]
        WatchOfficer["Watch Officer Copilot\n(openai/gpt-oss-20b)"]
        PlanReviewer["Plan Reviewer\n(Solvency Margin & Redundancy Check)"]
        IntegrityGuard["Server Integrity Filter\n(Database Truth Overrides LLM Text)"]
    end

    subgraph Governance["4. Cryptographic Human Governance"]
        Passkeys["FIDO2 / WebAuthn Dual Passkeys\n(Coordinator + Finance Approver)"]
        HashLock["Plan SHA-256 Hash Lock\n(Any Data Change Invalidates Approval)"]
    end

    subgraph PayPalRails["5. PayPal Developer Platform (Sandbox)"]
        Orders["Orders v2\n(Donation Influx)"]
        Payouts["Payouts v1 Batch\n(Idempotent Relief Outbox)"]
        Webhooks["Webhook Verification\n(v1/notifications/verify-webhook-signature)"]
        Reconciliation["Reporting API v1\n(Automated Ledger Reconciliation)"]
    end

    ExternalOfficial --> DeterministicCore
    DeterministicCore --> AIAdvisor
    AIAdvisor --> Governance
    DeterministicCore --> Governance
    Governance --> PayPalRails
    PayPalRails --> DeterministicCore
```

**The Core Operating Rule:**  
*Official data informs. Deterministic policy decides. AI explains and challenges. Humans authorise. PayPal moves money. Reconciliation verifies.*

---

## Target Audience

Landfall is engineered specifically for:
- **Local mutual-aid funds & community foundations**
- **Faith-based disaster relief ministries**
- **Grassroots volunteer disaster coordinators**

*Scope Boundary:* Landfall does not claim to replace national agencies (FEMA, Red Cross) or enterprise multi-program platforms (AidKit). It is purpose-built for agile local funds who need free, transparent, PayPal-native infrastructure to protect their own communities.

---

## 60-Second Quickstart

### Prerequisites
- Node.js >= 20.x
- `pnpm` >= 9.x
- Docker (for local Postgres database)
- Free Groq Cloud API Key (`GROQ_API_KEY`) for AI inference ($0.00 cost)
- PayPal Developer Sandbox Client ID & Secret

### Setup in 5 Steps

```bash
# 1. Clone repository
git clone https://github.com/Bharathadi01/landfall.git
cd landfall

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and GROQ_API_KEY

# 4. Start local Postgres database and push schema
docker run -d --name landfall-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=landfall postgres:16-alpine
pnpm db:push

# 5. Run tests & start development server
pnpm test
# Database-backed suites (payout store, webhook→ledger, reconciler) only run against a DISPOSABLE database:
#   docker run -d --name landfall-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=landfall_test -p 55432:5432 postgres:16-alpine
#   DATABASE_URL=postgres://postgres:test@localhost:55432/landfall_test pnpm db:push
#   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/landfall_test pnpm test
pnpm dev
# Open http://localhost:3000
```

---

## Live Status & Empirical Evidence Matrix

Everything below runs against the PayPal **Sandbox** (`api-m.sandbox.paypal.com`) with synthetic households. Nothing here is production, and no customer validation is claimed. 'Verified' means we called the API and recorded the result; rows that are code-only say so.

| Capability / API | Status | Evidence / Sandbox ID | Technical Notes |
|---|---|---|---|
| **PayPal OAuth 2.0** | **VERIFIED** | `lib/paypal/client.ts` | In-memory token cache with expiration buffer; concurrency safe |
| **PayPal Payouts v1** | **VERIFIED** | Batch `VTJG3SR5BY56C` ($500.00, 5 × $100), `7Y5GP4ETNLCUQ`, `CYX4HC52K54WN`, `WWN9FJ4KDJCHS`, `YK4N42RDMN8AY` | Real Sandbox batches. PayPal reports `VTJG3SR5BY56C` as batch `SUCCESS`, but **1 of its 5 items is `SUCCESS` (credited), 3 are `UNCLAIMED` ($300 returns to the sender after 30 days) and 1 is `RETURNED` ($100, after a cancellation we ran live)**, read back from PayPal with `GET /v1/payments/payouts/{id}` on 2026-11-12. Batch fees are $3.00 (the credited item $2.00, four items at $0.25). The $1 batches also show `SUCCESS` and `UNCLAIMED` items. Batch `SUCCESS` is not 'every household credited'. |
| **PayPal Batch Payouts** | **VERIFIED** | Batch `7Y5GP4ETNLCUQ` ($2.00 total) | Item `FR7DHMX8QE59A` (`SUCCESS`, $1.00); Item `2FN4JTY2SF8A2` (`UNCLAIMED`, $1.00) |
| **PayPal Orders v2** | **VERIFIED** | Order `35996334K7032164X` | Created in Sandbox (`POST /v2/checkout/orders`); requires buyer authorization before capture; unapproved orders strictly segregated from ledger cash |
| **PayPal Subscriptions v1**| **VERIFIED** | Product `PROD-4HV976845W620203M`, Plan `P-5A327449X7452233TNLYQY3A` | Monthly sustainer billing for standby liquidity |
| **PayPal Webhook Verification** | **VERIFIED (live Sandbox)** | webhook `6HJ21518NN406061A`, `app/api/paypal/webhook/route.ts`, `docs/LIVE_PROOF.md` | Every event is verified through PayPal's `verify-webhook-signature` API before it touches the ledger (unsigned/unverified requests are rejected). Real events from batch `A2CEQ8RQXTVNS` (PROCESSING, 2× ITEM.SUCCEEDED, BATCH.SUCCESS) and a re-delivered ITEM.RETURNED were received and recorded as verified. |
| **PayPal Vault v3 (Pledges)** | **RESTRICTED / CODE COMPLETE** | `lib/pledges/index.ts` | Sandbox `POST /v3/vault/setup-tokens` returns `403 NOT_AUTHORIZED` (requires custom merchant underwriting); badged as *"Production path — Requires PayPal Vault approval"* |
| **Double-Entry General Ledger** | **VERIFIED** | `lib/ledger/index.ts` | Balanced debits and credits; immutable audit trail; negative balance guards |
| **Treasury Waterfall Engine** | **VERIFIED** | `components/treasury/TreasuryWaterfall.tsx` | Segregates available, committed, reserved, contingent, and disbursed funds |
| **Treasury Reconciliation** | **VERIFIED** | `lib/treasury/reconciler.ts` | Ledger vs `/v1/reporting/balances` & `/transactions`; SHA-256 audit log |
| **Sentinel NWS Alert Ingestion** | **VERIFIED** | `lib/sentinel/weather-client.ts` | Live `api.weather.gov/alerts/active` polling with RFC 7231 User-Agent |
| **Turf.js Exposure Engine** | **VERIFIED** | `lib/sentinel/exposure.ts`, `lib/sentinel/clusters.ts` | Privacy-preserving 0.01° centroid grid snapping; zero PII leakage |
| **Storm Readiness Drill** | **VERIFIED** | `lib/rehearsal/lab.ts`, `/console/rehearsal` | 3 historical hurricanes (Milton, Helene, Idalia) + 7 stress scenarios |
| **Two-person approval** | **BUILT · tested; live Sandbox demonstration pending** | `lib/proposals/`, `lib/security/webauthn.ts`, `lib/treasurer/recovery.ts`, `/console/proposals` | Money moves only through a *proposal*: a coordinator proposes, two different people (one Finance) approve the exact payload hash, and only the Treasurer executes, once. The server verifies each approval (a WebAuthn passkey over a single-use challenge bound to the payload hash, or a **labelled demo PIN** fallback), takes the approver's role from the signed session, and enforces one approval per person in the database. Approvers are demo personas. Tests: `tests/proposals/*` (idempotent proposal, single-flight execution, no double ledger posting on a later `RETURNED` webhook, PayPal-outage handling). |
| **Watch Officer AI Copilot** | **VERIFIED (live Groq call recorded in `docs/AI_VERIFICATION.md`)** | `lib/ai/watch-officer/`, `lib/ai/groq.ts` | Read-only tools, strict JSON schema, stable evidence ids, server-side number/evidence integrity check. The page shows whether the model or the labelled offline template answered; opening the page never starts a run. |
| **AI Case Officer** | **VERIFIED (live Groq call)** | `lib/ai/case-officer/`, `/console/cases/[ref]` | `gpt-oss-120b` tool loop (stored case, status history, live PayPal item status, recovery rules) then a strict JSON answer. Facts without cited evidence, or with numbers not in the evidence, are dropped and counted; the recommended action is clamped to what the deterministic rules allow; the drafted resident message (EN/ES/VI/HT) is never sent automatically. Falls back, labelled, to deterministic rules. |
| **Command Center + AG Studio** | **VERIFIED** | `app/console/war-room/`, `components/studio/`, `ag-studio-react@3.1.0` | Case-level AG Grid Enterprise (row grouping, master/detail evidence, grand total, status bar, side bar, Excel/CSV export, saved grid state); AG Studio with custom widgets and a Studio Agent that calls the model through a server gateway and Studio tools (read-only; refuses money-moving requests). Requires AG licence keys. |
| **PayPal Agent Toolkit** | **VERIFIED (read-only)** | `lib/paypal/agent-toolkit.ts` | Official `@paypal/agent-toolkit`; only `transactions.list` is enabled (no write action), arguments fixed server-side. Used by the AI Case Officer for PayPal's own transaction record. |
| **AI input screening** | **MEASURED** | `lib/ai/safety/guard.ts`, `docs/AI_EVAL_RESULTS.md` | Regex → Groq Prompt Guard 2 → `gpt-oss-safeguard-20b` policy check. On 60 author-written prompts: 29/30 attacks blocked, 0/30 benign blocked (regex alone: 8/30). Small sample; defence in depth only. |
| **Stakeholder feedback** | **BUILT · no responses claimed** | `/validate`, `docs/VALIDATION_KIT.md` | Consent-gated form; the public count is read from the database and is 0 until real people answer. |
| **Relief Delivery Assurance** | **VERIFIED (live Sandbox + replay)** | `lib/relief/cases.ts`, `lib/recovery/decision.ts`, `components/relief/` | One case per payment, joined from approval, PayPal item, webhook, ledger, resident report and recovery. A PayPal `SUCCESS` is shown as 'credited', never as 'received'; provenance (PayPal / Landfall / Resident-reported / Operator) is kept per fact and missing evidence is shown as Missing. |

---

## Data Provenance & Truth Invariants

Every piece of data in Landfall is visibly badged in the UI according to its origin:

- `[LIVE]`: Direct real-time feed from official public agencies (NWS, NHC) or PayPal Sandbox.
- `[STALE]`: Cached official records when upstream provider is unreachable or updates are pending.
- `[REPLAY]`: Verified historical archives (e.g. Iowa Environmental Mesonet Milton 2024 records).
- `[DEMO PERSONA]`: Fictional household profiles used for testing and UI demonstrations.
- `[SANDBOX]`: Non-production financial transactions executed on PayPal's test sandbox.

### Financial Math & Fee Truth
- Standard relief grant: **$100.00**
- PayPal payout fees observed on the real Sandbox batch `VTJG3SR5BY56C` ($500, five $100 items): **$3.00 in total**, which is $2.00 on the item that was credited and $0.25 on each of the other four. Sandbox fees are not a guide to live fees.
- So the fee overhead on that batch is **0.6%**, and it varies by item status. We do not claim a flat per-item fee.

---

## The Five Inviolable Invariants

Enforced continuously via static AST analysis in `tests/arch/boundary.test.ts`:

1. **Rules decide money:** AI never sets eligibility, priority tiers, or disbursement amounts.
2. **AI cannot approve:** AI has zero write tools and cannot approve payout plans.
3. **AI cannot move money:** Deterministic core modules (`lib/rules/`, `lib/ledger/`, `lib/treasurer/`) never import AI SDKs.
4. **Dual-custody human sign-off:** Payouts require two distinct human passkey approvals over a locked plan hash.
5. **Database truth over model output:** Server-side number integrity filters override any hallucinated currency values with database ground truth.

---

## AI Architecture ($0 Free Tier Inference)

| Role / Subsystem | Execution Model | Provider & Model | Operational Boundaries |
|---|---|---|---|
| **Watch Officer** | Remote LLM Copilot | Groq Cloud Free (`openai/gpt-oss-20b`) | Synthesizes alerts, exposure, and cash constraints; read-only tools; zero money movement authority. |
| **Hazard Briefing** | Remote LLM Assistant | Groq Cloud Free (`openai/gpt-oss-20b`) | Summarizes official NWS warning text with exact meteorological citations and issue timestamps. |
| **Plan Reviewer** | Remote LLM Assistant | Groq Cloud Free (`openai/gpt-oss-20b`) | Scrutinizes payout proposals for solvency risk, duplicate address clusters, and anomalous claims. |
| **Relief Communications** | Remote LLM Assistant | Groq Cloud Free (`openai/gpt-oss-20b`) | Multilingual SMS/email notices strictly grounded in ledger records. |
| **Deterministic Offline Fallback** | Local TypeScript Code | Local / Rule-Based | 100% deterministic local fallback triggered on network timeout or rate limits. |

**Total AI Inference Cost:** Strictly **$0.00**.

---

## Product Surfaces

1. **Resident Assistance Portal (`/r/enroll`):** Mobile-first, 5-language intake portal (`en`, `es`, `ht`, `vi`, `zh`) with primary vs displaced address separation and 24h appeals tracking (`/r/complaints`).
2. **Coordinator War Room (`/console/war-room`):** Real-time command center featuring interactive MapLibre weather map, AG Grid & AG Charts telemetry, AG Studio canvas, and Watch Officer assistant.
3. **Rehearsal Lab / Storm Drill (`/console/rehearsal`):** Pre-season rehearsal simulator testing historical storms against 7 operational stress scenarios.
4. **Donor Experience (`/`):** Interactive PayPal Sandbox donation widget with real-time liquidity ladder counters.

---

## Testing & Quality Gates

```bash
# 1. Non-interactive ESLint Check
$ pnpm lint
✔ No ESLint warnings or errors

# 2. Strict TypeScript Typecheck
$ pnpm exec tsc --noEmit
# Exit code 0 (0 errors)

# 3. Vitest Test Suite (Unit, Integration, Architectural)
$ pnpm test
 Test Files  63 passed | 11 skipped (74)
      Tests  586 passed | 114 skipped (700)   # DB suites need TEST_DATABASE_URL; all 700 pass when it is set (re-run 2026-11-12, disposable Postgres)

# 4. Next.js Production Build
$ pnpm build
   ✔ Finalizing page optimization
```

---

## Master Documentation Library

### Core Technical & Architectural Verification
- [Judge Evidence Pack (Master Source of Truth)](docs/JUDGE_EVIDENCE_PACK.md)
- [Release Candidate Red-Team Audit Report](docs/RELEASE_CANDIDATE_AUDIT.md)
- [Baseline & Implementation Status](docs/BASELINE_AND_IMPLEMENTATION_STATUS.md)
- [Financial Integrity & Accounting Architecture](docs/FINANCIAL_INTEGRITY.md)
- [PayPal Payouts v1 Status Mapping & Semantics](docs/PAYPAL_STATUS_MAPPING.md)
- [Payout Recovery Decision Matrix (18 Rules)](docs/RECOVERY_DECISION_MATRIX.md)
- [Proof-Carrying Relief Recovery Workflow](docs/RECOVERY_WORKFLOW.md)
- [PayPal Evidence & Sandbox Register](docs/PAYPAL_EVIDENCE.md)
- [Groq AI Investigator Verification Report](docs/GROQ_END_TO_END_VERIFICATION.md)
- [AI Investigator Live Demonstration Script](docs/AI_INVESTIGATOR_DEMO_SCRIPT.md)
- [Relief Money Investigator AI Architecture](docs/AI_INVESTIGATOR.md)
- [AG Studio & AG Grid Integration Report](docs/AG_STUDIO_INTEGRATION.md)
- [Official 3-Minute Submission Video Script](docs/SUBMISSION_VIDEO_SCRIPT.md)
- [Comprehensive Demo Rehearsal Runbook](docs/DEMO_REHEARSAL.md)

### Impact, Innovation & Market Validation
- [Reproducible Impact Benchmark (25 Scenarios)](docs/IMPACT_BENCHMARK.md)
- [Ideal Customer Profile (ICP) & Buyer Definition](docs/ICP_AND_BUYER.md)
- [Operator Discovery Script](docs/OPERATOR_DISCOVERY_SCRIPT.md)
- [Operator Validation Evidence Log](docs/VALIDATION_EVIDENCE.md)
- [Non-Money-Moving Pilot Protocol](docs/PILOT_PROTOCOL.md)
- [Competitive Positioning & Primary Source Matrix](docs/COMPETITIVE_POSITIONING.md)
- [Innovation Claim & Prior Art Analysis](docs/INNOVATION_CLAIM_AND_PRIOR_ART.md)
- [Design QA & Accessibility Audit](docs/DESIGN_QA.md)
- [Final Grand Prize Readiness Report](docs/FINAL_READINESS.md)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
