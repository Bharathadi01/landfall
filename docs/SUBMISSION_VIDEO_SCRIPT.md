# Landfall — 3-Minute Submission Video Script
### PayPal AI Hackathon 2026

**Title:** Landfall: cash before the storm — and proof it arrived
**Length:** under 3:00. Speak slowly; every scene has one idea.
**Data:** synthetic households, PayPal **Sandbox**. Say "sandbox" and "replay" out loud once. Make no impact or customer claims.

**Before recording:** dev server or Render URL up; `GROQ_API_KEY` and both AG licence keys set (no grid watermark); open `/console/war-room` once so the Studio state is warm; resident page `/r/enroll` open in a second tab; clear the Studio chat. Use the AI prompts below verbatim so rate-limited retries are rare.

---

### 0:00 – 0:20 · The problem (landing page `/`)
- **Show:** hero with the radar story, then scroll to the "PayPal says SUCCESS. Did the family get it?" section.
- **Say:** "When a hurricane warning is issued, a community fund can send cash before landfall. But PayPal's own docs say a payout marked SUCCESS means the money was credited to an account — not that the family can reach it or even knows it's there. Landfall sends the money, then keeps following every payment until the household says it arrived."

### 0:20 – 1:05 · Warning → two keys → PayPal (`/console/golden-flow`, "Guided Response")
- **Show:** the stepper. Press **Run all 8 steps**, then click through the stages: official warning → households in the path → fund check → plan → two approvals → send.
- **Say:** "An official NWS warning finds the enrolled households. A plain rules engine — not AI — decides who gets what and keeps a thirty-percent reserve. The AI Watch Officer can read the plan and flag risks, but it has no way to approve or send money. Two different people must approve this exact plan with passkeys — in this build those are demo passkeys, and the screen says so — and only then does Landfall create a PayPal Payouts batch in the sandbox."
- **Show:** the sandbox batch id returned. (Don't claim the first stage is a live PayPal order; it is labelled simulated.)

### 1:05 – 1:50 · Command Center: what happened to each payment (`/console/war-room`)
- **Show:** the delivery tracker (Approved → Sent → Credited → Resident confirmed → Closed), then the case grid.
- **Action:** group by **Delivery stage**, open one case's detail row.
- **Say:** "Here every payment is one case. PayPal credited three; only two households have told us they have it. Open a case and you see the evidence behind it — each fact labelled PayPal, Landfall, resident, or operator — and anything we don't have is shown as Missing, not guessed. This is AG Grid Enterprise: row grouping, master-detail, a grand total, status bar, column side bar, Excel export, and the layout is saved between visits."
- **Show:** the "needs attention" list with the reason on each row (e.g. an UNCLAIMED payment with its days left to claim).

### 1:50 – 2:10 · The resident's side (`/r/enroll` → Status)
- **Show:** switch to a language (Spanish), look up a case reference, tap **"I can't get to it"**, pick *No PayPal account*.
- **Switch back** to Command Center: the case now shows a resident-reported barrier and moves up the queue.
- **Say:** "The family can answer in their language. That answer is recorded as resident-reported — never upgraded to PayPal's word — and it changes who we call first."

### 2:10 – 2:50 · AG Studio and the Studio Agent (`Studio` tab)
- **Show:** the Recovery page; click the **UNCLAIMED** bar in the "PayPal Status" chart; the workbench grid and other charts cross-filter to it. Open the **Evidence behind each payment** widget and click a case chip.
- **Prompt 1 (AI panel):** "Create a payout recovery report."
- **Show:** the agent's tool steps, then the new **AI · Payout recovery** page appearing.
- **Prompt 2:** "Pay A. Pendelton again."
- **Say:** "Studio's agent is a real model calling Studio's own tools — it read the schema, queried the data and built this page. Ask it to move money and it refuses: no tool exists for it, and duplicate payouts are the exact failure we're preventing."

### 2:50 – 3:00 · Close
- **Show:** the Command Center numbers next to the Studio treasury widget (same figures).
- **Say:** "One set of numbers, every payment accounted for until the household confirms it. Rules decide the money. People approve it. Landfall makes sure it arrived."

---

## Checklist
- [ ] Says "sandbox" and "replay/synthetic" once; no pilot, customer, or impact claims.
- [ ] Shows SUCCESS ≠ received on screen (landing section or tracker).
- [ ] Two approvals visible; "demo passkeys" label legible.
- [ ] No AG Grid / Studio licence watermark anywhere.
- [ ] Agent refusal shown ("ACCESS DENIED … zero authority to move funds").
- [ ] Figures agree between Command Center and Studio ($14,250 received · $5,000 reserve · $4,000 sent · 8 households).

## Things not to say
- That webhooks were received from PayPal on the public URL (not demonstrated).
- That passkeys are server-verified (they are not in this build).
- That anyone has used or validated Landfall.
- Test counts other than the current ones: **405 passing without a database, 489 with a disposable `TEST_DATABASE_URL` database**.
