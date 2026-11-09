# Landfall — Devpost Submission Package
### PayPal AI Hackathon 2026 · Project Submission Text

> **Project Name:** Landfall  
> **Tagline:** Cash before the storm. Ready before the warning.  
> **Submission URL:** `https://paypalaihackathon.devpost.com/`  
> **Repository:** `https://github.com/Bharathadi01/landfall`  
> **Track:** Build What's Next with PayPal and AI  
> **Sponsor Category:** AG Grid ($5,000 challenge)  
> **Open Source License:** MIT  

---

## 1. Problem Statement

When a severe hurricane approaches landfall, low-income families and vulnerable residents face an immediate liquidity crisis: they need cash *before* the storm to buy plywood, purchase fuel, fill medical prescriptions, or evacuate flood zones. 

Traditional humanitarian relief typically arrives weeks or months after the disaster, leaving families to absorb catastrophic debt or remain trapped in harm's way. 

While mutual-aid groups and local community funds want to release cash early, they face three major operational bottlenecks:
1. **Intake paralysis:** Rushing to assemble beneficiary lists and verify bank details while storm warnings are active.
2. **Allocation friction:** Inventing subjective prioritization rules under immense community pressure.
3. **Disbursement caps & audit gaps:** Using personal peer-to-peer payment accounts (such as personal Venmo or Cash App) that freeze due to transaction caps, lack dual-authorization controls, and leave no auditable ledger.

---

## 2. Target Audience

Landfall is designed specifically for **local mutual-aid funds, community foundations, faith-based disaster ministries, and grassroots volunteer relief coordinators**.

*Scope Honesty:* Landfall does not claim to replace national disaster agencies (like FEMA or the Red Cross) or enterprise multi-program platforms (like AidKit). It is purpose-built for agile community funds who need free, open-source, PayPal-native infrastructure to protect their own neighborhoods.

---

## 3. The Solution: Anticipatory Relief Operating System

Landfall moves the operational burden from *during the crisis* to *before the season*. It coordinates one cohesive, joined-up community response:

1. **Pre-Enrolment:** Vulnerable households pre-register before hurricane season via a mobile-first, 5-language intake portal (`/r/enroll`), establishing payment routing (PayPal email/ID) and vulnerability tier.
2. **Official Hazard Ingestion:** Landfall Sentinel ingests official National Weather Service (NWS) warning polygons and National Hurricane Center (NHC) tropical cyclone GIS tracks in real time.
3. **Deterministic Exposure Mapping:** Turf.js spatial algorithms map warning polygons against household locations using privacy-preserving coordinate centroid masking.
4. **Transparent Policy Engine:** A pure TypeScript rules engine evaluates available treasury cash against protected reserves, deterministically allocating grants ($100 base + vulnerability additions) and fairly waitlisting lower tiers if funding is constrained.
5. **AI Operational Scrutiny:** The AI Watch Officer analyzes operational threats, checks solvency margins, and flags duplicate addresses or anomalous claims—without having any authority to set amounts or approve payouts.
6. **Dual Passkey Authorization:** Two distinct coordinators (including one verified Finance Director) sign the immutable SHA-256 plan hash using WebAuthn hardware passkeys.
7. **PayPal Sandbox Execution:** PayPal Payouts v1 executes the approved disbursements with strict `PayPal-Request-Id` idempotency.
8. **Automated Reconciliation:** PayPal webhooks update a double-entry general ledger, recording debits, credits, and unspent cash rollbacks.

---

## 4. Key Differentiator: The Storm Readiness Drill

Landfall's signature innovation is the **Storm Readiness Drill (Rehearsal Lab)** (`/console/rehearsal`). 

Coordinators cannot afford to learn their software or test payment rails during an actual hurricane. The Rehearsal Lab enables community teams to rehearse their exact workflow against authentic historical disasters (Hurricane Milton 2024, Hurricane Helene 2024, Hurricane Idalia 2023) across seven operational stress scenarios:
- **Normal Funding:** 100% allocation across all exposed households.
- **Funding Shortfall:** Automated deterministic waitlisting based on vulnerability priority.
- **Increased Exposure:** Dynamic recalculation when warning polygons expand inland.
- **Delayed Verification:** Routing unverified documents to human review without demoting households.
- **Failed Payouts:** Automated recovery workflows for unclaimed or returned transfers.
- **False Alarms:** Instant cancellation when warning products are downgraded, protecting $0.00 lost.
- **Reserve Protection:** Hard barriers preventing depletion of core organizational reserves.

Every drill generates an immutable, cryptographically hashed reconciliation receipt verifying fee overhead ($0.25 flat fee = 0.25% fee overhead; **99.75% direct relief delivered**).

---

## 5. PayPal Developer Platform Integration

Landfall deeply integrates the PayPal Developer Platform exclusively in the Sandbox environment (`api-m.sandbox.paypal.com`):

| PayPal API / Feature | Exact Endpoint / SDK | Concrete Role in Landfall |
|---|---|---|
| **PayPal Orders v2** | `POST /v2/checkout/orders`<br>`POST /v2/checkout/orders/{id}/capture` | Powers the community donation flow, capturing donor funds and crediting the relief treasury ledger. |
| **PayPal Payouts v1** | `POST /v1/payments/payouts`<br>`GET /v1/payments/payouts/{batch_id}` | Executes Tranche 1 anticipatory grants to verified recipients with unique idempotency keys. |
| **PayPal Subscriptions v1** | `POST /v1/billing/subscriptions`<br>`GET /v1/billing/plans` | Manages monthly sustainer commitments providing standby liquidity before disaster season. |
| **PayPal Reporting v1** | `GET /v1/reporting/balances`<br>`GET /v1/reporting/transactions` | Powers the treasury reconciliation engine, verifying internal ledger balances against PayPal bank balances. |
| **PayPal Webhooks v1** | `POST /v1/notifications/verify-webhook-signature` | Cryptographically validates incoming event signatures, processing `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `BLOCKED`, and `UNCLAIMED`. |
| **PayPal Vault v3 (Pledges)** | `POST /v3/vault/setup-tokens` | Evaluated in code for contingent storm pledges; transparently documented as restricted in standard sandbox without custom underwriting. |

---

## 6. Meaningful AI Implementation & Ethical Boundaries

### Model Architecture
- **Inference Budget:** Strictly **$0.00 spent**.
- **Provider:** Groq Cloud Free Plan.
- **Open-Weights Model:** `openai/gpt-oss-20b`.
- **Offline Fallback:** 100% deterministic local template fallback if Groq API is unavailable.

### AI Roles
1. **Watch Officer:** Operational disaster copilot synthesizing complex weather bulletins, exposure counts, and cash constraints into actionable briefings.
2. **Hazard Briefing Assistant:** Summarizes official NWS warning text with exact meteorological citations and issue timestamps.
3. **Plan Reviewer:** Scrutinizes deterministic payout proposals for solvency risk, duplicate address clusters, and anomalous claims.
4. **Relief Communications Assistant:** Drafts multilingual recipient SMS/email notifications strictly grounded in ledger records.
5. **AG Studio Adapter:** Implements official `AgLlmAdapter` to power natural-language queries directly within the AG Studio canvas.

### The Five Inviolable Invariants (Verified via CI AST Analysis)
1. **Rules decide money:** AI never sets eligibility, priority tiers, or disbursement amounts.
2. **AI cannot approve:** AI has zero write tools and cannot approve payout plans.
3. **AI cannot move money:** Core treasury modules never import AI SDKs.
4. **Dual-custody human sign-off:** Payouts require two distinct human passkey approvals over a locked plan hash.
5. **Database truth over model output:** Server-side number integrity filters override any hallucinated currency values with database ground truth.

---

## 7. Evidence & Verification

All capabilities are verified through automated testing and empirical sandbox records:

- **Automated Test Suite:** 30 test files, **263 tests passing (100%)**.
- **Static Boundary Security:** 5 architectural boundary tests validating total AI isolation from financial cores.
- **Strict TypeScript:** 0 compilation errors across strict mode.
- **ESLint Code Quality:** 0 errors or warnings.
- **Production Build:** 42 Next.js routes compiled cleanly.
- **Empirical Sandbox Batch ID:** `CYX4HC52K54WN`, Item `XVV68QXJWJ66Y` ($1.00 USD `SUCCESS`, TxID `6SM40781T11720216`).
- **Empirical Sandbox Donation Order:** `35996334K7032164X` created via `/api/donations/order` (PayPal Orders v2 requires donor authorization prior to server capture; unapproved orders are strictly excluded from ledger cash).

---

## 8. Hackathon Build Delta (Work Completed After Oct 1, 2026)

Landfall was comprehensively evolved during the PayPal AI Hackathon:

1. **Groq Free Migration:** Migrated from paid LLM endpoints to Groq Cloud Free Plan with `openai/gpt-oss-20b` and deterministic fallback ($0.00 cost).
2. **Storm Readiness Drill:** Architected `lib/rehearsal/lab.ts` and `/console/rehearsal` featuring 3 historical hurricanes and 7 stress scenarios.
3. **AG Studio War Room:** Integrated `ag-studio-react@3.1.0` with 8 custom relief widgets, live AG Grid filtering, and Studio Agent Framework bridge.
4. **Mobile-First Multilingual Portal:** Implemented 5-language resident enrollment (`/r/enroll`) and 24h appeals tracking (`/r/complaints`).
5. **Live Sentinel Weather Client:** Implemented live NWS alerts, NHC tropical cyclone GeoJSON cones, and NOAA nowCOAST WMS radar mosaics.
6. **WebAuthn FIDO2 Dual Passkeys:** Implemented hardware passkey signatures over immutable plan hashes.
7. **Comprehensive Audit Suite:** Expanded automated test suite from 120 tests to 263 passing tests, including full coverage of financial, rules, and security boundaries.

