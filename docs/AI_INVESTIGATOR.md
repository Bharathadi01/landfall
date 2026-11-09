# Relief Money Investigator AI Agent (§3, §4, §5)

## 1. Architectural Philosophy: AI Never Moves Money

The Landfall Relief Money Investigator is a specialized read-only financial forensics copilot. It exists to solve a critical operational challenge in disaster response:

> **When hundreds of micro-transfers are dispatched under emergency conditions, exceptions occur (unclaimed escrow, closed accounts, risk holds). A human coordinator cannot manually cross-reference bank webhooks, double-entry ledger entries, and household records in real-time. The AI Investigator analyzes the evidence, identifies root causes, verifies escrow constraints, and prepares safe operational recommendations for human authorization.**

The agent is built under strict architectural guardrails:
1. **Zero Money Movement Authority:** The agent possesses **zero write tools**. It cannot create orders, dispatch payouts, capture tokens, or adjust ledger journals.
2. **Deterministic Server-Side Invariant Enforcement:** Even if a frontier model hallucinates or is prompted adversarially, the server-side validator overrides `can_reissue_now` and `recommended_next_action` with authoritative engine calculations.
3. **Escrow Protection Invariant:** When an item is `UNCLAIMED`, the agent strictly enforces that funds remain active in PayPal escrow for 30 days. It is barred from recommending immediate reissuance.
4. **$0.00 Inference Budget:** Runs on the Groq Cloud Free Plan with `openai/gpt-oss-20b`, backed by a 100% deterministic local offline fallback.
5. **No PII Forwarded to Model:** Recipient emails, phones, and physical street addresses are pseudonymized/masked before prompt assembly.

---

## 2. Strict Read-Only Tool Surface

The agent interacts exclusively with an allow-list of 8 read-only inspection tools:

| Tool Name | Scope | Description |
|---|---|---|
| `get_payout_batch` | PayPal Reporting | Reads batch-level metadata, total amount, fees, and rail status. |
| `get_payout_item` | PayPal Payouts | Retrieves item-level status (`SUCCESS`, `UNCLAIMED`, `FAILED`, etc.), error codes, and debug IDs. |
| `get_obligation` | Relief Rules Engine | Inspects household entitlement record, approved plan hash, and dual signatures. |
| `get_ledger_trace` | General Ledger | Fetches debit/credit journal transactions and reconciliation match state. |
| `get_verified_webhook_history` | Sentinel Ingestion | Checks cryptographically verified PayPal webhook notifications. |
| `get_balance_snapshot` | Treasury Reconciler | Inspects current liquid cash, reserve floor, and uncaptured pledges. |
| `run_reconciliation_preview` | Auditing | Previews potential ledger adjustment prior to human execution. |
| `evaluate_recovery_options` | Recovery Engine | Queries deterministic recovery state machine for safe action alternatives. |

---

## 3. Structured Zod Output Contract

Every investigative output strictly validates against `InvestigationResultSchema`:

```typescript
export const InvestigationResultSchema = z.object({
  case_id: z.string(),
  payout_item_id: z.string(),
  status: z.string(),
  verified_facts: z.array(z.string()),
  hypotheses: z.array(z.string()),
  unknowns: z.array(z.string()),
  stale_evidence: z.array(z.string()),
  contradictions: z.array(z.string()),
  recommended_next_action: z.enum([
    "WAIT_AND_MONITOR",
    "CONTACT_RECIPIENT",
    "ESCALATE_TO_PAYPAL_OR_OPERATOR",
    "PREPARE_CORRECTED_RETRY",
    "PREPARE_NEW_APPROVED_PAYOUT",
    "CLOSE_AS_RESOLVED",
    "HOLD_INSUFFICIENT_EVIDENCE",
  ]),
  safe_action_reason: z.string(),
  can_reissue_now: z.boolean(), // Strictly verified against deterministic engine
  audit_summary: z.string(),
});
```

---

## 4. Adversarial Prompt Defense

The investigator features an active defense filter that intercepts prompt injection attempts. Any user prompt containing terms such as `"bypass approval"`, `"send money"`, or `"payout immediately"` is immediately neutralized, logged to the `contradictions` array as an adversarial attempt, and returned with the safe deterministic recommendation.

