"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import { AgStudio, createWidgets } from "ag-studio-react";
import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  AgStudioModuleRegistry,
  createAiHarness,
  directLlmRunner,
  singleColumnLayout,
  studioTheme,
  type AgReportState,
} from "ag-studio";
import { LicenseManager } from "ag-grid-enterprise";

// Register the Studio AI Agent Module
AgStudioModuleRegistry.registerModules([AgStudioAiModule]);

import { GroqStudioLlmAdapter } from "@/lib/ai/watch-officer/studio-adapter";
import { landfallStudioParams } from "@/styles/ag-studio-theme";
import {
  studioSources,
  studioRelationships,
  studioCalendars,
  STUDIO_PROMPT_STARTERS,
} from "@/lib/studio/landfall-studio-data";

// Custom Widgets
import { SolvencyWidget, SOLVENCY_WIDGET_TYPE } from "./SolvencyWidget";
import {
  ReserveGuardrailWidget,
  RESERVE_GUARDRAIL_WIDGET_TYPE,
} from "./widgets/ReserveGuardrailWidget";
import {
  PayoutLifecycleWidget,
  PAYOUT_LIFECYCLE_WIDGET_TYPE,
} from "./widgets/PayoutLifecycleWidget";
import {
  RecoveryEvidenceChainWidget,
  EVIDENCE_CHAIN_WIDGET_TYPE,
} from "./widgets/RecoveryEvidenceChainWidget";

const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (licenseKey) {
  try {
    AgStudioLicenseManager.setLicenseKey(licenseKey);
    LicenseManager.setLicenseKey(licenseKey);
  } catch {
    /* continue with evaluation watermark */
  }
}

if (typeof window !== "undefined") {
  const _origError = window.console.error;
  window.console.error = function (...args: any[]) {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("AG Grid") ||
      msg.includes("License Key") ||
      msg.includes("ag-grid.com/licensing") ||
      msg.includes("license key") ||
      msg.startsWith("********************************")
    ) {
      window.console.warn(...args);
      return;
    }
    _origError.apply(window.console, args);
  };
}

/** Official Landfall theme configured via AG Studio's modern Theming API. */
const LANDFALL_STUDIO_THEME = (studioTheme as any).withParams(landfallStudioParams);

/** SVG Icon Helpers for Custom Widgets */
const makeSvgIcon = (svgPath: string, color: string = "%232DD4BF") => ({
  url: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${svgPath}</svg>`
  ).replace(/%25/g, "%")}`,
});

/** Custom widgets registered alongside AG built-ins under the "Landfall Relief Intelligence" group. */
const widgetsConfig = (defaults: any) =>
  (createWidgets as any)({
    additionalTypes: [
      {
        id: RESERVE_GUARDRAIL_WIDGET_TYPE,
        label: "Reserve Guardrail",
        icon: makeSvgIcon("<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='m9 12 2 2 4-4'/>", "%23FBBF54"),
        dataMapping: {
          reserve: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
          total: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: false },
        },
        form: (params: any) =>
          params.createDefaults({
            dataMappingItems: [
              { key: "reserve", label: "Protected Reserve" },
              { key: "total", label: "Total Balance" },
            ],
          }),
        comp: ReserveGuardrailWidget,
        defaultSize: { width: 500, height: 180 },
        minSize: { width: 320, height: 140 },
        ai: {
          label: "Reserve Guardrail",
          description:
            "Explains statutory 30% reserve policy floor, protected reserve amount, total funds, headroom, and compliance status from the policy engine.",
          usage: "Use in treasury and overview pages to show reserve health and ensure policy compliance.",
        },
      },
      {
        id: PAYOUT_LIFECYCLE_WIDGET_TYPE,
        label: "Payout Lifecycle",
        icon: makeSvgIcon("<circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/>", "%2354A0FF"),
        dataMapping: {
          item: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: false },
          status: { type: "field", supportedRoles: ["category"], requires: { cardinality: "one" }, required: false },
        },
        form: (params: any) =>
          params.createDefaults({
            dataMappingItems: [
              { key: "item", label: "Payout Item" },
              { key: "status", label: "Status" },
            ],
          }),
        comp: PayoutLifecycleWidget,
        defaultSize: { width: 440, height: 260 },
        minSize: { width: 320, height: 200 },
        ai: {
          label: "Payout Lifecycle",
          description:
            "Shows recorded chronological timeline of PayPal batch submission, provider transaction status, webhook verification, ledger reconciliation, and beneficiary delivery confirmation for a selected payout item.",
          usage: "Use to investigate payout exceptions and understand exact provider history.",
        },
      },
      {
        id: EVIDENCE_CHAIN_WIDGET_TYPE,
        label: "Recovery Evidence Chain",
        icon: makeSvgIcon("<path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/>", "%23A78BFA"),
        form: (params: any) => params.createDefaults({}),
        comp: RecoveryEvidenceChainWidget,
        defaultSize: { width: 620, height: 220 },
        minSize: { width: 360, height: 180 },
        ai: {
          label: "Recovery Evidence Chain",
          description:
            "Displays end-to-end cryptographic traceability chain: Approved Obligation -> Dual-Passkey Approval -> PayPal Payout Batch -> Payout Item -> Webhook -> Ledger Reconciliation -> Recovery Proof.",
          usage: "Use for audit, financial assurance, and settlement verification.",
        },
      },
      {
        id: SOLVENCY_WIDGET_TYPE,
        label: "Relief Solvency",
        icon: makeSvgIcon("<circle cx='12' cy='12' r='8' stroke-opacity='.3'/><path d='M12 4a8 8 0 0 1 8 8'/>"),
        dataMapping: {
          value: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
          target: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
        },
        form: (params: any) =>
          params.createDefaults({
            dataMappingItems: [
              { key: "value", label: "Available" },
              { key: "target", label: "Needed" },
            ],
          }),
        comp: SolvencyWidget,
        defaultSize: { width: 420, height: 170 },
        minSize: { width: 300, height: 140 },
        ai: {
          label: "Relief Solvency",
          description:
            "Landfall Relief Solvency gauge. Compares cash available to pay (value) with relief owed to households in the warning area (target) and states whether everyone can be paid.",
        },
      },
    ],
    menu: [
      ...(defaults?.menu ?? []),
      {
        label: "Landfall Relief Intelligence",
        widgetIds: [
          RESERVE_GUARDRAIL_WIDGET_TYPE,
          PAYOUT_LIFECYCLE_WIDGET_TYPE,
          EVIDENCE_CHAIN_WIDGET_TYPE,
          SOLVENCY_WIDGET_TYPE,
        ],
      },
    ],
  });

/** Four Canonical Report Pages (§4) */
export const CANONICAL_REPORT_STATE: AgReportState = {
  version: "3.1.0",
  selectedPageId: "overview",
  pages: [
    /* ── PAGE A: RELIEF OVERVIEW ─────────────────────────── */
    {
      id: "overview",
      widgets: {
        "kpi-funding": {
          type: "value",
          format: { title: { text: "Recognised Funding", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "funding_events.amount_usd", aggregation: "sum" }] },
        },
        "kpi-available": {
          type: "value",
          format: { title: { text: "Available to Allocate", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.allocatable_usd", aggregation: "sum" }] },
        },
        "kpi-reserve": {
          type: "value",
          format: { title: { text: "Protected Reserve", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.reserve_usd", aggregation: "sum" }] },
        },
        "kpi-unresolved": {
          type: "value",
          format: { title: { text: "Unresolved Payout Value", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }] },
        },
        "w-solvency": {
          type: SOLVENCY_WIDGET_TYPE,
          format: { title: { text: "Unresolved Exposure Coverage", enabled: true, wrapping: true } },
          dataMapping: {
            value: [{ id: "solvency.allocatable_usd", aggregation: "sum" }],
            target: [{ id: "solvency.required_usd", aggregation: "sum" }],
          },
        },
        "c-payout-dist": {
          type: "donut-chart",
          format: {
            title: { text: "Payout Item Outcomes (PayPal Status)", enabled: true, wrapping: true },
            triggerCrossFilter: true,
          },
          dataMapping: {
            categoryKey: [{ id: "payout_items.transaction_status" }],
            valueKey: [{ id: "payout_items.items_count", aggregation: "sum" }],
          },
        },
        "c-exception-aging": {
          type: "bar-chart-grouped",
          format: { title: { text: "Unresolved Value by Aging Bracket (USD)", enabled: true, wrapping: true } },
          dataMapping: {
            categoryKey: [{ id: "payout_items.age_band" }],
            valueKey: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }],
          },
        },
        "g-priority-exceptions": {
          type: "grid",
          format: {
            title: { text: "Priority Exceptions Worklist (Authoritative PayPal Status)", enabled: true, wrapping: true },
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "payout_items.item_id" },
              { id: "payout_items.resident_name" },
              { id: "payout_items.transaction_status" },
              { id: "payout_items.amount_usd" },
              { id: "payout_items.age_hours" },
              { id: "payout_items.safe_action" },
            ],
          },
        },
      },
      widgetLayout: {
        "kpi-funding": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-available": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-reserve": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-unresolved": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 6 },
        "w-solvency": { xTrack: 0, yTrack: 6, xSpan: 8, ySpan: 12 },
        "c-payout-dist": { xTrack: 8, yTrack: 6, xSpan: 8, ySpan: 12 },
        "c-exception-aging": { xTrack: 16, yTrack: 6, xSpan: 8, ySpan: 12 },
        "g-priority-exceptions": { xTrack: 0, yTrack: 18, xSpan: 24, ySpan: 15 },
      },
    },

    /* ── PAGE B: TREASURY & RECONCILIATION ───────────────── */
    {
      id: "treasury",
      widgets: {
        "kpi-total-treasury": {
          type: "value",
          format: { title: { text: "Recognised Treasury Balance", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.total_balance_usd", aggregation: "sum" }] },
        },
        "kpi-reserve-floor": {
          type: "value",
          format: { title: { text: "Statutory Reserve Floor (30%)", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.required_reserve_usd", aggregation: "sum" }] },
        },
        "kpi-headroom": {
          type: "value",
          format: { title: { text: "Reserve Headroom (+USD)", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.headroom_usd", aggregation: "sum" }] },
        },
        "kpi-net-allocatable": {
          type: "value",
          format: { title: { text: "Net Allocatable Cash", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "solvency.allocatable_usd", aggregation: "sum" }] },
        },
        "w-guardrail": {
          type: RESERVE_GUARDRAIL_WIDGET_TYPE,
          format: { title: { text: "Reserve Guardrail (Deterministic 30% Statutory Policy Floor)", enabled: true, wrapping: true } },
          dataMapping: {
            reserve: [{ id: "solvency.reserve_usd", aggregation: "sum" }],
            total: [{ id: "solvency.total_balance_usd", aggregation: "sum" }],
          },
        },
        "c-treasury-tranches": {
          type: "bar-chart-grouped",
          format: { title: { text: "Treasury Tranche Allocation (USD)", enabled: true, wrapping: true } },
          dataMapping: {
            categoryKey: [{ id: "treasury.bucket" }],
            valueKey: [{ id: "treasury.amount_usd", aggregation: "sum" }],
          },
        },
        "c-funding-sources": {
          type: "donut-chart",
          format: { title: { text: "Funding Stream Composition (USD)", enabled: true, wrapping: true } },
          dataMapping: {
            categoryKey: [{ id: "funding_events.source_type" }],
            valueKey: [{ id: "funding_events.amount_usd", aggregation: "sum" }],
          },
        },
        "g-ledger": {
          type: "grid",
          format: {
            title: { text: "Double-Entry Ledger Reconciliation (Minor Unit Precision)", enabled: true, wrapping: true },
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "ledger_reconciliation.account_id" },
              { id: "ledger_reconciliation.account_name" },
              { id: "ledger_reconciliation.debit_usd" },
              { id: "ledger_reconciliation.credit_usd" },
              { id: "ledger_reconciliation.balance_usd" },
              { id: "ledger_reconciliation.variance_cents" },
              { id: "ledger_reconciliation.match_status" },
            ],
          },
        },
        "g-batches": {
          type: "grid",
          format: {
            title: { text: "PayPal Payout Batches Audit Trail", enabled: true, wrapping: true },
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "payout_batches.batch_id" },
              { id: "payout_batches.paypal_batch_id" },
              { id: "payout_batches.submitted_date" },
              { id: "payout_batches.batch_status" },
              { id: "payout_batches.items_total" },
              { id: "payout_batches.total_amount_usd" },
              { id: "payout_batches.reconciliation_gap_usd" },
            ],
          },
        },
      },
      widgetLayout: {
        "kpi-total-treasury": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-reserve-floor": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-headroom": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-net-allocatable": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 6 },
        "w-guardrail": { xTrack: 0, yTrack: 6, xSpan: 24, ySpan: 8 },
        "c-treasury-tranches": { xTrack: 0, yTrack: 14, xSpan: 12, ySpan: 12 },
        "c-funding-sources": { xTrack: 12, yTrack: 14, xSpan: 12, ySpan: 12 },
        "g-ledger": { xTrack: 0, yTrack: 26, xSpan: 24, ySpan: 14 },
        "g-batches": { xTrack: 0, yTrack: 40, xSpan: 24, ySpan: 14 },
      },
    },

    /* ── PAGE C: PAYOUT RECOVERY INTELLIGENCE ────────────── */
    {
      id: "recovery",
      widgets: {
        "kpi-unclaimed-total": {
          type: "value",
          format: {
            title: { text: "Unresolved Exceptions (All Categories)", enabled: true, wrapping: true },
            crossFilter: "filter",
          },
          dataMapping: { value: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }] },
        },
        "kpi-aging-max": {
          type: "value",
          format: { title: { text: "Oldest Payout Exception (Hours)", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "payout_items.age_hours", aggregation: "max" }] },
        },
        "kpi-batch-sum": {
          type: "value",
          format: { title: { text: "Submitted Batch Total", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "payout_batches.total_amount_usd", aggregation: "sum" }] },
        },
        "kpi-ledger-variance": {
          type: "value",
          format: { title: { text: "Ledger Discrepancy (Cents)", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "ledger_reconciliation.variance_cents", aggregation: "sum" }] },
        },
        "c-recovery-status": {
          type: "donut-chart",
          format: {
            title: { text: "PayPal Status (Click UNCLAIMED to Cross-Filter)", enabled: true, wrapping: true },
            triggerCrossFilter: true,
          },
          dataMapping: {
            categoryKey: [{ id: "payout_items.transaction_status" }],
            valueKey: [{ id: "payout_items.items_count", aggregation: "sum" }],
          },
        },
        "c-aging-dist": {
          type: "bar-chart-grouped",
          format: {
            title: { text: "Unresolved Value by Aging Band (USD)", enabled: true, wrapping: true },
            crossFilter: "filter",
          },
          dataMapping: {
            categoryKey: [{ id: "payout_items.age_band" }],
            valueKey: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }],
          },
        },
        "w-lifecycle": {
          type: PAYOUT_LIFECYCLE_WIDGET_TYPE,
          format: { title: { text: "Payout Lifecycle Chronology (Item milton_002)", enabled: true, wrapping: true } },
          dataMapping: {
            item: [{ id: "payout_items.item_id", aggregation: "first" }],
            status: [{ id: "payout_items.transaction_status", aggregation: "first" }],
          },
        },
        "w-evidence-chain": {
          type: EVIDENCE_CHAIN_WIDGET_TYPE,
          format: { title: { text: "Recovery Evidence Chain (Cryptographic Traceability)", enabled: true, wrapping: true } },
        },
        "g-payout-workbench": {
          type: "grid",
          format: {
            title: { text: "Payout Exception Workbench", enabled: true, wrapping: true },
            crossFilter: "filter",
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "payout_items.item_id" },
              { id: "payout_items.resident_name" },
              { id: "payout_items.zone" },
              { id: "payout_items.transaction_status" },
              { id: "payout_items.amount_usd" },
              { id: "payout_items.age_hours" },
              { id: "payout_items.reconciliation_status" },
              { id: "payout_items.beneficiary_confirmed" },
              { id: "payout_items.safe_action" },
            ],
          },
        },
      },
      widgetLayout: {
        "kpi-unclaimed-total": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-aging-max": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-batch-sum": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-ledger-variance": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 6 },
        "c-recovery-status": { xTrack: 0, yTrack: 6, xSpan: 8, ySpan: 12 },
        "c-aging-dist": { xTrack: 8, yTrack: 6, xSpan: 8, ySpan: 12 },
        "w-lifecycle": { xTrack: 16, yTrack: 6, xSpan: 8, ySpan: 12 },
        "w-evidence-chain": { xTrack: 0, yTrack: 18, xSpan: 24, ySpan: 9 },
        "g-payout-workbench": { xTrack: 0, yTrack: 27, xSpan: 24, ySpan: 15 },
      },
    },

    /* ── PAGE D: BENEFICIARY ACCOUNTABILITY ──────────────── */
    {
      id: "accountability",
      widgets: {
        "kpi-reg-obligations": {
          type: "value",
          format: { title: { text: "Approved Relief Obligations", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "relief_obligations.grant_usd", aggregation: "sum" }] },
        },
        "kpi-provider-credited": {
          type: "value",
          format: { title: { text: "Gross Payout Instructions Dispatched", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "payout_items.amount_usd", aggregation: "sum" }] },
        },
        "kpi-grievances-cases": {
          type: "value",
          format: { title: { text: "Total Grievance Inquiries", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "grievance_summary.case_count", aggregation: "sum" }] },
        },
        "kpi-resolved-grievances": {
          type: "value",
          format: { title: { text: "Resolved Inquiries", enabled: true, wrapping: true } },
          dataMapping: { value: [{ id: "grievance_summary.resolved_count", aggregation: "sum" }] },
        },
        "c-tier-grants": {
          type: "bar-chart-grouped",
          format: { title: { text: "Assistance by Vulnerability Tier (USD)", enabled: true, wrapping: true } },
          dataMapping: {
            categoryKey: [{ id: "relief_obligations.priority_tier" }],
            valueKey: [{ id: "relief_obligations.grant_usd", aggregation: "sum" }],
          },
        },
        "c-zone-grants": {
          type: "donut-chart",
          format: { title: { text: "Disbursements by Evacuation Zone (USD)", enabled: true, wrapping: true } },
          dataMapping: {
            categoryKey: [{ id: "relief_obligations.zone" }],
            valueKey: [{ id: "relief_obligations.grant_usd", aggregation: "sum" }],
          },
        },
        "g-grievances": {
          type: "grid",
          format: {
            title: { text: "Grievances & Community Feedback Log", enabled: true, wrapping: true },
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "grievance_summary.category" },
              { id: "grievance_summary.case_count" },
              { id: "grievance_summary.resolved_count" },
              { id: "grievance_summary.pending_count" },
              { id: "grievance_summary.avg_resolution_hours" },
              { id: "grievance_summary.status" },
            ],
          },
        },
        "g-residents": {
          type: "grid",
          format: {
            title: { text: "Privacy-Preserving Resident Obligation Roster", enabled: true, wrapping: true },
            style: { columnAutoSize: true, headerRow: { wrapText: true } },
          },
          dataMapping: {
            cols: [
              { id: "households.household_id" },
              { id: "households.zone" },
              { id: "households.priority_tier" },
              { id: "households.exposure" },
              { id: "households.payout_channel" },
              { id: "households.grant_usd" },
            ],
          },
        },
      },
      widgetLayout: {
        "kpi-reg-obligations": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-provider-credited": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-grievances-cases": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 6 },
        "kpi-resolved-grievances": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 6 },
        "c-tier-grants": { xTrack: 0, yTrack: 6, xSpan: 12, ySpan: 12 },
        "c-zone-grants": { xTrack: 12, yTrack: 6, xSpan: 12, ySpan: 12 },
        "g-grievances": { xTrack: 0, yTrack: 18, xSpan: 24, ySpan: 12 },
        "g-residents": { xTrack: 0, yTrack: 30, xSpan: 24, ySpan: 15 },
      },
    },
  ],
} as any;

const STORAGE_KEY = "landfall_ag_studio_state_v4";

export default function StudioCanvas({ mode }: { mode: "view" | "edit" }) {
  const [reportState, setReportState] = useState<AgReportState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.pages) && parsed.pages.length >= 4) {
            return parsed;
          }
        }
      } catch {
        /* fallback */
      }
    }
    return CANONICAL_REPORT_STATE;
  });

  const [activePageId, setActivePageId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.selectedPageId === "string") {
            return parsed.selectedPageId;
          }
        }
      } catch {
        /* fallback */
      }
    }
    return "overview";
  });
  const [activeCrossFilter, setActiveCrossFilter] = useState<{ key: string; value: string } | null>(null);
  const [canvasRevision, setCanvasRevision] = useState<number>(0);

  useEffect(() => {
    const handleStateUpdate = (e: any) => {
      if (e.detail) {
        setReportState(e.detail);
        if (e.detail.selectedPageId) {
          setActivePageId(e.detail.selectedPageId);
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("ag-studio-state-update", handleStateUpdate);
      return () => window.removeEventListener("ag-studio-state-update", handleStateUpdate);
    }
  }, []);

  const clearCrossFilter = () => {
    setActiveCrossFilter(null);
    setReportState((prev: any) => ({
      ...prev,
      pages: prev.pages?.map((p: any) =>
        p.id === activePageId ? { ...p, crossFilter: { values: {} } } : p
      ),
    }));
    setCanvasRevision((r) => r + 1);
  };

  const applyCrossFilter = (status: string) => {
    setActiveCrossFilter({ key: "c-recovery-status", value: status });
    setReportState((prev: any) => ({
      ...prev,
      pages: prev.pages?.map((p: any) =>
        p.id === "recovery"
          ? {
              ...p,
              crossFilter: {
                values: {
                  "c-recovery-status": [
                    {
                      type: "value",
                      group: 0,
                      field: { id: "payout_items.transaction_status" },
                      values: [status],
                    },
                  ],
                },
              },
            }
          : p
      ),
    }));
    setCanvasRevision((r) => r + 1);
  };

  const data = useMemo(
    () => ({
      sources: studioSources,
      relationships: studioRelationships,
      calendars: studioCalendars,
    }),
    []
  );

  // Studio Agent Framework: Coordinates Built-In Agents with Relief Finance Analyst
  const ai = useCallback(
    ({ api }: { api: any }) =>
      createAiHarness(api, (ctx) => {
        const adapter = new GroqStudioLlmAdapter({ api });

        const analyst = directLlmRunner({
          id: "relief-finance-analyst",
          name: "Relief Finance Analyst",
          description:
            "Specialist relief-finance intelligence agent. Audits PayPal payout statuses, double-entry reconciliation, statutory reserve floors, exception aging, and recovery evidence.",
          instructions: () =>
            "You are Landfall's Relief Finance Analyst. You assist relief operators and auditors in analyzing disaster payout outcomes, identifying exceptions (Unclaimed, On-Hold, Failed), verifying ledger reconciliation, and auditing reserve compliance. " +
            "SAFETY INVARIANT: You are strictly read-only for reporting and dashboard configuration. You CANNOT execute payouts, re-issue money, or alter ledger records.",
          adapter,
        });

        const lead = directLlmRunner({ ...ctx.builtIn.lead, adapter });
        const dataAgent = directLlmRunner({ ...ctx.builtIn.data, adapter });
        const page = directLlmRunner({ ...ctx.builtIn.page, adapter });
        const widget = directLlmRunner({ ...ctx.builtIn.widget, adapter });
        const planning = directLlmRunner({ ...ctx.builtIn.planning, adapter });

        return {
          agents: [analyst, lead, dataAgent, page, widget, planning],
          primary: "relief-finance-analyst",
          promptStarters: STUDIO_PROMPT_STARTERS,
        };
      }),
    []
  );

  const onStateUpdated = useCallback((evt: any) => {
    if (evt?.state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(evt.state));
        setReportState(evt.state);
        if (evt.state.selectedPageId) {
          setActivePageId(evt.state.selectedPageId);
        }
        const activePage = evt.state.pages?.find((p: any) => p.id === (evt.state.selectedPageId || activePageId));
        if (activePage?.crossFilter?.values && Object.keys(activePage.crossFilter.values).length > 0) {
          const firstKey = Object.keys(activePage.crossFilter.values)[0];
          const valObj = activePage.crossFilter.values[firstKey]?.[0];
          if (valObj) {
            setActiveCrossFilter({
              key: firstKey,
              value: String(valObj.values?.[0] || valObj.field?.id || "Active Filter"),
            });
          }
        } else {
          setActiveCrossFilter(null);
        }
      } catch {
        /* ignore storage quota */
      }
    }
  }, [activePageId]);

  const resetToTemplate = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setActiveCrossFilter(null);
      setReportState({ ...CANONICAL_REPORT_STATE, selectedPageId: activePageId });
    } catch {
      /* ignore */
    }
  };

  const switchPage = (pageId: string) => {
    setActivePageId(pageId);
    setReportState((prev: any) => {
      const updated = {
        ...prev,
        selectedPageId: pageId,
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
      }
      return updated;
    });
  };

  const currentReportState = useMemo(() => {
    if (!reportState?.pages?.length) return reportState;
    const targetPage = reportState.pages.find((p) => p.id === activePageId) || reportState.pages[0];
    const otherPages = reportState.pages.filter((p) => p.id !== targetPage.id);
    return {
      ...reportState,
      selectedPageId: targetPage.id,
      pages: [targetPage, ...otherPages],
    };
  }, [reportState, activePageId]);

  const PAGE_NAV = useMemo(() => {
    const defaultPages = [
      { id: "overview", label: "Relief Overview", icon: "📊" },
      { id: "treasury", label: "Treasury & Reserve", icon: "🛡️" },
      { id: "recovery", label: "Payout Recovery", icon: "⚡" },
      { id: "accountability", label: "Beneficiary Accountability", icon: "🤝" },
    ];
    const customPages = (reportState?.pages || [])
      .filter((p: any) => !defaultPages.some((dp) => dp.id === p.id))
      .map((p: any) => ({
        id: p.id,
        label: p.title || p.id,
        icon: "✨",
      }));
    return [...defaultPages, ...customPages];
  }, [reportState?.pages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Top Studio Control Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 14px",
          background: "rgba(12, 17, 27, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: 12.5,
          color: "#EEF2F8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5EEAD4", letterSpacing: "-0.01em" }}>
            Relief Finance Intelligence
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-geist-mono)",
              background: "rgba(84, 160, 255, 0.15)",
              color: "#54A0FF",
              border: "1px solid rgba(84, 160, 255, 0.3)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            SANDBOX REPLAY
          </span>
        </div>

        {/* 4 Report Page Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Report Pages"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 8,
            padding: 3,
          }}
        >
          {PAGE_NAV.map((p) => {
            const isActive = (reportState?.selectedPageId || activePageId) === p.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchPage(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#EEF2F8" : "#A3AEC2",
                  background: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activePageId === "recovery" && !activeCrossFilter && (
            <button
              data-testid="filter-unclaimed-btn"
              onClick={() => applyCrossFilter("UNCLAIMED")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(251, 191, 84, 0.12)",
                border: "1px solid rgba(251, 191, 84, 0.35)",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                color: "#FBBF54",
                cursor: "pointer",
                fontWeight: 600,
              }}
              title="Click to cross-filter report to UNCLAIMED payouts"
            >
              <span>⚡ Filter: UNCLAIMED</span>
            </button>
          )}

          {activeCrossFilter && (
            <div
              data-testid="active-crossfilter-chip"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(84, 160, 255, 0.15)",
                border: "1px solid rgba(84, 160, 255, 0.35)",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 11,
                color: "#54A0FF",
              }}
            >
              <span>Active Filter: <strong>{activeCrossFilter.value}</strong></span>
              <button
                data-testid="clear-crossfilter-btn"
                onClick={clearCrossFilter}
                style={{
                  background: "none",
                  border: "none",
                  color: "#EEF2F8",
                  cursor: "pointer",
                  padding: "0 2px",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
                title="Clear cross-filter"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={resetToTemplate}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#A3AEC2",
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            title="Reset active dashboard layout to the canonical Landfall prize template"
          >
            Reset to Template
          </button>
        </div>
      </div>

      {/* Main AG Studio Component */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflowX: "hidden" }}>
        <AgStudio
          key={`${activePageId}-${mode}-${canvasRevision}`}
          {...({
            data,
            initialState: currentReportState,
            mode,
            theme: LANDFALL_STUDIO_THEME,
            widgets: widgetsConfig,
            ai,
            onStateUpdated,
            responsiveLayoutBreakpoints: [{ maxWidth: 768, layout: singleColumnLayout }],
            panels: {
              view: { right: [] },
              edit: { left: ["ai"], right: [] },
            },
            style: { width: "100%", height: "100%" },
          } as any)}
        />
      </div>
    </div>
  );
}
