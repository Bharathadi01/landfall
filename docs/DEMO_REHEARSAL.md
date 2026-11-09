# Landfall — Official 10-Step Judge Demonstration & Rehearsal Runbook
### PayPal AI Hackathon 2026 · Interactive Demonstration Protocol
**Document Version:** 1.0.0 (Release Candidate)  
**Host Application Port:** `http://localhost:3000` (or `http://localhost:3456`)  
**Estimated Walkthrough Duration:** 3 to 5 minutes  
**Target Audience:** Hackathon Judges, Payment Engineers, AI Architects

---

## 1. Overview & Setup

Landfall provides a complete, working, interactive humanitarian finance command center. This runbook details the exact 10-step browser journey demonstrating how Landfall delivers **"Cash before the storm"** and accounts for every payout state through **Proof-Carrying Relief Recovery**.

### Prerequisites:
1. Start the application:
   ```bash
   pnpm build && pnpm start
   ```
2. Open your browser to `http://localhost:3000/console/war-room`.

---

## 2. The 10-Step Judge Journey

### Step 1: Open the Humanitarian Command Center
- **Action:** Navigate to `http://localhost:3000/console/war-room`.
- **What to Observe:**
  - Authoritative dark operational theme (`slate-950`).
  - Active incident banner: `HURRICANE MILTON · CAT 4 · 48H TO LANDFALL [HISTORICAL REPLAY]`.
  - Solvency Telemetry: Total Liquid Cash ($1,500.00), 30% Reserve Protection Floor ($450.00), Allocatable Tranche 1 ($1,000.00).
  - Role Perspective Switcher: Toggle between `ALL`, `OPERATIONS`, `FIDUCIARY`, and `AUDITOR` to demonstrate tailored views.

### Step 2: Inspect a Labelled PayPal Payout Exception
- **Action:** Scroll to the **Recipient Rescue & Exception Queue** widget (`RecipientRescueQueue.tsx`).
- **What to Observe:**
  - Notice item `2FN4JTY2SF8A2` with status `[PAYPAL SANDBOX] UNCLAIMED` for Maria Santos ($100.00 USD).
  - A bright amber badge highlights: `30-DAY ESCROW ACTIVE`.
  - The system warns that reissuing aid while funds sit unclaimed in PayPal will result in 100% duplicate loss once claimed.

### Step 3: Open the Forensic Evidence Trail
- **Action:** Click **"Inspect Evidence Trail"** on the unclaimed item or view the **PayPal Money Path Explorer** widget.
- **What to Observe:**
  - 5-Pillar visual evidence chain connecting:
    1. Donor Inflow (`Orders v2` capture #`f417441c1a73c`)
    2. Relief Obligation (`ob_milton_hh_001` tied to Priority Tier 1 Medical Device)
    3. PayPal Payout Batch (`7Y5GP4ETNLCUQ`, Item `2FN4JTY2SF8A2`)
    4. Webhook Notification (`PAYOUTS-ITEM-UNCLAIMED`)
    5. Double-Entry Ledger Entry (`MATCHED` in `relief_disbursements`)

### Step 4: Ask the AI Investigator to Explain the Exception
- **Action:** Click **"Consult AI Investigator"** in the item drawer.
- **What to Observe:**
  - Groq Cloud Free Plan AI (`openai/gpt-oss-20b`) analyzes the 5-pillar context in real time (< 800ms) with zero recurring cost.
  - The AI explains: *"The recipient has not registered a PayPal account under maria.santos@test.example. Funds are safely held in PayPal 30-day escrow. Do not reissue."*
  - Notice the visible security indicator: `READ-ONLY COPILOT · ZERO FINANCIAL PRIVILEGES`.

### Step 5: Inspect the Deterministic Policy Decision
- **Action:** Click the **"Policy & Taxonomy Classification"** tab.
- **What to Observe:**
  - Landfall's deterministic taxonomy categorizes the item as `UNCLAIMED_RECIPIENT_ACCESS` (Rule #2).
  - Permitted next actions: `CONTACT_RECIPIENT` or `WAIT_AND_MONITOR`.
  - Hard Invariant displayed: `canReissueImmediately: FALSE`.

### Step 6: Demonstrate a Blocked Unsafe Reissue
- **Action:** Click the disabled/locked red button **"Attempt Immediate Reissue"**.
- **What to Observe:**
  - The system displays a strict security modal:  
    `BLOCKED BY FINANCIAL SAFETY ENGINE: Cannot reissue funds while active PayPal transaction 2FN4JTY2SF8A2 is UNCLAIMED. Reissuance would cause duplicate $100.00 loss.`
  - Explains the exact economic reason: PayPal holds unclaimed payouts in recipient escrow for 30 days before auto-reversal.

### Step 7: Demonstrate Human Approval on a Safe Recovery Path
- **Action:** Select an eligible failed disbursement (`BATCH_FAIL_001`) or click **"Initiate Contact / Resolution"**.
- **What to Observe:**
  - The **WebAuthn Passkey Dual-Approval Modal** appears.
  - Prompts for two distinct authorized signers:
    - Signer 1: Operations Coordinator (`Dr. Sarah Lin [DEMO PERSONA]`)
    - Signer 2: Finance Fiduciary Lead (`Marcus Vance [DEMO PERSONA]`)
  - A real WebAuthn challenge ceremony is simulated or executed via `@simplewebauthn/browser`.

### Step 8: Re-Fetch PayPal State and Reconcile
- **Action:** Click **"Re-Fetch PayPal State"** on the **Settlement Integrity Bridge** widget.
- **What to Observe:**
  - Live query to PayPal Sandbox API endpoint.
  - Double-entry ledger updates:
    - Debits = $100.00 | Credits = $100.00 | Discrepancy = **0¢**.
    - Reconciliation status confirms `BALANCED`.

### Step 9: Open the Resulting Recovery Proof & Verify Hash
- **Action:** Click **"Generate Cryptographic Recovery Proof"**.
- **What to Observe:**
  - A tamper-evident JSON certificate appears containing the 5 pillars.
  - Master SHA-256 Hash displayed in monospace:  
    `46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c`.
  - Click **"Verify Hash"** to re-hash the canonical payload in the browser: status displays `CRYPTOGRAPHICALLY VERIFIED`.

### Step 10: Verify Transparency & Provenance Standards
- **Action:** Review all displayed widgets and telemetry badges.
- **What to Observe:**
  - Every widget carries an explicit provenance tag:
    - `[PAYPAL SANDBOX]` on real PayPal API responses.
    - `[SIMULATED]` on synthetic stress-test benchmark scenarios.
    - `[DEMO PERSONA]` on mock WebAuthn security credentials.
    - `[REPLAY]` on Hurricane Milton historical weather telemetry.
  - Zero deceptive claims; 100% auditable truth.

---

## 3. Alternative Guided Experience: The 8-Stage Golden Flow (`/console/golden-flow`)

For a linear, stage-by-stage presentation, judges can also open `http://localhost:3000/console/golden-flow`:
- Step 1: PayPal Donation Inflow Capture ($1,000.00 USD)
- Step 2: Solvency Waterfall (30% Reserve Protected Floor)
- Step 3: NWS Disaster Alert Detection (`TBW:HU.W:0009`)
- Step 4: Geographic Polygon Exposure Filtering
- Step 5: Demographic Priority Tiering (Life-Support Devices Funded First)
- Step 6: Two-Key Passkey Approval (`computePlanHash`)
- Step 7: Hardened Treasurer Outbox Submission
- Step 8: Webhook Verification & 0¢ Discrepancy Reconciliation

Each stage can be inspected, stepped through, or executed non-interactively.

