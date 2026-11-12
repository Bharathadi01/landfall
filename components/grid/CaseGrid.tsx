"use client";

/**
 * CaseGrid — the centre of Landfall. Every household's payout, PayPal status, delivery stage and evidence,
 * in an AG Grid Enterprise table that talks to the map beside it:
 *   select a case → the globe flies to its zone;   click a cluster on the globe → the grid filters to that zone.
 *
 * AG features used: row grouping (drag-to-group panel), master/detail evidence, set + floating filters, pinned column,
 * sparkline column, integrated charts (range → chart), Find, custom context menu, custom tooltip, custom status-bar panel,
 * cell-change flashing driven by transactions, CSV/Excel export, persisted grid state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, DefaultMenuItem, GetContextMenuItemsParams, GridApi, GridReadyEvent, GridState, MenuItemDef } from "ag-grid-community";
import { registerAg } from "@/lib/ag/register";
import { landfallGridTheme, chartTheme, LANDFALL } from "@/styles/ag-studio-theme";
import { interpretStudioQuery, type StudioAgentCommand } from "@/lib/ai/watch-officer/studio-bridge";
import { STAGES, type ReliefCase, type StageKey } from "@/lib/relief/cases";
import { studioWebhookObservations } from "@/lib/studio/landfall-studio-data";
import { money, money2 } from "@/components/relief/parts";
import { I } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StormDesk } from "@/components/sentinel/desk/StormDesk";
import { COMMUNITY_FUNDS_GEO } from "@/lib/sentinel/weather-client";
import type { NormalizedAlert } from "@/lib/sentinel/types";
import type { ClusterExposureSummary, ExposureCluster } from "@/lib/sentinel/clusters";
import { TierCell, StatusCell, StageCell, EvidenceCell, ProvenanceCell, EvidenceStateCell, CaseTooltip, NoCasesOverlay } from "./renderers";
import { StatusSummaryPanel } from "./StatusSummaryPanel";

registerAg();

type GroupBy = "stage" | "status" | "none";

const GRID_STATE_KEY = "landfall.cases.grid.v2";

const GRID_PROMPTS = [
  "Show unclaimed payments",
  "Credited but not confirmed",
  "What needs a person",
  "Tier 1 medical device households",
  "Zone A",
  "Sort by priority tier",
  "Reset all grid filters",
];

export interface CaseRow {
  caseRef: string;
  itemId: string;
  resident: string;
  zone: string;
  priorityTier: number;
  payoutStatus: string;
  stageKey: StageKey;
  stagesReached: Record<StageKey, boolean>;
  stageLabel: string;
  trail: number[];
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

export function toRow(c: ReliefCase): CaseRow {
  return {
    caseRef: c.caseRef,
    itemId: c.itemId,
    resident: c.resident,
    zone: c.zone,
    priorityTier: c.tier,
    payoutStatus: c.status,
    stageKey: c.stage,
    stagesReached: c.stagesReached,
    stageLabel: STAGES.find((s) => s.key === c.stage)?.label ?? c.stage,
    trail: STAGES.map((s) => (c.stagesReached[s.key as StageKey] ? 1 : 0.22)),
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

const EVENT_STATUS: Record<string, string> = {
  SUCCEEDED: "SUCCESS", UNCLAIMED: "UNCLAIMED", HELD: "ONHOLD", BLOCKED: "BLOCKED", FAILED: "FAILED", RETURNED: "RETURNED", REFUNDED: "REFUNDED",
};

const zoneKey = (z: string) => z.match(/^Zone [A-Z]/)?.[0] ?? z;

function loadGridState(): GridState | undefined {
  try {
    const raw = window.localStorage.getItem(GRID_STATE_KEY);
    return raw ? (JSON.parse(raw) as GridState) : undefined;
  } catch {
    return undefined;
  }
}

export function CaseGrid({ cases, queue, openRef }: { cases: ReliefCase[]; queue: ReliefCase[]; openRef: React.MutableRefObject<string | null> }) {
  const [api, setApi] = useState<GridApi | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("stage");
  const [find, setFind] = useState("");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; key: string } | null>(null);
  const [feed, setFeed] = useState<{ state: "idle" | "running" | "done"; last?: string }>({ state: "idle" });
  const [showChart, setShowChart] = useState(false);
  const [weather, setWeather] = useState<{ alerts: NormalizedAlert[]; clusters: ClusterExposureSummary | null }>({ alerts: [], clusters: null });
  const timer = useRef<number | null>(null);
  const chartBox = useRef<HTMLDivElement>(null);
  const chartHandle = useRef<{ destroyChart: () => void } | null>(null);

  const rowData = useMemo(() => cases.map(toRow), [cases]);
  const byItem = useMemo(() => new Map(rowData.map((r) => [r.itemId, r])), [rowData]);
  const initialState = useMemo(() => (typeof window === "undefined" ? undefined : loadGridState()), []);
  const fund = COMMUNITY_FUNDS_GEO[0];

  // Hazard geometry + household clusters for the map beside the grid (Milton replay scenario)
  useEffect(() => {
    let alive = true;
    fetch(`/api/sentinel/live?fundId=${fund.id}&mode=HISTORICAL_REPLAY`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setWeather({ alerts: j.weather?.nwsAlerts ?? [], clusters: j.clusters ?? null }))
      .catch(() => undefined);
    return () => { alive = false; };
  }, [fund.id]);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const clusterForZone = useCallback(
    (zone: string) => weather.clusters?.clusters.find((c) => c.zone.startsWith(zoneKey(zone))) ?? null,
    [weather.clusters]
  );

  const focusRow = useCallback(
    (row: CaseRow) => {
      const c = clusterForZone(row.zone);
      if (c) setFocus({ lng: c.centroid.lng, lat: c.centroid.lat, key: row.caseRef });
    },
    [clusterForZone]
  );

  const filterToZone = useCallback(
    (key: string | null) => {
      if (!api) return;
      if (!key) {
        api.setColumnFilterModel("zone", null).then(() => api.onFilterChanged());
        setZoneFilter(null);
        return;
      }
      const values = [...new Set(rowData.map((r) => r.zone).filter((z) => z.startsWith(key)))];
      api.setColumnFilterModel("zone", { filterType: "set", values }).then(() => api.onFilterChanged());
      setZoneFilter(key);
    },
    [api, rowData]
  );

  /* ── columns ───────────────────────────────────────────── */

  const detailCellRendererParams = useMemo(
    () => ({
      detailGridOptions: {
        columnDefs: [
          { field: "title", headerName: "Evidence", flex: 1.1, minWidth: 150, cellClass: "font-semibold text-ink" },
          { field: "ref", headerName: "Reference", flex: 1.3, minWidth: 170, cellClass: "font-code text-[12px] text-ink-2", tooltipField: "ref" },
          { field: "provenance", headerName: "Source", width: 160, cellRenderer: ProvenanceCell },
          { field: "state", headerName: "State", width: 140, cellRenderer: EvidenceStateCell },
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
        pinned: "left",
        flex: 1.4,
        minWidth: 230,
        cellRenderer: "agGroupCellRenderer",
        filter: "agTextColumnFilter",
        cellClass: "font-semibold text-ink",
      },
      {
        headerName: "PayPal status",
        field: "payoutStatus",
        width: 170,
        filter: "agSetColumnFilter",
        enableRowGroup: true,
        rowGroup: groupBy === "status",
        hide: groupBy === "status",
        enableCellChangeFlash: true,
        cellRenderer: StatusCell,
      },
      {
        headerName: "Delivery stage",
        field: "stageLabel",
        width: 215,
        filter: "agSetColumnFilter",
        enableRowGroup: true,
        rowGroup: groupBy === "stage",
        hide: groupBy === "stage",
        enableCellChangeFlash: true,
        cellRenderer: StageCell,
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 140,
        aggFunc: "sum",
        enableValue: true,
        filter: "agNumberColumnFilter",
        enableCellChangeFlash: true,
        cellClass: "tabular font-semibold text-ink",
        valueFormatter: (p: any) => (typeof p.value === "number" ? money2(p.value) : p.value ?? ""),
      },
      {
        headerName: "Next permitted action",
        field: "nextAction",
        flex: 2.4,
        minWidth: 300,
        filter: "agTextColumnFilter",
        cellClass: "text-ink",
        tooltipValueGetter: (p: any) => p.data?._case?.nextAction.plain,
        tooltipComponent: CaseTooltip,
      },
      { headerName: "Priority", field: "priorityTier", width: 130, filter: "agSetColumnFilter", enableRowGroup: true, cellRenderer: TierCell },
      {
        headerName: "Trail",
        field: "trail",
        width: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: "agSparklineCellRenderer",
        cellRendererParams: {
          sparklineOptions: {
            type: "bar",
            direction: "vertical",
            padding: { top: 15, bottom: 15, left: 6, right: 6 },
            axis: { strokeWidth: 0 },
            itemStyler: (p: { yValue: number }) => ({ fill: p.yValue >= 1 ? LANDFALL.delivered : "rgba(24,34,30,0.14)" }),
            tooltip: { enabled: false },
          },
        },
        headerTooltip: "Approved → Sent → Credited → Confirmed → Closed",
      },
      { headerName: "Clock", field: "clock", width: 160, cellClass: "text-ink-2" },
      { headerName: "Evidence", field: "evidenceText", width: 140, cellRenderer: EvidenceCell },
      { headerName: "Score", field: "priorityScore", width: 100, filter: "agNumberColumnFilter", initialSort: "desc", cellClass: "tabular text-ink-2" },
      { headerName: "Zone", field: "zone", flex: 1.3, minWidth: 190, filter: "agSetColumnFilter", enableRowGroup: true, cellClass: "text-ink-2" },
      { headerName: "Paid via", field: "recipientPath", width: 120, filter: "agSetColumnFilter", enableRowGroup: true, cellClass: "text-ink-2" },
      { headerName: "PayPal item", field: "itemId", width: 170, filter: "agTextColumnFilter", cellClass: "font-code text-[12px] text-ink-3" },
      {
        headerName: "",
        colId: "open",
        field: "caseRef",
        pinned: "right",
        width: 128,
        sortable: false,
        filter: false,
        floatingFilter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (p: { value?: string }) =>
          p.value ? (
            <a href={`/console/cases/${encodeURIComponent(p.value)}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline decoration-ink-3/60 underline-offset-[3px] hover:decoration-accent" aria-label="Open this payment: evidence, AI investigation and recovery">
              Open case
            </a>
          ) : null,
      },
      { headerName: "Medical device", field: "hasMedicalDevice", hide: true, filter: "agTextColumnFilter" },
      { headerName: "Needs a person", field: "needsPerson", hide: true, filter: "agTextColumnFilter" },
      { headerName: "Action key", field: "nextActionKey", hide: true, filter: "agTextColumnFilter" },
    ],
    [groupBy]
  );

  // Full-width group rows ("Credited by PayPal · 1"), so a grouped grid reads like a list with headings, not a second column.
  const groupRowRendererParams = useMemo(() => ({ suppressCount: false }), []);

  // No floating-filter row: filters live in each column menu and the Filters side panel, so the header stays quiet.
  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true, filter: true, floatingFilter: false, enableRowGroup: false }), []);

  const customChartThemes = useMemo(() => ({ landfall: chartTheme() as any }), []);

  /* ── grid lifecycle ────────────────────────────────────── */

  const onGridReady = useCallback((p: GridReadyEvent) => setApi(p.api), []);

  const onFirstDataRendered = useCallback(
    (p: { api: GridApi }) => {
      const requested = openRef.current;
      const ref = requested ?? queue[0]?.caseRef;
      openRef.current = null;
      window.setTimeout(() => {
        const node = ref ? p.api.getRowNode(ref) : null;
        if (!node) return;
        node.setExpanded(true);
        if (requested) window.setTimeout(() => node.rowIndex != null && p.api.ensureIndexVisible(node.rowIndex, "top"), 350);
      }, 400);
    },
    [queue, openRef]
  );

  const persistState = useCallback((state: GridState) => {
    try {
      const { filter, columnOrder, columnVisibility, columnSizing } = state;
      window.localStorage.setItem(GRID_STATE_KEY, JSON.stringify({ filter, columnOrder, columnVisibility, columnSizing }));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const onSelectionChanged = useCallback(() => {
    const row = api?.getSelectedRows()[0] as CaseRow | undefined;
    if (row) focusRow(row);
  }, [api, focusRow]);

  const setGroupsExpanded = (open: boolean) => api?.forEachNode((n) => { if (n.group) n.setExpanded(open); });

  const resetGrid = () => {
    setFind("");
    setZoneFilter(null);
    api?.setFilterModel(null);
    api?.resetColumnState();
    api?.applyColumnState({ defaultState: { sort: null }, state: [{ colId: "priorityScore", sort: "desc" }] });
    try { window.localStorage.removeItem(GRID_STATE_KEY); } catch { /* ignore */ }
  };

  const runCommand = (text: string) => {
    const userText = text.trim();
    if (!userText) return;
    const command: StudioAgentCommand = interpretStudioQuery(userText, cases);
    // This box is a keyword matcher, not a model. Say so when part of the request was not understood.
    const unsupported = /group by|\babove\b|\bover\b|more than|greater than|\bunder\b|below|less than|\$\s?\d/i.test(userText) && command.type !== "INFO";
    if (api) {
      if (command.type === "RESET_FILTERS") {
        api.setFilterModel(null);
        api.applyColumnState({ defaultState: { sort: null } });
        setZoneFilter(null);
      } else if (command.type === "FILTER_GRID" && command.filters) {
        const model: Record<string, any> = {};
        for (const f of command.filters) {
          if (f.operator === "equals") model[f.column] = { filterType: typeof f.value === "number" ? "number" : "text", type: "equals", filter: f.value };
          else if (f.operator === "contains") model[f.column] = { filterType: "text", type: "contains", filter: f.value };
        }
        // set-filter columns take a value list
        for (const col of ["payoutStatus", "zone", "stageLabel", "recipientPath"]) {
          const m = model[col];
          if (m) model[col] = { filterType: "set", values: [...new Set(rowData.map((r) => String((r as any)[col])).filter((v) => (m.type === "equals" ? v === String(m.filter) : v.toLowerCase().includes(String(m.filter).toLowerCase())))) ] };
        }
        api.setFilterModel(model);
      } else if (command.type === "SORT_GRID" && command.sortColumn) {
        api.applyColumnState({ state: [{ colId: command.sortColumn, sort: command.sortDirection || "asc" }], defaultState: { sort: null } });
      }
    }
    setReply(unsupported ? `${command.agentResponse} (This box is a keyword matcher, not an AI model: it applied the part it understands. Grouping and amount thresholds are not understood here; use “By stage / By status” above or the column menus.)` : command.agentResponse);
    setQuery("");
  };

  /* ── context menu ──────────────────────────────────────── */

  const getContextMenuItems = useCallback(
    (p: GetContextMenuItemsParams): (DefaultMenuItem | MenuItemDef)[] => {
      const row = p.node?.data as CaseRow | undefined;
      const items: (DefaultMenuItem | MenuItemDef)[] = [];
      if (row && p.node) {
        items.push({ name: "Open evidence chain", action: () => p.node!.setExpanded(true) });
        items.push({ name: "Show household zone on the globe", action: () => focusRow(row) });
        items.push({ name: "Filter to this zone", action: () => filterToZone(zoneKey(row.zone)) });
        items.push({ name: "Copy PayPal item id", action: () => navigator.clipboard?.writeText(row.itemId) });
        items.push("separator");
      }
      items.push("copy", "chartRange", "separator", "export");
      return items;
    },
    [focusRow, filterToZone]
  );

  /* ── live feed demo: replay PayPal webhook events and let cells flash ── */

  const startFeed = () => {
    if (!api) return;
    if (timer.current) window.clearInterval(timer.current);
    const obs = [...studioWebhookObservations].sort((a, b) => a.received_time.localeCompare(b.received_time));
    const targets = obs.map((o) => byItem.get(o.item_id)).filter((r): r is CaseRow => !!r);
    api.applyTransaction({
      update: targets.map((r) => ({
        ...r,
        payoutStatus: "PENDING",
        stageKey: "SENT" as StageKey,
        stageLabel: "Sent to PayPal",
        stagesReached: { APPROVED: true, SENT: true, CREDITED: false, CONFIRMED: false, CLOSED: false },
        trail: [1, 1, 0.22, 0.22, 0.22],
      })),
    });
    let i = 0;
    setFeed({ state: "running" });
    timer.current = window.setInterval(() => {
      const o = obs[i];
      const final = byItem.get(o?.item_id);
      if (o && final) {
        const status = EVENT_STATUS[o.event_type.replace("PAYMENT.PAYOUTS-ITEM.", "")] ?? final.payoutStatus;
        api.applyTransaction({ update: [{ ...final, payoutStatus: status }] });
        setFeed({ state: "running", last: `${o.event_type.replace("PAYMENT.PAYOUTS-", "")} · ${o.item_id} · ${o.received_time.slice(11, 19)} UTC` });
      }
      i++;
      if (i >= obs.length) {
        if (timer.current) window.clearInterval(timer.current);
        setFeed((f) => ({ ...f, state: "done" }));
      }
    }, 1500);
  };

  /* ── integrated chart: $ by PayPal status ──────────────── */

  const chartIt = () => {
    if (!api || !chartBox.current) return;
    setShowChart(true);
    setGroupBy("none");
    window.setTimeout(() => {
      chartHandle.current?.destroyChart();
      chartHandle.current = api.createRangeChart({
        chartType: "column",
        cellRange: { rowStartIndex: 0, rowEndIndex: Math.max(0, api.getDisplayedRowCount() - 1), columns: ["payoutStatus", "amount"] },
        aggFunc: "sum",
        chartContainer: chartBox.current!,
        chartThemeName: "landfall",
        unlinkChart: true,
      }) ?? null;
    }, 450);
  };

  return (
    <section className="space-y-4" aria-label="Relief delivery cases">
      <div className="pane overflow-hidden">
        {/* 1 — view controls */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SegmentedTabs<GroupBy>
            ariaLabel="Group cases by"
            size="sm"
            value={groupBy}
            onChange={(k) => { api?.forEachNode((n) => n.master && n.setExpanded(false)); setGroupBy(k); }}
            tabs={[{ id: "stage", label: "By stage" }, { id: "status", label: "By status" }, { id: "none", label: "Flat" }]}
          />
          <Button variant="ghost" size="sm" iconOnly aria-label="Expand all groups" title="Expand all groups" onClick={() => setGroupsExpanded(true)}><I.expandAll className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="Collapse all groups" title="Collapse all groups" onClick={() => setGroupsExpanded(false)}><I.collapseAll className="h-4 w-4" /></Button>
          <label className="relative ml-1">
            <span className="sr-only">Find in grid</span>
            <I.search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in grid…" className="field-input has-icon h-9 !min-h-0 w-44 !py-0 text-[13.5px]" />
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button variant="glass" size="sm" leading={<I.chart className="h-4 w-4" />} onClick={chartIt}>Chart $ by status</Button>
            <Button variant={showMap ? "glass" : "ghost"} size="sm" leading={<I.globe className="h-4 w-4" />} onClick={() => setShowMap((v) => !v)} aria-pressed={showMap} data-testid="grid-map-toggle">{showMap ? "Hide map" : "Show map"}</Button>
            <Button variant="ghost" size="sm" leading={<I.download className="h-4 w-4" />} onClick={() => api?.exportDataAsExcel({ fileName: "landfall_relief_cases.xlsx" })} title="Export to Excel (CSV is in the right-click menu)">Export</Button>
            <Button variant="ghost" size="sm" leading={<I.retry className="h-4 w-4" />} onClick={resetGrid}>Reset</Button>
          </div>
        </div>

        {/* 2 — quick filters (rule-based, never AI) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="mr-1 text-[12.5px] font-semibold text-ink-3">Show</span>
          {GRID_PROMPTS.slice(0, 3).map((p) => (
            <button key={p} type="button" onClick={() => runCommand(p)} className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-ink-3 hover:bg-ink/[0.04] hover:text-ink">{p}</button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); runCommand(query); }} className="flex w-[220px] items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or type: “Zone A”, “tier 1”" className="field-input h-9 !min-h-0 !py-0 text-[13.5px]" aria-label="Ask the grid" title="Rule-based keyword filters, not an AI model. They only filter and sort this grid." />
          </form>
          <Button variant="ghost" size="sm" className="ml-auto" leading={<I.webhook className="h-4 w-4" />} onClick={startFeed} disabled={feed.state === "running"} title="Replays recorded PayPal webhook events (synthetic) so you can watch cells update live">
            {feed.state === "running" ? "Receiving events…" : feed.state === "done" ? "Replay again" : "Replay PayPal webhooks"}
          </Button>
        </div>
        {(reply || feed.state !== "idle" || zoneFilter) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-ink/[0.02] px-4 py-2.5 text-[13px] text-ink-2" data-testid="grid-agent-reply" aria-live="polite">
            {reply && <span className="min-w-0 flex-1"><span className="font-semibold text-ink">Filter: </span>{reply}</span>}
            {feed.state !== "idle" && <Tag tone="amber">Replayed webhooks · synthetic events</Tag>}
            {feed.last && <span className="font-code text-[11.5px] text-ink-3">{feed.last}</span>}
            {zoneFilter && (
              <button onClick={() => filterToZone(null)} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[12px] text-ink">
                Filtered to {zoneFilter} <I.close className="h-3 w-3" />
              </button>
            )}
          </p>
        )}

        {/* 3 — the grid (+ the map, on request) */}
        <div className={`grid grid-cols-1 ${showMap ? "xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
          <div className="h-[680px] min-w-0">
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              groupDisplayType="groupRows"
              groupRowRendererParams={groupRowRendererParams}
              groupDefaultExpanded={groupBy === "none" ? 0 : 1}
              rowGroupPanelShow="always"
              theme={landfallGridTheme}
              getRowId={(p) => p.data.caseRef}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              masterDetail
              detailCellRendererParams={detailCellRendererParams}
              detailRowHeight={410}
              suppressAggFuncInHeader
              findSearchValue={find}
              grandTotalRow="bottom"
              cellSelection
              enableCharts
              customChartThemes={customChartThemes}
              chartThemes={["landfall"]}
              tooltipShowDelay={250}
              noRowsOverlayComponent={NoCasesOverlay}
              getContextMenuItems={getContextMenuItems}
              sideBar={{ toolPanels: ["columns", "filters"] }}
              statusBar={{ statusPanels: [{ statusPanel: StatusSummaryPanel, align: "left" }, { statusPanel: "agAggregationComponent", align: "right" }] }}
              initialState={initialState}
              onStateUpdated={(e) => persistState(e.api.getState())}
              onGridReady={onGridReady}
              onFirstDataRendered={onFirstDataRendered}
              onSelectionChanged={onSelectionChanged}
            />
          </div>

          {showMap && (
          <aside className="relative hidden h-[680px] border-l border-line xl:block" aria-label="Where the selected households are">
            <StormDesk
              variant="panel"
              className="!rounded-none !border-0"
              fund={fund}
              alerts={weather.alerts}
              clusters={weather.clusters}
              mode="HISTORICAL_REPLAY"
              focusPoint={focus}
              onSelectCluster={(c: ExposureCluster) => filterToZone(zoneKey(c.zone))}
            />
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <div className="glass-hud pointer-events-auto flex items-center gap-2 rounded-sm px-3 py-1.5">
                {cases.some((c) => c.origin === "SANDBOX_LIVE") ? <Tag tone="amber" solid>Synthetic locations</Tag> : <Tag tone="storm" solid>Replay</Tag>}
                <span className="text-[12px] font-semibold text-ink">Where they live</span>
              </div>
            </div>
            <p className="glass-hud pointer-events-none absolute inset-x-3 bottom-9 px-3.5 py-2.5 text-[11.5px] leading-snug text-ink-2">
              Select a case and the globe flies to its zone. Click a cluster to filter the grid to that zone. Homes are clustered — no exact address is shown.
            </p>
          </aside>
          )}
        </div>
      </div>

      {/* integrated chart */}
      <div className={showChart ? "pane overflow-hidden" : "hidden"}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[14px] font-semibold text-ink">Dollars by PayPal status</span>
            <Tag tone="neutral">AG integrated chart · {money(rowData.reduce((a, r) => a + r.amount, 0))} total</Tag>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { chartHandle.current?.destroyChart(); chartHandle.current = null; setShowChart(false); }}>Close</Button>
        </div>
        <div ref={chartBox} className="h-[380px] w-full" />
      </div>
    </section>
  );
}
