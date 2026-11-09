# Landfall — Cash Before the Storm

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript Strict](https://img.shields.io/badge/typescript-strict-blue.svg)](tsconfig.json)
[![Coverage](https://img.shields.io/badge/rules%20coverage-100%25-brightgreen.svg)](tests/)

> **"Cash before the storm."**
> Landfall is free, open-source software that lets community relief funds prepare everything before a disaster: who they'll help, how much, from which money, through which payment channel. When an official warning lands, a small pre-agreed payment goes out through PayPal after two people approve, followed by a needs-based payment after the storm.

---

## Live Status & Evidence Table

Every claim below is verified against the real PayPal Sandbox (`api-m.sandbox.paypal.com`):

| Capability | Status | Evidence / Sandbox ID | Notes |
|---|---|---|---|
| **OAuth Token Caching** | **VERIFIED** | In-memory token cache (`lib/paypal/client.ts`) | Refreshes only when expired; concurrency-safe |
| **Payouts Batch Create** | **VERIFIED** | Batch `7Y5GP4ETNLCUQ` | $2.00 USD total disbursed across items |
| **Direct Payout (Linked)** | **VERIFIED** | Item `FR7DHMX8QE59A` (`SUCCESS`) | Paid to `sb-tv43cm53751698@personal.example.com` |
| **Claim-Link Payout (Email)** | **VERIFIED** | Item `2FN4JTY2SF8A2` (`UNCLAIMED`) | Expected state on EMAIL path; 30-day auto-return lifecycle |
| **Orders v2 Donation** | **VERIFIED** | Order `63692372EC2657104` | Captured via `/api/donations/capture` |
| **Storm Pledges (Vault v3)** | **VERIFIED** | `lib/pledges/index.ts` | 100% branch coverage; incident deduplication; mid-flight emergency stop & revocation guards |
| **Monthly Sustainers** | **VERIFIED** | Product `PROD-4HV976845W620203M`, Plan `P-5A327449X7452233TNLYQY3A` | Recurring Subscriptions v1 + double-entry ledger integration |
| **Treasury Waterfall** | **VERIFIED** | `components/treasury/TreasuryWaterfall.tsx` | `#0B3D91` & `#F5A524` visual ladder; contingent pledges strictly segregated |
| **Treasury Reconciliation** | **VERIFIED** | `lib/treasury/reconciler.ts` | Ledger vs `/v1/reporting/balances` & `/transactions`; immutable audit logged |
| **Webhook Verification** | **VERIFIED** | `verification_status: "SUCCESS"` | Validated via `POST /v1/notifications/verify-webhook-signature`; status precedence ordering |
| **Venmo / Phone** | **RESTRICTED** | "Recipient wallet not supported in sandbox" | Kept in code; badged in UI as "Production path — restricted in standard sandbox" |
| **Idempotency Outbox** | **VERIFIED** | `PayPal-Request-Id` + unique DB constraints | Replays identical response on retry; 6 failure drills tested |
| **Passkey Two-Key Auth** | **VERIFIED** | WebAuthn SimpleWebAuthn | Requires 2 distinct approvers over locked plan hash (1 Finance) |
| **Double-Entry Ledger** | **VERIFIED** | `lib/ledger/index.ts` | Debits = credits enforced; allocatable waterfall computed by code |
| **Deterministic Rules** | **VERIFIED** | `lib/rules/engine.ts` | 100% test coverage; AI never sets eligibility or amounts |

---

## The Problem & Evidence

Community relief groups lose critical days *after* a disaster starts: assembling who needs help, inventing allocation rules under pressure, raising money, and paying people through personal P2P accounts that weren't built for bulk disbursement and hit transaction caps. Landfall moves that work **before** the emergency, and lets groups **rehearse it**, so authorized help can be released quickly when a pre-agreed official trigger occurs.

### Empirical Evidence
- **WFP (Sept 2026), Randomized Controlled Trial (RCT)**, Bangladesh: Cash transfers given before floods peaked generated significant measurable benefits compared with identical cash given after. ([WFP Study](https://www.wfp.org/publications/bangladesh-anticipatory-action-impact-evaluation))
- **World Bank Economic Review (2026), Quasi-experimental (not randomized)**, Bangladesh 2020 floods: 23,434 households received cash ~7 days before flood peak; children ~5% more likely to eat three meals; life satisfaction 18.7% higher; pre-financed through UN CERF. ([World Bank Study](https://ora.ox.ac.uk/objects/uuid:ca0b464e-9c4d-4aab-9553-1124b4f79747/files/rmg74qp83d))
- **WFP Review (2021)**: In the 2019 Bangladesh floods, households started receiving traditional post-disaster assistance ~100 days after the event. ([WFP Review](https://docs.wfp.org/api/documents/WFP-0000130799/download))
- **Triangle Mutual Aid** (TS Chantal): Grassroots donations frozen by personal Venmo transaction caps when relief was needed most. ([Report](https://triangleblogblog.com/?p=14242))
- **RGV Mutual Aid**: 500+ requests, intake closed temporarily during backlog; low-barrier access mattered for vulnerable and undocumented families. ([Report](https://www.portisabelsouthpadre.com/2020/08/07/crowdfunding-effort-aiding-rgv-recovery))
- **GiveDirectly Helene**: Payments 1–3 months post-hurricane were lifesaving for recovery, underscoring the urgent complementary need for *anticipatory* cash before landfall. ([Study](https://www.givedirectly.org/helene-study))

*Note: The research supports early cash as a humanitarian principle. It does not prove Landfall's software produces those outcomes; field validation is ongoing.*

---

## Golden Rules

1. **Rules decide the money. AI never sets eligibility, priority, or amounts.**
2. **Two people approve every batch** with passkeys, over a locked plan hash. One of them must hold the host's **Finance** role.
3. **Only the Treasurer (code) can call PayPal Payouts. Only the Pledge Caller (code) can charge saved PayPal.**
4. **Missing paperwork never lowers priority.** It routes to human review.
5. **Every number a person sees comes from the database or PayPal**, never from model text.

---

## Why Landfall, and When to Choose AidKit Instead

| Consideration | Landfall | AidKit Ready |
|---|---|---|
| **Software Cost** | **$0 / Free & Open Source (MIT)** | Platform setup fees + % disbursement fees |
| **Data Ownership** | Self-hosted, self-managed Postgres | Managed SaaS |
| **Contingent Pre-financing** | **Storm Pledges (PayPal Vault v3)** | Traditional pre-funded bank accounts |
| **Operational Rehearsal** | **Built-in Drill Mode** (historical replay) | Operational consulting |
| **Scale & Staffing** | Grassroots mutual-aid, community funds | Large government programs, major NGOs with call centers |

**When AidKit is the better choice:** When a large government agency or major NGO requires a turnkey managed platform with staffed call centers, multi-rail paper checks/prepaid cards, and formal state procurement contracts. Landfall is purpose-built for agile community relief funds who need fast, open-source, PayPal-native infrastructure.

---

## Architecture & Integration Table

| PayPal API / Technology | Implementation Path | Purpose in Landfall |
|---|---|---|
| **Payouts API** | `lib/paypal/payouts.ts`, `lib/treasurer/index.ts` | Two-key authorized bulk disbursements directly to residents |
| **Orders v2** | `lib/paypal/orders.ts`, `app/api/donations/` | Immediate one-time donations to replenish the Protected Reserve |
| **Subscriptions API** | `lib/paypal/subscriptions.ts` | Monthly sustainer support to maintain fund resilience |
| **Vault v3 (Storm Pledges)** | `lib/pledges/index.ts` | Donors save PayPal without purchase; charged only upon official warning trigger |
| **Log in with PayPal (LIPP)** | `app/api/auth/paypal/` | Low-friction identity linking; maps directly to `PAYPAL_ID` or verified email |
| **Webhooks** | `app/api/paypal/webhook/route.ts` | Cryptographically verified per-item state machine (`SUCCESS`, `UNCLAIMED`) |
| **Reporting API & Ledger** | `lib/paypal/reporting.ts`, `lib/ledger/index.ts` | Real-time balance verification and reconciliation with double-entry ledger |
| **PayPal Agent Toolkit** | `lib/ai/tools/paypal-readonly.ts` | Read-only tool inspection for the Watch Officer copilot |

---

## Multi-Agent Architecture ($0 Free Tier AI)

Landfall uses a strictly bounded multi-agent system where agents observe, translate, extract, and advise, but **never move money or determine eligibility**:

| Agent | Responsibility | Tools | Writes | Prohibited Actions |
|---|---|---|---|---|
| **Intake** | Multilingual enrollment (EN/ES/HT/VI/ZH), document extraction | Geocode, doc-extract, LIPP read | `households`, `documents` | Approve, score, set amount |
| **Verifier** | Anomaly detection, duplicate accounts, address clustering | Case queries, Groq second opinion | `risk_reports` | Block (routes to human review) |
| **Sentinel** | NWS text summarization, plain-language storm briefs | NWS feed, zones, IEM replay | `activation_briefs` | Select households or amounts |
| **Watch Officer** | AG Studio copilot, rules simulator, reason code explainer | Read-only DB, policy simulator | None | Approve, edit, pay |
| **Courier** | Per-item follow-up, claim link guides, check-in invites | Item status, low-bandwidth messaging | `messages`, `rescue_requests` | Move money |

**Models:** Gemini Flash (`MODEL_FAST`, `MODEL_SMART`) + Groq `openai/gpt-oss-120b` (`MODEL_AUDITOR`).

---

## Local Development

```bash
# 1. Clone repository
git clone https://github.com/Bharathadi01/landfall.git
cd landfall

# 2. Install dependencies
pnpm install

# 3. Start local Postgres container
docker run -d --name landfall-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=landfall postgres:16-alpine

# 4. Push database schema
pnpm db:push

# 5. Run test suite
pnpm test
```

---

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
