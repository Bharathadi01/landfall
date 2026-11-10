# Landfall AG Analytical Measure Dictionary

**Version:** 3.1.0-PrizeCorrection  
**Specification Reference:** `LANDFALL_AG_GRID_STUDIO_PRIZE_MASTER_SPEC.md` (§3, §9)  
**Classification:** Financial Analytics & Analytical Measures Specification  
**Environment Provenance:** PayPal Sandbox / Historical Milton Replay (October 2024)

---

## 1. Executive Overview & Design Principles

The Landfall AG Studio analytics environment operates under strict financial integrity rules:
1. **Zero Double-Counting:** Joins between parent datasets (e.g. `payout_batches`, `treasury`) and child grains (e.g. `payout_items`, `webhook_observations`) must never sum parent-level amounts across child records.
2. **Deterministic Reserve Floor:** A statutory 30.0% reserve floor invariant is evaluated deterministically in code; analytics measures reflect this invariant directly from `solvency` and `treasury` tables.
3. **Traceable Minor Units:** Double-entry ledger reconciliation is tracked in integer minor units (USD cents) to prevent floating-point rounding errors.
4. **Honest Provider Semantics:** PayPal provider status `SUCCESS` strictly denotes that funds were credited to the recipient's PayPal account; it does not attest to personal cash withdrawal or physical receipt.
5. **Exact Metric Attribution:** Every metric explicitly documents whether its underlying data is live, sandbox, replay, or simulated.

---

## 2. Definitive Measure Dictionary

### Measure 1: Recognised Funding
- **Measure Name:** `recognised_funding_usd`
- **Business Definition:** Total cumulative recognized and deposited disaster relief donor funds in the Landfall operating account.
- **Formula:** 
  $$\sum \text{funding\_events.amount\_usd}$$
- **Source Datasets:** `funding_events` (where `status = 'CONFIRMED'`)
- **Aggregation:** `SUM`
- **Currency Handling:** Floating USD formatted to `\$XX,XXX` or standard currency string; internally reconciled with `funding_events.amount_cents / 100`.
- **Filter Behaviour:** Filters by `received_at` date ranges, `event_type` (`CORPORATE_GRANT`, `INDIVIDUAL_MATCH`, etc.), and campaign ID. Unaffected by recipient-level filters.
- **Null Handling:** Null or missing records evaluate to `0.00`.
- **Environment Provenance:** `SANDBOX REPLAY` (Historical Milton Replay).
- **Ledger Invariant Reconciled Value:** **\$14,250.00** across verified initial grants ($10,000 corporate matching + $4,250 community donor pool).

---

### Measure 2: Statutory Reserve Floor (30%)
- **Measure Name:** `statutory_reserve_floor_usd`
- **Business Definition:** The legally mandated statutory minimum liquidity reserve floor (30.0% of total recognised funding) locked by smart contract / policy engine invariant.
- **Formula:** 
  $$\text{statutory\_reserve\_floor\_usd} = \text{total\_balance\_usd} \times 0.30$$
- **Source Datasets:** `solvency`, `treasury`
- **Aggregation:** Direct scalar or `MAX` across active treasury balance snapshot.
- **Currency Handling:** USD, rounded up to nearest cent.
- **Filter Behaviour:** System-wide baseline; independent of worklist or UI cross-filters.
- **Null Handling:** Defaults to 30.0% of total available funds if omitted.
- **Environment Provenance:** `SANDBOX REPLAY` (Statutory Policy Rule).
- **Ledger Invariant Reconciled Value:** **\$4,275.00** ($14,250.00 \times 0.30$).

---

### Measure 3: Actual Protected Reserve
- **Measure Name:** `protected_reserve_usd`
- **Business Definition:** Actual protected cash ring-fenced in the reserve vault. Must always be $\ge$ the statutory reserve floor.
- **Formula:** 
  $$\text{protected\_reserve\_usd} = \text{solvency.reserve\_usd}$$
- **Source Datasets:** `solvency`, `treasury.protected_reserve`
- **Aggregation:** `LAST` / snapshot scalar.
- **Currency Handling:** USD integer cents / 100.
- **Filter Behaviour:** Global fund invariant; unaffected by payout item filters.
- **Null Handling:** Asserts failure if null (strict non-null constraint in database).
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **\$5,000.00** (Surplus allocation exceeding statutory requirement).

---

### Measure 4: Reserve Headroom
- **Measure Name:** `reserve_headroom_usd`
- **Business Definition:** Safety margin of protected funds held above the statutory 30% floor. A positive value confirms regulatory compliance; zero indicates strict boundary; negative indicates breach.
- **Formula:** 
  $$\text{reserve\_headroom\_usd} = \text{protected\_reserve\_usd} - \text{statutory\_reserve\_floor\_usd}$$
- **Source Datasets:** `solvency`
- **Aggregation:** Scalar difference.
- **Currency Handling:** USD signed currency.
- **Filter Behaviour:** Invariant; global.
- **Null Handling:** Returns `0.00` if inputs are missing.
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **+\$725.00** ($5,000.00 - $4,275.00).

---

### Measure 5: Available Allocatable Funds
- **Measure Name:** `allocatable_funds_usd`
- **Business Definition:** Maximum liquid cash currently eligible for disbursement to approved hurricane relief obligations without encroaching upon the protected reserve.
- **Formula:** 
  $$\text{allocatable\_funds\_usd} = \text{total\_balance\_usd} - \text{protected\_reserve\_usd}$$
- **Source Datasets:** `solvency.allocatable_usd`, `treasury`
- **Aggregation:** Direct scalar from reconciled treasury position.
- **Currency Handling:** USD currency format.
- **Filter Behaviour:** Independent of UI cross-filtering.
- **Null Handling:** Strict exception thrown if undefined.
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **\$9,250.00** ($14,250.00 - $5,000.00).

---

### Measure 6: Approved Obligations Value
- **Measure Name:** `approved_obligations_usd`
- **Business Definition:** Sum total of disaster grant commitments approved by dual-passkey authorization for households meeting vulnerability criteria in the storm warning polygon.
- **Formula:** 
  $$\sum \text{relief\_obligations.grant\_usd} \quad \text{WHERE status} \in \{\text{'APPROVED'}, \text{'COMMITTED'}, \text{'DISBURSED'}\}$$
- **Source Datasets:** `relief_obligations`
- **Aggregation:** `SUM`
- **Currency Handling:** USD currency format ($500.00 per household tranche).
- **Filter Behaviour:** Dynamically filtered by `vulnerability_tier` (1 to 5), `evacuation_zone` (A, B, C, D, E), and `county`.
- **Null Handling:** Evaluates to `0.00`.
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **\$2,500.00** across 5 approved households (Milton Tranche 1).

---

### Measure 7: Funding Coverage Ratio (3.7x)
- **Measure Name:** `funding_coverage_ratio`
- **Business Definition:** Solvency coverage multiple indicating how many times over the currently approved relief obligations could be funded using liquid allocatable cash.
- **Exact Mathematical Formula:**
  $$\text{funding\_coverage\_ratio} = \frac{\text{allocatable\_funds\_usd}}{\text{approved\_obligations\_usd}} = \frac{\$9,250.00}{\$2,500.00} = 3.70\text{x}$$
- **Numerator:** Liquid allocatable funds (\$9,250.00), excluding the \$5,000.00 protected reserve.
- **Denominator:** Currently approved relief grant liabilities (\$2,500.00 in Tranche 1).
- **Business Interpretation & Safeguard Caveat:**
  > [!IMPORTANT]
  > The 3.7x coverage multiple confirms that the active tranche of approved obligations ($2,500.00) is **3.7 times covered** by uncommitted liquid cash ($9,250.00). It must **NOT** be labeled as "Can we pay everyone?" or "Universal disaster coverage", because subsequent tranches or unapproved pipeline applications have not yet been evaluated by the policy engine.
- **Filter Behaviour:** Recalculates dynamically if obligations are filtered by vulnerability tier or geographic zone.
- **Null Handling:** If denominator is 0, returns $\infty$ or "N/A (Zero obligations)".
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **3.7x**.

---

### Measure 8: Submitted Payout Batch Value
- **Measure Name:** `submitted_payout_batch_usd`
- **Business Definition:** Total value of payout instructions transmitted in batch to PayPal Payouts v1 API.
- **Formula:** 
  $$\sum \text{payout\_batches.total\_amount\_usd}$$
- **Source Datasets:** `payout_batches` (joined 1:1 on `batch_id`)
- **Aggregation:** `SUM` at batch grain. (Crucial: never sum across joined payout items).
- **Currency Handling:** USD formatted.
- **Filter Behaviour:** Filters by `batch_id` (`7Y5GP4ETNLCUQ`) and submission timestamp.
- **Null Handling:** Returns `0.00`.
- **Environment Provenance:** `PAYPAL SANDBOX` (Batch ID: `7Y5GP4ETNLCUQ`).
- **Ledger Invariant Reconciled Value:** **\$2,500.00**.

---

### Measure 9: Provider-Credited Payout Value (`SUCCESS`)
- **Measure Name:** `provider_credited_payout_usd`
- **Business Definition:** Total amount of payout transactions confirmed by PayPal API and webhooks as successfully deposited into the recipient's PayPal account balance.
- **Formula:** 
  $$\sum \text{payout\_items.amount\_usd} \quad \text{WHERE status} = \text{'SUCCESS'}$$
- **Source Datasets:** `payout_items`, `webhook_observations`
- **Aggregation:** `SUM` at `payout_item` grain.
- **Currency Handling:** USD.
- **Filter Behaviour:** Responsive to status and tier cross-filters.
- **Null Handling:** Returns `0.00`.
- **Semantics Safeguard:**
  > [!NOTE]
  > PayPal `SUCCESS` confirms wallet credit only. Recipient personal cash extraction or ATM withdrawal is distinct and tracked separately under `beneficiary_confirmed`.
- **Environment Provenance:** `PAYPAL SANDBOX`.
- **Ledger Invariant Reconciled Value:** **\$1,500.00** (3 households: `hh_tbw_001`, `hh_tbw_003`, `hh_tbw_004`).

---

### Measure 10: Unclaimed Assistance Value (`UNCLAIMED`)
- **Measure Name:** `unclaimed_assistance_usd`
- **Business Definition:** Value of dispatched relief grants delivered to PayPal where the resident has been notified via SMS/email but has not yet accepted or claimed the funds into their account.
- **Formula:** 
  $$\sum \text{payout\_items.amount\_usd} \quad \text{WHERE status} = \text{'UNCLAIMED'}$$
- **Source Datasets:** `payout_items`
- **Aggregation:** `SUM`
- **Operational Protocol:** Send authorized SMS reminder. **Strictly prohibit issuing a duplicate payout** while the original payment remains claimable during the 30-day window.
- **Environment Provenance:** `PAYPAL SANDBOX`.
- **Ledger Invariant Reconciled Value:** **\$500.00** (1 household: `hh_tbw_002` / Arthur Pendelton).

---

### Measure 11: Payout Under Compliance Hold (`ONHOLD`)
- **Measure Name:** `onhold_assistance_usd`
- **Business Definition:** Payout transactions flagged by PayPal compliance for routine security review.
- **Formula:** 
  $$\sum \text{payout\_items.amount\_usd} \quad \text{WHERE status} = \text{'ONHOLD'}$$
- **Source Datasets:** `payout_items`
- **Aggregation:** `SUM`
- **Operational Protocol:** Await release webhook (`PAYMENT.PAYOUTS-ITEM.HELD` $\rightarrow$ `SUCCESS`). Do not re-issue.
- **Environment Provenance:** `PAYPAL SANDBOX`.
- **Ledger Invariant Reconciled Value:** **\$500.00** (1 household: `hh_tbw_005` / R. Jenkins).

---

### Measure 12: Unresolved Payout Value
- **Measure Name:** `unresolved_payout_usd`
- **Business Definition:** Dollar sum of all dispatched payout items currently requiring operational investigation or awaiting asynchronous provider resolution.
- **Formula:** 
  $$\sum \text{payout\_items.amount\_usd} \quad \text{WHERE status} \in \{\text{'UNCLAIMED'}, \text{'ONHOLD'}, \text{'FAILED'}, \text{'BLOCKED'}, \text{'RETURNED'}\}$$
- **Source Datasets:** `payout_items`
- **Aggregation:** `SUM`
- **Currency Handling:** USD.
- **Filter Behaviour:** Dynamic cross-filter updates.
- **Null Handling:** `0.00`.
- **Environment Provenance:** `PAYPAL SANDBOX`.
- **Ledger Invariant Reconciled Value:** **\$1,000.00** (\$500.00 UNCLAIMED + \$500.00 ONHOLD).

---

### Measure 13: Oldest Payout Exception Age
- **Measure Name:** `oldest_payout_exception_hours`
- **Business Definition:** Number of elapsed hours since the earliest unresolved payout item was submitted to PayPal.
- **Formula:** 
  $$\max \left(\frac{T_{\text{now}} - \text{submitted\_at}}{3600}\right) \quad \text{FOR unresolved payout items}$$
- **Source Datasets:** `payout_items`
- **Aggregation:** `MAX` elapsed time in hours.
- **Currency Handling:** Scalar float / hours.
- **Filter Behaviour:** Filterable by status and cohort.
- **Null Handling:** Returns `0` if all items are resolved.
- **Environment Provenance:** `HISTORICAL REPLAY` (Baseline relative to simulation anchor 18:30 UTC).
- **Ledger Invariant Reconciled Value:** **4.2 hours**.

---

### Measure 14: Double-Entry Ledger Variance (Minor Units)
- **Measure Name:** `ledger_variance_cents`
- **Business Definition:** Net discrepancy between debits and credits across assets, liabilities, restricted reserves, and equity accounts in the Landfall double-entry ledger.
- **Formula:** 
  $$\text{ledger\_variance\_cents} = \left| \sum \text{debits\_cents} - \sum \text{credits\_cents} \right|$$
- **Source Datasets:** `ledger_reconciliation`
- **Aggregation:** Integer absolute sum of cents.
- **Currency Handling:** Minor units (integer cents).
- **Filter Behaviour:** Strict system audit metric.
- **Null Handling:** Strict non-null; non-zero value trips audit circuit breaker.
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **0¢** (Exact balance).

---

### Measure 15: Grievance Resolution Rate
- **Measure Name:** `grievance_resolution_pct`
- **Business Definition:** Proportion of recipient complaints, identity appeals, and disbursement grievances formally resolved by caseworkers.
- **Formula:** 
  $$\frac{\text{Resolved Inquiries}}{\text{Total Registered Inquiries}} \times 100\%$$
- **Source Datasets:** `relief_obligations` (grievance status attributes)
- **Aggregation:** Ratio of counts.
- **Currency Handling:** Percentage.
- **Filter Behaviour:** Filterable by zone and issue category (`MISSING_CLAIM_LINK`, `NAME_MISMATCH`, etc.).
- **Null Handling:** Returns `100.0%` if total inquiries is 0.
- **Environment Provenance:** `SANDBOX REPLAY`.
- **Ledger Invariant Reconciled Value:** **66.7%** (2 resolved of 3 total inquiries).

---

## 3. Dataset Grain and Relationship Cardinality

| Parent Dataset | Child Dataset | Cardinality | Join Key | Anti-Duplication Rule |
|---|---|---|---|---|
| `treasury` | `funding_events` | $1 : N$ | `account_id` | Never sum `treasury.total_balance` across `funding_events` rows. |
| `solvency` | `treasury` | $1 : 1$ | `snapshot_id` | Scalar snapshot join. |
| `payout_batches` | `payout_items` | $1 : N$ | `batch_id` | Calculate batch metrics from `payout_batches`; sum item values from `payout_items`. |
| `relief_obligations` | `payout_items` | $1 : 1$ | `obligation_id` | 1 relief grant maps to exactly 1 payout item in active tranche. |
| `payout_items` | `webhook_observations` | $1 : N$ | `item_id` | Filter webhooks by `is_authoritative = true` or use window aggregation (`FIRST`/`LAST`). |
| `payout_items` | `recovery_proofs` | $1 : 1$ | `item_id` / `batch_id` | Anchor cryptographic hash without multiplying transaction amount. |
| `payout_items` | `approval_events` | $1 : 2$ | `plan_id` | Dual-passkey requires 2 signers per plan; never duplicate item value by 2. |

