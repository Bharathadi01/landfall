# Landfall — PayPal Sandbox Configuration Guide

This document specifies the exact setup, endpoints, and credentials required for running Landfall against the **PayPal Sandbox** (`https://api-m.sandbox.paypal.com`).

---

## 1. Sandbox App Requirements

1. **Dashboard:** [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
2. **Environment:** Ensure the environment toggle is set to **Sandbox**.
3. **App Name:** `landfall-us`
4. **App Type:** **Merchant**
5. **Sandbox Business Account:** Must be a **United States (US)** business account (e.g. `sb-...@business.example.com (US)`). *Note: India/non-US sandbox accounts cannot issue Payouts batches due to cross-border outward remittance rules.*

---

## 2. Enabled App Features

In the Sandbox App settings:
- ✅ **Payouts:** Enabled (required for emergency cash disbursements).
- ✅ **Log in with PayPal (LIPP):** Enabled.
  - Personal Information: Full Name
  - Address Information: Street address, City, State, Postal code
  - Account Information: Email, Account verification status, PayPal account ID
  - **Return URLs:**
    - `http://127.0.0.1:3000/api/auth/paypal/callback`
    - `http://localhost:3000/api/auth/paypal/callback`
    - `https://<YOUR-RENDER-URL>.onrender.com/api/auth/paypal/callback`
- ✅ **Transaction Search:** Enabled.

---

## 3. Webhook Subscriptions

Landfall listens on `POST /api/paypal/webhook`. Register this URL using our script:
```bash
pnpm exec tsx scripts/register-webhook.ts https://<YOUR-RENDER-URL>.onrender.com
```

Subscribed event types:
- `PAYMENT.PAYOUTSBATCH.SUCCESS`
- `PAYMENT.PAYOUTSBATCH.PROCESSING`
- `PAYMENT.PAYOUTSBATCH.DENIED`
- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`
- `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`
- `PAYMENT.PAYOUTS-ITEM.RETURNED`
- `PAYMENT.PAYOUTS-ITEM.FAILED`
- `PAYMENT.PAYOUTS-ITEM.CANCELED`
- `PAYMENT.PAYOUTS-ITEM.BLOCKED`
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`

---

## 4. Environment Variables

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<YOUR_US_SANDBOX_CLIENT_ID>
PAYPAL_CLIENT_SECRET=<YOUR_US_SANDBOX_SECRET>
PAYPAL_WEBHOOK_ID=<REGISTERED_WEBHOOK_ID>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<YOUR_US_SANDBOX_CLIENT_ID>
PAYPAL_LIPP_REDIRECT=http://127.0.0.1:3000/api/auth/paypal/callback
SANDBOX_RESIDENT_EMAIL=sb-tv43cm53751698@personal.example.com
```

---

## 5. Live Spike Verification

Run the spike test suite against PayPal Sandbox at any time:
```bash
pnpm spike:paypal
```
Or open the `/spike` route in your browser to inspect real-time audit logs and PayPal `debug_id`s.

