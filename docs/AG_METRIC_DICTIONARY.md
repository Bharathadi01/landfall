# Landfall AG Studio Canonical Metric Dictionary

**Version:** 3.1.0  
**Design Reference:** `LANDFALL_AG_GRID_STUDIO_PRIZE_MASTER_SPEC.md` (§9)

---

## 1. Metric Canonical Definitions

| Metric Name | Canonical Definition | Source Grain | Safe Unit | Invariant & Boundary Notes |
|---|---|---|---|---|
| **Funding Received** | Recognized contributions deposited in the PayPal account under verified webhook events. | `funding_events.amount_usd` (SUM) | USD ($) | Excludes pending checkout orders and failed pledges. |
| **Available Funds** | Liquid balance in PayPal available for immediate disaster obligation commitments. | `solvency.allocatable_usd` | USD ($) | Authoritatively derived: `total_balance - protected_reserve`. Excludes protected reserve. |
| **Protected Reserve** | Statutory/policy reserve funds locked by deterministic invariant. | `solvency.reserve_usd` | USD ($) | Enforces 30% policy floor ($4,275 required on $14,250 total; $5,000 actual). Code cannot spend this balance. |
| **Reserve Policy Floor** | Minimum reserve percentage mandated by governance policy. | `solvency.policy_floor_pct` | Percent (%) | Hardcoded to 30.0% in policy engine. |
| **Reserve Headroom** | Surplus reserve held above the mandatory 30% policy floor. | `solvency.headroom_usd` | USD ($) | Formula: `actual_reserve - (total_balance * 0.30)`. Must remain positive (currently +$725.00). |
| **Approved Obligations** | Formal grant liabilities approved via dual-passkey signatures for eligible households in warning polygon. | `relief_obligations.grant_usd` (SUM) | USD ($) | Exactly 5 households × $500.00 = $2,500.00 in Milton Tranche 1. |
| **Submitted Payout Value** | Payout items formally posted to PayPal Payouts v1 API via batch transaction. | `payout_items.amount_usd` (SUM) | USD ($) | Matches submitted batch `7Y5GP4ETNLCUQ` ($2,500.00). |
| **Provider-Credited Value** | Value of payout items confirmed by PayPal as successfully credited to recipient account (`SUCCESS`). | `payout_items` WHERE `status = 'SUCCESS'` | USD ($) | Exactly 3 items × $500 = $1,500.00. Confirms wallet credit only; does NOT prove cash extraction. |
| **Unclaimed Value** | Value of payout items delivered to PayPal but not yet accepted by the recipient (`UNCLAIMED`). | `payout_items` WHERE `status = 'UNCLAIMED'` | USD ($) | 1 item × $500 = $500.00. Resident alerted via SMS. Re-issue prohibited until claim expires or cancels. |
| **On-Hold Value** | Value of payout items placed under routine risk screening by PayPal compliance (`ONHOLD`). | `payout_items` WHERE `status = 'ONHOLD'` | USD ($) | 1 item × $500 = $500.00. Requires automated release webhook. Duplicate re-issue prohibited. |
| **Unresolved Exception Count** | Number of payout items requiring human review or automated webhook resolution. | `payout_items.is_unresolved` (SUM) | Items | Items with status `UNCLAIMED`, `ONHOLD`, `FAILED`, `RETURNED`, `BLOCKED`, `REFUNDED`, `REVERSED`. |
| **Unresolved Exception Value** | Total dollar value of payouts in unresolved exception state. | `payout_items.unresolved_usd` (SUM) | USD ($) | Sum of unresolved item amounts. Currently $1,000.00 in active Milton response. |
| **Reconciled Value** | Payout amounts verified against double-entry general ledger with zero minor-unit variance. | `ledger_reconciliation.debit_usd` | USD ($) | Balanced debits and credits across all accounts. |
| **Reconciliation Variance** | Discrepancy between PayPal reported disbursements and internal ledger balance. | `ledger_reconciliation.variance_cents` | Minor Units (¢) | Must equal exactly 0¢. Any non-zero variance triggers critical audit alert. |
| **Beneficiary Receipt Confirmation** | Direct resident or field-attested confirmation of relief assistance received. | `payout_items.beneficiary_confirmed` | Count / State | Strictly distinct from PayPal `SUCCESS`. |

---

## 2. Status Mapping Matrix (PayPal Payouts v1)

| Provider Status | User-Facing Label | Palette Tone | Meaning | Permitted Operational Action |
|---|---|---|---|---|
| `SUCCESS` | Provider Credited | Accent / Green (`#2DD4BF`) | Funds credited to recipient PayPal or Venmo wallet balance. | Record settlement proof; close out obligation. |
| `PENDING` | In Transit | Neutral / Blue (`#54A0FF`) | PayPal batch node processing payment. | Await clearing webhook (timeout 15m). |
| `UNCLAIMED` | Unclaimed by Resident | Amber (`#FBBF54`) | Recipient notified by SMS/email; has not claimed funds. | Send SMS reminder. Do NOT issue second payment. |
| `ONHOLD` | Provider Security Hold | Warning / Orange (`#FF7A59`) | PayPal compliance routine risk evaluation hold. | Monitor webhook feed. Confirm secondary phone contact. |
| `FAILED` | Payout Failed | Danger / Red (`#FF6378`) | Account closed, invalid identifier, or blocked by PayPal. | Collect updated contact / payment path; prepare new plan. |
| `RETURNED` | Returned to Fund | Amber / Gray (`#A3AEC2`) | 30-day unclaimed window expired; funds swept back to fund. | Re-confirm displacement address; offer assisted cashout. |
| `BLOCKED` | Blocked by Policy | Danger / Red (`#FF6378`) | Compliance denial or regulatory restriction. | Manual caseworker review required. |
| `REFUNDED` | Refunded | Violet (`#A78BFA`) | Funds refunded back to organization balance. | Adjust ledger entries. |
| `REVERSED` | Reversal | Violet (`#A78BFA`) | Administrative chargeback or reversal. | Reconcile ledger variance. |

