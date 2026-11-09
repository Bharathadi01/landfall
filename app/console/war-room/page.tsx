"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridApi, type GridReadyEvent } from "ag-grid-community";
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

ModuleRegistry.registerModules([AllCommunityModule]);
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule]);

type Tab = "OVERVIEW" | "GRID" | "WIDGETS" | "SETTLEMENT";

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

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "officer"; text: string }>>([
    {
      sender: "officer",
      text: "Ask me to focus the grid — try “Tier 1 medical device households” or “Zone A”. I can filter and sort; I can’t change amounts or pay anyone.",
    },
  ]);

  const rowData = useMemo(
    () =>
      SYNTHETIC_HOUSEHOLDS.map((h) => {
        const isConfirmed = h.id !== "hh_orl_006";
        const priorityTier = h.hasMedicalDevice ? 1 : h.isElderlyLivingAlone ? 2 : h.hasDisability ? 3 : h.hasChildrenUnder5 ? 4 : 5;
        return {
          id: h.id,
          zone: h.zone,
          priorityTier,
          status: isConfirmed ? "CONFIRMED" : "UNCONFIRMED",
          hasMedicalDevice: h.hasMedicalDevice ? "YES" : "NO",
          recipientPath: h.language === "es" ? "Venmo" : "PayPal",
          amount: "$500.00",
          evidenceLevel: isConfirmed ? "Verified" : "Pending",
        };
      }),
    []
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Household", field: "id", flex: 1.1, minWidth: 130, filter: "agTextColumnFilter", cellClass: "font-mono text-[12.5px] text-ink" },
      {
        headerName: "Priority",
        field: "priorityTier",
        flex: 0.8,
        minWidth: 110,
        filter: "agNumberColumnFilter",
        cellRenderer: (p: any) => {
          const t = p.value as number;
          const cls = t === 1 ? "field-badge-critical" : t === 2 ? "field-badge-warning" : "field-badge-success";
          return <span className={`field-badge ${cls}`}>Tier {t}</span>;
        },
      },
      { headerName: "Evacuation zone", field: "zone", flex: 1.5, minWidth: 180, filter: "agTextColumnFilter", cellClass: "text-ink-2" },
      {
        headerName: "Medical device",
        field: "hasMedicalDevice",
        flex: 0.8,
        minWidth: 120,
        filter: "agTextColumnFilter",
        cellRenderer: (p: any) => (p.value === "YES" ? <span className="text-danger">● Yes</span> : <span className="text-ink-3">No</span>),
      },
      {
        headerName: "In storm path",
        field: "status",
        flex: 0.9,
        minWidth: 130,
        filter: "agTextColumnFilter",
        cellRenderer: (p: any) =>
          p.value === "CONFIRMED" ? <span className="field-badge field-badge-warning">In path</span> : <span className="field-badge field-badge-neutral">Outside</span>,
      },
      { headerName: "Paid via", field: "recipientPath", flex: 0.8, minWidth: 110, filter: "agTextColumnFilter", cellClass: "text-paypal" },
      { headerName: "Grant", field: "amount", flex: 0.7, minWidth: 100, cellClass: "tabular font-semibold text-accent-strong" },
      { headerName: "Verification", field: "evidenceLevel", flex: 0.8, minWidth: 110, cellClass: "text-ink-2" },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);
  const onGridReady = useCallback((p: GridReadyEvent) => setGridApi(p.api), []);

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
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <SectionHeader icon={Users} tone="accent" title="Household relief roster" description="AG Grid · sort, filter, or let the AI do it" />
              <button onClick={() => runCommand("Reset all grid filters")} className="field-btn field-btn-subtle px-3 py-2 text-[12.5px]">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <div className="h-[460px] w-full">
              <AgGridReact
                ref={gridRef}
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                theme={landfallGridTheme}
                onGridReady={onGridReady}
                pagination
                paginationPageSize={10}
              />
            </div>
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
