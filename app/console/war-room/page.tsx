"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type GridState,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { AgCharts } from "ag-charts-react";
import {
  type AgChartOptions,
  ModuleRegistry as AgChartsModuleRegistry,
  AllCommunityModule as AgChartsAllCommunityModule,
} from "ag-charts-community";
import { interpretStudioQuery, type StudioAgentCommand } from "@/lib/ai/watch-officer/studio-bridge";
import { PasskeyApprovalModal } from "@/components/security/PasskeyApprovalModal";
import { landfallGridTheme, landfallChartTheme } from "@/styles/ag-studio-theme";
import { registerAgLicenses } from "@/lib/ag/license";
import { LandfallStudio } from "@/components/studio/LandfallStudio";
import { PageHeader, StatCard, SectionHeader, Chip, IconTile, type Tone } from "@/components/ui/primitives";
import { ProvenanceTag, PayPalStatusBadge, StageDots, EvidenceState, money, money2 } from "@/components/relief/parts";
import {
  buildReliefCases,
  summarizeCases,
  attentionQueue,
  STAGES,
  ACCESS_REASON_LABEL,
  type AccessReport,
  type ReliefCase,
} from "@/lib/relief/cases";
import { TREASURY, studioApprovalEvents, studioWebhookObservations } from "@/lib/studio/landfall-studio-data";
import {
  HazardIntelligenceWidget,
  ExposureDistributionWidget,
  TreasuryWaterfallWidget,
  ResponseFunnelWidget,
  PayoutHealthWidget,
  ReadinessMonitorWidget,
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
  KeyRound,
  Send,
  Landmark,
  HeartHandshake,
  CheckCheck,
  Clock,
  Users,
  Boxes,
  FileCheck2,
  RotateCcw,
  CornerDownLeft,
  Zap,
  Download,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule]);
registerAgLicenses();

type Tab = "OVERVIEW" | "GRID" | "STUDIO" | "WIDGETS" | "SETTLEMENT";
type GroupBy = "stage" | "status" | "none";

const GRID_STATE_KEY = "landfall.cases.grid.v1";

const STAGE_ICON = {
  APPROVED: ShieldCheck,
  SENT: Send,
  CREDITED: Landmark,
  CONFIRMED: HeartHandshake,
  CLOSED: CheckCheck,
} as const;
const STAGE_TONE: Record<string, Tone> = { APPROVED: "neutral", SENT: "neutral", CREDITED: "paypal", CONFIRMED: "accent", CLOSED: "accent" };

const GRID_PROMPTS = [
  "Show unclaimed payments",
  "Credited but not confirmed",
  "What needs a person",
  "Tier 1 medical device households",
  "Zone A",
  "Sort by priority tier",
  "Reset all grid filters",
];

interface CaseRow {
  caseRef: string;
  itemId: string;
  resident: string;
  zone: string;
  priorityTier: number;
  payoutStatus: string;
  stageLabel: string;
  amount: number;
  clock: string;
  evidenceText: string;
  evidencePct: number;
  nextAction: string;
  nextActionKey: string;
  needsPerson: "YES" | "NO";
  priorityScore: number;
  recipientPath: string;
  hasMedicalDevice: "YES" | "NO";
  _case: ReliefCase;
}

function toRow(c: ReliefCase): CaseRow {
  return {
    caseRef: c.caseRef,
    itemId: c.itemId,
    resident: c.resident,
    zone: c.zone,
    priorityTier: c.tier,
    payoutStatus: c.status,
    stageLabel: STAGES.find((s) => s.key === c.stage)?.label ?? c.stage,
    amount: c.amountUsd,
    clock: c.claimDaysLeft !== null ? `${c.claimDaysLeft}d left to claim` : c.status === "SUCCESS" ? "—" : `${Math.round(c.ageHours)}h open`,
    evidenceText: `${c.evidenceCount.present}/${c.evidenceCount.applicable}`,
    evidencePct: Math.round((c.evidenceCount.present / Math.max(c.evidenceCount.applicable, 1)) * 100),
    nextAction: c.nextAction.plain,
    nextActionKey: c.nextAction.safeAction,
    needsPerson: c.nextAction.needsPerson && c.openIssue ? "YES" : "NO",
    priorityScore: c.priority.score,
    recipientPath: c.wallet === "VENMO" ? "Venmo" : "PayPal",
    hasMedicalDevice: c.tier === 1 ? "YES" : "NO",
    _case: c,
  };
}

function loadGridState(): GridState | undefined {
  try {
    const raw = window.localStorage.getItem(GRID_STATE_KEY);
    return raw ? (JSON.parse(raw) as GridState) : undefined;
  } catch {
    return undefined;
  }
}

export default function CommandCenterPage() {
  const gridRef = useRef<AgGridReact>(null);
  const pendingOpen = useRef<string | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("stage");
  const [quickFilter, setQuickFilter] = useState("");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState(
    "Ask in plain English — for example “show unclaimed payments”. I can filter and sort this grid; I can’t change amounts or pay anyone."
  );
  const [reports, setReports] = useState<AccessReport[]>([]);

  // Resident-reported access reports (from the resident portal) join the cases.
  useEffect(() => {
    let alive = true;
    fetch("/api/recipients/access-report")
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((j) => alive && setReports(j.reports ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const cases = useMemo(() => buildReliefCases(reports), [reports]);
  const sum = useMemo(() => summarizeCases(cases), [cases]);
  const queue = useMemo(() => attentionQueue(cases, 3), [cases]);
  const rowData = useMemo(() => cases.map(toRow), [cases]);
  const initialState = useMemo(() => (typeof window === "undefined" ? undefined : loadGridState()), []);

  const activity = useMemo(() => {
    const ev = [
      { t: "2024-10-09T18:05:00Z", icon: CloudLightning, tone: "storm" as Tone, text: "NWS Hurricane Warning TBW:HU.W:0009 issued" },
      ...studioApprovalEvents.map((a) => ({ t: a.approved_at, icon: KeyRound, tone: "amber" as Tone, text: `${a.approver_role} signed the plan (demo passkey)` })),
      ...studioWebhookObservations.map((w) => ({
        t: w.received_time,
        icon: Send,
        tone: "paypal" as Tone,
        text: `PayPal ${w.event_type.replace("PAYMENT.PAYOUTS-ITEM.", "")} · ${w.item_id}`,
      })),
    ];
    return ev.sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5);
  }, []);

  /* ── Grid configuration ─────────────────────────────────── */

  const detailCellRendererParams = useMemo(
    () => ({
      detailGridOptions: {
        columnDefs: [
          { field: "title", headerName: "Evidence", flex: 1.1, minWidth: 150, cellClass: "font-semibold text-ink" },
          { field: "ref", headerName: "Reference", flex: 1.3, minWidth: 170, cellClass: "font-mono text-[12px] text-paypal" },
          { field: "provenance", headerName: "Source", width: 150, cellRenderer: (p: any) => <ProvenanceTag provenance={p.value} /> },
          { field: "state", headerName: "State", width: 130, cellRenderer: (p: any) => <EvidenceState state={p.value} /> },
          { field: "detail", headerName: "What we know", flex: 3, minWidth: 320, cellClass: "text-ink-2", tooltipField: "detail" },
        ] as ColDef[],
        defaultColDef: { sortable: false, resizable: true },
        rowHeight: 44,
        headerHeight: 38,
        theme: landfallGridTheme,
      },
      getDetailRowData: (params: any) => params.successCallback((params.data as CaseRow)._case.evidence),
    }),
    []
  );

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Household",
        field: "resident",
        flex: 1.5,
        minWidth: 210,
        cellRenderer: "agGroupCellRenderer",
        filter: "agTextColumnFilter",
        cellClass: "font-medium text-ink",
      },
      { headerName: "Item", field: "itemId", width: 150, filter: "agTextColumnFilter", cellClass: "font-mono text-[12px] text-ink-3" },
      {
        headerName: "Priority",
        field: "priorityTier",
        width: 125,
        filter: "agNumberColumnFilter",
        enableRowGroup: true,
        cellRenderer: (p: any) => {
          if (!p.value) return null;
          const t = p.value as number;
          return <span className={`field-badge ${t === 1 ? "field-badge-critical" : t === 2 ? "field-badge-warning" : "field-badge-success"}`}>Tier {t}</span>;
        },
      },
      {
        headerName: "PayPal status",
        field: "payoutStatus",
        width: 170,
        filter: "agTextColumnFilter",
        enableRowGroup: true,
        rowGroup: groupBy === "status",
        hide: groupBy === "status",
        cellRenderer: (p: any) => (p.value ? <PayPalStatusBadge status={p.value} /> : null),
      },
      {
        headerName: "Delivery stage",
        field: "stageLabel",
        width: 210,
        filter: "agTextColumnFilter",
        enableRowGroup: true,
        rowGroup: groupBy === "stage",
        hide: groupBy === "stage",
        cellRenderer: (p: any) => (p.data ? <StageDots c={p.data._case} /> : p.value),
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 135,
        aggFunc: "sum",
        cellClass: "tabular font-semibold text-accent-strong",
        valueFormatter: (p: any) => (typeof p.value === "number" ? money2(p.value) : p.value ?? ""),
      },
      { headerName: "Clock", field: "clock", width: 160, cellClass: "text-ink-2" },
      {
        headerName: "Evidence",
        field: "evidenceText",
        width: 130,
        cellRenderer: (p: any) =>
          p.data ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                <span className={`block h-full rounded-full ${p.data.evidencePct === 100 ? "bg-accent" : "bg-amber"}`} style={{ width: `${p.data.evidencePct}%` }} />
              </span>
              <span className="tabular text-[12px] text-ink-2">{p.value}</span>
            </span>
          ) : null,
      },
      {
        headerName: "Next permitted action",
        field: "nextAction",
        flex: 2.4,
        minWidth: 300,
        filter: "agTextColumnFilter",
        cellClass: "text-ink",
        tooltipField: "nextAction",
      },
      { headerName: "Score", field: "priorityScore", width: 100, filter: "agNumberColumnFilter", initialSort: "desc", cellClass: "tabular text-ink-2" },
      { headerName: "Zone", field: "zone", flex: 1.3, minWidth: 190, filter: "agTextColumnFilter", enableRowGroup: true, cellClass: "text-ink-2" },
      { headerName: "Paid via", field: "recipientPath", width: 110, filter: "agTextColumnFilter", enableRowGroup: true, cellClass: "text-paypal" },
      { headerName: "Medical device", field: "hasMedicalDevice", hide: true, filter: "agTextColumnFilter" },
      { headerName: "Needs a person", field: "needsPerson", hide: true, filter: "agTextColumnFilter" },
      { headerName: "Action key", field: "nextActionKey", hide: true, filter: "agTextColumnFilter" },
    ],
    [groupBy]
  );

  const autoGroupColumnDef = useMemo<ColDef>(
    () => ({ headerName: groupBy === "stage" ? "Delivery stage" : "PayPal status", minWidth: 260, flex: 1.4, cellRendererParams: { suppressCount: false } }),
    [groupBy]
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true, filter: true }), []);

  const onGridReady = useCallback((p: GridReadyEvent) => setGridApi(p.api), []);

  const onFirstDataRendered = useCallback(
    (p: { api: GridApi }) => {
      const requested = pendingOpen.current;
      const ref = requested ?? queue[0]?.caseRef;
      pendingOpen.current = null;
      // Expand once the grid has laid out. Only scroll when the user explicitly asked to open a case:
      // scrolling before the detail height is applied mis-positions the evidence panel.
      window.setTimeout(() => {
        const node = ref ? p.api.getRowNode(ref) : null;
        if (!node) return;
        node.setExpanded(true);
        if (requested) window.setTimeout(() => node.rowIndex != null && p.api.ensureIndexVisible(node.rowIndex, "top"), 350);
      }, 400);
    },
    [queue]
  );

  const persistState = useCallback((state: GridState) => {
    try {
      const { filter, columnOrder, columnVisibility, columnSizing } = state;
      window.localStorage.setItem(GRID_STATE_KEY, JSON.stringify({ filter, columnOrder, columnVisibility, columnSizing }));
    } catch {
      /* storage unavailable */
    }
  }, []);

  /** Expand/collapse the group rows only — case evidence panels (master/detail) stay as the user left them. */
  const setGroupsExpanded = (open: boolean) => {
    gridApi?.forEachNode((n) => {
      if (n.group) n.setExpanded(open);
    });
  };

  const resetGrid = () => {
    setQuickFilter("");
    gridApi?.setFilterModel(null);
    gridApi?.resetColumnState();
    gridApi?.applyColumnState({ defaultState: { sort: null }, state: [{ colId: "priorityScore", sort: "desc" }] });
    try {
      window.localStorage.removeItem(GRID_STATE_KEY);
    } catch {
      /* ignore */
    }
  };

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
      }
    }
    setReply(command.agentResponse);
    setQuery("");
  };

  const openCase = (c: ReliefCase) => {
    pendingOpen.current = c.caseRef;
    setTab("GRID");
  };

  /* ── Money chart (derived: segments sum to funds received) ── */

  const chartOptions = useMemo<AgChartOptions>(
    () =>
      ({
        theme: landfallChartTheme,
        data: [
          { bucket: "Ready to allocate", amount: TREASURY.allocatable },
          { bucket: "Protected reserve", amount: TREASURY.reserve },
          { bucket: "Sent to PayPal", amount: TREASURY.paidOut + TREASURY.inFlight },
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
              { text: money(TREASURY.total), fontSize: 26, fontWeight: 650, color: "#EEF2F8" },
              { text: "funds received", fontSize: 12, color: "#6E7A91", spacing: 6 },
            ],
            tooltip: { renderer: (p: any) => ({ heading: p.datum.bucket, data: [{ label: "Amount", value: money(p.datum.amount) }] }) },
          },
        ],
        legend: { position: "bottom", item: { label: { color: "#A3AEC2", fontSize: 12 }, marker: { shape: "circle" } } },
        padding: { top: 4, bottom: 4 },
      }) as any,
    []
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "GRID", label: "Cases · AG Grid", icon: Users },
    { id: "STUDIO", label: "Relief Studio · AG Studio", icon: BarChart3 },
    { id: "WIDGETS", label: "All widgets", icon: Boxes },
    { id: "SETTLEMENT", label: "Settlement proof", icon: FileCheck2 },
  ];

  const statusTone = (s: string): Tone => (s === "UNCLAIMED" || s === "RETURNED" ? "amber" : s === "SUCCESS" ? "paypal" : s === "PENDING" ? "neutral" : "danger");

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Command Center · Hurricane Milton"
        icon={LayoutDashboard}
        tone="accent"
        title="12 hours to landfall."
        accent="Here’s what needs you."
        description={`${sum.households} households approved · ${money(sum.approvedUsd)} sent to PayPal · ${sum.creditedCount} credited by PayPal, ${sum.confirmedCount} confirmed by residents · ${sum.needPersonCount} need a person.`}
        meta={
          <>
            <Chip tone="storm" live>
              Replay · Oct 2024
            </Chip>
            <Chip tone="neutral">Synthetic scenario</Chip>
          </>
        }
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

      {/* Delivery tracker — PayPal credit is not the finish line */}
      <section className="glass p-3" data-reveal aria-label="Relief delivery progress">
        <ol className="grid grid-cols-1 gap-1 sm:grid-cols-5">
          {sum.stageCounts.map((s, i) => {
            const Icon = STAGE_ICON[s.key as keyof typeof STAGE_ICON];
            const gap = s.key === "CONFIRMED" && sum.creditedUnconfirmedCount > 0;
            return (
              <li key={s.key} className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 ${gap ? "bg-amber/[0.07]" : ""}`}>
                <IconTile icon={Icon} tone={gap ? "amber" : STAGE_TONE[s.key]} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 text-[13.5px] font-semibold text-ink">
                    {s.label}
                    <span className="tabular text-[12px] font-normal text-ink-3">
                      {s.count}/{sum.households}
                    </span>
                  </div>
                  <div className={`truncate text-[12px] ${gap ? "text-amber" : "text-ink-3"}`}>
                    {gap ? `${sum.creditedUnconfirmedCount} credited, not confirmed` : s.help}
                  </div>
                </div>
                {i < sum.stageCounts.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-ink-3/50 sm:block" />}
              </li>
            );
          })}
        </ol>
        {sum.creditedUnconfirmedCount > 0 && (
          <p className="px-3.5 pb-2 pt-1 text-[12.5px] text-ink-2">
            PayPal <span className="font-mono text-paypal">SUCCESS</span> means credited to the account — not proof the household can use the money. Landfall keeps the two facts apart.
          </p>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash in PayPal account" value={TREASURY.available} prefix="$" tone="paypal" icon={Wallet} hint="Replay data · includes the protected reserve" />
        <StatCard label="Protected reserve" value={TREASURY.reserve} prefix="$" tone="amber" icon={Lock} hint={`Policy floor ${money(TREASURY.requiredReserve)} (${TREASURY.policyFloorPct}%) · can’t be spent`} />
        <StatCard label="Ready to allocate" value={TREASURY.allocatable} prefix="$" tone="accent" icon={HandCoins} hint="Cash in account minus the reserve" />
        <StatCard label="Need a person" value={sum.needPersonCount} tone="danger" icon={AlertTriangle} hint={`${money(sum.needPersonUsd)} across cases needing follow-up`} />
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
          <section className="glass p-6 xl:col-span-7" data-reveal>
            <SectionHeader
              icon={AlertTriangle}
              tone="danger"
              title="Needs your attention"
              description="Ranked by explainable rules — every point has a stated reason"
              right={
                <Link href="/console/watch-officer" className="field-btn field-btn-secondary px-3.5 py-2 text-[13px]">
                  <Sparkles className="h-4 w-4 text-ai" /> Ask the AI why
                </Link>
              }
            />
            {reports.length > 0 && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-3.5" data-testid="resident-reports-banner">
                <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
                <div className="text-[13px] text-ink">
                  <span className="font-semibold">{reports.length} resident report{reports.length === 1 ? "" : "s"} received</span>{" "}
                  <ProvenanceTag provenance="RECIPIENT_REPORTED" className="ml-1" />
                  <div className="mt-1 text-ink-2">
                    {reports
                      .slice(-3)
                      .reverse()
                      .map((r) => (r.kind === "RECEIVED" ? "“I received it”" : `“Can’t access: ${ACCESS_REASON_LABEL[r.reason ?? "OTHER"].toLowerCase()}”`))
                      .join(" · ")}
                    . Self-reported — shown as such, never as PayPal confirmation.
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-5 space-y-3">
              {queue.map((c) => (
                <li key={c.caseRef} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.035]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[15px] font-semibold text-ink">{c.resident}</span>
                    <span className="text-[12.5px] text-ink-3">{c.zone}</span>
                    <Chip tone={statusTone(c.status)}>{c.barrier ? "Resident reported a problem" : c.status === "SUCCESS" ? "Credited · unconfirmed" : c.status}</Chip>
                    <span className="ml-auto text-[15px] font-semibold tabular text-ink">{money2(c.amountUsd)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.priority.reasons.slice(0, 3).map((r) => (
                      <span key={r.label} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-2">
                        {r.label} <span className="font-mono text-ink-3">+{r.points}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 text-[13px] text-accent-strong">
                      <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-180" /> {c.nextAction.plain}
                    </p>
                    <button onClick={() => openCase(c)} className="field-btn field-btn-secondary shrink-0 px-3 py-2 text-[12.5px]">
                      Open case evidence <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[10.5px] text-ink-3">{c.caseRef}</div>
                </li>
              ))}
              {queue.length === 0 && <li className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 text-[13.5px] text-accent-strong">Nothing needs a person right now.</li>}
            </ul>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-ink-3">
                <Sparkles className="h-3.5 w-3.5" /> Plain-English summary · computed from the case data
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                {sum.needPersonCount} of {sum.households} cases need a person, and none of them should trigger a second payout.{" "}
                <span className="tabular text-accent-strong">{money(TREASURY.allocatable)}</span> is allocatable and the{" "}
                <span className="tabular text-amber">{money(TREASURY.reserve)}</span> reserve is untouched. PayPal has credited{" "}
                <span className="tabular text-paypal">{money(sum.creditedUsd)}</span>; {sum.confirmedCount} of {sum.creditedCount} credited payments are confirmed by the household.
              </p>
              <p className="mt-2 text-[12px] text-ink-3">The AI Watch Officer page runs the live read-only model against this same data.</p>
            </div>
          </section>

          <div className="space-y-6 xl:col-span-5">
            <section className="glass p-6" data-reveal>
              <SectionHeader icon={Wallet} tone="paypal" title="Where the money sits" right={<Chip tone="accent">Ledger balanced</Chip>} />
              <div className="mt-2 h-[300px]">
                <AgCharts options={chartOptions} />
              </div>
            </section>

            <section className="glass p-6" data-reveal>
              <SectionHeader icon={Clock} title="Latest activity" description="Replay clock · UTC" />
              <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/[0.07]">
                {activity.map((a) => (
                  <li key={a.t + a.text} className="relative flex items-center gap-3">
                    <IconTile icon={a.icon} tone={a.tone} size="sm" className="relative z-10 !bg-surface" />
                    <span className="flex-1 text-[13.5px] text-ink-2">{a.text}</span>
                    <span className="font-mono text-[11px] text-ink-3">{a.t.slice(11, 16)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 space-y-3">
                <div>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-ink-2">Credited by PayPal</span>
                    <span className="tabular text-ink">
                      {sum.creditedCount} of {sum.households}
                    </span>
                  </div>
                  <div className="meter mt-2">
                    <span style={{ width: `${(sum.creditedCount / sum.households) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-ink-2">Confirmed by the household</span>
                    <span className="tabular text-ink">
                      {sum.confirmedCount} of {sum.households}
                    </span>
                  </div>
                  <div className="meter mt-2">
                    <span style={{ width: `${(sum.confirmedCount / sum.households) * 100}%` }} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Link href="/console/studio" className="glass card-hover group flex flex-col gap-4 p-6 sm:flex-row sm:items-center xl:col-span-12" data-reveal>
            <IconTile icon={BarChart3} tone="paypal" size="lg" />
            <div className="flex-1">
              <div className="text-[16px] font-semibold text-ink">Explore this response in Analytics Studio</div>
              <div className="text-[13.5px] text-ink-3">AG Studio workspace · custom widgets · cross-filters · ask the Studio agent in plain English</div>
            </div>
            <span className="field-btn field-btn-secondary">
              Open Studio <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      )}

      {tab === "GRID" && (
        <section className="glass overflow-hidden animate-field-fade">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <SectionHeader icon={Users} tone="accent" title="Relief delivery cases" description="AG Grid Enterprise · group, filter, expand a case to see its evidence" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-[12px]" role="group" aria-label="Group cases by">
                {(
                  [
                    ["stage", "By stage"],
                    ["status", "By PayPal status"],
                    ["none", "Flat"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    data-testid={`group-${k}`}
                    onClick={() => {
                      gridApi?.forEachNode((n) => n.master && n.setExpanded(false));
                      setGroupBy(k);
                    }}
                    aria-pressed={groupBy === k}
                    className={`rounded-lg px-2.5 py-1.5 transition-colors ${groupBy === k ? "bg-white/10 text-ink" : "text-ink-3 hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => setGroupsExpanded(true)} className="field-btn field-btn-subtle px-2 py-1.5 text-[12px]" title="Expand all groups">
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setGroupsExpanded(false)} className="field-btn field-btn-subtle px-2 py-1.5 text-[12px]" title="Collapse all groups">
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </button>
              <input
                type="text"
                placeholder="Quick search…"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                className="field-input h-8 w-36 text-[12px]"
                aria-label="Quick search cases"
              />
              <button onClick={() => gridApi?.exportDataAsCsv({ fileName: "landfall_relief_cases.csv" })} className="field-btn field-btn-subtle px-2.5 py-1.5 text-[12px]">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button onClick={() => gridApi?.exportDataAsExcel({ fileName: "landfall_relief_cases.xlsx" })} className="field-btn field-btn-subtle px-2.5 py-1.5 text-[12px]">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
              <button onClick={resetGrid} className="field-btn field-btn-subtle px-2.5 py-1.5 text-[12px]">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>

          {/* Ask the grid — plain-English filters, read-only */}
          <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-ai/[0.03] px-5 py-3.5 lg:flex-row lg:items-center">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runCommand(query);
              }}
              className="flex flex-1 items-center gap-2"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-ai" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask the grid: “credited but not confirmed”, “Zone A”…" className="field-input h-9 text-[13px]" aria-label="Ask the grid" />
              <button type="submit" className="field-btn field-btn-primary h-9 px-3" aria-label="Send">
                <Zap className="h-4 w-4" />
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {GRID_PROMPTS.slice(0, 4).map((p) => (
                <button key={p} onClick={() => runCommand(p)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-ink-2 transition-colors hover:border-ai/40 hover:text-ink">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <p className="border-b border-white/[0.06] px-5 py-2.5 text-[12.5px] text-ink-2" data-testid="grid-agent-reply">
            <span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider text-ai">Read-only</span>
            {reply}
          </p>

          <div className="h-[560px] w-full">
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              autoGroupColumnDef={groupBy === "none" ? undefined : autoGroupColumnDef}
              groupDefaultExpanded={groupBy === "none" ? 0 : 1}
              theme={landfallGridTheme}
              getRowId={(p) => p.data.caseRef}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              masterDetail
              detailCellRendererParams={detailCellRendererParams}
              detailRowHeight={410}
              suppressAggFuncInHeader
              quickFilterText={quickFilter}
              grandTotalRow="bottom"
              cellSelection
              sideBar={{ toolPanels: ["columns", "filters"] }}
              statusBar={{
                statusPanels: [
                  { statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" },
                  { statusPanel: "agAggregationComponent", align: "right" },
                ],
              }}
              initialState={initialState}
              onStateUpdated={(e) => persistState(e.api.getState())}
              onGridReady={onGridReady}
              onFirstDataRendered={onFirstDataRendered}
            />
          </div>
        </section>
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
          planHash={studioApprovalEvents[0].plan_hash}
          onClose={() => setPasskeyOpen(false)}
          onApproved={() => setPasskeyOpen(false)}
          planSummary={{
            title: "Tranche 1 · Hurricane Milton relief grants",
            totalAmountFormatted: `${money2(sum.approvedUsd)} USD`,
            householdsCount: sum.households,
            tranche: 1,
          }}
        />
      )}
    </div>
  );
}
