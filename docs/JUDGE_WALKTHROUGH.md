# Landfall — Official Hackathon Evaluation & Judge Walkthrough Guide
### PayPal AI Hackathon 2026 · AG Grid Sponsor Challenge · Landfall v3

> **Tagline:** *Cash before the storm.*  
> **Core Innovation:** Open-source anticipatory disaster-relief finance platform delivering unconditional cash transfers to vulnerable households 24–72 hours **before** hurricane landfall using official NWS weather alerts, deterministic double-entry accounting, dual-custody passkeys, and PayPal Payouts.

---

## 1. Executive Summary & Verification Gates

Landfall is built to withstand rigorous review from PayPal architects, financial security engineers, and humanitarian operators:

- **Vitest Test Suite:** **205 / 205 tests passing** across 21 test files (100% pass rate).
- **Architectural Boundary Enforcement:** **5 / 5 strict boundary rules verified** (`tests/arch/boundary.test.ts`).
- **TypeScript Integrity:** **0 errors** (`pnpm exec tsc --noEmit`).
- **Production Build:** **37 / 37 routes compiled** (`pnpm build`).
- **Zero-Cost AI Architecture:** $0.00 spent. Watch Officer operates exclusively on Groq Cloud Free Plan (`openai/gpt-oss-20b`) with an automated deterministic offline fallback template.

---

## 2. Interactive Console Routes for Judges

Judges can explore the complete application live in their browser:

| Console Route | Purpose & Key Features |
| :--- | :--- |
| **`/console/golden-flow`** | **M7 Golden Pipeline:** Complete 8-stage interactive demonstration from PayPal donation capture to verified PayPal Payouts disbursement and double-entry ledger balancing. |
| **`/console/war-room`** | **AG Studio War Room:** Unified operations dashboard powered by **AG Grid Community** and **AG Charts**, featuring the Recipient Intelligence Grid, Treasury Waterfall chart, and Watch Officer Copilot. |
| **`/console/sentinel`** | **Sentinel Engine:** Real-time National Weather Service alert ingestion and deterministic historical replay of Hurricane Milton (Oct 2024). |
| **`/console/recipients`** | **Recipient Management:** AES-256-GCM encrypted PII, vulnerability scoring (0–100), Lexicographic Tiering (P1–P6), and appeals engine. |
| **`/console/watch-officer`** | **Watch Officer AI Copilot:** Traceable, read-only situational reasoning with strict financial integrity guards. |

---

## 3. The 8-Stage Golden Workflow Walkthrough (`/console/golden-flow`)

Landfall's entire operational lifecycle executes across 8 deterministic stages:

1. **PayPal Donation Capture (`Orders v2`):**
   - Ingests donor contributions directly into the double-entry ledger (`DONOR_INFLOW -> PAYPAL_CLEARING`).
2. **Treasury Waterfall & Solvency Derivation:**
   - Derives a mandatory 30% reserve protection floor and transaction fee reserve ($50.00), calculating the exact allocatable cash available for release.
3. **Sentinel Disaster Warning Ingestion:**
   - Detects official NWS VTEC warning alert (`TBW:HU.W:0009` — Hurricane Milton Category 4) with explicit `REHEARSAL_MODE` safeguards.
4. **Geographic Household Exposure Resolution:**
   - Evaluates recipient coordinates against warning polygons; confirms households in coastal evacuation zones while safely excluding out-of-area residents.
5. **Deterministic Policy Allocation & Priority Tiering:**
   - Lexicographically sorts households by vulnerability (Tier 1 Life-Sustaining Medical Devices, Tier 2 Elderly Living Alone, Tier 3 Mobility/Disability, Tier 4 No Vehicle in Surge Zone, Tier 5 Children < 5). Assigns $100 Tranche 1 anticipatory grants.
6. **Dual-Custody WebAuthn Passkey Approval:**
   - Locks the plan into an immutable canonical SHA-256 hash (`computePlanHash`).
   - Requires two distinct cryptographic signatures: **Emergency Operations Lead** and **Finance Fiduciary Lead**.
7. **Hardened Treasurer PayPal Payout Submission:**
   - Dispatches idempotent payout batch to PayPal Sandbox Payouts API (`POST /v1/payments/payouts`) via the Outbox pattern.
8. **Webhook Verification & Ledger Reconciliation:**
   - Validates PayPal transmission signatures and balances debits and credits with exact **0¢ discrepancy**.

---

## 4. AG Studio Relief Operations War Room (`/console/war-room`)

Submitted for the **AG Grid Sponsor Challenge** ($5,000 prize track):

- **AG Grid Community Table (`AgGridReact`):**
  - Displays registered households with pinned IDs, custom dark-mode styling (`ag-theme-quartz-dark`), multi-column sorting, vulnerability tier badges, evacuation zone filtering, and recipient payment channels.
- **AG Charts Community (`AgCharts`):**
  - Donut chart dynamically visualizing the Storm Treasury Waterfall breakdown: Reserve Floor ($300.00), Fees Reserve ($50.00), and Allocatable Tranche 1 ($650.00).
- **Studio Agent Framework Bridge (`lib/ai/watch-officer/studio-bridge.ts`):**
  - Translates natural-language operator prompts (e.g. *"Show medical device households"*, *"Filter to Zone A"*, *"Sort by priority tier"*, *"Simulate constrained reserve"*) into declarative AG Grid filters and sort states in real-time.
- **Scenario Simulator:**
  - Compares Baseline (30% reserve) vs Constrained Reserve (15% reserve) vs Priority Focus (Tiers 1 & 2 only) with instant coverage ratio recalculation.

---

## 5. Live PayPal Sandbox Evidence Matrix

All money movements are backed by real, empirical calls to the PayPal Sandbox:

| PayPal API | Identifier / Batch ID | Status | Amount / Details | Proof Type |
| :--- | :--- | :--- | :--- | :--- |
| **Payouts v1** | `CYX4HC52K54WN` | `SUCCESS` | Item `XVV68QXJWJ66Y`: $1.00 USD (Fee: $0.25)<br>TxID: `6SM40781T11720216`<br>Receiver: `sb-tv43cm53751698@personal.example.com` | Live Sandbox API Call |
| **Payouts v1** | `7Y5GP4ETNLCUQ` | `SUCCESS` / `UNCLAIMED` | Item `FR7DHMX8QE59A`: $1.00 USD (`SUCCESS`, TxID `28T57883BE693350X`)<br>Item `2FN4JTY2SF8A2`: $1.00 USD (`UNCLAIMED`, TxID `37H27417P36178843`) | Live Sandbox API Call |
| **Payouts v1** | `DT5LUFX353YBU` | `DENIED` | Rejected with `SELF_PAY_NOT_ALLOWED` (Honest audit proof of PayPal business rule enforcement) | Live Sandbox API Call |
| **Orders v2** | `ORD-1731149200-DONATION` | `COMPLETED` | $1,000.00 USD captured donation inflow to Storm Treasury | Live Sandbox API Call |
| **Vault v3** | `POST /v3/vault/setup-tokens` | `NOT_AUTHORIZED` | Standard sandbox merchant restriction (`403 Forbidden`). Accurately classified as *Production Path — Requires PayPal Vault Approval*. | Empirical Probe |
| **Webhooks v1** | `PAYMENT.PAYOUTSBATCH.SUCCESS` | `VERIFIED` | Full cryptographic signature verification over transmission payload | Unit + Integration Test |

---

## 6. Golden Rules of AI Safety (Enforced by Architecture)

1. **Rules Decide the Money:** Deterministic TypeScript in `lib/rules/engine.ts` governs eligibility, vulnerability ranking, and payout sizing. Zero AI imports exist in the policy engine.
2. **AI Never Moves Money:** Watch Officer has zero mutation tools, zero access to PayPal Payouts, and cannot approve payout plans.
3. **Treasurer Code Isolation:** Only `lib/treasurer/index.ts` is permitted to invoke the PayPal Payouts API. Verified automatically in CI via `tests/arch/boundary.test.ts`.
4. **Dual-Custody Passkey Requirement:** No disbursement can execute without two distinct WebAuthn passkey signatures matching the immutable SHA-256 plan hash, with at least one holding the Finance role.

