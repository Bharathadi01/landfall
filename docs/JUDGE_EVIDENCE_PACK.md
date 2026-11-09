# Judge Evidence Pack & Technical Verification Index (§22)
## PayPal AI Hackathon 2026 · Definite Source of Truth

This evidence pack connects every core claim made in Landfall's submission to its exact implementation file, automated test ID, provider response, or primary reference.

---

## 1. Technological Implementation Evidence (Target: 10/10)

| Technical Claim | Verified Implementation File | Automated Test ID | Provider / External Evidence |
|---|---|---|---|
| **Authoritative PayPal Payouts v1 Item Integration** | `lib/recovery/types.ts`<br>`lib/recovery/engine.ts` | `tests/recovery/recovery.test.ts`<br>`tests/recovery/taxonomy.test.ts` | PayPal Sandbox Batch `CYX4HC52K54WN`, Item `XVV68QXJWJ66Y` (`SUCCESS`)<br>Batch `7Y5GP4ETNLCUQ`, Item `2FN4JTY2SF8A2` (`UNCLAIMED`) |
| **Strict 9-State Item Vocabulary** | `lib/recovery/exception-taxonomy.ts` | `tests/recovery/taxonomy.test.ts:45` | Official PayPal Docs: `payouts/payment-processing` |
| **Double-Entry General Ledger** | `lib/ledger/index.ts`<br>`lib/ledger/allocatable.ts` | `tests/ledger/financial_integrity.test.ts`<br>`tests/ledger/ledger.test.ts` | Balanced debits and credits verified on all transactions |
| **Inviolable 30% Reserve Protection** | `lib/treasury/waterfall.ts`<br>`lib/ledger/allocatable.ts` | `tests/treasury/pledges.test.ts:458`<br>`tests/ai/watch-officer.test.ts:210` | 0% reserve leakage across all tranches; `allowReserveDrawdown: false` |
| **Restart-Safe Idempotency & Outbox** | `lib/treasurer/index.ts` | `tests/treasurer/treasurer.test.ts:88` | Permanent internal deduplication; stable `sender_batch_id` reuse |
| **Real Server-Verified WebAuthn Passkeys** | `components/security/PasskeyApprovalModal.tsx`<br>`lib/security/passkeys.ts` | `tests/security/passkeys.test.ts`<br>`tests/security/hostile_invariants.test.ts` | FIDO2 challenge/assertion verification; distinct dual signatures (Ops + Finance) |
| **Read-Only AI Forensics ($0 Inference)** | `lib/ai/investigator/agent.ts` | `tests/ai/investigator.test.ts`<br>`tests/ai/groq-provider.test.ts` | Groq Cloud Free (`openai/gpt-oss-20b`); 8 read-only tools; prompt injection defense |
| **AG Studio 3.1.0 Agent Framework Harness** | `lib/ai/watch-officer/studio-adapter.ts`<br>`app/console/war-room/page.tsx` | `tests/ai/studio-bridge.test.ts`<br>`tests/ai/studio-agent-security.test.ts` | Official `createAiHarness` connection to `<AgStudioCanvas>` |

---

## 2. Design & User Experience Evidence (Target: 10/10)

| Design Dimension | Implementation File / Component | Verification Standard |
|---|---|---|
| **Mission-Critical Humanitarian Palette** | `app/globals.css`<br>`tailwind.config.js` | Dark slate foundation (`slate-950`), semantic telemetry accents (emerald, amber, rose, sky, purple). |
| **11 Modular Tactical Widgets** | `app/console/war-room/widgets/` | AG Grid Community v33, AG Charts Community v14, dynamic layout switching. |
| **PayPal Money Path Explorer** | `widgets/PayPalMoneyPathExplorer.tsx` | 7-stage interactive lifecycle tracing from inflow to cryptographic proof. |
| **Settlement Integrity Bridge** | `widgets/SettlementIntegrityBridge.tsx` | Live comparison of PayPal balance vs general ledger with reserve floor breakdown. |
| **Recipient Rescue Queue** | `widgets/RecipientRescueQueue.tsx` | Operational AG Grid triage queue with inline forensic investigation drawer. |
| **5-Language Resident Portal & Appeals** | `app/r/enroll/page.tsx`<br>`app/r/complaints/page.tsx` | Multilingual support in EN, ES, HT, VI, and ZH with 24h review SLA tracker. |
| **Non-Map Accessible Equivalents** | `app/console/war-room/page.tsx` | Full data parity between MapLibre map and accessible AG Grid tabular views (WCAG 2.1 AA). |

---

## 3. Potential Impact Evidence (Target: 10/10)

| Impact Claim | Evidence Reference | Denominator / Sample Size | Provenance Standard |
|---|---|---|---|
| **Unsafe Reissue Block Rate** | `tests/impact/benchmark.test.ts:16` | **100%** (21 / 21 unsafe cases blocked) | `AUTOMATED_BENCHMARK_SIMULATED` |
| **False Block Rate** | `tests/impact/benchmark.test.ts:20` | **0%** (0 / 4 safe cases blocked) | `AUTOMATED_BENCHMARK_SIMULATED` |
| **Recovery Proof Completeness** | `tests/impact/benchmark.test.ts:24` | **100%** (24 / 24 traceable proofs generated) | `AUTOMATED_BENCHMARK_SIMULATED` |
| **Operator Effort Reduction** | `lib/impact/benchmark.ts:230` | **96%** (20 mins manual baseline → 12s Landfall) | `AUTOMATED_BENCHMARK_SIMULATED` |
| **Demographic Vulnerability Targeting** | `lib/fixtures/households.ts` | 6 priority tiers (medical devices, seniors, disabilities, surge zone, infants) | `DETERMINISTIC_POLICY_FIXTURE` |
| **Customer Validation Transparency** | `docs/VALIDATION_EVIDENCE.md` | Initial hypothesis; 12 inquiries initiated, 1 interview documented | `INITIAL HYPOTHESIS — VALIDATION IN PROGRESS` |

---

## 4. Innovation / Differentiation Evidence (Target: 10/10)

| Innovation Pillar | Implemented Difference | Prior Art & Adjacent Platforms | File Reference |
|---|---|---|---|
| **Proof-Carrying Relief Recovery** | 5-pillar SHA-256 master root hash linking obligation to provider payout item | Enterprise suites track batch reconciliation; Landfall binds 1:1 item-to-obligation proof. | `lib/recovery/engine.ts:150` |
| **Escrow-Aware Duplicate Lock** | Mathematically blocks reissuance while PayPal payout is `UNCLAIMED` (30d window) | Standard merchant dashboards allow blind retries that lead to 100% duplicate losses. | `lib/recovery/exception-taxonomy.ts:75` |
| **Read-Only AI Forensic Investigator** | 8 allow-listed read inspection tools; $0 inference cost; active injection defense | General LLM agents often attempt write mutations or lack deterministic guardrails. | `lib/ai/investigator/agent.ts:40` |
| **Dual Passkey Governance** | WebAuthn FIDO2 biometrics over canonical plan SHA-256 hash | Traditional systems rely on shared database passwords or static checkboxes. | `components/security/PasskeyApprovalModal.tsx` |
| **AG Studio AI Harness** | Dynamic browser-native data engine responding to natural-language situational queries | Standard dashboard mockups or static data tables without agent integration. | `lib/ai/watch-officer/studio-adapter.ts` |

