# Operator Discovery & Validation Script (§20.2)

## 1. Interview Protocol Overview

- **Format:** 15-minute semi-structured qualitative interview.
- **Audience:** Relief-fund treasurers, disaster finance managers, and nonprofit payment administrators.
- **Compliance & Privacy:**
  - Strict confidentiality: No beneficiary PII, credentials, or live transaction IDs requested.
  - Explicit consent: Recorded notes are anonymized by default.
  - Neutral stance: Explores real past incidents rather than pitching hypothetical features.

---

## 2. Structured Interview Questionnaire

### Section A: Role & Operational Context
1. What is your role in approving, dispatching, or reconciling outbound emergency assistance payments?
2. Roughly how many outbound relief payments do you handle during a normal month versus during an active disaster response?
3. Which payment rails and accounting systems does your organization actively use (e.g. PayPal, bank ACH, physical checks, QuickBooks)?

### Section B: Recent Real Exception Incident
4. Think about the most recent relief payout that was pending, unclaimed, failed, returned, or placed on hold. What happened?
5. How was the exception discovered (e.g. resident complained, bank reconciliation, provider webhook)?
6. Which screens, reports, spreadsheets, or staff members did you need to consult to understand the issue?
7. Approximately how long did it take from noticing the exception to determining the safe next action?
8. What happened to the recipient's relief obligation while the payout was unresolved?
9. How did you prove that the funds had or had not returned to your organization's account?
10. How did you prevent an accidental duplicate payment?

### Section C: Frequency, Effort & Consequences
11. In the last 90 days, approximately how many payout exceptions occurred relative to total disbursements?
12. Approximately how much staff time did investigating the last exception consume?
13. Did the incident cause delayed aid, duplicate financial risk, complaints, or write-offs?

### Section D: Product Fit & Disconfirmation
14. Does your current accounting or payment platform link provider-item state history back to individual household obligations?
15. If a tool provided automated read-only exception investigation, duplicate blocking, and cryptographic proof of resolution, would it add value or create another system to maintain?
16. What security, compliance, or procurement requirement would prevent adoption?
17. Do you currently use or have permission to use PayPal Payouts for emergency assistance? (If no, record as broader context but not PayPal-ICP validation).

