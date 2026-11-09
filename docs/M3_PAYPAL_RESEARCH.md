# M3 PayPal Research & Live API Verification

Conducted: Mon Nov 9, 2026  
Target Environment: PayPal Sandbox (`https://api-m.sandbox.paypal.com`)  
Business Account: `sb-7sfg953788004@business.example.com` (US Merchant Account `RMYYMT3FXD8LJ`)  
Client App: `landfall-us`

---

## 1. Executive Summary & Live Verification Matrix

| Capability | Endpoint / Resource | Sandbox Result | Live ID / Evidence | Production Approval Requirement |
|---|---|---|---|---|
| **Subscriptions Product** | `POST /v1/catalogs/products` | **VERIFIED SUCCESS** | `PROD-4HV976845W620203M` | Standard PayPal Business account |
| **Subscriptions Plan** | `POST /v1/billing/plans` | **VERIFIED SUCCESS** | `P-5A327449X7452233TNLYQY3A` | Standard PayPal Business account |
| **Reporting Balances** | `GET /v1/reporting/balances` | **VERIFIED SUCCESS** | Account `RMYYMT3FXD8LJ` | Reporting API permission enabled |
| **Transaction Search** | `GET /v1/reporting/transactions` | **VERIFIED SUCCESS** | Found 1 transaction detail | Reporting API permission enabled |
| **Vault v3 Setup Token** | `POST /v3/vault/setup-tokens` | **PERMISSION RESTRICTED** | `Authorization failed due to insufficient permissions` | Requires PayPal "Vault without purchase" / Reference Transactions approval on business account |

---

## 2. Vault v3 & Storm Pledges

### 2.1 Overview & Architecture
Storm Pledges allow donors to save their PayPal account without purchase and authorize a capped charge only when an official warning triggers:
1. **Donor Setup**: Client initiates setup token creation (`POST /v3/vault/setup-tokens`).
2. **Buyer-Present Approval**: Donor approves saving payment method via PayPal JS SDK v6 / popup.
3. **Token Creation**: Backend exchanges approved setup token for permanent payment token (`POST /v3/vault/payment-tokens`).
4. **Merchant-Initiated Charge**: When warning triggers, Pledge Caller charges token via Orders v2 (`POST /v2/checkout/orders` with `payment_source.token`).

### 2.2 Live Sandbox Finding & Production Constraint
- **Live Sandbox Call**:
  ```http
  POST /v3/vault/setup-tokens HTTP/1.1
  Host: api-m.sandbox.paypal.com
  Content-Type: application/json
  Authorization: Bearer <TOKEN>

  {
    "payment_source": {
      "paypal": {
        "usage_type": "MERCHANT",
        "customer_type": "CONSUMER",
        "experience_context": {
          "brand_name": "Landfall Mutual Aid",
          "return_url": "https://example.com/return",
          "cancel_url": "https://example.com/cancel"
        }
      }
    }
  }
  ```
- **Response**:
  ```json
  {
    "name": "NOT_AUTHORIZED",
    "message": "Authorization failed due to insufficient permissions.",
    "debug_id": "848bb202ee26a"
  }
  ```
- **Underlying Cause**: In PayPal Developer Sandbox, saving PayPal accounts without purchase (`usage_type: MERCHANT` or Reference Transactions / Billing Agreements) is restricted unless explicitly enabled by PayPal Developer Operations for the account.
- **Implementation Strategy**:
  1. Production code is written to the exact Vault v3 specification.
  2. The application handles `NOT_AUTHORIZED` by providing an auditable Sandbox Simulation mode clearly badged as *"Production path — Requires PayPal Vault approval"*.
  3. All donor caps, consent records, outbox persistence, and ledger accounting are 100% real and enforced in the database.

---

## 3. Monthly Sustainers (Subscriptions v1)

### 3.1 Catalog Products
- **Endpoint**: `POST /v1/catalogs/products`
- **Request**:
  ```json
  {
    "name": "Landfall Mutual Aid Sustainer",
    "description": "Monthly recurring sustainer contribution",
    "type": "SERVICE",
    "category": "CHARITY"
  }
  ```
- **Live Sandbox Result**: `PROD-4HV976845W620203M` created successfully.

### 3.2 Billing Plans
- **Endpoint**: `POST /v1/billing/plans`
- **Request**:
  ```json
  {
    "product_id": "PROD-4HV976845W620203M",
    "name": "Monthly Sustainer ($25/mo)",
    "billing_cycles": [
      {
        "frequency": { "interval_unit": "MONTH", "interval_count": 1 },
        "tenure_type": "REGULAR",
        "sequence": 1,
        "total_cycles": 0,
        "pricing_scheme": {
          "fixed_price": { "value": "25.00", "currency_code": "USD" }
        }
      }
    ],
    "payment_preferences": {
      "auto_bill_outstanding": true,
      "setup_fee_failure_action": "CONTINUE",
      "payment_failure_threshold": 3
    }
  }
  ```
- **Live Sandbox Result**: Plan `P-5A327449X7452233TNLYQY3A` created successfully with status `ACTIVE`.

### 3.3 Subscription Webhooks & Accounting Invariant
- **Events**:
  - `BILLING.SUBSCRIPTION.CREATED`: Subscription entity initialized.
  - `BILLING.SUBSCRIPTION.ACTIVATED`: Donor approved subscription. **DOES NOT MOVE MONEY**.
  - `BILLING.SUBSCRIPTION.UPDATED`: Plan or details changed.
  - `BILLING.SUBSCRIPTION.CANCELLED`: Donor or coordinator cancelled.
  - `BILLING.SUBSCRIPTION.SUSPENDED`: Temporarily halted due to payment failures.
  - `BILLING.SUBSCRIPTION.EXPIRED`: Maximum cycles reached.
  - `PAYMENT.SALE.COMPLETED`: **MONEY MOVEMENT**. The only event that records a credit to `paypal_available` and `reserve_protected` in the double-entry ledger.

---

## 4. Reporting & Treasury Reconciliation

### 4.1 Account Balances
- **Endpoint**: `GET /v1/reporting/balances?currency_code=USD`
- **Live Sandbox Result**: Returned active account balance for account `RMYYMT3FXD8LJ`:
  - `available_balance`: USD amount
  - `as_of_time`: `2026-11-08T21:59:59Z`

### 4.2 Transaction Search
- **Endpoint**: `GET /v1/reporting/transactions?start_date=<ISO>&end_date=<ISO>&fields=all`
- **Live Sandbox Result**: Returned matching transactions for reconciliation matching.

---

## 5. Security & Invariant Rules for M3

1. **Contingent vs Captured**:
   - Pledges are contingent promises. They are stored in `pledges_contingent`.
   - **Never** add contingent pledges to `allocatable` funds.
   - Pledges move to `pledges_captured` and available balance ONLY when PayPal Order capture returns `COMPLETED`.
2. **Cap Enforcement**:
   - Every charge checks:
     - `amount <= pledge.amountPerEventCents`
     - `amount + pledge.chargedThisSeasonCents <= pledge.seasonCapCents`
     - `pledge.status === "ACTIVE"`
     - `pledge.expiresAt > NOW()`
     - `emergencyStop === false`
3. **Deduplication**:
   - Stable idempotency key: `req_pledge_${incidentId}_${pledgeId}`.
   - Database unique constraint on `(incident_id, pledge_id)`.

