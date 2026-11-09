"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  ValidationModule,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from "ag-grid-community";
import { AgCharts } from "ag-charts-react";
import {
  type AgChartOptions,
  ModuleRegistry as AgChartsModuleRegistry,
  AllCommunityModule as AgChartsAllCommunityModule,
} from "ag-charts-community";
import { SYNTHETIC_HOUSEHOLDS, DEFAULT_POLICY_CONFIG } from "@/lib/fixtures/households";
import { interpretStudioQuery, STUDIO_SUGGESTED_PROMPTS, type StudioAgentCommand } from "@/lib/ai/watch-officer/studio-bridge";
import { simulateResponseScenarios } from "@/lib/rules/simulator";
import { createAiHarness, type AgReportState } from "ag-studio";
import { GroqStudioLlmAdapter } from "@/lib/ai/watch-officer/studio-adapter";
import { PasskeyApprovalModal } from "@/components/security/PasskeyApprovalModal";
import { fieldAtlasTheme } from "@/styles/ag-studio-theme";
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
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Filter,
  Layers,
  Search,
  ExternalLink,
  Shield,
  HelpCircle,
  FileCheck2,
  Lock,
} from "lucide-react";

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

// Register AG Charts Community modules
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule]);

// Dynamically import AgStudio from ag-studio-react for client-side execution
const AgStudioCanvas = dynamic(
  () =>
    Promise.all([
      import("ag-studio-react"),
      import("ag-studio"),
    ]).then(([studioReact, studioCore]) => {
      const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
      if (licenseKey && studioCore.AgStudioLicenseManager) {
        try {
          studioCore.AgStudioLicenseManager.setLicenseKey(licenseKey);
        } catch {
          // Gracefully continue if license verification fails
        }
      }
      return studioReact.AgStudio;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="h-[650px] flex items-center justify-center bg-[#FFFEFA] border border-[#DEDCD3] rounded-xl text-[#58665F] font-mono text-xs">
        Initializing AG Studio Embedded Canvas & Data Engine...
      </div>
    ),
  }
);

export default function WarRoomPage() {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Progressive Disclosure Tabs: "OVERVIEW" answers "What needs attention right now?"
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "STUDIO_CANVAS" | "WIDGETS" | "RECIPIENTS" | "SETTLEMENT"
  >("OVERVIEW");

  const [studioMode, setStudioMode] = useState<"view" | "edit">("view");
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [passkeysVerified, setPasskeysVerified] = useState(true);

  // Studio Agent Copilot state
  const [agentQuery, setAgentQuery] = useState("");
  const [agentMessages, setAgentMessages] = useState<
    Array<{ sender: "user" | "officer"; text: string; timestamp: string }>
  >([
    {
      sender: "officer",
      text: "Landfall Watch Officer standing by. Connected to Studio Agent Framework and Groq Free Plan (openai/gpt-oss-20b). Ask me to 'show medical device households', 'filter to Zone A', 'sort by priority tier', or 'simulate constrained reserve'.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // AG Studio AI Harness setup
  const handleAiHarness = useCallback(({ api }: { api: any }) => {
    return createAiHarness(api, {
      adapter: new GroqStudioLlmAdapter(),
      primary: "lead",
    });
  }, []);

  // Scenario Simulator state
  const [selectedScenario, setSelectedScenario] = useState<
    "BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS"
  >("BASELINE");

  // Grid Data
  const rowData = useMemo(() => {
    return SYNTHETIC_HOUSEHOLDS.map((h) => {
      const isConfirmed = h.id !== "hh_orl_006";
      const priorityTier = h.hasMedicalDevice
        ? 1
        : h.isElderlyLivingAlone
        ? 2
        : h.hasDisability
        ? 3
        : h.hasChildrenUnder5
        ? 4
        : 5;

      return {
        id: h.id,
        zone: h.zone,
        tier: priorityTier,
        priorityTier,
        status: isConfirmed ? "CONFIRMED" : "UNCONFIRMED",
        hasMedicalDevice: h.hasMedicalDevice ? "YES" : "NO",
        elderly: h.isElderlyLivingAlone ? "YES" : "NO",
        recipientPath: h.language === "es" ? "Venmo" : "PayPal",
        amount: "$500.00",
        evidenceLevel: isConfirmed ? "LEVEL_3_HIGH" : "LEVEL_1_PENDING",
      };
    });
  }, []);

  // AG Studio Structured Data Sources
  const studioData = useMemo(() => {
    return [
      {
        id: "households",
        name: "Monitored Households",
        data: rowData.map((r) => ({
          household_id: r.id,
          resident_name: r.id === "hh_tbw_001" ? "E. Rodriguez" : "Resident",
          zone: r.zone,
          tier_label: `Tier ${r.tier}`,
          priority_tier: `Tier ${r.tier}`,
          status: r.status,
          amount_cents: 50000,
        })),
      },
      {
        id: "treasury",
        name: "Treasury Tranches",
        data: [
          { category: "Protected Reserve", amount_usd: 5000 },
          { category: "Disbursement Fees Buffer", amount_usd: 120 },
          { category: "Available to Allocate", amount_usd: 9250 },
        ],
      },
    ];
  }, [rowData]);

  // AG Studio Pre-configured Report Dashboard State
  const initialStudioState = useMemo<AgReportState>(() => {
    return {
      version: "3.1.0",
      selectedPageId: "page-1",
      pages: [
        {
          id: "page-1",
          widgets: {
            "widget-kpi-evac": {
              type: "value",
              format: {
                title: { text: "Vulnerable Residents Monitored", enabled: true },
              },
              dataMapping: {
                value: [{ id: "households.household_id", aggregation: "count" }],
              },
            },
            "widget-chart-treasury": {
              type: "bar-chart-grouped",
              format: {
                title: { text: "Treasury Tranches & Protected Reserves ($ USD)", enabled: true },
              },
              dataMapping: {
                categoryKey: [{ id: "treasury.category" }],
                valueKey: [{ id: "treasury.amount_usd", aggregation: "sum" }],
              },
            },
            "widget-chart-priority": {
              type: "donut-chart",
              format: {
                title: { text: "Vulnerability Tier Distribution", enabled: true },
              },
              dataMapping: {
                categoryKey: [{ id: "households.tier_label" }],
                valueKey: [{ id: "households.household_id", aggregation: "count" }],
              },
            },
            "widget-grid-pipeline": {
              type: "grid",
              format: {
                title: { text: "Active Resident Rescue & Payout Pipeline", enabled: true },
                style: { columnAutoSize: true },
              },
              dataMapping: {
                cols: [
                  { id: "households.household_id" },
                  { id: "households.resident_name" },
                  { id: "households.zone" },
                  { id: "households.tier_label" },
                  { id: "households.status" },
                  { id: "households.amount_cents" },
                ],
              },
            },
          },
          widgetLayout: {
            "widget-kpi-evac": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
            "widget-chart-treasury": { xTrack: 6, yTrack: 0, xSpan: 9, ySpan: 8 },
            "widget-chart-priority": { xTrack: 15, yTrack: 0, xSpan: 9, ySpan: 8 },
            "widget-grid-pipeline": { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 16 },
          },
          filter: {
            page: [
              {
                field: { id: "households.priority_tier" },
                view: { expanded: true },
                model: {
                  operator: "isIn",
                  value: ["Tier 1", "Tier 2", "Tier 3"],
                },
              },
            ],
          },
        },
      ],
    };
  }, []);

  // Column definitions styled for Field Atlas
  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: "Household ID",
        field: "id",
        width: 140,
        filter: "agTextColumnFilter",
        cellClass: "font-mono text-xs font-semibold text-[#192A24]",
      },
      {
        headerName: "Priority Tier",
        field: "priorityTier",
        width: 120,
        filter: "agNumberColumnFilter",
        cellRenderer: (params: any) => {
          const tier = params.value;
          return (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                tier === 1
                  ? "bg-[#FDE8E8] text-[#B92525] border-[#F5A3A3]"
                  : tier === 2
                  ? "bg-[#FEF5E7] text-[#B46914] border-[#F3CA8A]"
                  : "bg-[#E0EEE7] text-[#175B47] border-[#97D5B2]"
              }`}
            >
              Tier {tier}
            </span>
          );
        },
      },
      {
        headerName: "Evacuation Zone",
        field: "zone",
        width: 170,
        filter: "agTextColumnFilter",
        cellClass: "text-xs text-[#58665F]",
      },
      {
        headerName: "Disaster Exposure",
        field: "status",
        width: 140,
        filter: "agTextColumnFilter",
        cellRenderer: (params: any) => {
          const isConfirmed = params.value === "CONFIRMED";
          return (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                isConfirmed
                  ? "bg-[#E4F4EC] text-[#1B7340] border-[#97D5B2]"
                  : "bg-[#EDECE7] text-[#636C67] border-[#D0CEBE]"
              }`}
            >
              {params.value}
            </span>
          );
        },
      },
      {
        headerName: "Disbursement Channel",
        field: "recipientPath",
        width: 150,
        filter: "agTextColumnFilter",
        cellClass: "font-mono text-xs text-[#58665F]",
      },
      {
        headerName: "Tranche 1 Grant",
        field: "amount",
        width: 130,
        filter: "agTextColumnFilter",
        cellClass: "font-mono text-xs font-bold text-[#175B47] font-tabular",
      },
      {
        headerName: "Verification Status",
        field: "evidenceLevel",
        width: 150,
        filter: "agTextColumnFilter",
        cellClass: "text-xs font-mono text-[#58665F]",
      },
    ];
  }, []);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      sortable: true,
      resizable: true,
    };
  }, []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // AG Charts Treasury Allocation Breakdown (Field Atlas Palette)
  const chartOptions: AgChartOptions = useMemo(() => {
    return {
      title: {
        text: "Storm Treasury Allocation Breakdown",
        color: "#192A24",
        fontSize: 14,
      },
      subtitle: {
        text: "Available Funds: $14,250.00 | Allocatable: $9,250.00",
        color: "#58665F",
        fontSize: 11,
      },
      theme: "ag-default",
      data: [
        { category: "Protected Reserve", amount: 5000, color: "#D99B43" },
        { category: "Disbursement Buffer", amount: 120, color: "#7B847D" },
        { category: "Available to Allocate", amount: 9250, color: "#175B47" },
      ],
      series: [
        {
          type: "donut",
          calloutLabelKey: "category",
          angleKey: "amount",
          innerRadiusRatio: 0.65,
          fills: ["#D99B43", "#7B847D", "#175B47"],
          strokes: ["#FFFEFA", "#FFFEFA", "#FFFEFA"],
        },
      ],
      background: {
        fill: "transparent",
      },
      legend: {
        item: {
          label: {
            color: "#192A24",
            fontSize: 11,
          },
        },
      },
    };
  }, []);

  // Studio Agent Command Execution
  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentQuery.trim()) return;

    const userText = agentQuery.trim();
    setAgentQuery("");
    const newMessages = [
      ...agentMessages,
      { sender: "user" as const, text: userText, timestamp: new Date().toLocaleTimeString() },
    ];

    const command: StudioAgentCommand = interpretStudioQuery(userText);

    if (gridApi) {
      if (command.type === "RESET_FILTERS") {
        gridApi.setFilterModel(null);
        gridApi.applyColumnState({
          defaultState: { sort: null },
        });
      } else if (command.type === "FILTER_GRID" && command.filters) {
        const filterModel: Record<string, any> = {};
        for (const f of command.filters) {
          if (f.operator === "equals") {
            filterModel[f.column] = {
              filterType: typeof f.value === "number" ? "number" : "text",
              type: "equals",
              filter: f.value,
            };
          } else if (f.operator === "contains") {
            filterModel[f.column] = {
              filterType: "text",
              type: "contains",
              filter: f.value,
            };
          }
        }
        gridApi.setFilterModel(filterModel);
      } else if (command.type === "SORT_GRID" && command.sortColumn) {
        gridApi.applyColumnState({
          state: [{ colId: command.sortColumn, sort: command.sortDirection || "asc" }],
          defaultState: { sort: null },
        });
      } else if (command.type === "SIMULATE_SCENARIO" && command.scenarioId) {
        setSelectedScenario(command.scenarioId);
      }
    }

    newMessages.push({
      sender: "officer",
      text: command.agentResponse,
      timestamp: new Date().toLocaleTimeString(),
    });
    setAgentMessages(newMessages);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="field-badge field-badge-info">
              SANDBOX MODE · MILTON 2024 REPLAY
            </span>
            <span className="field-badge field-badge-success">
              NOAA NWS TBW ACTIVE
            </span>
          </div>
          <h1 className="text-title-1 text-[#192A24] font-bold tracking-tight">
            Operations overview
          </h1>
          <p className="text-caption">
            Real-time financial readiness, priority payout exceptions, and anticipatory relief execution.
          </p>
        </div>

        {/* Primary Command Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPasskeyModalOpen(true)}
            className="field-btn field-btn-primary shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            <span>Authorise Payout Queue</span>
          </button>

          <Link
            href="/console/golden-flow"
            className="field-btn field-btn-secondary"
          >
            <span>Run Golden Pipeline</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      {/* 2. PROGRESSIVE DISCLOSURE TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DEDCD3] pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            activeTab === "OVERVIEW"
              ? "bg-[#175B47] text-[#FFFEFA] shadow-sm font-bold"
              : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
          }`}
        >
          Overview (Attention Queue)
        </button>

        <button
          onClick={() => setActiveTab("STUDIO_CANVAS")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            activeTab === "STUDIO_CANVAS"
              ? "bg-[#175B47] text-[#FFFEFA] shadow-sm font-bold"
              : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
          }`}
        >
          Analytics Workspace (AG Studio 3.1)
        </button>

        <button
          onClick={() => setActiveTab("WIDGETS")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            activeTab === "WIDGETS"
              ? "bg-[#175B47] text-[#FFFEFA] shadow-sm font-bold"
              : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
          }`}
        >
          Operational Widgets (12)
        </button>

        <button
          onClick={() => setActiveTab("RECIPIENTS")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            activeTab === "RECIPIENTS"
              ? "bg-[#175B47] text-[#FFFEFA] shadow-sm font-bold"
              : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
          }`}
        >
          Recipient Roster (AG Grid)
        </button>

        <button
          onClick={() => setActiveTab("SETTLEMENT")}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            activeTab === "SETTLEMENT"
              ? "bg-[#175B47] text-[#FFFEFA] shadow-sm font-bold"
              : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
          }`}
        >
          Settlement & Audit Trail
        </button>
      </div>

      {/* --- TAB 1: DEFAULT OVERVIEW (WHAT NEEDS ATTENTION RIGHT NOW?) --- */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6 animate-field-fade">
          {/* A. OPERATIONAL SUMMARY: 4 MAJOR METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="field-paper p-5 space-y-1">
              <span className="text-micro text-[#7B847D]">Available PayPal Funds</span>
              <div className="text-2xl font-bold font-tabular text-[#192A24]">
                $14,250.00
              </div>
              <span className="text-[11px] text-[#58665F] block">
                Verified Sandbox Merchant Balance
              </span>
            </div>

            <div className="field-paper p-5 space-y-1">
              <span className="text-micro text-[#7B847D]">Protected Reserve</span>
              <div className="text-2xl font-bold font-tabular text-[#D99B43]">
                $5,000.00
              </div>
              <span className="text-[11px] text-[#58665F] block">
                Mathematical Floor (Untouchable)
              </span>
            </div>

            <div className="field-paper p-5 space-y-1">
              <span className="text-micro text-[#7B847D]">Available to Allocate</span>
              <div className="text-2xl font-bold font-tabular text-[#175B47]">
                $9,250.00
              </div>
              <span className="text-[11px] text-[#58665F] block">
                Net Liquid for Tranche 1 Grants
              </span>
            </div>

            <div className="field-paper p-5 space-y-1 bg-[#FEF5E7] border-[#F3CA8A]">
              <span className="text-micro text-[#B46914]">Payouts Needing Attention</span>
              <div className="text-2xl font-bold font-tabular text-[#B46914] flex items-center justify-between">
                <span>2 Exceptions</span>
                <AlertTriangle className="w-5 h-5 text-[#B46914]" />
              </div>
              <span className="text-[11px] text-[#58665F] block">
                Unclaimed or provider hold status
              </span>
            </div>
          </div>

          {/* B. PRIORITY QUEUE: PAYOUTS NEEDING ATTENTION (MOST IMPORTANT SECTION) */}
          <div className="field-paper p-6 space-y-4 border-2 border-[#DEDCD3]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DEDCD3] pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B46914]" />
                  <h2 className="text-heading text-[#192A24]">
                    Payouts needing attention
                  </h2>
                </div>
                <p className="text-caption">
                  Unresolved exceptions flagged by PayPal webhooks requiring human coordinator action.
                </p>
              </div>

              <Link
                href="/console/watch-officer"
                className="field-btn field-btn-secondary text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#175B47] mr-1" />
                <span>Open Watch Officer AI</span>
              </Link>
            </div>

            {/* Exception Items Table / Cards */}
            <div className="space-y-3">
              {/* Exception 1: UNCLAIMED */}
              <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#DEDCD3] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs font-mono text-[#192A24]">
                      hh_stp_002 (M. Hernandez · Pinellas Zone A)
                    </span>
                    <span className="field-badge field-badge-warning">UNCLAIMED</span>
                    <span className="font-mono text-xs font-bold text-[#175B47] font-tabular">
                      $500.00 USD
                    </span>
                  </div>
                  <p className="text-xs text-[#58665F]">
                    <strong>Why it needs attention:</strong> The recipient has not claimed this payment yet. PayPal notification delivered via SMS.
                  </p>
                  <p className="text-[11px] text-[#175B47] font-medium">
                    <strong>Recommended action:</strong> Re-send SMS notification reminder. Do not issue a duplicate transaction while the original remains pending.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href="/console/watch-officer"
                    className="field-btn field-btn-primary text-xs py-1.5 px-3"
                  >
                    <span>Inspect Case</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>

              {/* Exception 2: ON_HOLD */}
              <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#DEDCD3] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs font-mono text-[#192A24]">
                      hh_clw_005 (R. Jenkins · Clearwater Beach)
                    </span>
                    <span className="field-badge field-badge-critical">ON_HOLD</span>
                    <span className="font-mono text-xs font-bold text-[#175B47] font-tabular">
                      $500.00 USD
                    </span>
                  </div>
                  <p className="text-xs text-[#58665F]">
                    <strong>Why it needs attention:</strong> Account temporarily on hold by PayPal Sandbox fraud filters.
                  </p>
                  <p className="text-[11px] text-[#175B47] font-medium">
                    <strong>Recommended action:</strong> Awaiting webhook callback release. Direct relief coordinator to verify secondary contact.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href="/console/watch-officer"
                    className="field-btn field-btn-primary text-xs py-1.5 px-3"
                  >
                    <span>Inspect Case</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* C. FUNDING AND READINESS (TREASURY ALLOCATION & TIMELINE) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Treasury Allocation Chart */}
            <div className="lg:col-span-6 field-paper p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2">
                <h3 className="text-heading text-[#192A24]">Treasury allocation</h3>
                <span className="field-badge field-badge-neutral">DOUBLE-ENTRY LEDGER</span>
              </div>
              <div className="h-[240px]">
                <AgCharts options={chartOptions} />
              </div>
            </div>

            {/* Readiness Progression & Recent Activity */}
            <div className="lg:col-span-6 field-paper p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2">
                <h3 className="text-heading text-[#192A24]">Readiness & activity</h3>
                <span className="field-badge field-badge-info">LIVE WEBSOCKET</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#192A24]">Household Evacuation Coverage</span>
                  <span className="font-mono text-[#175B47]">24 of 30 Funded (80%)</span>
                </div>
                <div className="h-2.5 w-full bg-[#ECEAE2] rounded-full overflow-hidden">
                  <div className="h-full bg-[#175B47] rounded-full w-[80%]" />
                </div>
                <div className="flex justify-between text-[11px] text-[#7B847D] font-mono">
                  <span>Priority Tier 1 (Medical): 100%</span>
                  <span>Priority Tier 2 (Elderly): 75%</span>
                </div>
              </div>

              {/* Compact Recent Events Timeline */}
              <div className="space-y-2 pt-2 border-t border-[#DEDCD3]">
                <span className="text-micro text-[#7B847D] block">Recent Operational Events</span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#58665F]">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#175B47]" />
                      <span>Batch 7Y5GP4ETNLCUQ submitted via PayPal Payouts</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#7B847D]">18:14:02 UTC</span>
                  </div>

                  <div className="flex items-center justify-between text-[#58665F]">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#175B47]" />
                      <span>Dual WebAuthn passkey signatures recorded</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#7B847D]">18:12:30 UTC</span>
                  </div>

                  <div className="flex items-center justify-between text-[#58665F]">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#175B47]" />
                      <span>NWS Hurricane Warning (TBW:HU.W:0009) detected</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#7B847D]">18:05:00 UTC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: AG STUDIO ANALYTICS WORKSPACE --- */}
      {activeTab === "STUDIO_CANVAS" && (
        <div className="space-y-4 animate-field-fade">
          <div className="field-paper p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-heading text-[#192A24] flex items-center gap-2">
                <span>AG Studio 3.1.0 Analytical Workspace</span>
                <span className="field-badge field-badge-info">Field Atlas Theme</span>
              </h2>
              <p className="text-caption">
                Interactive analytical dashboard powered by AG Studio, official Theming API, and Groq Watch Officer Copilot.
              </p>
            </div>

            <button
              onClick={() => setStudioMode(studioMode === "view" ? "edit" : "view")}
              className="field-btn field-btn-secondary text-xs"
            >
              Mode: {studioMode === "edit" ? "Edit (Drag & Drop)" : "View (Locked)"}
            </button>
          </div>

          {/* AG Studio Embedded Component with Field Atlas Theme */}
          <div className="w-full h-[680px] rounded-2xl overflow-hidden border border-[#DEDCD3] bg-[#FFFEFA] shadow-lg">
            <AgStudioCanvas
              data={{ sources: studioData }}
              initialState={initialStudioState}
              mode={studioMode}
              ai={handleAiHarness}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {/* Copilot Natural Language Command Bar */}
          <form onSubmit={handleAgentSubmit} className="field-paper p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#175B47] flex-shrink-0 ml-1" />
            <input
              type="text"
              placeholder="Ask Watch Officer Copilot: 'show medical device households', 'filter to Zone A', 'sort by priority tier'..."
              value={agentQuery}
              onChange={(e) => setAgentQuery(e.target.value)}
              className="field-input text-xs flex-1"
            />
            <button type="submit" className="field-btn field-btn-primary text-xs py-2 px-4">
              Send Command
            </button>
          </form>
        </div>
      )}

      {/* --- TAB 3: OPERATIONAL WIDGETS (THE 12 MODULAR WIDGETS) --- */}
      {activeTab === "WIDGETS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-field-fade">
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

      {/* --- TAB 4: RECIPIENT ROSTER (AG GRID WITH FIELD ATLAS THEME) --- */}
      {activeTab === "RECIPIENTS" && (
        <div className="space-y-4 animate-field-fade">
          <div className="field-paper p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-heading text-[#192A24]">
                Household Relief Directory
              </h2>
              <p className="text-caption">
                Prioritized resident roster showing vulnerability tiers, evacuation zones, and grant allocation.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => {
                  if (gridApi) gridApi.setFilterModel(null);
                }}
                className="field-btn field-btn-secondary text-xs py-1.5 px-3"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* AG Grid Component with Field Atlas Theme */}
          <div className="w-full h-[580px] rounded-2xl overflow-hidden border border-[#DEDCD3] shadow-md bg-[#FFFEFA]">
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              theme={fieldAtlasTheme}
              onGridReady={onGridReady}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        </div>
      )}

      {/* --- TAB 5: SETTLEMENT & AUDIT TRAIL --- */}
      {activeTab === "SETTLEMENT" && (
        <div className="space-y-6 animate-field-fade">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PayPalMoneyPathExplorer />
            <SettlementIntegrityBridge />
          </div>
          <ImpactEvidenceWidget />
        </div>
      )}

      {/* Passkey Approval Modal */}
      {isPasskeyModalOpen && (
        <PasskeyApprovalModal
          isOpen={isPasskeyModalOpen}
          planHash="sha256_8f93e2b1c4a0e71928374a5b6c"
          onClose={() => setIsPasskeyModalOpen(false)}
          onApproved={() => {
            setPasskeysVerified(true);
            setIsPasskeyModalOpen(false);
          }}
          planSummary={{
            title: "Tranche 1 Emergency Evacuation Grants",
            totalAmountFormatted: "$9,250.00 USD",
            householdsCount: 24,
            tranche: 1,
          }}
        />
      )}
    </div>
  );
}
