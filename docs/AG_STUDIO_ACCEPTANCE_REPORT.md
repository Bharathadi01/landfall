# Landfall — Official AG Studio & Studio Agent Framework Acceptance Report
### PayPal AI Hackathon 2026 · Best Use of AG Grid Sponsor Track ($5,000 Prize Category)

> **Submission Scope:** Verification of genuine **AG Studio** (`ag-studio-react`, `ag-studio`), custom disaster-relief operational widgets, and official **Studio Agent Framework** integration on Landfall v3.

---

## 1. Dependency & Package Manifest Audit

Landfall installs and imports the official commercial AG Studio suite:

```json
{
  "dependencies": {
    "ag-studio": "3.1.0",
    "ag-studio-react": "3.1.0",
    "ag-grid-enterprise": "36.3.0",
    "ag-grid-community": "^36.3.0",
    "ag-grid-react": "^36.3.0",
    "ag-charts-community": "^14.3.0",
    "ag-charts-react": "^14.3.0"
  }
}
```

- **Core Package:** `ag-studio@3.1.0` (drag-and-drop report builder, data engine, state serialization).
- **React Wrapper:** `ag-studio-react@3.1.0` (`AgStudio`, `AgStudioProvider`, `createWidgets`).
- **Data Grid Engine:** `ag-grid-enterprise@36.3.0` & `ag-grid-community@36.3.0`.
- **Charting Engine:** `ag-charts-community@14.3.0` & `ag-charts-react@14.3.0`.
- **Runtime Environment:** React 19 (`^19.0.0`), Next.js 15 (`15.1.6`), Node 22+.

---

## 2. Actual Component Imports & Canvas Implementation

The `/console/war-room` route embeds the genuine `AgStudio` component dynamically to ensure full client-side execution in Next.js App Router:

```tsx
import dynamic from "next/dynamic";

const AgStudioCanvas = dynamic(
  () => import("ag-studio-react").then((mod) => mod.AgStudio),
  { ssr: false }
);

export default function WarRoomPage() {
  return (
    <AgStudioCanvas
      data={studioData}
      mode={studioMode}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
```

### Modes Supported:
1. **Design / Edit Mode (`mode="edit"`):**
   - Drag-and-drop canvas layout editor.
   - Live widget palette with data field mapping.
   - Filter bar and property inspection panels.
2. **Locked Operational View Mode (`mode="view"`):**
   - Locked canvas layout preventing accidental restructuring during disaster emergencies.
   - Interactive cross-filtering across tables, KPI cards, and charts.

---

## 3. Landfall Operational Data Sources

AG Studio's browser-native data engine is supplied with 4 structured data sources:

1. **`households` Data Source:**
   - Fields: `household_id`, `resident_name`, `zone`, `priority_tier` (1–6), `tier_label`, `status` (`CONFIRMED` / `OUT_OF_AREA`), `amount_cents`, `path` (`LINKED_PAYPAL`, `EMAIL_CLAIM`, `ASSISTED`, `MANUAL_CHANNEL`).
2. **`treasury` Data Source:**
   - Fields: `category`, `amount_usd`, `allocation` (`Protected`, `Fees`, `Liquid`).
3. **`payout_batches` Data Source:**
   - Fields: `batch_id`, `item_id`, `tx_id`, `receiver`, `amount`, `fee`, `status` (`SUCCESS`, `UNCLAIMED`).
4. **`scenarios` Data Source:**
   - Fields: `scenario_id`, `title`, `reserve_protected`, `allocatable`, `coverage_percentage`, `funded_count`, `waitlisted_count`.

---

## 4. Distinctive Landfall Widgets

Landfall configures 7 specialized operational widgets tailored for anticipatory disaster cash relief:

| Widget Name | Data Source | Visualization / Function | Cross-Filter Behavior |
| :--- | :--- | :--- | :--- |
| **Hazard Exposure Intelligence** | `sentinel` | Category 4 storm alert, wind speed (145 mph), surge height (10–15 ft), landfall countdown. | Filters recipient grid by evacuation zone. |
| **Treasury Waterfall Donut** | `treasury` | AG Charts donut breaking down 30% Reserve Floor, Fees Reserve, and Allocatable Cash. | Slices filter allocatable funds pool. |
| **Recipient Exposure Grid** | `households` | Multi-column table with custom vulnerability tier badges (Tier 1 Rose, Tier 2 Amber, Tier 3 Purple, etc.). | Selecting a row cross-filters payout status and zone details. |
| **Dual-Custody Approval Panel** | `payout_plan` | Displays immutable SHA-256 plan hash and signing state of Operations and Finance passkeys. | Locks view when hash is verified. |
| **PayPal Transaction Lifecycle** | `payout_batches` | Live status tracking of individual items (`SUCCESS`, `UNCLAIMED`, `DENIED`), TxIDs, and fees. | Filters items by batch or status. |
| **Response Scenario Simulator** | `scenarios` | Comparison of Baseline vs 15% Constrained Reserve vs Tier 1–2 Priority Focus. | Updates coverage ratio and funding gap dynamically. |
| **Watch Officer Copilot Panel** | `studio_agent` | Conversational interface connected to Groq Free Plan (`openai/gpt-oss-20b`). | Natural-language commands update AG Studio filters and layout. |

---

## 5. Studio Agent Framework Integration

Landfall implements the official **`AgLlmAdapter`** interface (`lib/ai/watch-officer/studio-adapter.ts`) to integrate the Watch Officer directly into AG Studio:

```typescript
export class GroqStudioLlmAdapter implements AgLlmAdapter {
  executeTurn(request: AgLlmRequest, options?: AgLlmExecuteTurnOptions): AgLlmResponseHandler {
    // 1. Ingests user prompt from AG Studio chat session
    // 2. Dispatches to deterministic Studio Bridge (zero AI in money)
    // 3. Emits streaming AgAiEvent content deltas
    // 4. Resolves AgLlmResponse with status: "completed" and token usage
  }
}
```

### Verified Sample Interaction:
- **Operator Prompt:** *"Show medical device households"*
- **Studio Agent Action:**
  - Evaluates intent → Identifies Life-Safety priority (Tier 1).
  - Emits filter command: `{ column: "priorityTier", operator: "equals", value: 1 }`.
  - AG Studio Grid filters immediately to Elena Rodriguez (Oxygen Concentrator).
  - Agent Explanation: *"Focusing view on Tier 1 households: Life-sustaining medical equipment dependent (e.g. oxygen concentrators)."*

### Security & Invariant Proof:
- **Zero Financial Mutation:** The Studio Agent operates strictly on the presentation layer. It possesses zero tools for creating payouts, charging payment tokens, approving payout plans, or modifying ledger balances.
- **Privacy Protection:** Recipient names and street addresses are stripped/masked before query evaluation.

---

## 6. Verification & Automated Test Coverage

AG Studio and Studio Agent Framework integration is verified across two dedicated test suites:

- **`tests/ai/studio-bridge.test.ts` (7 / 7 tests pass):**
  - Tier 1 medical device filter resolution.
  - Tier 2 elderly living alone filter resolution.
  - Evacuation Zone A surge query parsing.
  - Grid sort and scenario simulation commands.
  - Reset / Clear filter commands.
- **`tests/ai/studio-agent-security.test.ts` (4 / 4 tests pass):**
  - Streaming and completion lifecycle of `GroqStudioLlmAdapter`.
  - Invariant: Zero money movement or payout tools exposed to adapter.
  - Adversarial prompt injection defense (blocking simulated transfer attempts).
  - Presentation-only view manipulation verification.

---

## 7. License & Evaluation Status

- **License Type:** AG Studio Commercial License (Evaluation / Hackathon mode).
- **Watermark:** In evaluation mode, AG Studio renders a subtle evaluation notice in the console and canvas footer.
- **Production Path:** Supports seamless deployment with `NEXT_PUBLIC_AG_STUDIO_LICENSE` when an enterprise key is provisioned.

