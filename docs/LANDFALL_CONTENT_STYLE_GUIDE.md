# LANDFALL CONTENT STYLE GUIDE
## UX WRITING, TERMINOLOGY & TRUTHFULNESS STANDARDS

**System:** Landfall Anticipatory Disaster Relief  
**Edition:** Field Atlas Global Hackathon Edition  
**Date:** November 10, 2026  

---

## 1. Core Writing Principles

1. **Plain English First**: Disaster relief and emergency cash assistance are fundamentally human operations. Never use institutional or developer jargon when straightforward language exists.
2. **Active Voice**: Clearly state who or what is performing an action (`"Operations team approved payout"` instead of `"Payout approval was executed by operators"`).
3. **One Concept Per Heading**: Headings must be concise, descriptive, and immediately understandable in a 3-minute hackathon demonstration.
4. **Action-Oriented Controls**: Buttons describe the exact outcome (`"Approve assistance tranche"`, `"Inspect payout exception"`, `"Download reconciliation proof"`).
5. **No Exaggerated or Unqualified Claims**: Maintain uncompromising scientific and operational honesty.
6. **No Redundant Copy**: Do not repeat the same explanatory paragraph across multiple pages.

---

## 2. Terminology & Jargon Elimination Matrix

| Avoid (Technical / Developer Jargon) | Prefer (Field Atlas Plain English) | Rationale |
|---|---|---|
| Total Liquid PayPal Cash | Available PayPal funds | Clear, accurate, and immediately understandable to donors and operators. |
| Net Allocatable Tranche 1 | Available to allocate | Removes institutional jargon while preserving accounting precision. |
| Protected Operating Reserve | Protected reserve | Concise and avoids bureaucratic stiffness. |
| Anticipatory Response Funnel | Assistance progress | Focuses on human relief rather than marketing funnel terminology. |
| PayPal Payout Settlement Health | Payout status | Clean and operational. |
| Recipient Rescue Exception Queue | Payouts needing attention | Directly answers the operator's primary question: *What needs my attention?* |
| Cryptographic Proof Hash | Verification record | Demystifies cryptographic audit trails for non-technical judges. |
| Dual-Custody Governance | Two-person approval | Plain English description of WebAuthn passkey dual-signature requirements. |
| AI Money Investigator | AI payout investigator | Clarifies that AI assists human investigators but never touches or executes funds. |
| Liquidity Deficit Mitigation | Low funds notice | Communicates urgency without financial obfuscation. |
| Deterministic Eligibility Protocol | Eligibility policy | Clearly denotes established rules without robotic terminology. |

---

## 3. Truthfulness & Claim Qualification Rules

All claims presented on public, operational, or demonstration surfaces must adhere to strict qualification criteria:

1. **Humanitarian Delay Citations**:
   - *Avoid*: `"Traditional aid takes 100 days to arrive."`
   - *Prefer*: `"Post-disaster assessments cite an average of 60 to 90 days before federal or multilateral recovery grants reach individual households."`
2. **Multilateral Organization Citations (WFP & World Bank)**:
   - *Avoid*: `"Endorsed by the World Food Programme and World Bank."`
   - *Prefer*: `"Informed by empirical research from the World Food Programme and World Bank demonstrating that anticipatory cash transfers protect household assets and accelerate community recovery."`
3. **Tax Deductibility**:
   - *Avoid*: `"All donations are 100% tax-deductible."`
   - *Prefer*: `"Donations support community-directed relief funds. Tax deductibility is subject to the sponsoring 501(c)(3) fiscal sponsor."`
4. **PayPal Transaction Fees**:
   - Clearly state that PayPal Sandbox transactions reflect standard commercial API fee structures without hidden surcharges.
5. **Explicit Environment Badges**:
   Every data surface must carry one of the following explicit badges:
   - `LIVE`: Connected to active, real-time authoritative APIs (e.g. NWS alert feed).
   - `SANDBOX`: Verified PayPal Sandbox environment using test accounts and simulated ledger funds.
   - `REPLAY`: Time-indexed historical meteorological replay (e.g. Hurricane Milton Oct 8–10, 2024).
   - `SIMULATED`: Deterministic simulation drill executed for testing or training purposes.
   - `SYNTHETIC BENCHMARK`: Algorithmic benchmark data generated for scalability evaluation.

---

## 4. User-Facing Error & Status Messages

Error messages presented to end users and operators must explain what happened and what specific action to take next, without dumping raw stack traces or internal API error codes:

| Context | Technical Message (Avoid) | Field Atlas Message (Prefer) |
|---|---|---|
| Unclaimed Payout | `PayPal API returned UNCLAIMED (HTTP 200).` | `The recipient has not claimed this payment yet. The notification has been re-sent. Do not issue a duplicate payment while the initial transaction remains pending.` |
| Insufficient Funds | `BalanceError: Tranche 1 allocation exceeds net allocatable.` | `Available funds ($14,250.00) are insufficient to cover all eligible households ($22,500.00). The protected reserve ($5,000.00) remains untouched. Priority Tier 1 households have been queued first.` |
| AI Timeout | `Groq adapter timeout after 15000ms.` | `The AI investigator is temporarily unavailable. Automated financial safeguards and human approval queues remain fully active.` |
| Webhook Verification | `INVALID_SIGNATURE on PayPal-Auth-Algo header.` | `Webhook signature verification failed. The event was logged for security review and internal ledger records were not modified.` |

