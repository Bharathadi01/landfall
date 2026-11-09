# AG Studio & AG Grid Integration Report

## 1. Overview & Official Sponsor Challenge Alignment

Landfall directly addresses the official AG Grid sponsor challenge of the PayPal AI Hackathon 2026 by integrating:
1. **`ag-studio-react@3.1.0` and `ag-studio@3.1.0`**: Embedded analytics canvas, browser-native in-memory data engine, cross-filtering, and the official Studio Agent Framework AI harness.
2. **`ag-grid-react` & `ag-grid-community` v33**: Enterprise-grade data visualization, custom cell renderers, responsive column sizing, and quick-filter telemetry.
3. **`ag-charts-react` & `ag-charts-community` v14**: Donut charts, solvency waterfalls, and disaster response funnels.

---

## 2. AG Studio Architecture & Studio Agent Harness

### 2.1 Embedded Canvas Mode
Located in `/console/war-room` under the **AG Studio Canvas** tab:
- Renders `<AgStudioCanvas>` powered by `ag-studio-react`.
- Supports both **View Mode** (locked tactical analysis) and **Edit Mode** (drag-and-drop report layout customization).
- Directly feeds disaster telemetry datasets (`households`, `treasury`, `exposure`, `reconciliation`).

### 2.2 Studio Agent Framework Bridge
AG Studio 3.1.0 features the `ai` property on `AgStudioProperties`, configured via:
```typescript
import { createAiHarness } from "ag-studio";
import { GroqStudioLlmAdapter } from "@/lib/ai/watch-officer/studio-adapter";

<AgStudioCanvas
  data={studioData}
  mode={studioMode}
  ai={useCallback(({ api }) => {
    return createAiHarness(api, {
      adapter: new GroqStudioLlmAdapter(),
      primary: "lead",
    });
  }, [])}
  style={{ width: "100%", height: "100%" }}
/>
```

The adapter implements `AgLlmAdapter` and connects to the Groq Cloud Free Plan (`openai/gpt-oss-20b`) with a 100% deterministic local fallback that supports operational situational commands:
- `"show medical device households"` -> Filters grid to Priority Tier 1.
- `"filter to Zone A"` -> Isolates storm surge flood evacuation sectors.
- `"simulate constrained reserve"` -> Dynamically models restricted liquidity.
- `"sort by priority tier"` -> Orders households deterministically by vulnerability.

---

## 3. The 11 Modular Tactical Widgets

Under the **Widgets & Roles (11)** command surface, coordinators and auditors can inspect 11 focused operational widgets:

1. **`HazardIntelligenceWidget`**: Live NOAA/NWS storm feed, Category 4 tracking, barometric pressure, surge heights.
2. **`ExposureDistributionWidget`**: Geographic breakdown of vulnerable households across evacuation sectors.
3. **`TreasuryWaterfallWidget`**: Visual AG Charts donut breakdown of available cash, reserve floors, and fees.
4. **`ResponseFunnelWidget`**: Funnel tracking from hazard warning to passkey sign-off and disbursement.
5. **`PayoutHealthWidget`**: Real-time ratio of confirmed vs pending vs unclaimed payouts.
6. **`ReadinessMonitorWidget`**: Real-time solvency checklist before triggering relief payments.
7. **`ScenarioComparisonWidget`**: Deterministic stress simulator across 3 liquidity conditions.
8. **`ImpactTimelineWidget`**: Chronological milestone audit from storm watch to household confirmation.
9. **`PayPalMoneyPathExplorer`**: 7-stage interactive lifecycle tracing:
   `Inflow -> Ledger -> Obligation -> Sign-off -> Payout -> AI Forensics -> Recovery Proof`.
10. **`SettlementIntegrityBridge`**: Live comparison of PayPal balance vs double-entry general ledger with 30% reserve protection.
11. **`RecipientRescueQueue`**: Operational AG Grid triage queue for inspecting `UNCLAIMED`, `FAILED`, and `RETURNED` items, with integrated AI Money Investigator root-cause diagnostics.

---

## 4. Architectural Boundaries Enforced

1. **AG Grid and AG Studio are strictly read-only and analytical.** They never possess authority to move funds or sign payout hashes.
2. **Dual-Custody Passkey requirement:** Plan execution remains guarded by WebAuthn FIDO2 biometrics independent of UI grid state.
3. **Zero AI Money Movement:** All AI assistants are read-only copilots bounded by deterministic TypeScript validators.

