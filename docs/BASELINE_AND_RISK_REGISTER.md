# LANDFALL — BASELINE AND RISK REGISTER
### PayPal AI Hackathon 2026 · Grand-Prize Execution Brief Phase 0 Deliverable

> **Audit Date:** November 9, 2026  
> **Auditor Role:** Principal Payments Architect, AI Systems Engineer, Security Reviewer & Red-Team Lead  
> **Repository:** `https://github.com/Bharathadi01/landfall`  
> **Target Branch:** `main`  
> **Commit (HEAD):** `a0fb129af7c2832ca41055eca42eb08b5e94ebeb`  
> **Execution Constraint:** Zero Git mutations, zero live financial writes, zero paid API charges ($0.00 AI budget).  

---

## 1. Repository & Runtime Baseline

### 1.1 Git Topology
- **Branch:** `main` (in sync with `origin/main` at `a0fb129`)
- **Working Tree:** Dirty / uncommitted (19 modified/deleted tracked files, 58 untracked files/directories preserving prior milestone implementations).
- **Whitespace Check:** `git diff --check` identified 3 trailing whitespace issues (`README.md:9`, `README.md:57`, `lib/paypal/webhooks.ts:168`).

### 1.2 Runtime & Dependency Stack
- **Framework:** Next.js `15.1.6` (App Router, React `19.0.0`)
- **Language / Strictness:** TypeScript `5.7.3` (`strict: true`, zero `tsc --noEmit` errors)
- **Database & ORM:** PostgreSQL 16 (local container port 5432) via Drizzle ORM `0.39.3` & `drizzle-kit 0.30.4`
- **Testing Framework:** Vitest `3.0.5` (30 test files, 263 passing tests, 7.57s execution)
- **PayPal Client:** Custom REST client (`lib/paypal/client.ts`) with OAuth2 in-memory token caching and debug_id tracking; `@paypal/paypal-js: 8.2.0` for client-side components
- **AI Inference:** `groq-sdk: 1.6.0` on Groq Cloud Free Plan with open-weights model `openai/gpt-oss-20b` (`GROQ_API_KEY`) and 100% deterministic local offline fallback
- **AG Studio / Grid:** `ag-grid-community: 36.3.0`, `ag-grid-enterprise: 36.3.0`, `ag-grid-react: 36.3.0`, `ag-studio: 3.1.0`, `ag-studio-react: 3.1.0`, `ag-charts-community: 14.3.0`
- **Authentication / Passkeys:** `@simplewebauthn/server: 14.1.0`, `@simplewebauthn/browser: 14.0.0`
- **Geospatial:** MapLibre GL `6.17.0`, `@turf/boolean-point-in-polygon: 7.2.0`, `@turf/helpers: 7.2.0`

---

## 2. Actual Implementation Architecture Mapping

```
[External Sources]
  ├── NOAA NWS API (/alerts/active) ────────► lib/sentinel/weather-client.ts (Live alerts + VTEC normalization)
  ├── NHC Tropical Cyclone GIS ────────────► lib/sentinel/weather-client.ts (120h tracks, cones, radii)
  └── NOAA nowCOAST WMS (GeoServer) ───────► components/sentinel/WeatherMap.tsx (CONUS base reflectivity radar)

[Deterministic Core Services (No AI)]
  ├── Turf.js Spatial Exposure ────────────► lib/sentinel/exposure.ts & clusters.ts (Point-in-polygon)
  ├── Policy & Allocation Engine ──────────► lib/rules/engine.ts (Lexicographic tiering, waitlisting)
  ├── Double-Entry General Ledger ─────────► lib/ledger/index.ts (Balanced debits/credits, immutable entries)
  ├── Treasury Liquidity Waterfall ────────► lib/treasury/waterfall.ts & readiness.ts (Integer cents)
  └── Treasurer Outbox Pattern ────────────► lib/treasurer/index.ts (Idempotent payout batch dispatcher)

[Human Governance & Passkey Dual Custody]
  ├── Plan Canonical Hashing ──────────────► SHA-256 canonical plan item serialization
  ├── Passkey Verification Server ─────────► lib/security/passkeys.ts (Dual distinct approvers, 1 Finance)
  └── Passkey Browser Ceremonies ──────────► components/security/ (Needs browser integration)

[PayPal Developer Platform (Sandbox)]
  ├── Orders v2 (Donations) ───────────────► lib/paypal/orders.ts & app/api/donations/
  ├── Payouts v1 (Relief Grants) ──────────► lib/paypal/payouts.ts & lib/treasurer/
  ├── Subscriptions v1 (Sustainers) ───────► lib/paypal/subscriptions.ts
  ├── Webhooks v1 ─────────────────────────► lib/paypal/webhooks.ts & app/api/paypal/webhook/route.ts
  └── Reporting v1 (Reconciliation) ───────► lib/paypal/reporting.ts & lib/treasury/reconciler.ts

[AI Operational Copilots (Groq Free $0.00)]
  ├── Watch Officer Orchestrator ──────────► lib/ai/watch-officer/orchestrator.ts (openai/gpt-oss-20b)
  ├── Hazard Briefing Assistant ───────────► lib/ai/hazard-briefing.ts
  ├── Adversarial Plan Reviewer ───────────► lib/ai/plan-review.ts
  ├── Relief Communications Assistant ────► lib/ai/communication.ts
  └── AG Studio Bridge & Adapter ──────────► lib/ai/watch-officer/studio-adapter.ts & studio-bridge.ts
```

---

## 3. Empirical Sandbox Transaction Trace

One empirical PayPal Sandbox payout was executed and authoritatively verified:

- **Payout Batch ID:** `CYX4HC52K54WN`
- **Sender Batch ID:** `batch_activation_manual_t1`
- **Payout Item ID:** `XVV68QXJWJ66Y`
- **Transaction ID:** `6SM40781T11720216`
- **Receiver:** `sb-tv43cm53751698@personal.example.com`
- **Disbursement Amount:** `$1.00 USD` (100 cents)
- **PayPal Fee Assessed:** `$0.25 USD` (flat API fee)
- **Status:** `SUCCESS` (Funds credited to recipient account)
- **Correlation:** Exactly corresponds to internal plan item `plan_empirical_sandbox_001` item 1, verified in `lib/workflow/manifest.ts` and `docs/PAYPAL_EVIDENCE_MANIFEST.md`.
- **Honesty Distinction:** The separate 5-household $500.00 Milton disaster scenario is an operational **rehearsal drill**, not five empirical live PayPal Sandbox transactions.

---

## 4. Defect Reproduction & Risk Register

Every issue highlighted in the Phase 0 review has been reproduced and analyzed:

| # | Severity | Defect / Vulnerability | Exact Code Reference | Reproduction Evidence | Root Cause | Proposed Remediation |
|:---:|:---:|---|---|---|---|---|
| **D1** | **P0 (Critical)** | **Reserve Protection Leakage in Tranche 1** | `lib/ledger/allocatable.ts:20` | `protectedDeduction = isTranche1 ? 0 : reserveProtectedCents;`<br>When `isTranche1 === true`, `protectedDeduction` becomes 0, allowing Tranche 1 to spend down the protected reserve. | Legacy assumption that disaster activation unlocks all reserves. Contradicts strict reserve lock invariant. | Modify `calculateAllocatable` to strictly deduct `reserveProtectedCents` in all tranches unless explicit override policy applies. |
| **D2** | **P0 (Critical)** | **Manual Offline Recipients Enter PayPal Batch** | `lib/treasurer/index.ts:253` | `plan.items.map(...)` maps all plan items directly to PayPal Payout items. Recipients with `recipientPath: "MANUAL_CHANNEL"` have blank receiver details, causing PayPal API 400 rejection. | Lack of dispatch filtering between PayPal digital rails and offline cash card rails. | Filter `plan.items` in `TreasurerEngine`: route `MANUAL_CHANNEL` to offline disbursement queue; route digital channels to PayPal. |
| **D3** | **P0 (Critical)** | **In-Memory Outbox Loses State on Restart** | `lib/treasurer/index.ts:173` | `private outbox = new Map<string, OutboxEntry>()` stores outbox submissions in RAM. Serverless container restarts discard active submissions. | Outbox state not synced with Postgres `payout_batches` / `payout_items` tables. | Sync `TreasurerEngine` outbox operations directly with `payout_batches` table in Postgres for durable crash recovery. |
| **D4** | **P1 (High)** | **Orders v2 Capture Claim Discrepancy** | `README.md:117`, `docs/DEVPOST_SUBMISSION.md` | Claims Order `63692372EC2657104` captured via `/api/donations/capture`. In actual manifest (`manifest.ts:143`), Order `35996334K7032164X` is in `CREATED` status without capture. | Conflating order creation with donor-approved capture. In PayPal Orders v2, an unapproved order cannot be captured server-side. | Correct documentation to truthfully reflect Order `35996334K7032164X` in `CREATED` status awaiting buyer approval, or provide verified captured order proof. |
| **D5** | **P1 (High)** | **WebAuthn Biometrics Absent in UI** | `package.json:24`, `app/console/rehearsal/page.tsx:313` | `@simplewebauthn/browser` is never imported in UI. Rehearsal UI renders static `✓ WEBAUTHN SIGNED` badges without browser biometrics. | UI shortcuts in rehearsal page bypassed real WebAuthn browser challenge ceremonies. | Build an interactive WebAuthn approval modal importing `@simplewebauthn/browser` for genuine passkey signing over the plan hash. |
| **D6** | **P1 (High)** | **Missing `/r/complaints` Appeals Page (404)** | `app/r/` directory | Navigating to `/r/complaints` produces Next.js 404 Not Found error. Backend API exists at `app/api/recipients/complaints/route.ts`. | Route was specified and backend was built, but frontend page was omitted. | Implement `app/r/complaints/page.tsx` with 24h appeals status tracking and complaint submission. |
| **D7** | **P1 (High)** | **AG Studio Adapter Disconnect** | `lib/ai/watch-officer/studio-adapter.ts:22`, `app/console/war-room/page.tsx:528` | `GroqStudioLlmAdapter` routes to local regex parser instead of Groq, and is never passed to `<AgStudioCanvas>` in the UI. | Mock adapter created for interface compliance was not wired to live model or UI canvas. | Wire `GroqStudioLlmAdapter` to Groq SDK and pass to AG Studio's Agent Framework harness. |
| **D8** | **P1 (High)** | **"Sole LLM Agent" Contradiction** | `lib/ai/hazard-briefing.ts`, `plan-review.ts`, `communication.ts` | Code has 4 distinct Groq call sites, while README claimed only 1 LLM agent. | Documentation was not updated when Phase 3 multi-agent assistants were added. | Harmonize documentation to honestly reflect the 4 specialized LLM roles and their boundaries. |
| **D9** | **P2 (Medium)** | **Hardcoded Historical Lead Times** | `lib/rehearsal/lab.ts:57` | Milton (52.4h), Helene (48.0h), Idalia (41.5h) are hardcoded literals without derivation formulas. | Precomputed lead times from IEM advisories were entered directly into fixtures. | Provide explicit archive advisory timestamps, landfall timestamps, and lead-time calculation script. |
| **D10** | **P2 (Medium)** | **Coordinate Privacy Radius Overstatement** | `lib/sentinel/clusters.ts:88` | Computes arithmetic mean of zone groups; does not do 0.01° grid snapping; no fixed 1.1 km radius. | Overstated mathematical privacy guarantee in documentation. | Correct documentation to describe zone centroid aggregation and add minimum cohort suppression. |
| **D11** | **P2 (Medium)** | **99.75% Capital Efficiency Over-Scope** | `README.md`, `docs/IMPACT_EVIDENCE.md` | $0.25 flat fee on $100 payout applies strictly to US domestic USD API payouts. | Single pricing scenario presented as universal platform efficiency. | Clearly label 99.75% as an illustrative US USD domestic API payout scenario. |
| **D12** | **P3 (Low)** | **Git Diff Whitespace Warnings** | `README.md`, `lib/paypal/webhooks.ts` | Trailing whitespace on 3 lines. | Minor formatting artifact. | Clean up trailing whitespace. |

---

## 5. Phase 0 Verdict & Action Plan

**Baseline Status:** VERIFIED AND FULLY CATALOGED.  
**Action Plan:** Proceed to **Stage A** to fix all P0 critical financial and security defects (D1, D2, D3), followed by Stage B to build the complete **Proof-Carrying Relief Recovery** workflow.

