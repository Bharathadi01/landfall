# Security

Landfall is a hackathon-stage project that runs against the **PayPal Sandbox** with **synthetic households**. It has not had an independent security review or penetration test and holds no security certification. This page says what is protected, how, and, just as importantly, what is **not** yet safe for real people's data or real money. The detailed analysis is in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Reporting a vulnerability

No dedicated security contact or bug-bounty process has been set up by the maintainer, and none is invented here.

* If **private vulnerability reporting** is enabled on the GitHub repository (Security tab → "Report a vulnerability"), use that. This is the preferred path.
* Otherwise open a GitHub issue that says only that you have a security finding and asks for a private channel. **Do not put exploit details, secrets or personal data in a public issue.**

Please do not run load tests, spam the enrolment form, or use the demo sign-in to create large numbers of Sandbox payouts against the shared demonstration deployment.

## Supported versions

There are no versioned releases. Only the `main` branch is maintained.

## Authentication today is demo-only

This is the most important fact on this page.

* **Operator sign-in is a one-click choice of three fictional demo personas** (`POST /api/auth/session`): a coordinator, a finance director and a read-only viewer. There is no password, SSO or account system. It is enabled unless `JUDGE_MODE_ENABLED=false`, and `render.yaml` sets it to `true` so judges can use the product. **Anyone who visits the public demonstration can sign in as the coordinator or the finance director.**
* If `JUDGE_MODE_ENABLED=false`, **no operator can sign in at all**: there is no other sign-in path in the code.
* **Money approvals** use two different signed-in people, the second of whom is Finance, with either a passkey (WebAuthn, bound to the exact payload hash) or, where no authenticator exists, a labelled **demo PIN**. The default PIN (`246810`) is in this repository and printed on the public judge card. The demo PIN is refused whenever `PAYPAL_ENV=live` (`demoKeyEnabled`) and can be turned off anywhere with `DEMO_KEY_DISABLED=true`.
* **What bounds the damage on the demonstration deployment:** it uses Sandbox credentials (play money); a payout needs a server-side Sandbox receiver for the household (`SANDBOX_RECEIVERS`, never returned by any API); per-item and per-proposal caps (`LIVE_PAYOUT_MAX_ITEM_CENTS` $100 and `LIVE_PAYOUT_MAX_TOTAL_CENTS` $50 per proposal as deployed); a household with a payment already in flight is refused; the `PAYLOAD_CHANGED` and duplicate guards apply.
* **Before any use with real money or real beneficiaries** at minimum: replace persona sign-in with real identity and role assignment; set `JUDGE_MODE_ENABLED=false` and `DEMO_KEY_DISABLED=true`; require passkeys for approvers; move the rate limiter and lockouts out of process memory; and complete the items below.

## Controls that exist (and where to verify them)

| Control | Implementation | Evidence |
|---|---|---|
| Default-deny API with one access table | `middleware.ts`, `lib/auth/policy.ts`; routes re-check access | `tests/security/access-matrix.test.ts` fails if any route lacks a rule or a sensitive route is public |
| Signed session cookie | HMAC-SHA-256, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 8 h; signing or verifying throws in production if `SESSION_SECRET` is missing or shorter than 16 characters | `tests/security/session.test.ts` |
| Cross-site request blocking | Origin / Fetch-Metadata check for unsafe methods carrying a session cookie | middleware |
| Two-person approval | Proposal → two distinct approvers (one Finance) → Treasurer; unique constraint on (proposal, approver); identity from the session, content from the stored proposal | `tests/proposals/*`, `tests/security/passkeys.test.ts`, `tests/security/demo-key.test.ts` |
| Passkey approval bound to the payload | Single-use, 5-minute challenge that includes the payload hash; origin and relying-party id checked; signature counter updated | `tests/security/passkeys.test.ts` |
| Only the Treasurer can spend | PayPal write functions importable only from `lib/treasurer/` | `tests/arch/boundary.test.ts` |
| Webhook authenticity | Signature verified with PayPal's `verify-webhook-signature`; unverified events stored with `verified=false` and change nothing; duplicate event ids ignored | `tests/paypal/*`, [ARCHITECTURE.md §13](docs/ARCHITECTURE.md#13-webhook-processing) |
| Idempotent money handling | Deterministic ledger transaction ids, payout precedence guard, row-locked status application, `PayPal-Request-Id` | `tests/ledger/*`, `tests/payouts/*`, [FINANCIAL_LEDGER.md](docs/FINANCIAL_LEDGER.md) |
| Cron endpoints fail closed | `CRON_SECRET` ≥ 16 chars, constant-time compare, no default | `tests/security/cron-auth.test.ts` |
| Error hygiene | `safeError` returns a fixed message plus a reference; upstream, SQL and stack text stay in server logs | `tests/security/http-utils.test.ts` |
| Audit redaction | Recipient addresses and email-like values removed from `audit_events` payloads | `tests/security/audit-redact.test.ts` |
| PII encryption at rest | AES-256-GCM for household name and address (see gap 3) | `tests/security/encryption.test.ts` |
| Resident access | Case reference + six-digit code; six wrong codes lock a household for 15 minutes; identical error for "no such case" and "wrong code"; a resident can reach only their own household | `tests/security/resident-code.test.ts` |
| AI cannot move money | No write tool in any AI tool set; input screening; number integrity | [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) |
| Browser hardening headers | `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, a Content-Security-Policy that allow-lists the hosts used (see gap 10) | `next.config.mjs` |

## Known gaps (verified in the code; not yet fixed)

Ordered roughly by how much they would matter in a real deployment. None has been exploited; they are listed so no one assumes protections that are not there.

1. **No production authentication** (above).
2. **Public demo PIN** in the repository and judge card; only disabled automatically for `PAYPAL_ENV=live`.
3. **PII encryption key defaults to a value in the source code.** If `PII_ENCRYPTION_KEY` is unset, `lib/security/encryption.ts` derives the key from a constant string. `render.yaml` and `.env.example` do not set it. A deployment that follows them encrypts household name and address with a key anyone can read here. **Set a real 32-byte key before storing any real person's data.**
4. **Payment receiver and coordinates are stored in clear text** (`households.receiver`, lat/lng); API responses mask them, but a database reader would see them. Donor emails for pledges and for the checkout-created subscription row are clear text as well ([docs/DATA_MODEL.md §5](docs/DATA_MODEL.md#5-sensitive-fields)).
5. **Public routes that change state without an ownership check:** `POST /api/subscriptions/cancel` (cancels any well-formed subscription id at PayPal) and `POST /api/pledges/revoke` (any pledge uuid). Both are rate-limited (6 per minute) but unauthenticated. `POST /api/pledges/create` returns the whole stored pledge row and, if the Vault exchange fails, stores the setup-token id in the payment-token column instead of failing.
6. **The read-only `viewer` role can write** through `POST /api/recipients/appeal` and `/reconfirm` (the `resident-operator` rule includes viewers; only `access-report` blocks the role). These writes are not financial.
7. **Log in with PayPal callback** does not verify `state`, is public, and returns the user's email, name and address in its JSON response; it persists nothing but an audit row ([docs/PAYPAL_INTEGRATION.md §7a](docs/PAYPAL_INTEGRATION.md#7a-log-in-with-paypal-identity-check)).
8. **Rate limits, resident-code lockouts and complaints live in process memory.** They reset on restart, are per instance, and complaints are lost.
9. **Public enrolment has no abuse control** beyond a 6-per-minute-per-address rate limit (no CAPTCHA, email delivery or approval step before a household record exists).
10. **CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts** (needed today by the framework and the PayPal and AG Grid scripts), which weakens its protection against injected script.
11. **Resident codes are derived from `SESSION_SECRET`** (no database). Rotating the secret signs everyone out and changes every code; `RESIDENT_CODE_EPOCH` rotates codes alone. The demo households' codes are public by design.
12. **`POST/GET /api/treasury/reconcile` records a caller-supplied `actor`** in its audit trail (the caller must still be an operator).
13. **`GET /api/alerts/poll` mutates state** (it ingests alerts); it is restricted to the cron secret or a coordinator/finance session.
14. **Audit tables are append-only by convention only**: no database trigger or hash chain makes `audit_events`, `pii_access_log` or `payout_status_history` tamper-evident, and the application uses one database credential with full rights.
15. **Passkeys are not verified on the demonstration deployment.** `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` are left unset in `render.yaml` ("set after the first deploy") and the repository cannot tell whether they were set. Passkey logic is covered by tests; end-to-end use on the deployment is not documented evidence.

## Secrets and configuration

* **Never commit secrets.** [`.env.example`](.env.example) contains names and safe placeholders only. `.env` and `.env*.local` are git-ignored (other names such as `.env.production` are not, so do not use them for secrets).
* Server-only secrets: `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `GROQ_API_KEY`, `SESSION_SECRET`, `CRON_SECRET`, `PII_ENCRYPTION_KEY`, `DATABASE_URL`, `SANDBOX_RECEIVERS`. Variables prefixed `NEXT_PUBLIC_` are shipped to every browser: they hold the PayPal **client id** and the AG Grid/Studio licence keys, which are not secret by design.
* Rotate `SESSION_SECRET` to invalidate every session and resident code. Rotate `CRON_SECRET` independently.

## Out of scope

Weaknesses in PayPal, Groq, Render, NWS/NASA/Open-Meteo or other third-party services; denial-of-service testing; social engineering; anything requiring physical access.

## Safe harbour

Good-faith research that avoids privacy violations, data destruction and service disruption, and that follows the rules above, is welcome. This is a statement of intent by the project, not a legal guarantee.
