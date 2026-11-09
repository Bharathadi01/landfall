# Ideal Customer Profile (ICP) & Buyer Definition (§20.1)

## 1. Initial Ideal Customer Profile (ICP)

- **Target Segment:** Small and mid-sized community relief funds, disaster-response nonprofits, community foundations, and grassroots mutual aid networks based in the United States that operate a verified PayPal Business account and distribute emergency relief cash via PayPal Payouts.
- **Primary Geography:** United States (domestic USD disbursements).
  - *Developer Location Disclosure:* The prototype was developed in India; however, official PayPal merchant feature guidelines list India as `Receive and withdraw` only (sending Payouts is not supported for Indian merchant accounts). Therefore, the demonstration is explicitly built for US PayPal merchant accounts operating in the PayPal Sandbox environment.
- **Primary Buyer / User:**
  - *Buyer:* Executive Director, Chief Financial Officer, or Board Treasurer of a community relief organisation.
  - *Daily Operators:* Emergency Operations Coordinator (case investigation and recipient communication) and Finance Lead (reserve oversight and dual passkey authorization).

---

## 2. Inclusion vs Exclusion Criteria

| Criterion | In Scope (Target ICP) | Out of Scope (Excluded) |
|---|---|---|
| **Account Type** | PayPal Business Account with Payouts enabled | Personal accounts or unverified basic business tiers |
| **Disbursement Volume** | 50 – 5,000 emergency payments per storm | Micro-grants (< 5 payments) or multi-million enterprise programmes |
| **Custody Posture** | Landfall acts as an assurance & workflow layer (zero custody) | Organisations seeking a custodian, bank, or escrow provider |
| **Payment Rail** | PayPal digital wallet & bank transfers via PayPal | Physical cash distribution networks or proprietary card systems |
| **System Maturity** | Grassroots & community foundations needing exception recovery | Large UN agencies already operating mature global suites (e.g. UNICEF HOPE) |

---

## 3. Market Validation Status

**Status:** `INITIAL HYPOTHESIS — VALIDATION IN PROGRESS`

In strict accordance with the competition evidence standards, Landfall does not claim commercial validation without verifiable operator interviews. The ICP serves as an engineering and product design hypothesis.

