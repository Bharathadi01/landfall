# Non-Money-Moving Pilot Protocol (§20.6)

## 1. Pilot Mission & Safety Boundaries

The Landfall Pilot Protocol provides community relief organizations with a secure, zero-risk pathway to test Proof-Carrying Relief Recovery against real historical or anonymized data without moving live funds.

- **Mode:** `LIVE_READ_ONLY` or `PILOT_SANDBOX`.
- **Zero Money Movement:** The pilot tenant has zero write access to PayPal Payouts or live bank debits.
- **Privacy Standard:** Beneficiary names and phone numbers are redacted prior to ingestion; only pseudonymous household IDs and masked emails are processed.
- **Consent Prerequisite:** Requires written data-processing authorization and an agreed 90-day data retention/deletion schedule.

---

## 2. Three-Stage Pilot Lifecycle

### Stage 1: Historical Data Ingestion & Obligation Linking (Day 1–7)
- Organization securely uploads a CSV export of past disaster disbursements and corresponding household entitlement records.
- Landfall's ingestion pipeline validates recipient formats, checks for duplicate allocations, and links payout records to relief obligations.
- Produces a baseline **Obligation Traceability Audit** identifying orphan records or unmatched debits.

### Stage 2: Forensic Exception Classification (Day 8–14)
- Landfall runs historical payout items through the 18-rule Exception Taxonomy.
- The AI Relief Money Investigator analyzes anomalies (`UNCLAIMED`, `FAILED`, `RETURNED`) and drafts structured findings.
- The organization compares Landfall's automated safe recommendations against the actual manual actions taken by their staff during the real event.

### Stage 3: Proof Generation & Reconciliation Audit (Day 15–30)
- Simulates resolution of past exceptions and generates cryptographic SHA-256 Recovery Proof certificates.
- Runs double-entry ledger reconciliation against historical PayPal monthly financial statements.
- Produces a formal **Pilot Evaluation Report** detailing:
  - Discrepancy detection rate
  - Estimated time saved per exception
  - Duplicate risk exposure prevented
  - Recommendations for live operational deployment

