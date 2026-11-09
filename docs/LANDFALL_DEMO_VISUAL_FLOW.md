# LANDFALL — THREE-MINUTE DEMO VISUAL FLOW & SCRIPT
## FIELD ATLAS · GLOBAL HACKATHON DEMONSTRATION SEQUENCE

**Edition:** Field Atlas Global Hackathon Edition  
**Target Duration:** Exactly 180 seconds (3:00)  
**Tone:** Authoritative, calm, precise, mission-driven  
**Guiding Principle:** *"PayPal moves the money. AI helps investigate. Deterministic safeguards and human approval protect every decision."*

---

## Storyboard & Sequence Overview

```
[0:00] The Problem (Landing Page)
   │
   ▼
[0:15] Disaster Intelligence (Sentinel Map)
   │
   ▼
[0:40] Household Prioritisation (Recipient Directory)
   │
   ▼
[1:00] Funding & Solvency Reserves (War Room Treasury)
   │
   ▼
[1:25] AI Payout Investigation (Watch Officer AI Workspace)
   │
   ▼
[1:50] Human Dual-Custody Approval (WebAuthn Passkey Signing)
   │
   ▼
[2:15] PayPal Execution & Ledger Reconciliation (PayPal Audit Ledger)
   │
   ▼
[2:40] Closing & Immutable Proof
```

---

## Detailed Minute-by-Minute Demonstration Script

### Scene 1: The Problem (0:00 – 0:15)
- **Route:** `/`
- **Visual:** Clean editorial split hero: *"Relief should be ready before the storm."* Show the dynamic readiness indicator, current liquidity ($14,250.00), and the 4-stage pipeline preview.
- **Presenter Spoken Script:**
  > "Traditional disaster assistance takes 60 to 90 days to reach vulnerable families. By the time a check arrives, evictions have happened and medications have spoiled.
  > 
  > Landfall turns disaster relief on its head. We connect real-time weather intelligence, donor funds, and instant PayPal payouts to deliver cash assistance *before* hurricane landfall."

---

### Scene 2: Disaster Intelligence & Threat Cone (0:15 – 0:40)
- **Route:** `/console/sentinel`
- **Visual:** Sentinel Storm Atlas map displaying live NOAA nowCOAST WMS radar and National Weather Service Hurricane Warning polygons (or Milton 2024 Replay). Click on the Pinellas County warning polygon to display the Exposure Drawer with 10 impacted households.
- **Presenter Spoken Script:**
  > "This is Sentinel, our meteorological intelligence engine. We ingest live feeds from NOAA and the National Weather Service.
  > 
  > As Hurricane Milton approaches Tampa Bay, our geospatial engine computes point-in-polygon exposure in milliseconds using Turf.js. We don't guess: if a household's coordinates are inside an official warning polygon, they are queued for relief."

---

### Scene 3: Deterministic Household Prioritisation (0:40 – 1:00)
- **Route:** `/console/recipients`
- **Visual:** The Recipient Directory displaying AES-256 protected profiles, four-check verification chips, and vulnerability tiers. Filter by "Tier 1: Medical Device Dependent".
- **Presenter Spoken Script:**
  > "Who receives funds first? We use strict, transparent deterministic rules — never black-box AI.
  > 
  > Tier 1 households are families requiring electricity-dependent oxygen or dialysis. Tier 2 are elderly residents living alone. Every resident's personal data is encrypted with AES-256, preserving privacy while ensuring verifiable eligibility."

---

### Scene 4: Funding & Solvency Reserves (1:00 – 1:25)
- **Route:** `/console/war-room`
- **Visual:** Operations Overview tab answering *"What needs attention right now?"*. Point out the 4 core metrics:
  - Available PayPal Funds: `$14,250.00`
  - Protected Solvency Reserve: `$5,000.00` (untouchable floor)
  - Allocatable Funds: `$9,250.00`
  - Payouts Needing Attention: `1 case`
- **Presenter Spoken Script:**
  > "In the War Room, coordinators see exactly what needs attention.
  > 
  > Our double-entry accounting engine enforces a mathematical invariant: our protected reserve ($5,000.00) can never be breached. All allocations are capped strictly to available liquid funds, ensuring total financial solvency."

---

### Scene 5: AI Investigation — Read-Only Safeguard (1:25 – 1:50)
- **Route:** Click *"Inspect Case"* in the War Room Priority Queue (or navigate to `/console/watch-officer`).
- **Visual:** Case drawer opens showing an unclaimed payment exception for Arthur Pendelton (`hh_tbw_002`). The Watch Officer AI workspace clearly displays:
  - **Verified Facts:** PayPal payout status `UNCLAIMED`; claim link active; recipient email valid.
  - **AI Hypothesis:** Recipient likely evacuated to an area with intermittent cellular coverage.
  - **Recommendation:** Do not issue a duplicate payment; re-send claim SMS notification.
  - **Explicit Guardrail Badge:** *Read-Only AI — Cannot Authorize or Move Funds.*
- **Presenter Spoken Script:**
  > "Here, a PayPal payout exception was flagged. Watch Officer AI investigates the logs using Groq's zero-cost inference.
  > 
  > Notice the design: AI clearly separates confirmed facts from hypotheses. Most importantly, AI is strictly read-only. It cannot authorize payments or touch funds."

---

### Scene 6: Accountable Human Approval (1:50 – 2:15)
- **Route:** `/console/war-room` (or `/console/golden-flow`)
- **Visual:** Trigger Dual-Custody Approval modal. Demonstrate the two required cryptographic signatures (Fiduciary Signer + Operations Signer).
- **Presenter Spoken Script:**
  > "No money moves without accountable human sign-off.
  > 
  > We enforce hardware-grade WebAuthn dual passkey custody. A fiduciary officer and an operations director must each sign the cryptographically hashed disbursement manifest using their biometric security keys before PayPal receives the batch."

---

### Scene 7: PayPal Hyperwallet Execution & Ledger Proof (2:15 – 2:40)
- **Route:** `/spike`
- **Visual:** PayPal Audit Ledger showing live PayPal Sandbox REST API batch status (`SUCCESS` / `PENDING`), webhook verification receipts, and matching double-entry ledger entries with zero discrepancy.
- **Presenter Spoken Script:**
  > "Once signed, Landfall dispatches idempotent payout batches via the PayPal Hyperwallet API.
  > 
  > Look at the settlement audit: every single transaction is confirmed with an official PayPal transaction reference and verified by HMAC-SHA256 webhook signatures. Our balanced trial ledger shows zero discrepancy down to the cent."

---

### Scene 8: Closing & Resident Experience (2:40 – 3:00)
- **Route:** Quick transition to `/r/enroll` on mobile viewport (or resident view).
- **Visual:** Calm, 5-language mobile intake in Spanish, Haitian Creole, Vietnamese, and Chinese.
- **Presenter Spoken Script:**
  > "And for residents, our mobile portal is radically simple, calm, and available in five languages.
  > 
  > **PayPal moves the money. AI helps investigate. Deterministic safeguards and human approval protect every decision.** Relief is ready before the storm."

---

## Rehearsal Timing Verification Table

| Timestamp | Phase | Primary Action | Success Criteria |
|---|---|---|---|
| `0:00 - 0:15` | Problem Framing | Hero page loaded | Headline visible; core value proposition clear. |
| `0:15 - 0:40` | Sentinel Hazard | View Hurricane Milton cone | Threat polygons and exposure numbers visible. |
| `0:40 - 1:00` | Prioritisation | Filter Tier 1 medical devices | Deterministic rules demonstrated. |
| `1:00 - 1:25` | Treasury | Point to Protected Reserve | Solvency invariant ($5,000 floor) visible. |
| `1:25 - 1:50` | AI Investigator | Inspect unclaimed exception | Facts vs hypotheses clear; read-only badge. |
| `1:50 - 2:15` | Human Approval | WebAuthn passkey signing | Two distinct passkey signatures verified. |
| `2:15 - 2:40` | Settlement Proof | PayPal Audit Ledger | Sandbox REST API transactions & zero discrepancy. |
| `2:40 - 3:00` | Closing | Mobile Resident Portal | Multi-language support; concluding sentence delivered. |

