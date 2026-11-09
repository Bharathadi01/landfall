# Payout Recovery Decision Matrix (§21.3)

## 1. Architectural Overview

The Recovery Decision Matrix is Landfall's deterministic policy engine for handling payout anomalies. It translates raw provider statuses, webhook telemetry, and ledger balances into legally binding operational recovery recommendations.

**Guiding Rule:** The AI Investigator advises and explains; the **Deterministic Policy Engine decides**.

---

## 2. The 18 Exhaustive Exception Rules

| # | Exception Category | Trigger Predicate | Permitted Actions | Forbidden Actions | Required Human Role | Reissue Immediate? |
|:---:|---|---|---|---|:---:|:---:|
| 1 | `PENDING_TOO_LONG` | Payout `PENDING` > 24 hours | `WAIT_AND_MONITOR`, `ESCALATE` | Retry, Reissue | Operations | ❌ NO |
| 2 | `UNCLAIMED_RECIPIENT_ACCESS` | Payout `UNCLAIMED` (30d escrow) | `CONTACT_RECIPIENT`, `WAIT_AND_MONITOR` | Retry, Reissue | Operations | ❌ NO |
| 3 | `RETURNED_FUNDS_UNCONFIRMED` | Payout `RETURNED` but ledger uncredited | `HOLD_INSUFFICIENT_EVIDENCE`, `ESCALATE` | Retry, Reissue | Finance | ❌ NO |
| 4 | `RETURNED_FUNDS_CONFIRMED` | Payout `RETURNED` and ledger reconciled | `PREPARE_CORRECTED_RETRY`, `CLOSE` | Auto-reissue | Finance | ❌ Sign-off Req. |
| 5 | `FAILED_PROVIDER_REQUEST` | Payout `FAILED` at API boundary | `PREPARE_NEW_APPROVED_PAYOUT` | Auto-reissue | Operations | ❌ Sign-off Req. |
| 6 | `ONHOLD_REVIEW` | Payout `ONHOLD` by PayPal risk | `ESCALATE_TO_PAYPAL_OR_OPERATOR` | Retry, Reissue | Finance | ❌ NO |
| 7 | `BLOCKED_PROVIDER_REQUEST` | Payout `BLOCKED` by regulatory policy | `ESCALATE_TO_PAYPAL_OR_OPERATOR` | Retry, Reissue | Finance | ❌ NO |
| 8 | `REFUNDED_BY_RECIPIENT` | Payout `REFUNDED` post-settlement | `PREPARE_CORRECTED_RETRY` | Auto-reissue | Finance | ❌ Sign-off Req. |
| 9 | `REVERSED_PROVIDER_ITEM` | Payout `REVERSED` post-settlement | `HOLD_INSUFFICIENT_EVIDENCE`, `ESCALATE` | Retry, Reissue | Finance | ❌ NO |
| 10 | `STALE_PROVIDER_EVIDENCE` | Balance snapshot > 10m old | `WAIT_AND_MONITOR`, `HOLD` | New Payouts | Finance | ❌ NO |
| 11 | `CONTRADICTORY_EVIDENCE` | Provider amount != Ledger amount | `ESCALATE`, `HOLD` | Any Mutation | Auditor | ❌ NO |
| 12 | `DUPLICATE_ATTEMPT_RISK` | In-flight attempts > 1 | `HOLD`, `ESCALATE` | New Payouts | Finance | ❌ NO |
| 13 | `MISSING_OBLIGATION_LINK` | Orphaned provider item without obligation | `HOLD`, `ESCALATE` | New Payouts | Operations | ❌ NO |
| 14 | `RECIPIENT_MISMATCH` | Payout receiver != Obligation email | `ESCALATE`, `HOLD` | New Payouts | Operations | ❌ NO |
| 15 | `CURRENCY_MISMATCH` | Provider currency != Programme currency | `HOLD`, `ESCALATE` | New Payouts | Finance | ❌ NO |
| 16 | `RESERVE_OR_COMMITMENT_BREACH` | Allocatable cash < Target obligation | `WAIT_AND_MONITOR`, `HOLD` | New Payouts | Finance | ❌ NO |
| 17 | `WEBHOOK_SIGNATURE_INVALID` | Webhook signature verification fails | `HOLD`, `ESCALATE` | Ledger Updates | Auditor | ❌ NO |
| 18 | `UNKNOWN_PROVIDER_STATE` | Status outside PayPal v1 vocabulary | `HOLD`, `ESCALATE` | Any Assumption | Operations | ❌ NO |

---

## 3. Human Approval Authority & Roles

- **Operations Lead (Key 1):** Validates household disaster exposure, geographic boundaries, and contact updates.
- **Finance / Treasury Lead (Key 2):** Validates liquid capital adequacy, 30% reserve protection floor, ledger reconciliation, and authorizes payout release.
- **Auditor:** Read-only inspection of cryptographic SHA-256 Recovery Proof certificates and double-entry general ledger journals.

