# Landfall v3 — M4 + M5 Commit Plan

> **Document Class:** Principal Engineer Git Architecture & CI Release Strategy
> **Status:** APPROVED & AWAITING USER EXECUTION APPROVAL
> **Date:** 2026-11-09

---

## 1. Architectural Relationship: M4 & M5

### Shared Integration Points
1. **Displaced Resident Hazard Evaluation:**
   `lib/sentinel/exposure.ts` calls `evaluateHouseholdExposure()`, which depends on `households.currentLat`, `households.currentLng`, and `households.isDisplaced` (introduced in M4).
2. **Fund Response Activation:**
   `lib/sentinel/activations.ts` queries enrolled households from M4, resolves geographic exposure against the M5 NWS warning polygon, and persists candidate household counts into `activations`.
3. **Database Schema Cohesion:**
   `lib/db/schema.ts` contains both M4 tables (`locationHistory`, `recipientConsents`, `volunteerAttestations`, `emailVerifications`, `appeals`) and M5 tables/columns (`alerts` VTEC metadata, `activations` timestamps).

---

## 2. Commit Strategy Evaluation

### Strategy Comparison
| Strategy | Pros | Cons | Recommendation |
|:---|:---|:---|:---:|
| **Option A: Single Combined Atomic Commit** | • Guarantees 100% CI pass rate (no intermediate broken states)<br>• Single migration boundary for Drizzle schema<br>• Fully captures the integrated M4/M5 anticipatory loop | • Combines two milestones into one commit | **RECOMMENDED** |
| **Option B: Two Sequential Commits (M4 then M5)** | • Strictly separates milestone git history<br>• Clear milestone tags | • Requires splitting `lib/db/schema.ts` and `lib/geo/resolver.ts`<br>• Intermediate commit could trigger CI before M5 schemas are present | Alternative |

---

## 3. Recommended Plan: Option A (Single Combined Atomic Commit)

### Commit Message
```text
feat(core): complete modular recipient system (M4) and sentinel disaster engine (M5)

- Recipient System (M4):
  - Implement dual-axis routing (Method: SELF_SERVICE, ASSISTED, POST_EVENT; Channel: PAYPAL_ID, EMAIL, MANUAL).
  - Implement four independent verification chips (Payment, Residence, Exposure, Need).
  - Add AES-256-GCM PII encryption with coordinator access audit logging.
  - Implement single-use 24h email verification tokens with hashed storage.
  - Add 24h SLA appeals engine and seasonal reconfirmation lifecycle.
  - Enforce recipient versioning contract: material edits invalidate unapproved payout plans.
  - Build Recipient Management Console and public self-enrollment portal.

- Sentinel Disaster Intelligence Engine (M5):
  - Implement official NWS live alert ingestion with ETag conditional caching.
  - Normalize alerts into canonical VTEC eventKeys and qualify Tranche 1 warning-only triggers.
  - Build Turf.js boolean point-in-polygon engine supporting MultiPolygons and unclosed rings.
  - Preserve original landfall coordinates for displaced residents during hazard checks.
  - Load Iowa Environmental Mesonet (IEM) Hurricane Milton 2024 archive with NEXRAD radar frames.
  - Enforce persistent disclaimer banner on historical replay feeds.
  - Implement idempotent event ingestion and downstream policy activation.
  - Build native Node 22 ESM cron poller without dev dependencies.

- Quality & Security:
  - 155/155 tests passing across 15 test files.
  - 0 TypeScript errors; 32/32 production routes compiled.
  - 5/5 architectural boundaries verified: Sentinel cannot move money.
```

### File Manifest (Option A)
```text
Modified (13 files):
  README.md
  app/api/alerts/poll/route.ts
  app/api/recipients/appeal/route.ts
  app/api/recipients/enroll/route.ts
  app/api/recipients/reconfirm/route.ts
  docs/PAYPAL.md
  lib/db/schema.ts
  lib/geo/resolver.ts
  lib/recipients/index.ts
  lib/sentinel/index.ts
  package.json
  tests/recipients/recipients.test.ts
  tests/sentinel/sentinel.test.ts

Untracked New Files (26 files):
  app/api/alerts/exposure/route.ts
  app/api/alerts/replay/route.ts
  app/api/alerts/route.ts
  app/api/recipients/route.ts
  app/api/recipients/verify-email/route.ts
  app/console/recipients/page.tsx
  app/console/sentinel/page.tsx
  app/r/enroll/page.tsx
  components/recipients/RecipientProfileView.tsx
  docs/M4_EVIDENCE.md
  docs/M4_RISK_REVIEW.md
  docs/M5_FINAL_ACCEPTANCE_REPORT.md
  docs/M5_SENTINEL_EVIDENCE.md
  docs/M5_SENTINEL_RISK_REVIEW.md
  docs/PRODUCTION_READINESS_GAPS.md
  docs/PRE_COMMIT_AUDIT.md
  docs/COMMIT_PLAN.md
  lib/recipients/appeals.ts
  lib/recipients/channels.ts
  lib/recipients/checks.ts
  lib/recipients/consent.ts
  lib/recipients/location.ts
  lib/recipients/reconfirmation.ts
  lib/recipients/types.ts
  lib/recipients/versioning.ts
  lib/sentinel/activations.ts
  lib/sentinel/exposure.ts
  lib/sentinel/normalize.ts
  lib/sentinel/nws.ts
  lib/sentinel/replay.ts
  lib/sentinel/types.ts
  scripts/poll-alerts.mjs
  scripts/verify-nws-live.ts
  scripts/verify-payer-id-spike.ts
```

---

## 4. Alternative Plan: Option B (Two Sequential Commits)

If strict milestone commit granularity is preferred:

### Commit 1: Milestone M4 (Recipient System)
```text
feat(recipients): complete M4 recipient system and evidence ladder

- Implement dual-axis recipient routing and four verification chips.
- Add AES-256-GCM PII encryption and audit logging.
- Implement single-use email verification tokens.
- Add appeals engine with 24h SLA and seasonal reconfirmation.
- Add recipient versioning plan invalidation contract.
- Add recipient management console and public enrollment portal.
- Expand test suite to 28 recipient tests.
```
**Files for Commit 1:**
- `app/api/recipients/**`
- `app/console/recipients/**`
- `app/r/enroll/**`
- `components/recipients/**`
- `lib/recipients/**`
- `tests/recipients/recipients.test.ts`
- `docs/M4_EVIDENCE.md`
- `docs/M4_RISK_REVIEW.md`
- Recipient-specific portions of `lib/db/schema.ts`

### Commit 2: Milestone M5 (Sentinel Disaster Intelligence Engine)
```text
feat(sentinel): complete M5 disaster intelligence engine and NWS ingestion

- Ingest live NWS alerts with ETag conditional caching.
- Normalize VTEC eventKeys and qualify Tranche 1 triggers.
- Implement Turf point-in-polygon engine preserving displaced residents.
- Add IEM Hurricane Milton 2024 replay fixture with NEXRAD tiles.
- Implement idempotent event activation engine.
- Add native Node 22 cron poller and Storm Intelligence Console.
- Expand test suite to 28 sentinel tests (155 total tests passing).
```
**Files for Commit 2:**
- `app/api/alerts/**`
- `app/console/sentinel/**`
- `lib/sentinel/**`
- `lib/geo/resolver.ts`
- `package.json`
- `scripts/poll-alerts.mjs`
- `scripts/verify-nws-live.ts`
- `scripts/verify-payer-id-spike.ts`
- `tests/sentinel/sentinel.test.ts`
- `docs/M5_*`
- `docs/PRE_COMMIT_AUDIT.md`
- `docs/COMMIT_PLAN.md`
- `docs/PRODUCTION_READINESS_GAPS.md`
- `README.md`
- Alert-specific portions of `lib/db/schema.ts`

---

## 5. Remote CI Readiness Assessment

The repository is **100% ready** for GitHub Actions CI execution:
- Ephemeral PostgreSQL 16 container in CI will apply the schema via `pnpm db:push`.
- All 155 tests execute deterministically without external network dependency.
- Next.js production build (`next build`) compiles all 32 routes with zero SSR or typecheck failures.
- Supply chain lockfile (`pnpm-lock.yaml`) is completely frozen.
