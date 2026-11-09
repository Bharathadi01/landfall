# PayPal Payouts v1 Status Mapping & Contract Semantics

## 1. Authoritative Item-Level Vocabulary

Per official PayPal Developer documentation ([PayPal Payouts Payment Processing](https://developer.paypal.com/payouts/payment-processing/)), the individual payout item `transaction_status` enum consists strictly of the following 9 values:

| Item Status | PayPal Rail State | Landfall Operational Interpretation | Safe Action | Reissue Allowed? |
|---|---|---|---|:---:|
| **`SUCCESS`** | Funds credited to recipient PayPal account balance | Disbursement successfully completed on PayPal digital rails. Verified with transaction reference. | `CLOSE_AS_RESOLVED` | ❌ **NO** |
| **`FAILED`** | Payout request failed at API boundary; funds not deducted from sender | Receiver account closed, unregistered, or restricted. Principal never debited. | `PREPARE_NEW_APPROVED_PAYOUT` | ❌ **Requires Reauthorization** |
| **`PENDING`** | Queued or processing in PayPal banking/network rails | Transaction in-flight. Awaiting settlement confirmation. | `WAIT_AND_MONITOR` | ❌ **STRICTLY NO** |
| **`UNCLAIMED`** | Funds in PayPal 30-day escrow awaiting recipient registration | Recipient does not have an active PayPal account. Funds held for 30 days. | `CONTACT_RECIPIENT` | ❌ **STRICTLY NO** |
| **`RETURNED`** | 30-day window expired or recipient declined; principal returned to sender | Principal returned to Landfall's PayPal balance. Confirmed in ledger. | `PREPARE_CORRECTED_RETRY` | ❌ **Requires Reauthorization** |
| **`ONHOLD`** | Administrative, compliance, or risk management hold | Transaction held for internal review by PayPal Risk Management. | `ESCALATE_TO_PAYPAL_OR_OPERATOR` | ❌ **STRICTLY NO** |
| **`BLOCKED`** | Blocked by regulatory, compliance, or country policy | Programmatic retry blocked. Escalation to merchant support required. | `ESCALATE_TO_PAYPAL_OR_OPERATOR` | ❌ **STRICTLY NO** |
| **`REFUNDED`** | Payout was refunded post-settlement | Disbursement was refunded back to sender. Requires ledger reversal. | `PREPARE_CORRECTED_RETRY` | ❌ **Requires Reauthorization** |
| **`REVERSED`** | Payout was reversed post-settlement | Disbursement reversed by PayPal. Audit investigation required. | `HOLD_INSUFFICIENT_EVIDENCE` | ❌ **STRICTLY NO** |

---

## 2. Separation of Concerns: Status vs Events vs Requests

To prevent subtle financial defects, Landfall strictly distinguishes four distinct concepts:

1. **Item Transaction Status (`transaction_status`):** The 9 statuses above returned by `GET /v1/payments/payouts-item/{payout_item_id}`.
2. **Payout Batch Status (`batch_status`):** `DENIED`, `PENDING`, `PROCESSING`, `SUCCESS`, `CANCELED`. A batch status of `SUCCESS` does NOT guarantee every item succeeded.
3. **Webhook Event Names:** `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`, `PAYMENT.PAYOUTS-ITEM.RETURNED`, `PAYMENT.PAYOUTS-ITEM.FAILED`, `PAYMENT.PAYOUTS-ITEM.BLOCKED`, `PAYMENT.PAYOUTS-ITEM.HELD`, `PAYMENT.PAYOUTS-ITEM.REFUNDED`, `PAYMENT.PAYOUTS-ITEM.CANCELED`. Note: Webhook names use `SUCCEEDED` and `HELD`, but the item-level transaction statuses are `SUCCESS` and `ONHOLD`.
4. **Internal Request State:** Internal outbox request lifecycle (`PREPARED`, `SUBMITTING`, `SUBMITTED`, `PROVIDER_CONFIRMED`).

Contract tests in `tests/recovery/taxonomy.test.ts` assert that Landfall never invents pseudo-statuses or coerces unknown statuses into assumed outcomes.

