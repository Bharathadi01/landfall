# PayPal Evidence & Sandbox Verification Register

## 1. Truth & Provenance Standard

All PayPal Developer Platform claims in Landfall are verified against live sandbox responses from `api-m.sandbox.paypal.com`.

| Evidence Tier | Definition | Standard of Verification |
|---|---|---|
| `LIVE_SANDBOX` | Actual HTTP response from PayPal Sandbox API | Verified with PayPal `debug_id` and sandbox resource ID |
| `CRYPTOGRAPHICALLY_VERIFIED` | Validated via official signature API | Verified via PayPal `POST /v1/notifications/verify-webhook-signature` |
| `DETERMINISTIC_REHEARSAL` | Replay against verified historical fixtures | Turf.js and ledger math running against real hurricane geometry |

---

## 2. Sandbox Resource Evidence Table

### 2.1 PayPal OAuth 2.0 Client Credentials
- **Implementation:** `lib/paypal/client.ts`
- **Verification:** Token generation with concurrency locking and in-memory TTL buffer.

### 2.2 PayPal Payouts v1 (Disbursements)
- **Batch 1 (Single Item):**
  - **Payout Batch ID:** `CYX4HC52K54WN`
  - **Payout Item ID:** `XVV68QXJWJ66Y`
  - **Amount:** $1.00 USD
  - **Fee:** $0.25 USD
  - **PayPal Transaction ID:** `6SM40781T11720216`
  - **Status:** `SUCCESS`
  - **Recipient:** Verified sandbox personal account.
- **Batch 2 (Multi-Item Boundary Test):**
  - **Payout Batch ID:** `7Y5GP4ETNLCUQ`
  - **Total Amount:** $2.00 USD
  - **Item 1:** `FR7DHMX8QE59A` (`SUCCESS`, $1.00 USD)
  - **Item 2:** `2FN4JTY2SF8A2` (`UNCLAIMED`, $1.00 USD)
  - **Proof-Carrying Recovery Trigger:** Item `2FN4JTY2SF8A2` actively proves the `UNCLAIMED` exception flow. Reissue is strictly locked for 30 days while funds sit in PayPal escrow.

### 2.3 PayPal Orders v2 (Donation Inflows)
- **Order ID:** `35996334K7032164X`
- **Intent:** `CAPTURE`
- **Currency & Amount:** $1.00 USD
- **PayPal Debug ID:** `f417441c1a73c`
- **Status:** `CREATED`
- **Invariant:** In PayPal Orders v2, an unapproved order cannot be captured without buyer authentication. Unapproved orders are strictly excluded from ledger cash.

### 2.4 PayPal Subscriptions v1 (Standby Liquidity)
- **Product ID:** `PROD-4HV976845W620203M` (Category: `NONPROFIT`, Type: `SERVICE`)
- **Plan ID:** `P-5A327449X7452233TNLYQY3A` (Billing Cycle: `MONTH`, Pricing: $25.00 USD/month)
- **Webhook Handlers:** `BILLING.SUBSCRIPTION.ACTIVATED`, `PAYMENT.SALE.COMPLETED`

### 2.5 PayPal Webhook Verification
- **Endpoint:** `POST /v1/notifications/verify-webhook-signature`
- **Verification Status:** `"SUCCESS"`
- **Cert URL Validation:** Restricted exclusively to official `*.paypal.com` hostnames.
- **Replay Resistance:** Idempotency cache rejects duplicate transmissions of identical `webhook_id` + `event_id`.

### 2.6 PayPal Reporting & Balances
- **Reporting Endpoint:** `GET /v1/reporting/balances` & `GET /v1/reporting/transactions`
- **Reconciliation Engine:** Compares general ledger debits/credits against PayPal reported balance.
- **Audit Hash:** Immutable SHA-256 reconciliation ledger entry generated on every reconciliation cycle.

---

## 3. PayPal Invariant Summary

1. **AI Never Touches PayPal Tokens or Payout APIs:** The AI layer (`lib/ai/`) has zero access to OAuth tokens, secret keys, or payout execution tools.
2. **Dual-Custody Passkey Requirement:** Payouts require two distinct cryptographic signatures (Emergency Operations + Fiduciary Lead) before any batch is transmitted to PayPal.
3. **Escrow Safety:** `UNCLAIMED` payouts cannot be duplicated; Landfall monitors the 30-day window and initiates contact guidance instead of premature re-disbursement.

