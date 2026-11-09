# Landfall — Storm Readiness Drill (Rehearsal Lab)
### Operational Runbook & Evidence · Master Plan Phase 2.8 Deliverable

> **Product Feature:** Storm Readiness Drill (Rehearsal Lab)  
> **Route:** `/console/rehearsal`  
> **Backend Orchestrator:** `lib/rehearsal/lab.ts`  
> **Automated Test Coverage:** `tests/rehearsal/lab.test.ts` (11/11 tests passing)  
> **Data Provenance:** Historical NWS/IEM warning geometry + Synthetic Household Personas (`[DEMO PERSONA]`) + Verified PayPal Sandbox Payouts (`CYX4HC52K54WN`)  

---

## 1. Overview & Purpose

In community disaster relief, volunteer coordinators and mutual-aid groups face an operational paradox: **they cannot afford to learn their software or test their payment rails during an active hurricane landfall.**

The **Storm Readiness Drill** is Landfall's signature product innovation. It allows community fund coordinators to rehearse their complete anticipatory cash workflow before hurricane season begins:

```
[Official Warning Replay]
          │
          ▼
[Turf.js Deterministic Exposure] ──► [Exposure Polygon vs Pre-Enrolled Homes]
          │
          ▼
[Treasury Waterfall Calculation] ──► [Available Cash vs Reserve Minimums]
          │
          ▼
[Deterministic Allocation Engine] ──► [Tiers 1-4 Ranked / Shortfall Waitlisting]
          │
          ▼
[Plan Reviewer AI Challenge] ──► [Solvency Margin, Redundancy, Injection Checks]
          │
          ▼
[Dual Passkey WebAuthn Approval] ──► [Coordinator + Finance Sign Locked Hash]
          │
          ▼
[PayPal Sandbox Execution] ──► [Batch / Single Payouts via api-m.sandbox]
          │
          ▼
[Reconciliation & Audit Trail] ──► [SHA-256 Receipt, Webhooks, Balanced Ledger]
```

---

## 2. Historical Storm Replay Scenarios

The rehearsal lab provides three authentic historical storm datasets extracted from the Iowa Environmental Mesonet (IEM) and National Hurricane Center archives:

| Historical Event | Year | Landfall Intensity | WFO & Target County | Lead Time Before Landfall | Key Challenge Rehearsed |
|---|---|---|---|---|---|
| **Hurricane Milton** | 2024 | Category 3 (120 mph) | `TBW` (Tampa Bay / Siesta Key) | **52.4 hours** | Rapid intensification; high coastal surge exposure in dense urban area. |
| **Hurricane Helene** | 2024 | Category 4 (140 mph) | `TAE` (Tallahassee / Big Bend) | **48.0 hours** | Catastrophic inland flood risk across multi-state rural corridors. |
| **Hurricane Idalia** | 2023 | Category 3 (125 mph) | `TAE` (Taylor County / Keaton Beach) | **41.5 hours** | Fast forward motion; extreme coastal water level anomalies. |

---

## 3. Seven Operational Stress Scenarios

Coordinators can toggle between seven stress scenarios to verify system behavior under severe operational and financial constraints:

### 1. `NORMAL_FUNDING` (Baseline Solvency)
- **Condition:** Treasury balance is $25,000 liquid cash; 5 exposed households require $500.00 ($100 each + $1.25 fees).
- **Behavior:** 100% of exposed households funded immediately; operating reserve ($5,000) fully protected; zero waitlist.

### 2. `FUNDING_SHORTFALL` (Constrained Liquidity)
- **Condition:** Liquid balance is restricted to $250.00; total need is $501.25.
- **Behavior:** System deterministically prioritizes Tier 1 (medical device dependence) and Tier 2 (elderly living alone). Lower tiers are automatically waitlisted without coordinator bias.

### 3. `INCREASED_EXPOSURE` (Expanding Hazard Cone)
- **Condition:** NWS issues an updated warning polygon expanding eastward into inland Orlando.
- **Behavior:** Spatial engine automatically detects inland resident `hh_orl_006`, re-evaluates exposure, and prompts coordinators for an additional tranche.

### 4. `DELAYED_VERIFICATION` (Missing Paperwork)
- **Condition:** Two households have pending proof-of-address documents or unverified PayPal IDs.
- **Behavior:** In accordance with humanitarian golden rules, missing documents route to `NEEDS_REVIEW` with an auditable appeal link; they are **never demoted** or disqualified.

### 5. `FAILED_PAYOUT` (Account Lock or Timeout)
- **Condition:** Recipient PayPal email fails to claim funds or transitions to `UNCLAIMED`.
- **Behavior:** Outbox orchestrator catches webhook status, prevents double-spends, rolls back the internal ledger allocation, and generates claim recovery instructions.

### 6. `FALSE_ALARM` (Warning Cancellation / Downgrade)
- **Condition:** NWS cancels Hurricane Warning prior to dual-custody approval.
- **Behavior:** Sentinel detects `messageType: "Cancel"`, instantly aborts the pending plan, and returns treasury to `STANDBY` with **$0.00 lost**.

### 7. `RESERVE_PROTECTION` (Solvency Invariant)
- **Condition:** High disaster demand threatens the fund's $5,000 baseline reserve.
- **Behavior:** Hard code barrier prevents payouts from encroaching upon protected reserves, ensuring organizational survival post-disaster.

---

## 4. Step-by-Step Rehearsal Walkthrough

A reviewer or judge can execute the complete rehearsal in `/console/rehearsal` in under 90 seconds:

```
Step 1: Select "Hurricane Milton 2024" (Tampa Bay, 52.4h lead time).
Step 2: Observe the NWS warning polygon overlay on the interactive MapLibre map.
Step 3: Select "Funding Shortfall & Waitlisting" scenario.
Step 4: Inspect the Treasury Waterfall ($250 liquid vs $500 demand).
Step 5: Click "Generate Deterministic Allocation Plan".
        -> Tiers 1-2 marked FUNDED; Tiers 3-4 marked WAITLISTED.
Step 6: Click "Run AI Plan Review".
        -> Plan Reviewer flags 0% solvency buffer and validates vulnerability priority.
Step 7: Click "Authorize Plan (Dual Passkey)".
        -> Coordinator + Finance Passkey simulated signatures bind the plan hash.
Step 8: Execute PayPal Sandbox Rehearsal Payout.
        -> Simulated batch execution against verified Sandbox parameters.
Step 9: Review the Immutable Reconciliation Receipt.
        -> SHA-256 Hash: e.g. 52c9...b14a; Net direct relief: 99.75%.
Step 10: Toggle to "False Alarm" scenario and observe instant automated cancellation.
```

---

## 5. Automated Test Evidence

The entire rehearsal orchestrator is verified under automated CI:

```bash
$ pnpm test tests/rehearsal/lab.test.ts

 ✓ tests/rehearsal/lab.test.ts (11 tests) 42ms
   ✓ executes normal funding scenario with full allocation
   ✓ handles funding shortfall with deterministic waitlisting
   ✓ expands exposure polygon and detects newly exposed households
   ✓ routes unverified households to NEEDS_REVIEW without demotion
   ✓ handles failed or unclaimed payouts and triggers reconciliation
   ✓ aborts allocation on false alarm warning downgrade
   ✓ strictly protects operating reserves
   ✓ calculates exact fee overhead and net relief delivered
   ✓ produces cryptographically bound rehearsal receipt
   ✓ validates all three historical storms (Milton, Helene, Idalia)
   ✓ confirms AI cannot alter amounts or approve payouts

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

---

## 6. Audit Trail & Cryptographic Receipt Example

Every completed drill produces an immutable verification receipt:

```json
{
  "rehearsalId": "rehearsal_milton_2024_shortfall_52c98a",
  "storm": "Hurricane Milton (2024)",
  "scenario": "FUNDING_SHORTFALL",
  "evaluatedHouseholds": 5,
  "fundedCount": 2,
  "waitlistedCount": 3,
  "grossDisbursed": "$200.00",
  "feeOverhead": "$0.50",
  "netReliefDelivered": "$199.50",
  "capitalEfficiency": "99.75%",
  "approvers": [
    { "name": "Elena Rostova", "role": "Relief Operations Coordinator", "method": "WebAuthn Passkey" },
    { "name": "Marcus Vance", "role": "Finance Director", "method": "WebAuthn Passkey" }
  ],
  "immutableAuditHash": "sha256-52c98a96431980f749a05b18be029d5b4a037841c9bc88a8d052a512726354b9",
  "status": "COMPLETED_REHEARSAL"
}
```

