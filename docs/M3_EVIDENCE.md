# M3 STORM TREASURY — VERIFICATION & EVIDENCE REPORT

**Status:** COMPLETE & HARDENED (100% Branch Coverage on `lib/pledges/**`)  
**Repository:** `https://github.com/Bharathadi01/landfall`  
**Authoritative Reference:** `docs/PROJECT_BRIEF.md` (Landfall v3, §4.2, §4.6)  
**Execution Timestamp:** November 9, 2026, 05:53 IST  

---

## 1. Executive Summary

Milestone 3 (**Storm Treasury**) implements the three-tier pre-arranged financing architecture and the automated reconciliation engine for Landfall:
1. **Storm Pledges (Contingent Promises):** PayPal Vault v3 setup and payment tokens, explicit donor consent records, and a deterministic Pledge Caller with incident-scoped idempotency, emergency stop controls, and strict segregation from allocatable funds.
2. **Monthly Sustainers:** PayPal Subscriptions integration (catalog products, monthly billing plans, donor subscriptions) with verified webhook processing. Strict accounting invariant: `BILLING.SUBSCRIPTION.ACTIVATED` records donor mandate with zero money movement; `PAYMENT.SALE.COMPLETED` books balanced double-entry ledger transactions (`paypal_available` DEBIT, `reserve_protected` CREDIT).
3. **Treasury Waterfall Visualizer:** Deterministic liquidity ladder (`#0B3D91` Deep Ocean, `#F5A524` Storm Amber) displaying Available → Protected Floor → Fees Reserved → Committed Plans → Allocatable Cash, with contingent pledges segregated and real-time Tranche 1 household coverage.
4. **Reconciliation Engine:** Automated on-demand and scheduled reconciliation comparing internal double-entry ledger state with live PayPal Reporting APIs (`/v1/reporting/balances` and `/v1/reporting/transactions`), identifying timing differences, transaction mismatches, and logging immutable audit events.

---

## 2. Phase 0: External PayPal API Verification

Empirical verification executed directly against live PayPal sandbox (`https://api-m.sandbox.paypal.com`) on our provisioned US Business account (`RMYYMT3FXD8LJ`):

| Capability / API | Endpoint | Live Sandbox Result | Empirical Identifier / Proof |
|---|---|---|---|
| **Subscriptions Product** | `POST /v1/catalogs/products` | **SUCCESS (201)** | `PROD-4HV976845W620203M` |
| **Subscriptions Plan** | `POST /v1/billing/plans` | **SUCCESS (201)** | `P-5A327449X7452233TNLYQY3A` |
| **Reporting Balances** | `GET /v1/reporting/balances` | **SUCCESS (200)** | Account `RMYYMT3FXD8LJ`, USD Available |
| **Transaction Search** | `GET /v1/reporting/transactions` | **SUCCESS (200)** | Returns live transaction feeds |
| **Vault Setup Token** | `POST /v3/vault/setup-tokens` | `NOT_AUTHORIZED` | Standard sandbox limitation (requires custom merchant Vault / Reference Transaction enablement). Badged clearly as *"Production path — Requires PayPal Vault approval"*. |

Full research and contract details documented in `docs/M3_PAYPAL_RESEARCH.md`.

---

## 3. Phase 1: Storm Pledges Engine & Hardening

### 3.1 Data Architecture
- **`pledge_consents` table:** Stores immutable donor consent texts, version (`v1.0`), accepted timestamps, hazard scopes (e.g. `['HURRICANE', 'FLOOD', 'STORM_SURGE']`), per-event maximums, and seasonal caps.
- **`storm_pledges` table:** Links consent records to PayPal Vault payment tokens, tracking cumulative `charged_this_season`, expiration dates, and lifecycle statuses (`ACTIVE`, `PAUSED`, `REVOKED`, `EXPIRED`).
- **`pledge_charges` table:** Tracks merchant-initiated order executions with unique idempotency keys (`pledge_charge_${incidentId}_${pledge.id}`) and outbox payloads for crash resilience.

### 3.2 Invariant Verification & Adversarial Scenarios
- **Contingent Segregation:** Active pledges are booked to `pledges_contingent`. They are **never** counted as allocatable funds.
- **Deterministic Charging:** Charges execute strictly when an incident warning covers the donor's hazard scope and remaining seasonal cap is positive.
- **Mid-Flight Emergency Stop:** Dynamic evaluation checked before **each individual pledge charge**. If triggered mid-processing, in-flight execution immediately halts and uncharged pledges are safely preserved.
- **Mid-Flight Revocation Check:** `getPledgeStatus` checks live status prior to external call, aborting charges if a donor revoked immediately before batch dispatch.
- **Seasonal Cap Races:** Clamps charges to exact remaining cap headroom and increments `skippedOverCap` when cap is exhausted.
- **Ledger Integration:** On completed PayPal capture, funds transfer from `pledges_contingent` to `pledges_captured` and credit `paypal_available` in balanced double-entry entries.

---

## 4. Phase 2: Monthly Sustainers

### 4.1 Subscriptions Integration
- **`lib/paypal/subscriptions.ts`:** Strongly typed Zod schemas for products, monthly plans, subscription creation, cancellation, and suspension (zero `any` types).
- **`subscriptions` table:** Tracks donor subscription IDs, plan IDs, donor emails, status (`APPROVAL_PENDING`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `EXPIRED`), and monthly amounts.

### 4.2 Webhook Invariants & Accounting
Implemented in `app/api/paypal/webhook/route.ts`:
- `BILLING.SUBSCRIPTION.CREATED`: Inserts record with status `APPROVAL_PENDING` (safe against downgrading active subscriptions).
- `BILLING.SUBSCRIPTION.ACTIVATED`: Transitions status to `ACTIVE`. **Moves 0 ledger money.**
- `BILLING.SUBSCRIPTION.CANCELLED` / `SUSPENDED`: Updates subscription lifecycle status.
- `PAYMENT.SALE.COMPLETED`: Parses recurring sale amount, dedupes by transaction ID, and writes balanced double-entry transaction:
  - `paypal_available`: DEBIT `$25.00`
  - `reserve_protected`: CREDIT `$25.00`
  - Updates subscription `lastPaymentAt`.
- **Out-of-Order Safety:** Employs `SUBSCRIPTION_STATUS_PRECEDENCE` (`APPROVAL_PENDING: 1, ACTIVE: 3, CANCELLED: 5, EXPIRED: 5`). Delayed `CREATED` webhooks can never overwrite an `ACTIVE` subscription.

---

## 5. Phase 3: Treasury Waterfall & Visualizer

### 5.1 Deterministic Calculation Formula
$$\text{Allocatable} = \text{PayPal Available} - \text{Protected Floor} (\text{unlocked for Tranche 1}) - \text{Fees Reserved} - \text{Committed Plans}$$

### 5.2 Live API & Component
- **API Endpoint:** `GET /api/treasury/waterfall` queries live database ledger entries, storm pledges, and subscriptions.
- **Visualizer Component:** `components/treasury/TreasuryWaterfall.tsx`:
  - Design tokens: Deep ocean `#0B3D91`, storm amber `#F5A524`.
  - Step-by-step visual ladder: Available → Protected Floor → Fees Reserved → Committed → Allocatable Cash.
  - Contingent pledges clearly segregated with warning badge: *"Contingent Promises · Never Counted in Allocatable Cash"*.
  - Live household coverage bar: e.g. *"94% of Tranche 1 demand covered for eligible households"*.

---

## 6. Phase 4: Reconciliation Engine

Implemented in `lib/treasury/reconciler.ts` and exposed via `GET`/`POST /api/treasury/reconcile`:
- **Balance Matching:** Reconciles internal `paypal_available` ledger balance against live `GET /v1/reporting/balances`.
- **Transaction Matching:** Cross-references `GET /v1/reporting/transactions` with internal ledger correlation IDs.
- **Classification Statuses:**
  - `IN_SYNC`: Exact balance match, all transactions accounted for.
  - `TIMING_DIFFERENCE`: Unmatched transactions within 24-hour settlement window.
  - `MISMATCH_ALERT`: Unexplained variance requiring finance officer investigation.
  - `FALLBACK_LEDGER_ONLY`: Seamless fallback to internal double-entry ledger when reporting API credentials are restricted.
- **Audit Log & Immutability:** Every run records an immutable entry into `audit_events`. Discrepancies **never alter historical ledger records**.

---

## 7. Test Suite & Coverage Evidence

### 7.1 Vitest Execution Summary
```
 RUN  v3.2.7 /Users/bharathadithya/.gemini/antigravity/scratch/landfall
 Coverage enabled with v8

 ✓ tests/subscriptions/subscriptions.test.ts (9 tests)
 ✓ tests/treasurer/treasurer.test.ts (14 tests)
 ✓ tests/treasury/pledges.test.ts (21 tests)
 ✓ tests/treasury/reconciliation.test.ts (6 tests)
 ✓ tests/ledger/financial_integrity.test.ts (5 tests)
 ✓ tests/paypal/client.test.ts (2 tests)
 ✓ tests/rules/policy.test.ts (17 tests)
 ✓ tests/arch/boundary.test.ts (5 tests)
 ✓ tests/recipients/recipients.test.ts (9 tests)
 ✓ tests/security/encryption.test.ts (4 tests)
 ✓ tests/sentinel/sentinel.test.ts (9 tests)
 ✓ tests/ledger/ledger.test.ts (6 tests)
 ✓ tests/security/passkeys.test.ts (5 tests)
 ✓ tests/paypal/webhooks.test.ts (4 tests)
 ✓ tests/rules/smoke.test.ts (1 test)

 Test Files  15 passed (15)
      Tests  117 passed (117)
```

### 7.2 Coverage Table
| Directory / Module | % Statements | % Branches | % Functions | % Lines | Status |
|---|---|---|---|---|---|
| `lib/pledges/**` | **100%** | **100%** | **100%** | **100%** | **PASSED (100% Gate)** |
| `lib/rules/**` | **100%** | **100%** | **100%** | **100%** | **PASSED (100% Gate)** |
| `lib/treasurer/**` | **100%** | **100%** | **100%** | **100%** | **PASSED (100% Gate)** |
| `lib/ledger/**` | **91.03%** | **85.71%** | **100%** | **91.03%** | **PASSED** |
| `lib/treasury/**` | **90.35%** | **85.29%** | **100%** | **90.35%** | **PASSED** |
| `lib/recipients/**` | **88.05%** | **77.41%** | **100%** | **88.05%** | **PASSED** |
| `lib/sentinel/**` | **87.36%** | **32.14%** | **100%** | **87.36%** | **PASSED** |

### 7.3 Next.js Production Build
```
   ▲ Next.js 15.1.6
 ✓ Compiled successfully
 ✓ Generating static pages (24/24)
 ✓ Finalizing page optimization
 0 errors, 0 warnings
```
