"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
import { AllEnterpriseModule, LicenseManager } from "ag-grid-enterprise";
import { AgStudioLicenseManager } from "ag-studio";
import { AgCharts } from "ag-charts-react";
import {
  type AgChartOptions,
  ModuleRegistry as AgChartsModuleRegistry,
  AllCommunityModule as AgChartsAllCommunityModule,
} from "ag-charts-community";
import { SYNTHETIC_HOUSEHOLDS } from "@/lib/fixtures/households";
import { interpretStudioQuery, type StudioAgentCommand } from "@/lib/ai/watch-officer/studio-bridge";
import { PasskeyApprovalModal } from "@/components/security/PasskeyApprovalModal";
import { landfallGridTheme, landfallChartTheme } from "@/styles/ag-studio-theme";
import { LandfallStudio } from "@/components/studio/LandfallStudio";
import { PageHeader, StatCard, SectionHeader, Chip, IconTile, type Tone } from "@/components/ui/primitives";
import {
  HazardIntelligenceWidget,
  ExposureDistributionWidget,
  TreasuryWaterfallWidget,
  ResponseFunnelWidget,
  PayoutHealthWidget,
  ReadinessMonitorWidget,
  ScenarioComparisonWidget,
  ImpactTimelineWidget,
  PayPalMoneyPathExplorer,
  SettlementIntegrityBridge,
  RecipientRescueQueue,
  ImpactEvidenceWidget,
} from "./widgets";
import {
  LayoutDashboard,
  Wallet,
  Lock,
  HandCoins,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  CloudLightning,
  Scale,
  KeyRound,
  Send,
  Check,
  Clock,
  Users,
  Boxes,
  FileCheck2,
  RotateCcw,
  CornerDownLeft,
  Zap,
} from "lucide-react";

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule]);

const studioLicense = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE || process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (studioLicense) {
  try {
    AgStudioLicenseManager.setLicenseKey(studioLicense);
    LicenseManager.setLicenseKey(studioLicense);
  } catch {
    /* evaluation watermark */
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

type Tab = "OVERVIEW" | "GRID" | "STUDIO" | "WIDGETS" | "SETTLEMENT";

const RESPONSE_STEPS: { icon: any; tone: Tone; label: string; detail: string; state: "done" | "attention" }[] = [
  { icon: CloudLightning, tone: "storm", label: "Warned", detail: "NWS Hurricane Warning", state: "done" },
  { icon: Scale, tone: "accent", label: "Decided", detail: "5 households · $2,500", state: "done" },
  { icon: Sparkles, tone: "ai", label: "Checked", detail: "No duplicates found", state: "done" },
  { icon: KeyRound, tone: "amber", label: "Approved", detail: "2 of 2 passkeys", state: "done" },
  { icon: Send, tone: "paypal", label: "Paid", detail: "2 need follow-up", state: "attention" },
];

const EXCEPTIONS = [
  {
    id: "hh_stp_002",
    name: "M. Hernandez",
    place: "Pinellas · Zone A",
    status: "Unclaimed",
    tone: "amber" as Tone,
    amount: "$500.00",
    why: "Payment sent, but the resident hasn’t claimed it yet. PayPal notified them by SMS.",
    action: "Re-send the SMS reminder. Don’t send a second payment while this one is pending.",
  },
  {
    id: "hh_clw_005",
    name: "R. Jenkins",
    place: "Clearwater Beach",
    status: "On hold",
    tone: "danger" as Tone,
    amount: "$500.00",
    why: "PayPal temporarily held this payment for a routine risk review.",
    action: "Wait for PayPal’s release webhook and confirm a secondary contact for the resident.",
  },
];

const ACTIVITY = [
  { icon: Send, tone: "paypal" as Tone, text: "PayPal batch 7Y5GP4ETNLCUQ submitted", time: "18:14" },
  { icon: KeyRound, tone: "amber" as Tone, text: "Second passkey signed by Finance", time: "18:12" },
  { icon: Sparkles, tone: "ai" as Tone, text: "AI plan review: no duplicates, solvent", time: "18:09" },
  { icon: CloudLightning, tone: "storm" as Tone, text: "NWS Hurricane Warning TBW:HU.W:0009", time: "18:05" },
];

const GRID_PROMPTS = [
  "Focus on Tier 1 life-safety medical device households",
  "Filter to Coastal Surge Evacuation Zone A",
  "Sort households by priority tier",
  "Reset all grid filters",
];

export default function CommandCenterPage() {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [, setSelectedScenario] = useState<"BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS">("BASELINE");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [isGrouped, setIsGrouped] = useState<boolean>(true);

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "officer"; text: string }>>([
    {
      sender: "officer",
      text: "Ask me to focus the grid — try “Tier 1 medical device households” or “Zone A”. I can filter and sort; I can’t change amounts or pay anyone.",
    },
  ]);

  const rowData = useMemo(
    () => [
      {
        id: "hh_tbw_001",
        itemId: "item_milton_001",
        name: "Elena Rodriguez (Oxygen Concentrator)",
        zone: "Zone A (Surge Evacuation)",
        priorityTier: 1,
        status: "CONFIRMED",
        hasMedicalDevice: "YES",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 0,
        payoutStatus: "SUCCESS",
        evidenceLevel: "Verified",
        webhookId: "WH-2L3991054H810932A",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.SUCCESS",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed ($500.00)",
        proofId: "prf_milton_t1_2024",
        proofStatus: "✓ Merkle Root Anchored",
        proofClass: "text-purple-300",
        observationTime: "2024-10-09 18:15:30 UTC",
      },
      {
        id: "hh_tbw_002",
        itemId: "item_milton_002",
        name: "Arthur Pendelton (82, Living Alone)",
        zone: "Zone A (Barrier Island)",
        priorityTier: 2,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 500,
        payoutStatus: "UNCLAIMED",
        evidenceLevel: "Pending",
        webhookId: "WH-3M4002165J921043B",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed (Escrowed)",
        proofId: "NOT LINKED — PENDING RECIPIENT CLAIM",
        proofStatus: "⚠ Awaiting Recipient Wallet Confirmation",
        proofClass: "text-amber-400 font-bold",
        observationTime: "2024-10-10 12:45:30 UTC · Age: 18.5 hrs",
      },
      {
        id: "hh_tbw_003",
        itemId: "item_milton_003",
        name: "Fatima & Marcus Al-Mansoor (Mobility)",
        zone: "Zone B (Inland Surge)",
        priorityTier: 3,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 0,
        payoutStatus: "SUCCESS",
        evidenceLevel: "Verified",
        webhookId: "WH-4N5113276K032154C",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.SUCCESS",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed ($500.00)",
        proofId: "prf_milton_t1_2024",
        proofStatus: "✓ Merkle Root Anchored",
        proofClass: "text-purple-300",
        observationTime: "2024-10-09 18:16:10 UTC",
      },
      {
        id: "hh_tbw_004",
        itemId: "item_milton_004",
        name: "Sarah & Chloe Jenkins (Children <5)",
        zone: "Zone B (Inland Surge)",
        priorityTier: 4,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 0,
        payoutStatus: "SUCCESS",
        evidenceLevel: "Verified",
        webhookId: "WH-6P7335498M254376E",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.SUCCESS",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed ($500.00)",
        proofId: "prf_milton_t1_2024",
        proofStatus: "✓ Merkle Root Anchored",
        proofClass: "text-purple-300",
        observationTime: "2024-10-09 18:17:45 UTC",
      },
      {
        id: "hh_tbw_005",
        itemId: "item_milton_005",
        name: "David Chen (General Public)",
        zone: "Zone A (Surge Evacuation)",
        priorityTier: 5,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 500,
        payoutStatus: "ONHOLD",
        evidenceLevel: "Pending",
        webhookId: "WH-5O6224387L143265D",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.HELD",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed ($500.00)",
        proofId: "NOT LINKED — COMPLIANCE REVIEW HOLD",
        proofStatus: "⚠ Policy Review Required",
        proofClass: "text-red-400 font-bold",
        observationTime: "2024-10-10 08:30:00 UTC",
      },
      {
        id: "hh_tbw_006",
        itemId: "item_milton_006",
        name: "Robert Jenkins (Invalid Phone)",
        zone: "Zone C (Peripheral)",
        priorityTier: 3,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "Venmo",
        amount: 500,
        unresolvedUsd: 500,
        payoutStatus: "FAILED",
        evidenceLevel: "Failed",
        webhookId: "WH-7Q8446509N365487F",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.FAILED",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed (Reversed)",
        proofId: "NOT LINKED — DISPATCH FAILURE",
        proofStatus: "⚠ Invalid Recipient Account",
        proofClass: "text-red-400 font-bold",
        observationTime: "2024-10-09 19:40:00 UTC · Age: 42.0 hrs",
      },
      {
        id: "hh_tbw_007",
        itemId: "item_milton_007",
        name: "Carlos Martinez (Window Expired)",
        zone: "Zone A (Coastal Barrier)",
        priorityTier: 2,
        status: "CONFIRMED",
        hasMedicalDevice: "NO",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 500,
        payoutStatus: "RETURNED",
        evidenceLevel: "Returned",
        webhookId: "WH-8R9557610O476598G",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.RETURNED",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 1000 Cash (Credited)",
        proofId: "NOT LINKED — 30-DAY WINDOW EXPIRED",
        proofStatus: "✓ Returned to Treasury ($500.00)",
        proofClass: "text-amber-300 font-bold",
        observationTime: "2024-10-08 14:10:00 UTC · Age: 72.0 hrs",
      },
      {
        id: "hh_tbw_008",
        itemId: "item_milton_008",
        name: "Maria Washington (Medical Device)",
        zone: "Zone B (Inland Surge)",
        priorityTier: 1,
        status: "CONFIRMED",
        hasMedicalDevice: "YES",
        recipientPath: "PayPal",
        amount: 500,
        unresolvedUsd: 500,
        payoutStatus: "PENDING",
        evidenceLevel: "Pending",
        webhookId: "WH-9S0668721P587609H",
        webhookEvent: "PAYMENT.PAYOUTS-ITEM.BLOCKED",
        approvals: "Coordinator + Finance Lead",
        ledgerAccount: "Account 2100 Disbursed (Pending Clearing)",
        proofId: "NOT LINKED — PENDING CLEARING",
        proofStatus: "⏳ Banking Rail Clearing",
        proofClass: "text-blue-300 font-bold",
        observationTime: "2024-10-10 17:05:00 UTC · Age: 1.5 hrs",
      },
    ],
    []
  );

  const detailCellRendererParams = useMemo(() => {
    return {
      detailGridOptions: {
        columnDefs: [
          { field: "category", headerName: "Evidence Stage", flex: 1.1, minWidth: 140, cellClass: "font-semibold text-ink" },
          { field: "recordId", headerName: "Identifier / Ref", flex: 1.3, minWidth: 160, cellClass: "font-mono text-teal-400" },
          { field: "verificationStatus", headerName: "Cryptographic State", flex: 1.2, minWidth: 150 },
          { field: "details", headerName: "Authoritative Audit Evidence", flex: 2.4, minWidth: 260, cellClass: "text-ink-2" },
        ],
        defaultColDef: {
          sortable: true,
          resizable: true,
          wrapHeaderText: true,
        },
        theme: landfallGridTheme,
      },
      getDetailRowData: (params: any) => {
        const item = params.data;
        const details = [
          {
            category: "1. Relief Obligation",
            recordId: `obl_milton_${item.itemId?.replace("item_milton_", "") || "001"}`,
            verificationStatus: "✓ Policy Engine Verified",
            details: `Approved $500.00 grant for ${item.name} (${item.zone})`,
          },
          {
            category: "2. PayPal Payout Item",
            recordId: `${item.itemId} · BATCH-7Y5GP4ETNLCUQ`,
            verificationStatus: `● ${item.payoutStatus}`,
            details: `Authoritative provider status ${item.payoutStatus} via PayPal Payouts v1 API`,
          },
          {
            category: "3. Webhook Observation",
            recordId: item.webhookId || "WH-2L3991054H810932A",
            verificationStatus: "✓ HMAC SHA-256 Validated",
            details: `Observation recorded at ${item.observationTime}. Signature verified.`,
          },
          {
            category: "4. Dual-Custody Approval",
            recordId: "ES256 WebAuthn 2/2",
            verificationStatus: "✓ Signed by 2 Officers",
            details: `${item.approvals || "Coordinator + Finance Lead"} hardware passkeys anchored`,
          },
          {
            category: "5. Ledger Reconciliation",
            recordId: item.ledgerAccount || "Acct 2100 Disbursed",
            verificationStatus: "✓ 0¢ Minor-Unit Variance",
            details: "Balanced double-entry journal with zero discrepancies",
          },
          {
            category: "6. Recovery Proof",
            recordId: item.proofId,
            verificationStatus:
              item.payoutStatus === "UNCLAIMED"
                ? "⚠ PENDING RECIPIENT CLAIM"
                : item.payoutStatus === "SUCCESS"
                ? "✓ Merkle Root Anchored"
                : "⚠ NO PROOF",
            details:
              item.payoutStatus === "UNCLAIMED"
                ? "NOT LINKED — PENDING RECIPIENT CLAIM within 30-day window. Caseworker reminder queued."
                : item.payoutStatus === "SUCCESS"
                ? "Cryptographically anchored in Merkle tree log (prf_milton_t1_2024)"
                : "Review required before issuing recovery proof",
          },
        ];
        params.successCallback(details);
      },
    };
  }, []);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Household ID",
        field: "id",
        flex: 1.2,
        minWidth: 150,
        cellRenderer: "agGroupCellRenderer",
        filter: "agTextColumnFilter",
        cellClass: "font-mono text-[12.5px] text-ink",
      },
      { headerName: "Resident", field: "name", flex: 1.4, minWidth: 160, filter: "agTextColumnFilter", cellClass: "text-ink font-medium" },
      {
        headerName: "Priority",
        field: "priorityTier",
        flex: 0.8,
        minWidth: 110,
        filter: "agNumberColumnFilter",
        cellRenderer: (p: any) => {
          if (!p.value) return null;
          const t = p.value as number;
          const cls = t === 1 ? "field-badge-critical" : t === 2 ? "field-badge-warning" : "field-badge-success";
          return <span className={`field-badge ${cls}`}>Tier {t}</span>;
        },
      },
      { headerName: "Evacuation zone", field: "zone", flex: 1.4, minWidth: 170, filter: "agTextColumnFilter", cellClass: "text-ink-2" },
      {
        headerName: "Medical device",
        field: "hasMedicalDevice",
        flex: 0.8,
        minWidth: 120,
        filter: "agTextColumnFilter",
        cellRenderer: (p: any) => (p.value === "YES" ? <span className="text-danger font-semibold">● Yes</span> : <span className="text-ink-3">No</span>),
      },
      {
        headerName: "In storm path",
        field: "status",
        flex: 0.9,
        minWidth: 120,
        filter: "agTextColumnFilter",
        cellRenderer: (p: any) =>
          p.value === "CONFIRMED" ? <span className="field-badge field-badge-warning">In path</span> : <span className="field-badge field-badge-neutral">Outside</span>,
      },
      { headerName: "Paid via", field: "recipientPath", flex: 0.8, minWidth: 100, filter: "agTextColumnFilter", cellClass: "text-paypal" },
      {
        headerName: "Authoritative Status",
        field: "payoutStatus",
        flex: 1.1,
        minWidth: 140,
        filter: "agSetColumnFilter",
        rowGroup: isGrouped,
        hide: isGrouped,
        cellRenderer: (p: any) => {
          const s = p.value as string;
          if (s === "SUCCESS") return <span className="field-badge field-badge-success">● SUCCESS</span>;
          if (s === "UNCLAIMED") return <span className="field-badge field-badge-warning">● UNCLAIMED</span>;
          if (s === "ONHOLD") return <span className="field-badge field-badge-critical">● ONHOLD</span>;
          if (s === "FAILED") return <span className="field-badge field-badge-critical">● FAILED</span>;
          if (s === "RETURNED") return <span className="field-badge field-badge-neutral">● RETURNED</span>;
          if (s === "PENDING") return <span className="field-badge field-badge-neutral">● PENDING</span>;
          return <span className="field-badge field-badge-neutral">{s || "Outside"}</span>;
        },
      },
      {
        headerName: "Payout Amount",
        field: "amount",
        flex: 0.9,
        minWidth: 125,
        aggFunc: "sum",
        cellClass: "tabular font-semibold text-accent-strong",
        valueFormatter: (p: any) =>
          typeof p.value === "number" ? `$${p.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : p.value ?? "$500.00",
      },
      {
        headerName: "Unresolved Exposure",
        field: "unresolvedUsd",
        flex: 1.0,
        minWidth: 140,
        aggFunc: "sum",
        cellClass: "tabular font-semibold text-amber",
        valueFormatter: (p: any) =>
          typeof p.value === "number" ? `$${p.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : p.value ?? "$0.00",
      },
      { headerName: "Verification", field: "evidenceLevel", flex: 0.8, minWidth: 110, cellClass: "text-ink-2" },
    ],
    [isGrouped]
  );

  const autoGroupColumnDef = useMemo<ColDef>(
    () => ({
      headerName: "PayPal Status Group",
      field: "payoutStatus",
      minWidth: 260,
      flex: 1.5,
      cellRendererParams: {
        suppressCount: false,
      },
    }),
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    }),
    []
  );

  const pinnedBottomRowData = useMemo(
    () => [
      {
        id: "TOTAL",
        name: "8 Payout Instructions Audited",
        priorityTier: 0,
        zone: "Milton Portfolio Wide",
        hasMedicalDevice: "—",
        status: "CONFIRMED",
        recipientPath: "PAYPAL RAILS",
        payoutStatus: "PORTFOLIO",
        amount: 4000,
        unresolvedUsd: 2500,
        evidenceLevel: "100% Traceable",
      },
    ],
    []
  );

  const onGridReady = useCallback((p: GridReadyEvent) => {
    setGridApi(p.api);
    setTimeout(() => {
      p.api.forEachNode((node) => {
        if (node.data?.payoutStatus === "UNCLAIMED" || node.data?.id === "hh_tbw_002") {
          node.setSelected(true);
          node.setExpanded(true);
          setSelectedRow(node.data);
        }
      });
    }, 150);
  }, []);

  const chartOptions = useMemo<AgChartOptions>(
    () =>
      ({
        theme: landfallChartTheme,
        data: [
          { bucket: "Ready to pay", amount: 9250 },
          { bucket: "Protected reserve", amount: 5000 },
          { bucket: "PayPal fee buffer", amount: 120 },
        ],
        series: [
          {
            type: "donut",
            angleKey: "amount",
            legendItemKey: "bucket",
            innerRadiusRatio: 0.72,
            fills: ["#2DD4BF", "#FBBF54", "#54A0FF"],
            strokes: ["#0C111B", "#0C111B", "#0C111B"],
            strokeWidth: 3,
            cornerRadius: 6,
            innerLabels: [
              { text: "$14,250", fontSize: 26, fontWeight: 650, color: "#EEF2F8" },
              { text: "in PayPal", fontSize: 12, color: "#6E7A91", spacing: 6 },
            ],
            tooltip: { renderer: (p: any) => ({ heading: p.datum.bucket, data: [{ label: "Amount", value: `$${p.datum.amount.toLocaleString()}` }] }) },
          },
        ],
        legend: { position: "bottom", item: { label: { color: "#A3AEC2", fontSize: 12 }, marker: { shape: "circle" } } },
        padding: { top: 4, bottom: 4 },
      }) as any,
    []
  );

  const runCommand = (text: string) => {
    const userText = text.trim();
    if (!userText) return;
    const command: StudioAgentCommand = interpretStudioQuery(userText);

    if (gridApi) {
      if (command.type === "RESET_FILTERS") {
        gridApi.setFilterModel(null);
        gridApi.applyColumnState({ defaultState: { sort: null } });
      } else if (command.type === "FILTER_GRID" && command.filters) {
        const model: Record<string, any> = {};
        for (const f of command.filters) {
          if (f.operator === "equals") model[f.column] = { filterType: typeof f.value === "number" ? "number" : "text", type: "equals", filter: f.value };
          else if (f.operator === "contains") model[f.column] = { filterType: "text", type: "contains", filter: f.value };
        }
        gridApi.setFilterModel(model);
      } else if (command.type === "SORT_GRID" && command.sortColumn) {
        gridApi.applyColumnState({ state: [{ colId: command.sortColumn, sort: command.sortDirection || "asc" }], defaultState: { sort: null } });
      } else if (command.type === "SIMULATE_SCENARIO" && command.scenarioId) {
        setSelectedScenario(command.scenarioId);
      }
    }
    setMessages((m) => [...m, { sender: "user", text: userText }, { sender: "officer", text: command.agentResponse }]);
    setQuery("");
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "GRID", label: "Households · AG Grid", icon: Users },
    { id: "STUDIO", label: "Relief Studio · AG Studio", icon: BarChart3 },
    { id: "WIDGETS", label: "All widgets", icon: Boxes },
    { id: "SETTLEMENT", label: "Settlement proof", icon: FileCheck2 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Command Center · Hurricane Milton"
        icon={LayoutDashboard}
        tone="accent"
        title="12 hours to landfall."
        accent="Here’s what needs you."
        description="Relief for 5 households is already out through PayPal. Two payments need a person to follow up."
        meta={<Chip tone="storm" live>Replay · Oct 2024</Chip>}
        actions={
          <>
            <Link href="/console/studio" className="field-btn field-btn-secondary">
              <BarChart3 className="h-4 w-4 text-paypal" /> Analytics Studio
            </Link>
            <button onClick={() => setPasskeyOpen(true)} className="field-btn field-btn-primary">
              <ShieldCheck className="h-4 w-4" /> Approve payout plan
            </button>
          </>
        }
      />

      {/* Response tracker */}
      <section className="glass p-2" data-reveal aria-label="Response progress">
        <ol className="grid grid-cols-1 gap-1 sm:grid-cols-5">
          {RESPONSE_STEPS.map((s, i) => (
            <li key={s.label} className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 ${s.state === "attention" ? "bg-amber/[0.07]" : ""}`}>
              <IconTile icon={s.icon} tone={s.tone} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  {s.label}
                  {s.state === "done" ? <Check className="h-3.5 w-3.5 text-accent-strong" strokeWidth={2.5} /> : <span className="live-dot text-amber" />}
                </div>
                <div className={`truncate text-[12px] ${s.state === "attention" ? "text-amber" : "text-ink-3"}`}>{s.detail}</div>
              </div>
              {i < RESPONSE_STEPS.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-ink-3/50 sm:block" />}
            </li>
          ))}
        </ol>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In PayPal" value={14250} prefix="$" tone="paypal" icon={Wallet} hint="Verified sandbox balance" />
        <StatCard label="Protected reserve" value={5000} prefix="$" tone="amber" icon={Lock} hint="Can’t be spent — enforced in code" />
        <StatCard label="Ready to pay" value={9250} prefix="$" tone="accent" icon={HandCoins} hint="Available for this storm’s grants" />
        <StatCard label="Need follow-up" value={2} tone="danger" icon={AlertTriangle} hint="Unclaimed or held by PayPal" />
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1 backdrop-blur" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium transition-all ${
              tab === t.id ? "bg-white/10 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-ink-3 hover:text-ink"
            }`}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "OVERVIEW" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 animate-field-fade">
          {/* Attention queue */}
          <section className="glass p-6 xl:col-span-7" data-reveal>
            <SectionHeader
              icon={AlertTriangle}
              tone="danger"
              title="Needs your attention"
              description="Flagged by PayPal webhooks · nothing else is waiting"
              right={
                <Link href="/console/watch-officer" className="field-btn field-btn-secondary px-3.5 py-2 text-[13px]">
                  <Sparkles className="h-4 w-4 text-ai" /> Ask the AI why
                </Link>
              }
            />
            <ul className="mt-5 space-y-3">
              {EXCEPTIONS.map((e) => (
                <li key={e.id} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.035]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[15px] font-semibold text-ink">{e.name}</span>
                    <span className="text-[12.5px] text-ink-3">{e.place}</span>
                    <Chip tone={e.tone}>{e.status}</Chip>
                    <span className="ml-auto text-[15px] font-semibold tabular text-ink">{e.amount}</span>
                  </div>
                  <p className="mt-2.5 text-[13.5px] text-ink-2">{e.why}</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 text-[13px] text-accent-strong">
                      <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-180" /> {e.action}
                    </p>
                    <Link href="/console/watch-officer" className="field-btn field-btn-secondary shrink-0 px-3 py-2 text-[12.5px]">
                      Open case <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-2 font-mono text-[10.5px] text-ink-3">{e.id}</div>
                </li>
              ))}
            </ul>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-ai/25 bg-gradient-to-br from-ai/[0.10] to-transparent p-4">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-ai">
                <Sparkles className="h-3.5 w-3.5" /> AI Watch Officer · briefing
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                Both exceptions are recoverable without a new payment. The fund stays solvent with{" "}
                <span className="tabular text-accent-strong">$9,250</span> ready and the{" "}
                <span className="tabular text-amber">$5,000</span> reserve untouched.
              </p>
              <p className="mt-2 text-[12px] text-ink-3">Read-only. Numbers checked against the ledger before display.</p>
            </div>
          </section>

          {/* Money + activity */}
          <div className="space-y-6 xl:col-span-5">
            <section className="glass p-6" data-reveal>
              <SectionHeader icon={Wallet} tone="paypal" title="Where the money sits" right={<Chip tone="accent">Ledger balanced</Chip>} />
              <div className="mt-2 h-[300px]">
                <AgCharts options={chartOptions} />
              </div>
            </section>

            <section className="glass p-6" data-reveal>
              <SectionHeader icon={Clock} title="Latest activity" description="All times UTC" />
              <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/[0.07]">
                {ACTIVITY.map((a) => (
                  <li key={a.text} className="relative flex items-center gap-3">
                    <IconTile icon={a.icon} tone={a.tone} size="sm" className="relative z-10 !bg-surface" />
                    <span className="flex-1 text-[13.5px] text-ink-2">{a.text}</span>
                    <span className="font-mono text-[11px] text-ink-3">{a.time}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-ink-2">Households paid</span>
                  <span className="tabular text-ink">3 of 5 confirmed</span>
                </div>
                <div className="meter mt-2"><span style={{ width: "60%" }} /></div>
              </div>
            </section>
          </div>

          {/* Studio teaser */}
          <Link href="/console/studio" className="glass card-hover group flex flex-col gap-4 p-6 sm:flex-row sm:items-center xl:col-span-12" data-reveal>
            <IconTile icon={BarChart3} tone="paypal" size="lg" />
            <div className="flex-1">
              <div className="text-[16px] font-semibold text-ink">Explore this response in Analytics Studio</div>
              <div className="text-[13.5px] text-ink-3">AG Studio workspace · custom solvency widget · cross-filters · ask the Studio agent in plain English</div>
            </div>
            <span className="field-btn field-btn-secondary">
              Open Studio <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      )}

      {tab === "GRID" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 animate-field-fade">
          <section className="glass overflow-hidden xl:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <SectionHeader icon={Users} tone="accent" title="Household relief roster" description="AG Grid 36.3 Enterprise · Sort, filter, group, or inspect audit detail" />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  data-testid="toggle-grouping-btn"
                  onClick={() => setIsGrouped(!isGrouped)}
                  className={`field-btn px-2.5 py-1.5 text-[12px] ${isGrouped ? "field-btn-primary" : "field-btn-secondary"}`}
                  title="Toggle between Grouped by PayPal Status and Flat View"
                >
                  {isGrouped ? "View Flat Roster" : "Group by PayPal Status"}
                </button>
                {isGrouped && (
                  <>
                    <button
                      data-testid="expand-all-btn"
                      onClick={() => gridApi?.expandAll()}
                      className="field-btn field-btn-subtle px-2 py-1.5 text-[12px]"
                      title="Expand all status groups"
                    >
                      Expand All
                    </button>
                    <button
                      data-testid="collapse-all-btn"
                      onClick={() => gridApi?.collapseAll()}
                      className="field-btn field-btn-subtle px-2 py-1.5 text-[12px]"
                      title="Collapse all status groups"
                    >
                      Collapse All
                    </button>
                  </>
                )}
                <input
                  type="text"
                  placeholder="Quick search roster..."
                  value={quickFilter}
                  onChange={(e) => {
                    setQuickFilter(e.target.value);
                    gridApi?.setGridOption("quickFilterText", e.target.value);
                  }}
                  className="field-input h-8 w-36 text-[12px]"
                  aria-label="Quick search grid"
                />
                <button
                  onClick={() => gridApi?.exportDataAsCsv({ fileName: "landfall_relief_roster.csv" })}
                  className="field-btn field-btn-subtle px-2.5 py-1.5 text-[12px]"
                  title="Export grid data to CSV"
                >
                  Export CSV
                </button>
                <button onClick={() => { setQuickFilter(""); runCommand("Reset all grid filters"); }} className="field-btn field-btn-subtle px-2.5 py-1.5 text-[12px]">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>
            </div>
            <div className="h-[430px] w-full">
              <AgGridReact
                ref={gridRef}
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                autoGroupColumnDef={isGrouped ? autoGroupColumnDef : undefined}
                groupDefaultExpanded={isGrouped ? -1 : 0}
                theme={landfallGridTheme}
                getRowId={(p) => p.data.id}
                rowSelection={{ mode: "singleRow" }}
                masterDetail={true}
                detailCellRendererParams={detailCellRendererParams}
                detailRowHeight={230}
                onGridReady={onGridReady}
                onRowSelected={(e) => {
                  if (e.node.isSelected()) setSelectedRow(e.data);
                }}
                pinnedBottomRowData={pinnedBottomRowData}
                pagination
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50]}
              />
            </div>

            {/* Contextual Master/Detail Payout Audit Drawer */}
            {selectedRow && (
              <div className="border-t border-white/[0.08] bg-surface-2/60 p-4 animate-field-fade" data-testid="grid-master-detail-panel">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-paypal">
                      PAYPAL AUDIT RECORD
                    </span>
                    <span className="text-ink-3">·</span>
                    <span className="font-mono text-[12px] text-ink font-semibold">{selectedRow.name}</span>
                    <span className="text-[11px] text-ink-3">({selectedRow.zone})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10.5px] text-ink-3">Item / Batch:</span>
                    <span className="font-mono text-[11px] text-ink font-semibold">{selectedRow.itemId || "item_milton_001"} · BATCH-7Y5GP4ETNLCUQ</span>
                    <span
                      className={`field-badge ${
                        selectedRow.payoutStatus === "SUCCESS"
                          ? "field-badge-success"
                          : selectedRow.payoutStatus === "UNCLAIMED"
                          ? "field-badge-warning"
                          : "field-badge-critical"
                      }`}
                    >
                      {selectedRow.payoutStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[11.5px]">
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3">1. Webhook Observation</div>
                    <div className="mt-1 font-mono text-[11px] text-ink">{selectedRow.webhookId || "WH-2L3991054H810932A"}</div>
                    <div className="mt-0.5 text-[10.5px] text-teal-400">✓ HMAC SHA-256 Validated · {selectedRow.webhookEvent || selectedRow.payoutStatus}</div>
                  </div>
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3">2. Dual Approvals</div>
                    <div className="mt-1 text-ink font-medium">{selectedRow.approvals || "Coordinator + Finance Lead"}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-teal-400">✓ WebAuthn 2/2 Signed · Policy Cleared</div>
                  </div>
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3">3. Ledger Reconciliation</div>
                    <div className="mt-1 font-mono text-ink">{selectedRow.ledgerAccount || "Account 2100 Disbursed ($500.00)"}</div>
                    <div className="mt-0.5 text-[10.5px] text-teal-400">✓ 0¢ Minor-Unit Variance</div>
                  </div>
                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-ink-3">4. Recovery Proof</div>
                    <div className={`mt-1 font-mono text-[11px] ${selectedRow.proofClass || "text-purple-300"}`}>{selectedRow.proofId || "prf_milton_t1_2024"}</div>
                    <div className={`mt-0.5 text-[10.5px] ${selectedRow.payoutStatus === "UNCLAIMED" ? "text-amber-400" : selectedRow.payoutStatus === "SUCCESS" ? "text-purple-400" : "text-ink-3"}`}>{selectedRow.proofStatus || "✓ Merkle Root Anchored"}</div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3">
                  <span>Authoritative Observation Time: {selectedRow.observationTime || "2024-10-09 18:15:30 UTC"}</span>
                  <span>Financial Invariant: Zero duplicate payout risk · Duplicate disbursements prohibited · Read-only audit inspection</span>
                </div>
              </div>
            )}
          </section>

          <section className="glass flex flex-col p-5 xl:col-span-4">
            <SectionHeader icon={Sparkles} tone="ai" title="Ask the grid" description="Plain-English filters · read-only" />
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 300 }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed animate-field-fade ${
                      m.sender === "user" ? "bg-white/10 text-ink" : "border border-ai/20 bg-ai/[0.07] text-ink-2"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {GRID_PROMPTS.map((p) => (
                <button key={p} onClick={() => runCommand(p)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-ai/40 hover:text-ink">
                  {p.replace("Coastal Surge Evacuation ", "").replace(" life-safety", "")}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runCommand(query);
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Tier 1 households in Zone A" className="field-input text-[13px]" aria-label="Ask the grid" />
              <button type="submit" className="field-btn field-btn-primary px-3.5" aria-label="Send">
                <Zap className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      )}

      <div
        className="h-[920px] w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-canvas/60"
        style={{ display: tab === "STUDIO" ? "block" : "none" }}
      >
        <LandfallStudio mode="view" />
      </div>

      {tab === "WIDGETS" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 animate-field-fade">
          <HazardIntelligenceWidget />
          <ExposureDistributionWidget />
          <TreasuryWaterfallWidget />
          <ResponseFunnelWidget />
          <PayoutHealthWidget />
          <ReadinessMonitorWidget />
          <ScenarioComparisonWidget />
          <ImpactTimelineWidget />
          <PayPalMoneyPathExplorer />
          <SettlementIntegrityBridge />
          <RecipientRescueQueue />
          <ImpactEvidenceWidget />
        </div>
      )}

      {tab === "SETTLEMENT" && (
        <div className="space-y-6 animate-field-fade">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PayPalMoneyPathExplorer />
            <SettlementIntegrityBridge />
          </div>
          <ImpactEvidenceWidget />
        </div>
      )}

      {passkeyOpen && (
        <PasskeyApprovalModal
          isOpen={passkeyOpen}
          planHash="sha256_8f93e2b1c4a0e71928374a5b6c"
          onClose={() => setPasskeyOpen(false)}
          onApproved={() => setPasskeyOpen(false)}
          planSummary={{ title: "Tranche 1 · Hurricane Milton relief grants", totalAmountFormatted: "$2,500.00 USD", householdsCount: 5, tranche: 1 }}
        />
      )}

    </div>
  );
}
