# LANDFALL v3 — Final Master Build Prompt

> **Replaces all earlier prompts and briefs.** Save as `docs/PROJECT_BRIEF.md` (overwrite) and re-read at the start of every task. Where any older file, README or code disagrees with this file, this file wins.
> This version answers two rounds of hostile review. Every mechanism here exists to defeat a specific objection (see §3), so don't remove or simplify any of them without asking me.

---

## 0. Role and engineering rules

You are the principal engineer building **Landfall** with me for the **PayPal AI Hackathon 2026**. The bar is "a judge from PayPal engineering, a humanitarian operations director and a security reviewer each try to break it, and each fails." Build it to that standard.

1. **Plan → implement → test → evidence.** Every milestone ends with proof: command output, PayPal IDs and debug_ids, DB rows, test and eval reports, screenshots.
2. **Real PayPal sandbox only** (`https://api-m.sandbox.paypal.com`). Mocks only in unit tests.
3. **"Done" means evidenced.** The README Status table is updated in the same commit as any feature and never claims more than what works.
4. **Verify every external API against its live docs before coding it** (PayPal Payouts, Identity, Vault v3, Subscriptions, JS SDK v6, Agent Toolkit; AG Studio 2.x; NWS; IEM; Render). If the docs differ from this file, the docs win; tell me.
5. Conventional Commits, small and frequent, pushed every time.
6. TypeScript strict; no `any` in `lib/`; Zod at every boundary; explicit state machines for money and alerts.
7. Secrets only server-side. Browser gets only the allow-listed `NEXT_PUBLIC_*` values.
8. Blocked for more than 20 minutes → report: what you tried, the exact error, two options.
9. Accessibility, security and honesty are features, not polish.

---

## 1. Hackathon facts

- Devpost https://paypalaihackathon.devpost.com/ · Rules https://paypalaihackathon.devpost.com/rules · Resources https://paypalaihackathon.devpost.com/resources · Discord https://discord.gg/sJ2G6DyvSK
- Repo https://github.com/Bharathadi01/landfall (public, MIT in About)
- Submission closes **Thu Nov 12, 2026, 12:00 PM PST**. The hosted demo must stay free and working for judges through **Dec 15, 2026**.
- Required: PayPal sandbox central + meaningful AI; working hosted demo + run instructions; open-source licence; **video under 3:00** on YouTube showing it running; English.
- Criteria (equal weight; ties broken in this order): **Technological Implementation → Design → Potential Impact → Innovation/Idea → Presentation.** Stage 1 pass/fail = fits the theme and really uses the APIs.
- Aim: 1st place. Sponsor prize: Best Use of AG Grid (AG Studio + custom widgets + Studio Agent Framework).

---

## 2. The product

### 2.1 One sentence
**Landfall is free, open-source software that lets community relief funds prepare everything before a disaster: who they'll help, how much, from which money, through which payment channel. When an official warning lands, a small pre-agreed payment goes out through PayPal after two people approve, followed by a needs-based payment after the storm.**

Tagline: **"Cash before the storm."**

### 2.2 The problem (defensible version)
Community relief groups lose critical days *after* a disaster starts: assembling who needs help, inventing allocation rules under pressure, raising money, and paying people through personal P2P accounts that weren't built for bulk disbursement and can hit transaction caps. Landfall moves that work **before** the emergency, and lets groups **rehearse it**, so authorized help can be released quickly when a pre-agreed official trigger occurs.

Don't claim identity verification is "the" bottleneck. Don't claim Landfall guarantees money before landfall.

### 2.3 Evidence (use exactly; never merge the two Bangladesh studies)
- **WFP (Sept 2026), randomized controlled trial**, Bangladesh: cash given before floods peaked generated significant benefits compared with the same cash given after. https://www.wfp.org/publications/bangladesh-anticipatory-action-impact-evaluation
- **World Bank Economic Review (2026), quasi-experimental, not randomized**, Bangladesh 2020 floods: 23,434 households received cash about 7 days before their local flood peak; children about 5% more likely to eat three meals; life satisfaction 18.7% higher; financing pre-arranged through the UN CERF fund. https://ora.ox.ac.uk/objects/uuid:ca0b464e-9c4d-4aab-9553-1124b4f79747/files/rmg74qp83d
- **WFP review (2021)**: in the 2019 Bangladesh floods, households started receiving humanitarian assistance about 100 days after the floods. https://docs.wfp.org/api/documents/WFP-0000130799/download
- Anticipatory action has three parts: **a forecast-based trigger, a pre-agreed plan, and pre-arranged financing.** Landfall implements all three for community funds.
- **Triangle Mutual Aid** (Tropical Storm Chantal): donations held by Venmo transaction caps while people still needed help. https://triangleblogblog.com/?p=14242
- **RGV Mutual Aid**: 500+ requests, intake closed temporarily during the backlog; low-barrier access mattered, including for undocumented families; paid via multiple methods including cash and wire. https://www.portisabelsouthpadre.com/2020/08/07/crowdfunding-effort-aiding-rgv-recovery
- **GiveDirectly Helene**: payments 1–3 months after the hurricane were described as "lifesaving". This is evidence for *timely recovery cash*, **not** for pre-storm payments. https://www.givedirectly.org/helene-study

The research supports **early cash as a principle**. It does not prove Landfall's software produces those outcomes; say so.

### 2.4 Competitors and honest positioning
- **AidKit Ready** (launched Aug 31, 2026): pre-positioned disaster cash for governments **and nonprofits**: intake, eligibility, fraud screening, multiple payment options (ACH, cards, mailed), audit, plus operational support. The government model is a one-time setup fee plus percentage-based fees on disbursed funds; nonprofit pricing isn't public. https://www.causeartist.com/blog/aidkit-ready-disaster-cash-assistance
- Others: UNICEF HOPE, IOM BRaVe, CommCare (humanitarian case and cash management).

**Landfall's honest difference** (put it in the README as "Why Landfall, and when to choose AidKit instead"):
1. **Open source and self-hostable, $0 software cost.** The group owns its data and code.
2. **PayPal-native pre-financing nobody else offers: Storm Pledges.** Donors save PayPal now and authorize a capped charge only when an official warning triggers (§4.2).
3. **Rehearsal built in: Drill mode.** Run a full storm end to end safely before the season.
4. **Radical transparency:** a published policy, explanations for every decision, a reconciled public ledger.
5. **No lock-in:** standard exports, so a group can move to AidKit or any provider.
6. **When AidKit is the better choice:** a large program needing staffed review teams, many payment rails, or government contracting. Saying this openly builds trust.

### 2.5 Golden rules (UI + README)
1. **Rules decide the money. AI never sets eligibility, priority or amounts.**
2. **Two people approve every batch** with passkeys, over a locked plan hash. One of them must hold the host's **Finance** role.
3. **Only the Treasurer (code) can call PayPal Payouts. Only the Pledge Caller (code) can charge saved PayPal.**
4. **Missing paperwork never lowers priority.** It routes to a human.
5. **Every number a person sees comes from the database or PayPal**, never from model text.

---

## 3. Risk register (objection → mechanism)

| # | Objection | Landfall mechanism | Where |
|---|---|---|---|
| R1 | Small groups can't get Payouts | Host model (nonprofit or fiscal sponsor owns the PayPal Business account); readiness checklist; honest "production approval is PayPal's decision"; manual-channel and PayPal CSV fallback | §4.1 |
| R2 | Who owns the money and the authority? | Governance config: host legal entity, account owner, Finance-role approver required, donor-restriction notes, documented in-app | §4.1 |
| R3 | No pre-arranged money | **Storm Treasury**: Protected Reserve + Sustainers (Subscriptions) + **Storm Pledges** (Vault v3); double-entry ledger; fees reserved; concurrency-safe commits | §4.2 |
| R4 | Balance ≠ donations ≠ allocatable | Allocatable = PayPal available balance − protected floor − fees reserved − committed; computed by code; shown as a waterfall | §4.2 |
| R5 | Forecast wrong / not proof of damage | Two tranches; Warning-only trigger list; small fixed Tranche 1; impact check-in for Tranche 2; auto-void; emergency stop | §4.3 |
| R6 | NWS geometry complexity | Sentinel handles polygon, zone (UGC) and county (SAME) alerts, Update/Cancel/expire chains, multi-alert, staleness; per-household confirmation via NWS `alerts/active?point=` | §4.3 |
| R7 | Replay confused with live | Replay built from the IEM VTEC archive (real historical NWS alert + geometry) and historical NEXRAD radar; persistent HISTORICAL REPLAY banner with source and mode | §4.3 |
| R8 | Excludes people without PayPal, bills, phones, documents | Four recipient paths + evidence ladder; no government ID or SSN ever requested; assisted enrollment; post-event intake; manual channel | §4.4 |
| R9 | Verified PayPal ≠ eligible ≠ resident ≠ affected | Four separate, visible checks: Payment channel · Residence evidence · Exposure · Need | §4.4 |
| R10 | Unclaimed contradicts linking | UNCLAIMED is expected only on the EMAIL path (claim link); linked accounts use `PAYPAL_ID`; an unexpected UNCLAIMED on a linked account is flagged as an exception | §4.5 |
| R11 | `PAYPAL_ID` vs OAuth payer_id | Spike-test that the Log in with PayPal payer_id works as a `PAYPAL_ID` receiver; fallback to verified email; record the result | §4.5 |
| R12 | Sandbox doesn't support PHONE | Sandbox uses EMAIL / PAYPAL_ID only; PHONE and Venmo shown as "production path" | §4.5 |
| R13 | Batch ≠ item success | Per-item state machine from item webhooks + item lookups; partial-success batch demonstrated | §4.6 |
| R14 | Duplicates on retry, refresh, timeout, restart | `PayPal-Request-Id` (replays the original response; PayPal stores keys 30 days) + `sender_batch_id` + DB unique keys + outbox; six failure drills in tests | §4.6 |
| R15 | Wrong recipient, irreversible | Final approval screen: masked destination, channel status, amount, prior payments, reason; passkey signature | §4.6 |
| R16 | Allocation formula unclear or unfair | Versioned, published policy engine with explicit formula; equity report; appeals | §4.7 |
| R17 | Agent theatre / Auditor not a control | Five agents with distinct tools and state; second model labelled advice; controls are rules + passkeys + Treasurer; live Agent Graph shows real handoffs | §5 |
| R18 | Prompt injection via text or documents | Untrusted-data wrapping; injection screening; no money tools near untrusted input; eval category | §5.4 |
| R19 | Cached outputs look scripted or go stale | Cache only extraction and explanations, keyed by input hash **and** state version; decisions never cached; at least one live inference in the demo, badged | §5.5 |
| R20 | Hallucinated impact numbers | Numbers rendered from data; AI text passes a numeric-consistency check | §5.6 |
| R21 | PII liability | Field encryption, RBAC, PII-access log, LLM redaction middleware, retention, backups + restore drill, threat model, security headers | §6 |
| R22 | Public ledger re-identification | Aggregates only, k ≥ 10, rounding, 24-hour delay, no per-household rows | §6 |
| R23 | Internet or power down in a storm | Offline encrypted manifest, low-bandwidth resident mode, stale-data warnings, any-2-of-N approvals, idempotent recovery, PayPal CSV fallback | §7 |
| R24 | No proof anyone would use it | Real outreach to organizers; quote only with permission; otherwise state "validation is next" | §11 |
| R25 | Too many features for 3 minutes | Six-beat demo script; Judge mode; everything else lives in the README | §12 |

Some risks can't be eliminated by software: PayPal's production approvals, legal obligations of the host, weather uncertainty, and real-world adoption. **Landfall's job is to make each one visible, bounded and honestly documented.** Never claim otherwise.

---

## 4. Core mechanisms

### 4.1 Host, governance and readiness
- `hosts`: legal name, type (501(c)(3) or fiscal sponsor), PayPal account owner, Finance officer(s), donor-restriction notes.
- Roles: `resident`, `volunteer`, `coordinator`, `finance`, `admin`. **Approvals require 2 distinct people, at least one `finance`.**
- `/console/readiness` shows **live checks**:
  - OAuth OK
  - last Payouts test (drill) batch ID
  - webhook registered and last event verified (timestamp)
  - policy published (version)
  - Protected Reserve ≥ floor
  - ≥ 2 approvers with passkeys, one Finance
  - manual-channel contact set
  - backups OK (last restore drill)
  - NWS feed fresh

  Activation is blocked unless all pass, with reasons shown.
- Production notes page: Payouts and Vault (billing agreement) approvals are PayPal's decision; Confirmed Charity status has its own requirements; Landfall guides but can't guarantee. Not legal advice.

### 4.2 Storm Treasury (pre-arranged financing)
Three layers, all real PayPal sandbox:
1. **Protected Reserve**: captured one-time donations (Orders v2 + JS SDK v6). A configurable **floor** that only Tranche 1 can draw on.
2. **Sustainers**: monthly PayPal Subscriptions (catalog product + plan + subscription via JS SDK; `BILLING.SUBSCRIPTION.*` and `PAYMENT.SALE.COMPLETED` webhooks).
3. **Storm Pledges**:
   - The donor saves PayPal **without purchase** via **Vault v3** (setup token → approval → payment token; `usage_type: MERCHANT`) and sets a pledge, e.g. "$25 each time an official hurricane or flood warning covers our area, max $100 per season".
   - When a Tranche 1 activation is approved, the **Pledge Caller** (code) creates merchant-initiated Orders with the vault token, within each donor's caps.
   - The donor is notified and can revoke anytime.
   - Pledged amounts are shown as **contingent**, never counted as allocatable until captured.
   - Production note: charging saved PayPal requires PayPal vetting / billing-agreement approval.

**Double-entry ledger** (`ledger_accounts`, `ledger_entries`, balanced per transaction). Accounts: `paypal_available`, `reserve_protected`, `allocatable`, `committed:{plan}`, `fees_reserved`, `paid_out`, `returned`, `pledges_contingent`, `pledges_captured`.

**Allocatable = PayPal available balance − protected floor (except for Tranche 1) − fees reserved − committed.** Computed by code. Plan commits use a row lock on the fund, so two plans can never spend the same dollars. Fees are reserved per item from PayPal's actual fee responses, not hardcoded.

**Treasury waterfall** visual: Available → Protected → Fees → Committed → Allocatable → Proposed → Buffer, plus pledges (contingent) and coverage ("covers 74% of Tranche 1 for 212 eligible households").

### 4.3 Sentinel, triggers and tranches
**Trigger policy** (published):
- Tranche 1 fires only on listed **Warning** events (Hurricane, Storm Surge, Flash Flood, Extreme Heat). `status=Actual`, `messageType` Alert or Update.
- Watches and advisories are informational only.

**Alert engine:**
- Poll `api.weather.gov/alerts/active?area=<state>` every ≥ 60 s, with `User-Agent` and `If-Modified-Since`/ETag. Back off on errors.
- Normalize each alert into an **event key** (VTEC phenomena.significance + office + ETN when present; else id + references chain).
- Follow `references` for Update and Cancel; handle expiry.
- **Geography resolver**: polygon geometry → use it. Null geometry → `geocode.UGC` zones (fetch and cache `/zones/forecast/{id}` or `/zones/county/{id}` geometry) and `SAME` county FIPS.
- **Per-household confirmation**: before planning, re-query `alerts/active?point=lat,lon` for candidates (batched and throttled). Agreement → exposure confirmed. Disagreement → `needs_review`.
- Multiple alerts on one household → one Tranche 1 per event.
- Staleness banner if the last successful sync was more than 10 min ago.

**Lifecycle:** cancel, expiry or downgrade before approval → plan auto-voided with the reason. After sending → no clawback; recorded in the ledger as "sent before cancellation" (bounded by the Tranche 1 cap).

**Tranche 2 "Recover"**: opened by a coordinator after the event; needs-based amounts from policy; requires an **impact check-in** (self one-tap + optional photo, or volunteer attestation); open to **non-enrolled** people via post-event intake; a separate budget line.

**Emergency stop**: a global flag the Treasurer and Pledge Caller check before every call.

**Historical replay (honest and real):**
- Build the fixture from the **IEM VTEC archive** (`mesonet.agron.iastate.edu/json/vtec_event.py` and `/geojson/vtec_event.py`) for the real Hurricane Milton 2024 warnings from NWS Tampa Bay (TBW). This gives real alert text and geometry.
- Add **historical NEXRAD radar** for the same hours from IEM's archived tile service (`ridge::TBW-N0Q-YYYYMMDDHHMM` / WMS-T).
- Persistent banner: "HISTORICAL REPLAY · Hurricane Milton, Oct 2024 · Source: NWS via IEM archive · Deterministic replay to demonstrate the workflow · Not a current warning."
- The live feed runs alongside it with its own LIVE badge.

### 4.4 Inclusion: recipient paths, evidence and the four checks
| Path | Who | Payment channel |
|---|---|---|
| `LINKED_PAYPAL` | Has PayPal; logs in with PayPal | `PAYPAL_ID` (payer_id) or verified email; expected SUCCESS |
| `EMAIL_CLAIM` | No PayPal; gives an email | Payout arrives as a **claim link**; **expected UNCLAIMED** until they open a free account; the Courier guides them |
| `ASSISTED` | No smartphone, low literacy, older adults | A volunteer enrolls them on a tablet; attestation; then either channel above |
| `MANUAL_CHANNEL` | Can't or won't use PayPal | Never sent to PayPal; tracked in the ledger; exported to the host's manual method (check, cash card) |

**Evidence ladder** for residence (any level is acceptable; higher levels only speed review): self-declared → volunteer attestation → document (utility bill, lease, mail, school letter, shelter letter). **No government ID, SSN or immigration status is ever requested.** Document text extraction is labelled **"extracted, not authenticated."**

**Four independent checks**, shown as chips on every household:
1. **Payment channel**: Verified (linked) / Claim link / Manual.
2. **Residence evidence**: Self / Attested / Document.
3. **Exposure**: In warning area (code + NWS point confirmed) / Not / Review.
4. **Need**: Policy priority factors (Tranche 1) / Impact confirmed (Tranche 2).

Also:
- **Displaced people**: Tranche 2 uses current location plus the original enrollment.
- "Still here?" re-confirmation each season; Tranche 1 needs re-confirmation within 12 months.
- Appeal button on the resident page → human review queue with SLA tracking.

### 4.5 PayPal recipient specifics
- Spike-verify that the Log in with PayPal `payer_id` works as a Payouts `PAYPAL_ID` receiver in the sandbox. Record the result in `docs/PAYPAL.md`; fallback to verified email.
- **The sandbox doesn't support the PHONE recipient type.** The sandbox uses EMAIL and PAYPAL_ID only. PHONE and Venmo (`USER_HANDLE`/`PHONE`, US only) stay in code, flagged "production path", disabled in the UI.
- Any UNCLAIMED on a `LINKED_PAYPAL` recipient is an **exception**: alert the coordinator, investigate.

### 4.6 Treasurer (code) and payment integrity
**Plan state machine:** `draft → rules_valid → explained → approved_1 → approved_2 → submitting → submitted → settled_partial | settled → closed` (and `voided`).

**Before calling Payouts**, check all of:
- readiness OK
- emergency stop off
- plan rules-valid and unchanged (hash)
- 2 passkey approvals (one Finance) on this hash
- allocatable covers total + fees
- no household already paid for this event and tranche

**Idempotency:**
- **Outbox row** written before the call.
- `PayPal-Request-Id` = plan id (PayPal replays the original response for retries; keys kept 30 days).
- `sender_batch_id` = `activation:tranche`; `sender_item_id` = `activation:tranche:household`.
- DB unique constraints on both.
- **Recovery worker** resumes `submitting` plans after a restart by replaying with the same request id.

**Tests must cover six drills:** double click, refresh mid-submit, network timeout after send, 5xx then retry, process restart, webhook replay. Each ends with exactly one batch and a correct ledger.

**Per-item truth:** item status only from `PAYMENT.PAYOUTS-ITEM.*` webhooks (signature-verified, deduped by event id, precedence for out-of-order) plus item lookups. `PAYOUTSBATCH` events trigger a fetch of items via HATEOAS links. The demo shows SUCCESS, UNCLAIMED and one simulated FAILED/BLOCKED (use PayPal's documented sandbox test values where available).

**Final approval screen** (full page, not a dialog), per line:
- recipient display name (decrypted for authorized roles only)
- masked destination
- channel check
- amount + fee
- prior payments
- policy reason
- flags

Then the totals waterfall, then the passkey signature.

**Reconciliation:** on demand + nightly. Ledger vs `GET /v1/reporting/transactions` and `/v1/reporting/balances` (or the documented fallback). Mismatches go to a war-room panel.

**Manual fallback:** export the approved plan as a PayPal Payouts **CSV** (PayPal's web upload is an official method) and as an **encrypted offline manifest**.

### 4.7 Policy engine (deterministic, published)
**Versioned policy JSON**, confirmed by Finance + one coordinator:
- `tranche1_amount` (fixed)
- `tranche2_formula`: base + per-person + vulnerability add-ons, capped
- `max_per_household_per_event`, `max_households_per_address`
- `priority_order`, a lexicographic list, e.g.:
  1. medical device dependent
  2. age 65+ living alone
  3. disability
  4. no vehicle in a surge zone
  5. children under 5
  6. everyone else by enrollment date
- `program_budget_cap`, `protected_floor`, `fee_buffer_pct`
- `trigger_events`, `tranche2_window_days`

AI may **draft** policy JSON from plain English; it's inert until confirmed.

Engine output per household: eligible?, amount, priority rank, and **reason codes** (e.g. `P1_MEDICAL_DEVICE`, `CAP_REACHED`, `WAITLISTED_BUDGET`, `NOT_IN_AREA`, `NEEDS_REVIEW_DOC_MISMATCH`).

**Equity report** for every plan: share of eligible households funded, broken down by language, recipient path, zone and evidence level. Show any group below 80% of the overall rate in amber, with an explanation.

Public `/how-we-decide` is generated from the active policy version (multilingual).

---

## 5. AI system (free tiers, real multi-agent)

### 5.1 Models
- **Gemini Flash** (Google AI Studio free key) for text, vision and audio: Intake, Sentinel, Watch Officer, Courier.
- **Groq** `openai/gpt-oss-120b` (free plan, OpenAI-compatible endpoint) for the Verifier's **second opinion** and fast classification.
- Gemini embeddings for case similarity (if the free tier allows; else a trigram fallback).
- `lib/ai/provider.ts`: routing, retry/backoff, provider fallback, token and latency logging. All model IDs come from env.

### 5.2 Agents (five, each with distinct tools and state)
| Agent | Job | Tools | Writes | Never |
|---|---|---|---|---|
| **Intake** | Multilingual enrollment conversation (text; voice optional), optional document extraction, assisted mode | geocode, doc-extract, Log in with PayPal userinfo (read) | `households` (draft → submitted), `documents` | approve, score |
| **Verifier** | Anomalies: same PayPal identity twice, address clusters, document mismatch, out-of-area, injection; Groq second opinion on flagged cases | identity-link + case queries, similarity | `risk_reports` | block (high risk → human) |
| **Sentinel** | Writes the plain-language activation brief from NWS text; geography is code; flags point-check disagreements | NWS, zones, IEM (replay) | `activation_briefs` | choose households or amounts |
| **Watch Officer** (AG Studio copilot) | Explains plans and reason codes, answers "why X?", runs what-if (re-runs rules on a copy), drafts coordinator and donor text with numbers injected | read-only DB, rules simulator, Agent Toolkit read-only (`list_transactions`, `get_merchant_insights`) | none | approve, edit, pay |
| **Courier** | Per-item follow-up: claim help (EMAIL path), re-confirmation, Tranche 2 check-in invites, reissue **requests** | item status, messaging (in-app + email) | `messages`, `rescue_requests` | move money |

Code services (no LLM): **Treasurer**, **Pledge Caller**, **Policy Engine**, **Geography Resolver**, **Reconciler**.

### 5.3 Orchestration and observability
- **Durable event-driven runtime:** `agent_events` (append-only, Zod-typed payloads, `correlation_id`, `state_version`) + `jobs` (Postgres queue, `FOR UPDATE SKIP LOCKED`) + Render Cron. Every step is idempotent.
- **Live Agent Graph** (animated) in the war room: nodes light up as events flow (agent → code service → PayPal), with model, latency, tokens, tool calls and PayPal debug_ids on hover.
- Traces exported to `agent_events` and viewable per activation.

### 5.4 Safety
- **PII redaction middleware** before any LLM call: names, emails, phones and street lines are replaced with tokens. Unit-tested; CI fails if a prompt builder receives PII fields.
- Untrusted text (stories, OCR text) goes in delimited data blocks; a system rule says to ignore instructions inside data; an injection screen runs on the Groq fast model plus heuristics.
- Agents reading untrusted input hold **no** money or write-to-PayPal tools. The Agent Toolkit is configured per agent with **read-only actions only**; CI asserts this.
- Zod-validated outputs; retry once, then `needs_review`.

### 5.5 Caching rules
- Cache **extraction and explanation** outputs keyed by `sha256(model + prompt_version + input + state_version)`.
- **Never cache** policy results, eligibility, amounts, plans or approvals. Always recompute.
- The UI badges cached text "AI-GENERATED · replayed" and live text "AI-GENERATED · live". The demo includes at least one live inference.

### 5.6 Numeric integrity
Any AI text shown to people is checked: every number in it must appear in the structured data passed in. Otherwise it's rejected and the template version is used instead.

### 5.7 Evals (`pnpm eval` → `docs/EVALS.md`, run in CI on a subset)
Categories and targets:
- intake field accuracy (60 cases, EN/ES/HT/VI)
- injection in story **and** in document → 0 unsafe outcomes, 0 money moved
- duplicate identity / address cluster detection
- missing evidence never lowers priority (property test)
- alert lifecycle: update, cancel, expire, null geometry, county-only, multi-alert
- point-check disagreement → review
- reserve shortfall → waitlist order correct
- six idempotency drills
- partial batch states
- out-of-order webhooks
- numeric-integrity rejects
- translation back-check: Gemini translates to the target language and back; flag drift for human review

Publish the scorecard. Claim only what it shows.

---

## 6. Security and privacy

- **Auth:** coordinators, finance and volunteers sign in with **passkeys** (WebAuthn via SimpleWebAuthn) plus short sessions; residents use magic-link or token pages. **Approvals are passkey signatures over the plan hash.**
- **RBAC** enforced server-side on every route; PII decrypted only for authorized roles; **every PII read is logged** in `pii_access_log`.
- **Encryption:** app-level AES-256-GCM for PII columns (key in env, versioned for rotation); TLS everywhere; document images deleted after extraction (`image_deleted_at`).
- **Minimization:** collect only what the policy needs; no government IDs; consent screen with AI disclosure, retention and deletion request.
- **Retention:** inactive enrollments purged after 12 months; payout records kept as the host's policy requires.
- **Public ledger:** aggregates by zone, k ≥ 10, amounts rounded to $50, 24-hour delay, no individual rows.
- **Platform:** strict CSP and security headers, rate limiting, CSRF protection, input validation, dependency audit in CI, secret scanning.
- **Backups:** Render Postgres backups plus a documented, tested **restore drill**.
- `docs/THREAT_MODEL.md` (STRIDE) and `SECURITY.md`.

---

## 7. Storm-day operations

- **Low-bandwidth resident mode:** text-first, under 100 KB pages, cached last status (PWA), short SMS-style messages.
- **Offline encrypted manifest** export for authorized coordinators (recipients, amounts, channel), decryptable with a passphrase.
- **Stale-data banners** for the weather feed, PayPal webhooks and reconciliation.
- **Any 2 of N approvers**, so an evacuated coordinator never blocks payment.
- Recovery worker plus idempotency, so outages never double-pay.
- **Drill mode:** a one-click full rehearsal (seeded people, replayed storm, sandbox payouts or a Treasurer dry-run), producing a **readiness report** (time from trigger to approval to sent, failures found).

---

## 8. Design, UI and motion

Goal: the most polished entry in the field, and calm, never gimmicky, because this is about people in danger.

- **Design system:** tokens (color, type, space, radius, motion) in `styles/tokens.css`.
  - Deep ocean `#0B3D91`, storm amber `#F5A524`, safe green, alert red; AA contrast in both themes.
  - Inter for UI, JetBrains Mono for IDs and amounts.
  - shadcn/ui + Tailwind; AG Studio themed to match.
- **Motion** (`motion` library + View Transitions API):
  - page transitions
  - pulsing warning polygons
  - **historical radar loop** on the map
  - household dots that **change color live** as webhooks arrive (SSE from Postgres LISTEN/NOTIFY)
  - an animated **money-flow ribbon** from Storm Treasury to zones
  - an animated Agent Graph
  - number counters
  - all respect `prefers-reduced-motion`
- **Storm Clock:** a timeline scrubber (T−48h → landfall → T+72h) that drives the replay: radar frames, alert changes, plan, approvals, payouts.
- **War room** (desktop, AG Studio custom widgets):
  1. Storm Map (MapLibre + radar + zones + households)
  2. Treasury Waterfall + pledges
  3. Plan & Approvals grid (reason codes, four-check chips, equity report)
  4. Payout Board (per-item states, 30-day claim clocks)
  5. Rescue & Appeals queue
  6. Agent Graph
  7. Readiness and reconciliation status
  8. Watch Officer chat as a custom `AgAiAgent`
- **Resident app** (mobile PWA):
  - language first (EN/ES/HT/VI/ZH)
  - large type, one question per screen, progress dots
  - voice-note option, assisted mode
  - status card with claim steps
  - appeal, "still here?"
- **Donor pages:** donate, sustain, **Storm Pledge** setup with a clear consent explanation and caps; the public ledger; "How we decide".
- **Badges everywhere relevant:** LIVE SANDBOX (hover → PayPal ID/debug_id), HISTORICAL REPLAY, SYNTHETIC, AI-GENERATED · live/replayed (hover → model).
- **Quality targets:** Lighthouse ≥ 95 on public pages; keyboard-complete; screen-reader labels; `lang` per page; skeletons; complete empty and error states.

---

## 9. Tech stack

- Next.js App Router, TypeScript strict, pnpm, Node 22, Tailwind + shadcn/ui, `motion`, MapLibre GL.
- AG Studio (`ag-studio-react` + `ag-studio`, identical versions), `AgStudioAiModule`, `AgAiAssistant` adapter → `/api/studio/ai`, custom widgets, custom agent. Confirm the trial licence includes AI (ask in Discord). If AG Studio can't host a widget, that widget falls back to plain AG Grid / AG Charts.
- Vercel AI SDK; `@ai-sdk/google`; OpenAI-compatible provider for Groq.
- PayPal: typed REST client (`lib/paypal/*`) for OAuth, Payouts, Orders v2, **Vault v3 payment tokens**, Subscriptions, Identity, Webhooks, Reporting; JS SDK v6; `@paypal/agent-toolkit/ai-sdk` read-only.
- Weather: NWS API, IEM (VTEC archive + historical radar tiles), US Census geocoder, Turf.
- Postgres + Drizzle; LISTEN/NOTIFY → SSE for realtime.
- Auth: SimpleWebAuthn passkeys.
- Testing: Vitest (100% on `lib/rules`, `lib/treasurer`, `lib/ledger`, `lib/pledges`, `lib/geo/resolver`), Playwright e2e (Judge mode + drills), `pnpm eval`, axe accessibility checks.
- Render: web, Postgres, cron (`render.yaml`); UptimeRobot on `/api/health`.
- CI: typecheck, lint, tests, coverage gates, architecture tests, eval subset, dependency audit, secret scan.

**Architecture tests:**
- Only `lib/treasurer` imports Payouts; only `lib/pledges` imports Vault charge.
- `lib/rules`, `lib/ledger` and `lib/treasurer` import no AI SDK.
- No agent toolkit config enables money-out tools.
- Prompt builders never receive PII fields.
- Allow-listed `NEXT_PUBLIC_*` only.

---

## 10. Data

- **Real:** PayPal sandbox calls; NWS live; IEM historical alerts and radar; Census geocoding; cited research.
- **Synthetic** (labelled), about 300 Tampa Bay households, mixed languages and paths:
  - ≥ 3 LINKED_PAYPAL on real sandbox personal accounts
  - ≥ 3 EMAIL_CLAIM
  - ≥ 2 ASSISTED
  - ≥ 2 MANUAL_CHANNEL
  - planted anomalies: same PayPal identity twice, 8 at one address, injection in story and in a document, document mismatch, a point-check disagreement, a household under a county-only alert
  - eligible demand **above** allocatable, so the waitlist and equity report are meaningful
- Seeded donors: one-time donations, 2 sustainers, 4 Storm Pledges with different caps.
- README "Data honesty" box.

---

## 11. Real-world validation (do it properly)

- Outreach kit in `docs/VALIDATION.md`: a 3-question message and a 5-minute demo link for mutual-aid organizers, fiscal sponsors and community foundations (Gulf Coast, Carolinas, Texas, Hawaiʻi).
- Log every contact (date, org type, response). Quote **only with written permission**, named or anonymous as they choose. **Never fabricate.**
- If there are no replies, the README and video say: "We contacted N organizers; field validation is our next step."

---

## 12. Judge mode and demo

**Judge mode** (`/` → "Run the storm"): resets the demo, then plays the six beats below with the Storm Clock. Every step is real (sandbox calls, live webhooks), and one AI call is live.

**Video (≤ 2:50, about 330 spoken words, captions, own voice, no copyrighted music), six beats:**

| Time | Beat |
|---|---|
| 0:00–0:25 | **Before the storm.** Maria enrolls in Spanish and links PayPal. A volunteer enrolls Mr. Tran with an email claim link. Four-check chips appear |
| 0:25–0:45 | **The money is ready.** Treasury waterfall; sustainers; Storm Pledges (contingent) |
| 0:45–1:10 | **The trigger.** HISTORICAL REPLAY: real Milton warning + radar loop; zones light up; NWS point checks confirm exposure |
| 1:10–1:40 | **The decision.** Policy engine ranks with reason codes; waitlist and equity report; Verifier flags a duplicate PayPal identity; Watch Officer explains (live AI) |
| 1:40–2:10 | **Two keys, real money.** Final approval screen; two passkey signatures (coordinator + Finance); Treasurer sends; Storm Pledges charged; the PayPal sandbox account shows the batch |
| 2:10–2:50 | **Every dollar accounted for.** Per-item webhooks: Maria SUCCESS, Mr. Tran UNCLAIMED → claim help in Vietnamese; one FAILED handled; reconciled public ledger; close: "Cash before the storm. Built on PayPal." |

---

## 13. README structure

1. Title, tagline, hero GIF of Judge mode, badges (CI, coverage, licence).
2. **Try it in 60 seconds:** live URL, Judge mode, sandbox logins (resident, coordinator, finance, donor), passkey note.
3. **Status table** (honest, with evidence links).
4. Problem + evidence (§2.3).
5. How it works: trigger, plan, pre-arranged money → Sentinel, Policy Engine, Storm Treasury; two tranches; four paths; four checks.
6. Golden rules + architecture diagram + agents table ("Never" column) + Agent Graph screenshot.
7. PayPal integration table: API → file → why (Payouts, Identity, Orders, Subscriptions, **Vault v3 Storm Pledges**, Webhooks, Reporting, Agent Toolkit).
8. AI table + eval scorecard.
9. Payment integrity (idempotency drills, per-item truth, reconciliation).
10. Security and privacy (threat model link).
11. **Why Landfall, and when to choose AidKit instead.**
12. Limits: sandbox vs production, PayPal approvals, not legal advice, weather uncertainty, validation status.
13. Data honesty, run locally, built during the hackathon (dated), tools used (Gemini, Groq, PayPal Agent Toolkit, AG Studio, APIMatic Context Plugin, Render, Antigravity, Claude Code), licence.

---

## 14. Build order (dependency order; each step needs evidence)

**Already done:** M0 scaffold; M1 spike; M2 Render deploy. **First, confirm the M2 evidence table:** real verified webhook, cancel → RETURNED, captured donation, Log in with PayPal (payer_id present?), balances or fallback. Fix anything missing.

1. **Foundations:** README Status table; tokens and design system; auth with passkeys; RBAC; encryption; PII-access log; security headers.
2. **Ledger + policy engine + Treasurer + architecture tests** (100% coverage; six idempotency drills).
3. **Storm Treasury:** Orders, Subscriptions, **Vault v3 Storm Pledges + Pledge Caller**, waterfall, reconciliation.
4. **Recipients:** four paths, evidence ladder, Log in with PayPal → `PAYPAL_ID` spike result, consent, appeals, "still here?".
5. **Sentinel:** NWS engine (polygon / zone / county, update / cancel / expire, point checks, staleness) + IEM historical fixture + radar.
6. **Agents:** Intake, Verifier (+ Groq), Sentinel brief, Watch Officer, Courier; runtime; Agent Graph; redaction; injection screen; numeric integrity.
7. **Tranche 1 end to end:** plan → equity → final approval → passkeys → Payouts → per-item webhooks → partial success → claim help.
8. **War room** (AG Studio widgets + Watch Officer agent) with motion, SSE live updates and the Storm Clock.
9. **Tranche 2** + post-event intake + impact check-ins; manual-channel export; offline manifest; CSV fallback; Drill mode + readiness report.
10. **Public surfaces:** landing, donor flows (donate / sustain / pledge), `/how-we-decide`, ledger, resident PWA polish (5 languages, low-bandwidth).
11. **Evals, accessibility (axe), Lighthouse, threat model, restore drill, Judge mode, docs, video, Devpost.**

---

## 15. Env vars

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_LIPP_REDIRECT=
PAYPAL_SUSTAINER_PLAN_ID=
DATABASE_URL=
PII_ENCRYPTION_KEY=           # base64 32 bytes, versioned
WEBAUTHN_RP_ID=
WEBAUTHN_ORIGIN=
SESSION_SECRET=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
MODEL_FAST=
MODEL_SMART=
MODEL_AUDITOR=openai/gpt-oss-120b
MODEL_EMBED=
NEXT_PUBLIC_AG_STUDIO_LICENSE=
NWS_USER_AGENT="Landfall (contact: <public email>)"
CRON_SECRET=
JUDGE_MODE_ENABLED=true
APP_URL=
```

---

## 16. Start

1. Overwrite `docs/PROJECT_BRIEF.md` with this file and commit.
2. Reply with:
   - the **M2 evidence table** (or what's missing)
   - every conflict between the current code or README and this brief (agent names and count, Allocator/Steward remnants, Gemini Pro, PHONE in sandbox, overclaims)
   - your plan for build-order steps 1–2, with the files you'll create
   - anything here the live docs contradict (especially Vault v3 MIT charges in sandbox, `PAYPAL_ID` with payer_id, AG Studio custom agents and tools, IEM endpoints)
3. Then execute step 1, then step 2, with evidence.
