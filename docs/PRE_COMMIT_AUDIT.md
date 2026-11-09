# Landfall v3 — Pre-Commit Engineering & Security Audit

> **Document Class:** Independent Principal Engineer & Application Security Review
> **Target Scope:** M4 (Recipient System) & M5 (Sentinel Disaster Intelligence Engine)
> **Status:** AUDITED & APPROVED
> **Audit Date:** 2026-11-09
> **Overall Verdict:** **PASS**

---

## 1. Executive Summary

An exhaustive, adversarial pre-commit audit was performed across the complete local working tree of **Landfall v3** prior to staging or committing changes to git.

The working tree incorporates the complete modular implementations of:
- **M4 — Recipient System**: Dual-axis routing (`SELF_SERVICE`, `ASSISTED`, `POST_EVENT` $\times$ `PAYPAL_ID`, `EMAIL`, `MANUAL`), four independent verification chips (`Payment`, `Residence`, `Exposure`, `Need`), AES-256-GCM PII encryption, 24-hour SLA appeals engine, seasonal reconfirmation, and recipient versioning plan invalidation.
- **M5 — Sentinel Disaster Intelligence Engine**: Official live National Weather Service (NWS) ingestion with ETag caching, VTEC event key normalization, Tranche 1 warning-only triggers (`HU.W`, `SS.W`, `FF.W`, `EH.W`), Turf.js geographic polygon resolution preserving displaced resident landfall coordinates, Iowa Environmental Mesonet (IEM) Hurricane Milton 2024 historical replay with radar tiles, persistent disclaimer enforcement, and idempotent database activation.

### Key Quality & Security Metrics
- **Tests Passing:** **155 / 155 passed** across 15 test files (Duration: 3.55s).
- **TypeScript Strictness:** **0 errors** (`pnpm exec tsc --noEmit`).
- **Production Route Compilation:** **32 / 32 routes compiled successfully** (`pnpm build`).
- **Architectural Boundary Invariants:** **5 / 5 passed** (`tests/arch/boundary.test.ts`).
- **Secret Leaks:** **0 credentials, API keys, or private tokens detected**.
- **Database Schema Push:** **Verified clean** against PostgreSQL via `drizzle-kit push`.
- **Dependency Reproducibility:** **Lockfile up to date** (`pnpm install --frozen-lockfile` passed in 31ms).

---

## 2. Git Integrity Audit (§1)

### 2.1 Branch & Upstream Alignment
- **Branch:** `main`
- **Head Commit:** `4a83134c6e6f3983fa5285c8f9f0d3c3f5fd0294`
- **Remote `origin/main`:** `4a83134c6e6f3983fa5285c8f9f0d3c3f5fd0294` (In exact sync with local `main`).
- **Status:** 13 modified tracked files, 26 untracked file paths, 0 staged files.

### 2.2 Inspection of Untracked & Modified Source Files
Every new and modified source file was inspected line-by-line:
- **Accidental Files:** None found. No `.DS_Store`, `.env`, temporary logs, or editor swap files are present.
- **Scripts:** Only project-standard test harnesses (`scripts/poll-alerts.mjs`, `scripts/verify-nws-live.ts`, `scripts/verify-payer-id-spike.ts`).
- **Generated Artifacts:** Build output in `.next` and coverage in `coverage/` are properly ignored by `.gitignore`.

---

## 3. Application Security & Cryptographic Review (§2)

### 3.1 Route-by-Route Authentication & Authorization Audit
| Route | Method | Auth Mechanism | Authorization / Security Control |
|:---|:---:|:---|:---|
| `/api/alerts` | `GET` | Public / Dashboard | Read-only; queries public NWS alerts and system health status. |
| `/api/alerts/poll` | `POST` | `CRON_SECRET` | Header `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`. Rejects unauthorized callers with HTTP 401. |
| `/api/alerts/exposure` | `POST` | Internal / Coordinator | Validates `alertId`; resolves coordinates; returns geographic evaluation without mutating data. |
| `/api/alerts/replay` | `POST` | Replay Harness | Loads deterministic IEM Milton 2024 replay. Explicitly tags alerts as `HISTORICAL_REPLAY`; zero payments can be executed. |
| `/api/recipients` | `GET` | Coordinator Role | PII (`name`, `address`) is masked as `[ENCRYPTED]` by default. Decrypts only if `decrypt=true`, which triggers mandatory `logPIIAccess` audit logging. |
| `/api/recipients/enroll` | `POST` | Public Intake / Volunteer | Requires explicit consent (`consentAgreed: true`). Validates bounds. Encrypts sensitive fields with AES-256-GCM before DB write. |
| `/api/recipients/appeal` | `POST` | Recipient / Volunteer | Validates household exists. Enforces strict 24-hour SLA deadline (`slaDeadline: now + 24h`). |
| `/api/recipients/reconfirm` | `POST` | Recipient | Evaluates 12-month reconfirmation check. Updates `reconfirmedAt` timestamp. |
| `/api/recipients/verify-email` | `POST` | Single-Use Token | Verifies SHA-256 hash against stored token; checks 24-hour expiration; marks token used (`usedAt: now`) to prevent replay. |

### 3.2 Recipient PII Encryption & Key Management
- **Cipher:** AES-256-GCM with standard 12-byte random IV and 16-byte authentication tag (`CURRENT_VERSION = "v1"`).
- **Format:** `v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
- **Tamper Rejection:** Proven by deterministic unit tests in `tests/security/encryption.test.ts`. Flipping any bit in ciphertext or auth tag throws OpenSSL decipher authentication error.
- **Zero Hardcoded Keys:** Uses `process.env.PII_ENCRYPTION_KEY`. In test environments, deterministic SHA-256 key hashing is used to avoid test crashes.
- **Audit Logging:** Decryption in directory views invokes `logPIIAccess({ actorId, actorRole, resourceType: "household", ... })`, generating immutable rows in `audit_events`.

### 3.3 Email Verification Token Lifecycle
- **Generation:** `crypto.randomBytes(32).toString("hex")` (256-bit entropy).
- **Storage:** Only the SHA-256 hash (`crypto.createHash("sha256").update(token).digest("hex")`) is stored in `email_verifications.token_hash`. Plaintext token is never persisted in DB.
- **Expiry:** Strict 24-hour TTL (`expiresAt = Date.now() + 24 * 60 * 60 * 1000`).
- **One-Time Use:** Enforced by checking `usedAt == null` and setting `usedAt: new Date()` in the same transaction.
- **Token Masking:** `app/api/recipients/enroll/route.ts` only includes `devEmailToken` when `process.env.NODE_ENV !== "production"`.

### 3.4 Recipient Versioning & Payout-Plan Invalidation
- **Contract:** Any material change to a recipient's payment channel, receiver identifier, or residence coordinates increments `households.recipientVersion`.
- **Enforcement:** `invalidatePlansForRecipientMutation({ householdId })` detects any unsubmitted payout plans referencing that household, transitions their status to `draft`, and voids coordinator passkey approvals.
- **Security Impact:** Prevents "bait-and-switch" attacks where a malicious actor alters a recipient's PayPal wallet destination after passkey approvals are granted.

### 3.5 Secret Exposure Scan Results
- **Automated Grep:** Scanned all newly introduced files for `password`, `secret`, `api_key`, `private_key`, `bearer`, and token literals.
- **Result:** **0 secret leaks detected**. No real private keys, API secrets, or sensitive production credentials exist in the codebase.

---

## 4. Database & Integration Review (§3)

### 4.1 Schema Modifications (`lib/db/schema.ts`)
- **New Tables:**
  1. `locationHistory`: Immutable historical coordinate tracking with `recordedBy` provenance.
  2. `recipientConsents`: Granular consent ledger (`TERMS_OF_SERVICE`, `PAYMENT_ROUTING`, `LOCATION_TRACKING`, `EMERGENCY_DISCLOSURE`) with withdrawal support (`withdrawnAt`).
  3. `volunteerAttestations`: Physical residence and community vouching records by verified volunteers.
  4. `emailVerifications`: Single-use 24-hour email verification tokens with hashed storage.
  5. `appeals`: Formal dispute cases with unique `caseReference` and 24-hour SLA timestamps.
- **Extended Tables:**
  1. `households`: Added `enrollmentMethod`, `paymentChannel`, `recipientVersion`, `currentLat`, `currentLng`, `isDisplaced`.
  2. `alerts`: Added VTEC metadata (`eventKey`, `phenomena`, `significance`, `urgency`, `certainty`, `status`, `messageType`, `areaDesc`), `effective`, `mode` (`LIVE`, `HISTORICAL_REPLAY`, `SYNTHETIC`), `isTranche1Eligible`, and `lastSyncedAt`.
  3. `activations`: Added `createdAt` and `updatedAt`.
- **Integrity & Concurrency Protection:**
  - `alerts.nwsId` has a strict `.unique()` constraint, preventing duplicate alert insertion under concurrent webhook or poller execution.
  - Foreign keys (`householdId`, `fundId`, `alertId`) enforce referential integrity.
  - All new columns are either nullable or define deterministic default values, guaranteeing backwards compatibility with existing M3 data.
- **Schema Push Validation:** `drizzle-kit push` was executed against local PostgreSQL and completed successfully (`[✓] Changes applied`).

---

## 5. PayPal & Financial Safety Invariants (§4)

The 5 architectural boundary tests were executed and passed with 0 violations:
```
✓ Invariant 1: Only lib/treasurer and spike/test scripts import PayPal Payouts
✓ Invariant 2: lib/rules, lib/ledger, lib/treasurer, lib/pledges, and lib/treasury NEVER import any AI SDK
✓ Invariant 3: Golden Rule #1 - AI never sets eligibility, priority or amounts
✓ Invariant 4: Client-exposed environment variables only use allow-listed NEXT_PUBLIC_*
✓ Invariant 5: Only lib/pledges may invoke Vault-based pledge charging
```

### Financial Flow Guarantees
1. **Sentinel Isolation:** `lib/sentinel/**` contains **0 imports** of PayPal Payouts, Orders, or Vault charging. Sentinel produces disaster telemetry only and cannot initiate financial transactions.
2. **Two-Person Human Approval Rule:** Payout batches cannot be submitted without two distinct human passkey approvals (`coordinator` and `finance`) over the SHA-256 `plan_hash`.
3. **Contingent Balance Segregation:** Pledges and sustainer subscriptions are recorded in the double-entry ledger only upon confirmed external capture (`PAYMENT.SALE.COMPLETED`). Contingent funds never become allocatable.
4. **Idempotent Activation:** Re-processing an identical storm alert returns the existing activation and does not duplicate downstream policy evaluations.

---

## 6. Regression & Quality Gates (§5)

| Gate | Command | Result | Details |
|:---|:---|:---:|:---|
| **TypeScript Strict** | `pnpm exec tsc --noEmit` | **PASS** | 0 errors across entire workspace |
| **Vitest Test Suite** | `pnpm test` | **PASS** | 155 / 155 tests passed in 15 files |
| **Production Build** | `pnpm build` | **PASS** | 32 / 32 routes compiled successfully |
| **Architecture Tests** | `pnpm vitest run tests/arch/boundary.test.ts` | **PASS** | 5 / 5 boundary rules verified |
| **Drizzle Schema Push** | `pnpm db:push` | **PASS** | Schema synced without data loss |
| **Lockfile Frozen** | `pnpm install --frozen-lockfile` | **PASS** | Up to date; 0 dependencies modified |

---

## 7. Audit Verdict

### **VERDICT: PASS**

The local working tree is robust, strictly tested, secure against credential leaks, and architecturally isolated. It is fully ready to be staged and committed to GitHub main.
