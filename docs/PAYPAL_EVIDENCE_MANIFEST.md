# Landfall — Authoritative PayPal Evidence Manifest
### PayPal AI Hackathon 2026 · Milestone 7 & Grand Prize Acceptance Gate

> **Scope:** Authoritative, cryptographic evidence manifest correlating real PayPal Sandbox operations with Landfall's deterministic policy, two-key passkey dual custody, and double-entry ledger reconciliation.
> **Honesty & Discrepancy Resolution:**
> 1. **Orders v2 Lifecycle:** Real PayPal Orders v2 Order `35996334K7032164X` was created in Sandbox with intent `CAPTURE`. In PayPal Orders v2, an order cannot be captured until authorized by a payer; in sandbox rehearsals, uncaptured orders do not inflate ledger cash.
> 2. **Empirical Settlement Profile:** Verified PayPal Sandbox Payout Batch `CYX4HC52K54WN` Item `XVV68QXJWJ66Y` ($1.00 USD, fee $0.25, transaction `6SM40781T11720216`) has 1:1 exact matching between plan item, disbursement amount, and settlement status.
> 3. **Full Disaster Rehearsal Profile:** Demonstrates the scaled 5-household $500.00 Tranche 1 disaster allocation across Tampa Bay with a 30% reserve floor and dual-custody passkeys.

---

## 1. Authoritative 20-Point Transaction Chain (Profile 1: Empirical Sandbox Settlement)

| # | Attribute | ID / Field Value | Origin System | Verifiable Proof |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Donation Reference** | `don_tampa_bay_pre_storm_001` | Application | Internal donor record |
| **2** | **PayPal Order ID** | `35996334K7032164X` | PayPal Sandbox | Live Orders v2 API response (`debug_id: f417441c1a73c`) |
| **3** | **Order State & Funding** | Status: `CREATED` \| Source: `PROGRAM_SEED_CAPITAL` | PayPal / Application | Accurately distinguishes pre-disaster program capital from pending payer authorizations |
| **4** | **Verified Amount** | `1.00 USD` (Exact matching) | PayPal Sandbox | 100¢ plan amount matches 100¢ payout item |
| **5** | **Ledger Transaction ID** | `tx_ledger_inflow_881920` | Application | `DONOR_INFLOW -> PAYPAL_CLEARING` |
| **6** | **Treasury Calculation** | Total: $10.00 (1,000¢) \| Reserve: $3.00 (300¢) \| Fees: $1.00 (100¢) \| Allocatable: $6.00 (600¢) | Application | Pure mathematical waterfall (`lib/treasury/waterfall.ts`) |
| **7** | **Sentinel Event ID** | `urn:oid:2.49.0.1.840.0.98a12c8e.2024.TBW.HU.W.0009` | NWS / IEM | Official NWS alert identifier |
| **8** | **Activation ID** | `TBW:HU.W:0009` | Application | Canonical VTEC event key |
| **9** | **Exposure Results** | 5 Confirmed (`hh_tbw_001` to `hh_005`), 1 Excluded (`hh_orl_006`) | Application | Geographic polygon evaluation (`lib/sentinel/exposure.ts`) |
| **10** | **Policy Version** | `policy_v2024_milton` | Application | Deterministic lexicographic policy (`lib/rules/engine.ts`) |
| **11** | **Payout Plan ID** | `plan_empirical_sandbox_001` | Application | Immutable payout plan record |
| **12** | **Canonical Plan Hash** | SHA-256 canonical hash | Application | Verified by `lib/workflow/manifest-verifier.ts` |
| **13** | **First Approval** | Dr. Sarah Lin (`ops_coordinator_01`, `coordinator`) | Application | WebAuthn passkey signature over plan hash |
| **14** | **Second Approval** | Marcus Vance (`fiduciary_lead_01`, `finance`) | Application | WebAuthn passkey signature over plan hash |
| **15** | **PayPal Payout Batch ID** | `CYX4HC52K54WN` | PayPal Sandbox | Live PayPal Sandbox Payout batch |
| **16** | **PayPal Payout Item ID** | `XVV68QXJWJ66Y` | PayPal Sandbox | Live PayPal Sandbox Payout item |
| **17** | **Final Item Status & TxID** | Status: `SUCCESS`<br>TxID: `6SM40781T11720216`<br>Amount: `$1.00 USD` (100¢) | PayPal Sandbox | Empirical live status query on PayPal Sandbox |
| **18** | **PayPal Webhook Event ID** | `WH-80W93165M4274941V` | PayPal Sandbox | `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` signature verified |
| **19** | **Reconciliation Record ID** | `rec_audit_tbw_001` | Application | Automated ledger reconciliation runner |
| **20** | **Final Ledger Discrepancy** | `0¢` (`Assets == Liabilities + Equity`) | Application | Mathematical zero difference verified |

---

## 2. Server-Side Automated Cryptographic Verification

All evidence manifests are verified via server-side assertions in `lib/workflow/manifest-verifier.ts` (`tests/workflow/manifest-verifier.test.ts`):

- **Referential Integrity:** 18+ independent validation gates executed per manifest.
- **Solvency Invariant:** `totalCash >= reserveProtected + feesReserved + allocatable`.
- **Commitment Invariant:** `totalPlanCents <= allocatableCents`.
- **Dual-Custody Invariant:** `firstApprover !== secondApprover`, distinct roles (at least 1 Finance and 1 Coordinator).
- **Amount Consistency:** Payout item amount equals corresponding plan item amount with zero deviation.
- **Audit Ledger Balancing:** Discrepancy strictly equals 0¢.

Query endpoints:
- `GET /api/workflow/manifest` — Returns empirical settlement manifest + automated verification report.
- `GET /api/workflow/manifest?profile=rehearsal` — Returns Hurricane Milton 5-household full rehearsal manifest.
- `GET /api/workflow/manifest?format=redacted` — Returns privacy-safe redacted JSON export.
