"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { I } from "@/components/icons";
import { AgStudio, createWidgets } from "ag-studio-react";
import {
  AgStudioAiModule,
  AgStudioModuleRegistry,
  createAiHarness,
  directLlmRunner,
  singleColumnLayout,
  studioTheme,
  type AgReportState,
} from "ag-studio";

// Register the Studio AI Agent Module
AgStudioModuleRegistry.registerModules([AgStudioAiModule]);

import {
  GroqStudioLlmAdapter,
  addRecoveryPage,
  CREATE_RECOVERY_PAGE_TOOL,
  RECOVERY_PAGE_ID,
  RECOVERY_PAGE_TITLE,
} from "@/lib/ai/watch-officer/studio-adapter";
import { registerAgLicenses } from "@/lib/ag/license";
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

registerAgLicenses();

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
            "Explains the 30% reserve policy floor, protected reserve amount, total funds, headroom, and compliance status from the policy engine.",
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
            "Shows, for a selected payout item, every piece of evidence behind it — obligation, two-person approval, PayPal batch/item, provider webhook, ledger, resident confirmation and recovery proof — with who reported it (PayPal, Landfall, resident, operator) and what is missing. Follows page filters; selecting an item cross-filters the page.",
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
        "kpi-funding": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-available": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-reserve": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-unresolved": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
        "w-solvency": { xTrack: 0, yTrack: 8, xSpan: 8, ySpan: 14 },
        "c-payout-dist": { xTrack: 8, yTrack: 8, xSpan: 8, ySpan: 14 },
        "c-exception-aging": { xTrack: 16, yTrack: 8, xSpan: 8, ySpan: 14 },
        "g-priority-exceptions": { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 18 },
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
          format: { title: { text: "Reserve policy floor (30%)", enabled: true, wrapping: true } },
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
          format: { title: { text: "Reserve guardrail (30% policy floor)", enabled: true, wrapping: true } },
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
        "kpi-total-treasury": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-reserve-floor": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-headroom": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-net-allocatable": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
        "w-guardrail": { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 14 },
        "c-treasury-tranches": { xTrack: 0, yTrack: 22, xSpan: 12, ySpan: 14 },
        "c-funding-sources": { xTrack: 12, yTrack: 22, xSpan: 12, ySpan: 14 },
        "g-ledger": { xTrack: 0, yTrack: 36, xSpan: 24, ySpan: 16 },
        "g-batches": { xTrack: 0, yTrack: 52, xSpan: 24, ySpan: 12 },
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
          format: { title: { text: "Evidence behind each payment", enabled: true, wrapping: true } },
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
        "kpi-unclaimed-total": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-aging-max": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-batch-sum": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-ledger-variance": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
        "c-recovery-status": { xTrack: 0, yTrack: 8, xSpan: 12, ySpan: 14 },
        "c-aging-dist": { xTrack: 12, yTrack: 8, xSpan: 12, ySpan: 14 },
        "w-lifecycle": { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 27 },
        "w-evidence-chain": { xTrack: 0, yTrack: 49, xSpan: 24, ySpan: 20 },
        "g-payout-workbench": { xTrack: 0, yTrack: 69, xSpan: 24, ySpan: 20 },
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
        "kpi-reg-obligations": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-provider-credited": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-grievances-cases": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
        "kpi-resolved-grievances": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
        "c-tier-grants": { xTrack: 0, yTrack: 8, xSpan: 12, ySpan: 14 },
        "c-zone-grants": { xTrack: 12, yTrack: 8, xSpan: 12, ySpan: 14 },
        "g-grievances": { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 14 },
        "g-residents": { xTrack: 0, yTrack: 36, xSpan: 24, ySpan: 18 },
      },
    },
  ],
} as any;

const STORAGE_KEY = "landfall_ag_studio_state_v5";

const ANALYST_INSTRUCTIONS =
  "You are Landfall's Relief Finance Analyst inside AG Studio. Help relief coordinators and auditors understand payout outcomes, exceptions, reserve compliance and ledger reconciliation.\n" +
  "DATA: tables payout_items, payout_batches, relief_obligations, webhook_observations, ledger_reconciliation, treasury, solvency, households, grievance_summary, recovery_proofs. Use viewSchema / executeQuery before quoting numbers; never invent figures.\n" +
  "FACTS TO RESPECT: PayPal item status SUCCESS means credited to the recipient's account — it is NOT proof the household can access or has received the money; keep provider status and recipient-reported confirmation separate. UNCLAIMED payments auto-return after 30 days and must be resolved by helping the resident claim, never by paying again. PENDING has no item webhook — monitor. ONHOLD/BLOCKED need investigation. FAILED/RETURNED need a NEW two-person-approved plan.\n" +
  "TOOLS: you can read data, add/modify widgets and filters, and call " + CREATE_RECOVERY_PAGE_TOOL + " to add a ready-made recovery page. " +
  "SAFETY: you are strictly read-only for money. You cannot execute, re-issue, approve or alter any payout, ledger entry or reserve — no such tool exists. If asked, refuse and explain the safe alternative. Keep answers short and cite the record ids you used.";

const PAGE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  overview: { label: "Relief overview", icon: I.dashboard },
  treasury: { label: "Treasury & reserve", icon: I.reserve },
  recovery: { label: "Payout recovery", icon: I.recovery },
  accountability: { label: "Accountability", icon: I.evidence },
  [RECOVERY_PAGE_ID]: { label: RECOVERY_PAGE_TITLE, icon: I.aiAdvisor },
};

function loadSavedState(): AgReportState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && Array.isArray(parsed.pages) && parsed.pages.length >= 4) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export default function StudioCanvas({ mode }: { mode: "view" | "edit" }) {
  /** The live Studio API. Page switches, filters and AI edits go through it — nothing re-mounts Studio. */
  const apiRef = useRef<any>(null);
  const studioRef = useRef<any>(null);
  /** Studio exposes its API via the component ref once ready; the AI callback also captures it in edit mode. */
  const getApi = () => studioRef.current?.api ?? apiRef.current;
  /** Latest state, kept in a ref so reading it never triggers a render. */
  const latestState = useRef<AgReportState | null>(null);
  const [pages, setPages] = useState<{ id: string }[]>(() => (loadSavedState() ?? CANONICAL_REPORT_STATE).pages as any);
  const [activePageId, setActivePageId] = useState<string>(() => (loadSavedState()?.selectedPageId as string) || "overview");
  const [activeCrossFilter, setActiveCrossFilter] = useState<{ key: string; value: string } | null>(null);

  // Studio is (re)created only when the mode changes; it starts from the latest state so nothing is lost.
  // Intentionally keyed on `mode`: Studio is re-created on a mode switch and must start from the latest state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = useMemo(() => latestState.current ?? loadSavedState() ?? CANONICAL_REPORT_STATE, [mode]);

  const data = useMemo(() => ({ sources: studioSources, relationships: studioRelationships, calendars: studioCalendars }), []);

  /* Studio Agent Framework — a real agent with real Studio tools. */
  const ai = useCallback(({ api }: { api: any }) => {
    apiRef.current = api;
    const adapter = new GroqStudioLlmAdapter({ api });

    // Custom tool: add the recovery page through Studio's own state API (tagged as an AI change, undoable).
    const createRecoveryPage = api.defineAiTool({
      name: CREATE_RECOVERY_PAGE_TOOL,
      description:
        "Add a ready-made 'Payout recovery' page to the report: unresolved-value KPIs, a PayPal-status donut, an ageing chart and a record-level workbench. Use when asked to create or build a payout recovery report or dashboard.",
      params: (shape: any) => shape.object({}),
      execute: async (_args: unknown, ctx: any) => {
        const r = addRecoveryPage(api);
        return r.ok ? ctx.success(r.message) : ctx.error(r.message);
      },
    });

    return createAiHarness(api, (ctx) => {
      const analyst = directLlmRunner({
        id: "relief-finance-analyst",
        name: "Relief Finance Analyst",
        description: "Specialist for PayPal payout outcomes, exceptions, reserve compliance and reconciliation. Read-only for money; can build dashboards.",
        instructions: () => ANALYST_INSTRUCTIONS,
        // A deliberately small tool set: every advertised tool costs prompt tokens on the free tier.
        tools: (c: any) => [c.studio.viewSchema(), c.studio.executeQuery(), c.studio.viewPage(), c.studio.addPageFilter(), createRecoveryPage],
        adapter,
      } as any);

      return {
        agents: [analyst, directLlmRunner({ ...ctx.builtIn.lead, adapter }), directLlmRunner({ ...ctx.builtIn.data, adapter }), directLlmRunner({ ...ctx.builtIn.page, adapter }), directLlmRunner({ ...ctx.builtIn.widget, adapter }), directLlmRunner({ ...ctx.builtIn.planning, adapter })],
        primary: "relief-finance-analyst",
        promptStarters: STUDIO_PROMPT_STARTERS,
      };
    });
  }, []);

  const onStateUpdated = useCallback((evt: any) => {
    const state = evt?.state;
    if (!state) return;
    latestState.current = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore storage quota */
    }
    setPages(state.pages ?? []);
    const selected = state.selectedPageId || state.pages?.[0]?.id;
    if (selected) setActivePageId(selected);
    const page = state.pages?.find((p: any) => p.id === selected);
    const values = page?.crossFilter?.values;
    if (values && Object.keys(values).length > 0) {
      const key = Object.keys(values)[0];
      const v = values[key]?.[0];
      setActiveCrossFilter(v ? { key, value: String(v.values?.[0] ?? v.field?.id ?? "Filter") } : null);
    } else {
      setActiveCrossFilter(null);
    }
  }, []);

  /** Apply a change through Studio's API (no re-mount, chat and history survive). */
  const setStudioState = (next: (state: any) => any, historyLabel: string) => {
    const api = getApi();
    if (!api) return;
    api.setState(next(api.getState()), { historyLabel, source: { type: "ui" } });
  };

  const switchPage = (pageId: string) => setStudioState((st) => ({ ...st, selectedPageId: pageId }), "Switch page");

  const applyCrossFilter = (status: string) =>
    setStudioState(
      (st) => ({
        ...st,
        pages: st.pages.map((p: any) =>
          p.id === "recovery"
            ? { ...p, crossFilter: { values: { "c-recovery-status": [{ type: "value", group: 0, field: { id: "payout_items.transaction_status" }, values: [status] }] } } }
            : p
        ),
      }),
      `Filter: ${status}`
    );

  const clearCrossFilter = () =>
    setStudioState((st) => ({ ...st, pages: st.pages.map((p: any) => (p.id === activePageId ? { ...p, crossFilter: { values: {} } } : p)) }), "Clear filter");

  const resetToTemplate = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStudioState(() => ({ ...CANONICAL_REPORT_STATE, selectedPageId: "overview" }), "Reset to template");
  };

  const nav = useMemo(
    () =>
      pages.map((p) => ({
        id: p.id,
        label: PAGE_LABELS[p.id]?.label ?? p.id,
        Icon: PAGE_LABELS[p.id]?.icon ?? I.aiAdvisor,
      })),
    [pages]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
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
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5EEAD4", letterSpacing: "-0.01em" }}>Relief Finance Intelligence</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", background: "rgba(255, 255, 255, 0.06)", color: "#A3AEC2", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 4, padding: "2px 6px" }}>
            REPLAY DATA · SYNTHETIC
          </span>
        </div>

        <div role="tablist" aria-label="Report pages" style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 8, padding: 3 }}>
          {nav.map(({ id, label, Icon }) => {
            const isActive = activePageId === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchPage(id)}
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
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activePageId === "recovery" && !activeCrossFilter && (
            <button
              data-testid="filter-unclaimed-btn"
              onClick={() => applyCrossFilter("UNCLAIMED")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251, 191, 84, 0.12)", border: "1px solid rgba(251, 191, 84, 0.35)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#FBBF54", cursor: "pointer", fontWeight: 600 }}
              title="Cross-filter the report to UNCLAIMED payouts"
            >
              Filter: UNCLAIMED
            </button>
          )}

          {activeCrossFilter && (
            <div data-testid="active-crossfilter-chip" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(84, 160, 255, 0.15)", border: "1px solid rgba(84, 160, 255, 0.35)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#54A0FF" }}>
              <span>
                Filtered: <strong>{activeCrossFilter.value}</strong>
              </span>
              <button data-testid="clear-crossfilter-btn" onClick={clearCrossFilter} style={{ background: "none", border: "none", color: "#EEF2F8", cursor: "pointer", padding: "0 2px", fontWeight: "bold", fontSize: 12 }} title="Clear filter">
                ✕
              </button>
            </div>
          )}

          <button
            onClick={resetToTemplate}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, color: "#A3AEC2", padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
            title="Reset the report to the Landfall template"
          >
            <I.retry size={12} /> Reset
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflowX: "hidden" }}>
        <AgStudio
          ref={studioRef}
          key={mode}
          {...({
            data,
            initialState,
            mode,
            theme: LANDFALL_STUDIO_THEME,
            widgets: widgetsConfig,
            ai,
            onStateUpdated,
            responsiveLayoutBreakpoints: [{ maxWidth: 768, layout: singleColumnLayout }],
            panels: {
              view: { right: [] },
              // Edit mode shows the AI assistant AND the compose panel, where the custom "Landfall Relief Intelligence" widgets live.
              edit: { left: ["ai"], right: ["edit"] },
            },
            style: { width: "100%", height: "100%" },
          } as any)}
        />
      </div>
    </div>
  );
}
