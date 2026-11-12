# AI architecture

> Describes the code at commit `f8f21a7`. Related: [ARCHITECTURE.md §8](ARCHITECTURE.md#8-ai-architecture) and [§12](ARCHITECTURE.md#12-human-approval-workflow), [THREAT_MODEL.md](THREAT_MODEL.md), [`docs/policies/ai-money-policy.md`](policies/ai-money-policy.md).

## 1. The invariant

> **AI MUST NOT INDEPENDENTLY AUTHORISE OR MOVE MONEY.**

This is a property of the structure of the code, not a request made to a model in a prompt:

1. **No AI module has a tool that spends.** The Watch Officer has seven read tools, the Case Officer five, the Studio agent only Studio's own dashboard-editing tools. None of them can reach `lib/treasurer/` (an architecture test, `tests/arch/boundary.test.ts`, fails the build if code outside `lib/treasurer/` imports the PayPal write functions).
2. **Money is moved only by the Treasurer**, which accepts a proposal that two different signed-in people approved (one with the Finance role), re-checks its payload hash, caps and funds, and then calls PayPal ([ARCHITECTURE.md §12](ARCHITECTURE.md#12-human-approval-workflow)). An AI output is never an input to that decision.
3. **Authoritative numbers come from deterministic code.** Eligibility, priority tier, payout amounts, treasury balances, readiness state, recovery options and exposure (Turf.js point-in-polygon) are computed by rules and the ledger. AI text is shown next to them and, where it states a figure, is checked against them (§4).
4. **When a model is unavailable the app says so.** Every AI surface has a labelled deterministic fallback; none silently pretends a template was a model answer.

What AI does here: explain, summarise, cross-check evidence, draft a message, recommend which *human* action to consider. What it cannot do: propose, approve, send, cancel, re-issue, change a household's priority or reveal personal data.

## 2. Who decides what

| Decision | Deterministic code | AI-assisted | Human |
|---|---|---|---|
| Which households are in a warning area | Turf.js point-in-polygon on NWS polygons | – | Coordinator reviews `needs review` cases |
| Priority tier and amount | Rules engine and fund policy (`lib/rules/engine.ts`) | – | Fund policy confirmed by coordinator and finance |
| Can the fund afford it | Ledger and treasury formulas ([FINANCIAL_LEDGER.md](FINANCIAL_LEDGER.md)) | Watch Officer explains the result and the blockers | Finance decides |
| What happened to a payment | PayPal status via webhook / refresh; ledger | Case Officer reads the evidence and says what it shows and what is unknown | Coordinator |
| Which recovery action is permitted | `lib/recovery/decision.ts` | Case Officer picks one *from the permitted list* | A person proposes; two people approve |
| Release money | Treasurer checks | – | Two approvals (passkey, or the labelled demo key in Sandbox) |
| Message to a resident | – | Case Officer drafts it in four languages with an English gloss | A person decides whether to send it (the app sends nothing) |

## 3. The pieces

### 3.1 Groq gateway (`lib/ai/groq.ts`)

All model calls (except the Watch Officer's own client, §3.3) go through one wrapper around the `groq-sdk`. Models, configurable by environment variable, defaults as shipped: reasoning `openai/gpt-oss-120b`, fast `openai/gpt-oss-20b`, input guard `meta-llama/llama-prompt-guard-2-86m`, policy model `openai/gpt-oss-safeguard-20b`, speech `whisper-large-v3-turbo` (configured but **no code path calls it**). Behaviours fixed after real failures against the live API (stated in the file header): always set `reasoning_effort` and a generous token budget (gpt-oss returns empty content otherwise); treat `finish_reason: length` as a failure rather than parsing a truncated answer; retry a 429 once honouring `Retry-After`; and on rate-limit, timeout, provider error, empty, truncated or bad-JSON failures try the *other* gpt-oss model once (the two have separate rate-limit buckets). Failures surface as a typed `GroqUnavailable` that callers must label.

### 3.2 Input screening (`lib/ai/safety/guard.ts`)

Applied to free text sent to the Watch Officer and the Studio gateway:

1. **Regex** for money-moving requests (free, deterministic) → block.
2. **Prompt Guard 2 (86M)** score ≥ 0.9 → block; < 0.1 and no sensitive words → allow.
3. **gpt-oss-safeguard-20b** with the written policy [`ai-money-policy.md`](policies/ai-money-policy.md) for the ambiguous middle and for anything that mentions money, approvals, rules or personal data.

If the model layers cannot be reached the verdict is `allow` with `degraded: true` (the regex layer alone judged it). That is a deliberate fail-open for **read-only** assistants; the file says it is defence in depth, **not** the control that protects money: the control is that no tool can move money and the Treasurer needs two humans.

### 3.3 AI Watch Officer (`lib/ai/watch-officer/`, `POST /api/watch-officer`)

* **Purpose**: a briefing for the coordinator: is a storm active, who is exposed, can the fund afford the first tranche, what blocks approval.
* **Evidence first**: the server calls its **seven read-only tools** itself (`get_disaster_context`, `get_exposure_summary`, `get_treasury_snapshot`, `get_policy_evaluation`, `get_payout_status`, `get_reconciliation_status`, `compare_response_scenarios`), collects the results as evidence items with ids, and hands them to the model in the prompt. Tool names are an allow-list.
* **Model**: only `openai/gpt-oss-20b` and `openai/gpt-oss-120b` are accepted; any other configured name throws (a "zero-cost" guard in `groq-client.ts`). The configured model is tried first, then the other, then the deterministic template.
* **Integrity enforcement** (`integrity.ts`, run on every answer, covered by `tests/ai/watch-officer-money.test.ts` and others): the readiness state is **overridden** by the deterministic evaluation; the funding constraints, exposure counts and event context are **replaced** by evidence values; every finding's evidence id must exist (otherwise it is rebound to the treasury source and reported); a dollar figure in a finding must appear in the evidence it cites, and a claim about the treasury must match the ledger's figures (otherwise the finding is restated from the snapshot or removed); a summary stating figures found in no evidence, or a "zero cash" claim while cash is allocatable, is replaced by a computed summary. Every correction is appended to the answer's warnings as `[NUMBER_INTEGRITY] …`.
* **Fallbacks, labelled**: `[MODEL_FALLBACK]` when the second model answered; `[OFFLINE_FALLBACK] … deterministic offline template, not a model` when neither could.
* **Persistence**: one `watch_officer_runs` row and `agent_events` rows per run.
* **Limit worth knowing**: the readiness check inside the integrity step assumes a fixed fees reserve of $25.00 and a fee of $2.25 per household (constants in `integrity.ts`), which differ from the live ledger's `feesReserved`; see [LIMITATIONS.md](LIMITATIONS.md).

### 3.4 AI Case Officer (`lib/ai/case-officer/`, `POST /api/cases/:ref/investigate`)

* **Purpose**: investigate one payment ("why is this still UNCLAIMED?") and recommend what a person should do.
* **Tools (five, read-only)**: `get_case`, `get_status_history`, `get_live_item_from_paypal` (one read-only GET of the payout item), `get_paypal_transaction_record` (PayPal Agent Toolkit `list_transactions`, arguments fixed by the server), `get_recovery_rules`. Up to 5 tool steps, then a strict-JSON final answer; if the model skips a tool the server runs it.
* **Output contract**: facts and hypotheses with evidence ids, unknowns, a recommended action from `CANCEL_ITEM | REISSUE | SEND_REMINDER | WAIT | ESCALATE_TO_PERSON`, and a resident message in en/es/vi/ht with an English gloss.
* **Guards**: every fact must cite an evidence id one of the tool calls actually returned, and every number in a fact must appear in the cited evidence, otherwise the fact is **dropped and counted** (`integrity.droppedFacts`, not shown as a finding). The recommended action is **clamped** to what the deterministic rules allow (`integrity.clampedAction`). Cancelling something already claimable, or resending when a payment is in flight, is never offered.
* **Fallback**: a deterministic investigation with `answeredBy: "deterministic"` and a `fallbackReason`.
* **Audit**: an `audit_events` row `case.investigated` (model, tool count, dropped facts, action) per run.

### 3.5 Deterministic "read-only investigator" (not currently on screen)

`lib/ai/investigator/agent.ts` defines a read-only investigator whose offline routine, `runOfflineInvestigation`, is deterministic (no model call). Its only consumer is the widget `app/console/war-room/widgets/RecipientRescueQueue.tsx` (badge "Read-only investigator"), and **no page mounts that widget**: the current Command Center does not render it. The model-driven variant described in the file header is exercised by tests (`tests/ai/investigator.test.ts`, `tests/security/red_team_adversarial.test.ts`), not by the interface. Treat it as library code; the AI features a visitor can use are the Watch Officer, the Case Officer and the Studio agent.

### 3.6 AG Studio agent (`/console/studio`, `POST /api/studio-llm`)

The Studio page uses AG Studio (`ag-studio` / `ag-studio-react` 3.1.0). Landfall implements AG Studio's own `AgLlmAdapter` interface (`lib/ai/watch-officer/studio-adapter.ts`) and passes it to AG Studio's built-in agents (`directLlmRunner`), so the *agent framework is AG Studio's* and only the model adapter is Landfall's. Per turn: money-moving requests are refused deterministically before any model is called; otherwise the turn goes to the server gateway, which screens the text (§3.2), slims Studio's ~45 000-character tool schemas, calls Groq (20b then 120b), and **returns requested tool calls without executing anything**. Studio executes its tools in the browser, against synthetic replay data; the tools edit the dashboard (add a page, filter, query data) and cannot touch money. When the model is unavailable an *offline analyst* answers from the same data with deterministic rules and says so. No personal data is sent to the model (the Studio data model is pseudonymous demo data).

### 3.7 Modules that exist but are not wired into the app

`lib/ai/communication.ts` (multilingual message drafts), `lib/ai/hazard-briefing.ts`, `lib/ai/plan-review.ts`: each is documented in its header with read-only invariants and has tests (`tests/ai/multi-agent.test.ts`), but **no application code imports them**; they are not visible product features. The `ai_runs` table and the `GROQ_MODEL_STT` setting are likewise unused. Describe them as library code, not as features.

## 4. Prompt-injection posture

| Vector | Where it could enter | Control | Evidence |
|---|---|---|---|
| Direct instruction in a question | Watch Officer query, Studio chat | Input screening (§3.2); money requests blocked by regex before any model; refused answers carry no model output | `tests/ai/safety-guard.test.ts`, `tests/ai/studio-agent-security.test.ts`, `tests/security/red_team_adversarial.test.ts` |
| Instruction hidden in data a tool returns | Resident free text, PayPal fields, alert text | Tool results are evidence, not commands; the model has no tool that can act; answers are post-checked against evidence | `tests/ai/watch-officer.test.ts`, `tests/ai/case-officer.test.ts` |
| Model invents a number | Any AI answer | Number integrity (§3.3), evidence-cited facts (§3.4) | `tests/ai/watch-officer-money.test.ts` |
| Model recommends something the rules forbid | Case Officer | Action clamped to the permitted list | `tests/ai/case-officer.test.ts` |
| Model tries to reveal personal data | Any | Watch Officer evidence is aggregate; the Studio dataset is synthetic; audit payloads are redacted; the Case Officer sees one payment's evidence (§6) | `tests/security/audit-redact.test.ts` (audit payloads only; model inputs are limited by what the tools return, §6) |
| Tool misuse (calling a write) | Any | No write tool exists in any AI tool set; allow-list of tool names; architecture boundary test | `tests/arch/boundary.test.ts` |

## 5. What is *not* claimed

* No claim that AI improves outcomes, accuracy or speed: none has been measured.
* The only AI evaluation is a **small input-screening eval**: 60 hand-written labelled prompts (30 attacks, 30 benign, including Spanish, Vietnamese and French) in [`evals/safety.jsonl`](../evals/safety.jsonl), run by `scripts/eval-safety.ts` against the live Groq models. The project's own recorded run (2026-11-11, [AI_EVAL_RESULTS.md](AI_EVAL_RESULTS.md); **not re-run for this documentation**, as it calls Groq) reported regex alone blocking 8/30 attacks, Prompt Guard alone 10/30, and the shipped three-layer pipeline 29/30 with 0/30 benign prompts wrongly blocked. The sample was written by the project author and is not an independent benchmark; the one attack that passed asked for the configured Sandbox receiver accounts. There is no evaluation of the *quality* of Watch Officer or Case Officer answers.
* The model providers are external services; their availability on the free tier is limited (rate limits are the common failure, which is why the fallbacks exist).
* "Zero cost" in code comments refers to using Groq's free tier; it is a development constraint, not a product claim.

## 6. Data sent to the model

Watch Officer: aggregates and ids (counts, formatted treasury figures, policy numbers, event names); no household names or addresses. Case Officer: the case reference, status, amounts, evidence text of that one payment (which includes the resident's reported words if they used the "can't access" report), and PayPal's status. Studio: the synthetic dataset's schema and rows the user queries. Groq's handling of that data is governed by Groq's terms, not by this repository.
