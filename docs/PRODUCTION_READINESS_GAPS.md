# Landfall v3 — Production Readiness & Architecture Gaps Audit

> **Document Class:** Principal Engineer Risk & Reliability Audit
> **Milestone Target:** M5 Final Acceptance Gate
> **Status:** AUDITED & DOCUMENTED
> **Date:** 2026-11-09

---

## Executive Summary

This audit assesses the deployment, operational, and architectural readiness of **Landfall v3** following the completion of **M3 (Storm Treasury)**, **M4 (Recipient System)**, and **M5 (Sentinel Disaster Intelligence Engine)**.

While all unit, integration, and architecture boundary tests (155/155 tests passing, 0 TypeScript errors, 32/32 Next.js routes compiled) pass locally and in GitHub Actions CI, transitioning from local ephemeral execution to multi-tenant production hosting (e.g. Render, AWS, or Fly.io) introduces specific operational, configuration, and infrastructure gaps.

This document itemizes every identified gap, evaluates its severity, and provides an actionable remediation plan.

---

## 1. Infrastructure & Hosting Gaps (Render Blueprint)

### GAP-01: Database Schema Push / Migration on Initial Deployment
- **Severity:** High (Initial Setup Blocker)
- **Component:** `render.yaml` (`landfall-web` build & start commands)
- **Current State:**
  `buildCommand: pnpm install && pnpm build`
  `startCommand: pnpm start`
- **Issue:**
  When Render provisions a new PostgreSQL database (`landfall-db`), the database is created completely empty with 0 tables. Because `pnpm db:push` (or Drizzle migrations) is not included in the web service build or start command, initial API requests (`/api/alerts`, `/api/recipients`, `/api/auth`) will fail with PostgreSQL `relation "alerts" does not exist` until migrations are executed.
- **Risk:** Complete application failure on first boot in a new environment.
- **Remediation:**
  Update `startCommand` in `render.yaml` or Render service dashboard:
  ```yaml
  startCommand: pnpm db:push && pnpm start
  ```
  This ensures that every container boot automatically verifies and creates any missing schema tables before serving traffic.

---

### GAP-02: Database Plan Selection (Starter vs. Free Tier)
- **Severity:** Low (Billing / Configuration)
- **Component:** `render.yaml` (`databases.plan`)
- **Current State:** `plan: starter` ($7/month).
- **Issue:**
  If the user's Render workspace does not have active billing or credits entered, Render will halt Blueprint creation and request a credit card before provisioning `landfall-db`.
- **Remediation:**
  If the deployment is for free hackathon evaluation without credit card setup, change `plan: starter` to `plan: free` in `render.yaml`. Note that Render free databases expire after 30 days and spin down after inactivity.

---

### GAP-03: `APP_URL` Environment Synchronization for Cron Poller
- **Severity:** Medium (Operational Dependency)
- **Component:** `render.yaml` (`landfall-sentinel-cron`)
- **Current State:**
  `APP_URL` is configured with `sync: false`.
- **Issue:**
  The Render cron poller (`landfall-sentinel-cron`) runs every 5 minutes and executes `scripts/poll-alerts.mjs`, which queries `${process.env.APP_URL}/api/alerts/poll`. Because `APP_URL` cannot be auto-injected by Render Blueprints before the web service URL is generated, the user must manually set `APP_URL: https://landfall-web.onrender.com` in the Render environment variables dashboard.
- **Risk:** If omitted, `APP_URL` defaults to `http://localhost:3000`, causing the external cron process to fail with `ECONNREFUSED`.
- **Remediation:**
  Immediately after `landfall-web` is provisioned, copy its public URL into `landfall-sentinel-cron`'s `APP_URL` environment variable.

---

## 2. Security & Identity Invariants

### GAP-04: WebAuthn Passkey Origin Domain Binding
- **Severity:** High (Production Security Invariant)
- **Component:** `lib/security/passkeys.ts`, `.env.example`, `render.yaml`
- **Current State:**
  `WEBAUTHN_RP_ID: localhost`
  `WEBAUTHN_ORIGIN: http://localhost:3000`
- **Issue:**
  FIDO2 / WebAuthn specifications strictly enforce Relying Party (`rpId`) and origin domain matching. Passkeys generated or asserted from `https://landfall.org` or `https://landfall-web.onrender.com` will be rejected by browsers and `@simplewebauthn` if `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` are still pointing to `localhost`.
- **Remediation:**
  Set `WEBAUTHN_RP_ID` (e.g. `landfall-web.onrender.com`) and `WEBAUTHN_ORIGIN` (e.g. `https://landfall-web.onrender.com`) in the Render environment variables dashboard for `landfall-web`.

---

### GAP-05: PII Secret Key Rotation & Storage
- **Severity:** Medium (Data Governance)
- **Component:** `lib/security/encryption.ts`
- **Current State:**
  Falls back to a deterministic development key hash if `PII_ENCRYPTION_KEY` is undefined.
- **Issue:**
  While the fallback prevents crashes during local development and testing, production environments must strictly enforce that `PII_ENCRYPTION_KEY` is a cryptographically strong 32-byte secret.
- **Remediation:**
  Add `PII_ENCRYPTION_KEY` to `render.yaml` as `generateValue: true` or configure as a secret in Render dashboard.

---

## 3. Database Invariants & Concurrency

### GAP-06: Composite Unique Constraint on Event Activations
- **Severity:** Medium (Adversarial Concurrency Defense)
- **Component:** `lib/db/schema.ts` (`activations` table)
- **Current State:**
  `evaluateAndActivateFundResponse()` performs software-level deduplication:
  ```ts
  const [existingActivation] = await db.select().from(activations)
    .where(and(eq(activations.fundId, targetFundId), eq(activations.alertId, alertRecordId)))
    .limit(1);
  ```
  However, the `activations` table does not have a database-level `uniqueIndex` across `(fund_id, alert_id)`.
- **Risk:**
  If two webhook requests or cron pollers run concurrently at the exact same millisecond, a race condition could theoretically insert two activation rows for the same fund and alert before either check finishes.
- **Remediation:**
  Add a composite unique constraint in `lib/db/schema.ts`:
  ```ts
  (table) => ({
    fundAlertIdx: uniqueIndex("activations_fund_alert_idx").on(table.fundId, table.alertId),
  })
  ```

---

## 4. Disaster Intelligence & Sentinel Resiliency

### GAP-07: In-Memory ETag Cache Persistence Across Container Restarts
- **Severity:** Low (Performance Optimization)
- **Component:** `lib/sentinel/nws.ts`
- **Current State:**
  NWS API conditional caching (ETag and `If-None-Match`) uses an in-memory `Map<string, { etag, data, cachedAt }>`.
- **Issue:**
  If the Next.js server restarts or runs in a multi-instance autoscaling cluster, each container maintains its own memory cache. While NWS returns `200 OK` safely on a cold cache, shared Redis or DB caching would minimize upstream NWS requests.
- **Remediation:**
  For Phase 2 multi-instance scaling, back the ETag cache with Redis or PostgreSQL `last_synced_at` metadata.

---

### GAP-08: Point-in-Polygon vs. NWS Point API Discrepancies
- **Severity:** Low (Operational Triage)
- **Component:** `lib/sentinel/exposure.ts`
- **Current State:**
  When Turf.js point-in-polygon and NWS Point API disagree, Sentinel marks the household exposure as `NEEDS_REVIEW` with reason code `POINT_CHECK_DISAGREEMENT`.
- **Issue:**
  Households flagged as `NEEDS_REVIEW` cannot be automatically approved in Tranche 1 until a human coordinator reviews them.
- **Remediation:**
  Ensure the coordinator team monitors the `/console/sentinel` review queue during active hurricanes so edge-case boundary households receive prompt human adjudication.

---

## 5. PayPal Sandbox Boundary Conditions

### GAP-09: PayPal Vault v3 Sandbox Merchant Onboarding Requirement
- **Severity:** External Sandbox Constraint (Documented in §3 & M3)
- **Component:** `lib/paypal/vault.ts`, `lib/pledges/index.ts`
- **Current State:**
  Vault v3 setup-token and merchant-initiated capture APIs require specific PayPal partner merchant onboarding permissions that standard self-serve developer accounts do not possess by default (returns HTTP 403 Forbidden).
- **Handled By:**
  The application gracefully catches this external limitation, provides a deterministic fallback mode for hackathon review, and documents the exact permissions needed for live production enablement.
- **Remediation:**
  PayPal account manager must enable `VAULT_V3_MERCHANT_INITIATED_BILLING` on the production merchant business account.

---

## Summary of Action Items Before Public Launch

| Priority | Item | Component | Action |
|:---|:---|:---|:---|
| **P0** | Database Initialization | Render Blueprint | Update start command to `pnpm db:push && pnpm start` |
| **P0** | Set `APP_URL` in Cron | Render Dashboard | Provide public URL to cron environment variable |
| **P0** | Configure WebAuthn Origin | Render Dashboard | Set `WEBAUTHN_RP_ID` & `WEBAUTHN_ORIGIN` to production host |
| **P1** | Add DB Unique Constraint | Drizzle Schema | Add `uniqueIndex("fund_alert_idx")` to `activations` |
| **P1** | Set Production PII Key | Environment | Set 32-byte cryptographically random `PII_ENCRYPTION_KEY` |
| **P2** | Vault v3 Partner Activation | PayPal Developer | Request merchant permissions from PayPal account manager |
