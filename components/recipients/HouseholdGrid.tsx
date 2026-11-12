"use client";

/**
 * HouseholdGrid — the household directory on AG Grid, so every list of people and payments in Landfall shares one grid, one theme and
 * one set of habits (sort, filter from the column menu, pin, resize, export). Four checks per household, each said in words with a
 * status colour: how they are paid, where they live, whether the storm reaches them, and their need.
 */

import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { registerAg } from "@/lib/ag/register";
import { landfallGridTheme } from "@/styles/ag-studio-theme";
import { Tag } from "@/components/ui/Tag";

registerAg();

type Row = Record<string, any>;

function HouseholdCell({ data }: ICellRendererParams<Row>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-semibold text-ink">{data.name}</span>
        {data.isDisplaced && <Tag tone="amber">Evacuated</Tag>}
      </div>
      <span className="mt-1 truncate text-[12px] text-ink-3">{data.address}</span>
    </div>
  );
}

function ChannelCell({ data }: ICellRendererParams<Row>) {
  const c = data?.fourChecks?.paymentChannel;
  if (!c) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center gap-1 leading-tight">
      <span><Tag tone={c.status === "VERIFIED" ? "delivered" : "neutral"}>{c.label}</Tag></span>
      {data?.receiver && <span className="truncate font-code text-[11.5px] text-ink-3">{data.receiver}</span>}
    </div>
  );
}

function ResidenceCell({ data }: ICellRendererParams<Row>) {
  const r = data?.fourChecks?.residenceEvidence;
  if (!r) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center gap-1 leading-tight">
      <span><Tag tone="neutral">{r.label}</Tag></span>
      {r.disclaimer && <span className="truncate text-[11.5px] text-amber" title={r.disclaimer}>{r.disclaimer}</span>}
    </div>
  );
}

function ExposureCell({ data }: ICellRendererParams<Row>) {
  const e = data?.fourChecks?.exposure;
  if (!e) return null;
  return <div className="flex h-full items-center"><Tag tone={e.status === "CONFIRMED" ? "amber" : "neutral"}>{e.label}</Tag></div>;
}

function NeedCell({ data }: ICellRendererParams<Row>) {
  const n = data?.fourChecks?.need;
  if (!n) return null;
  return <div className="flex h-full items-center"><Tag tone="accent">{n.label}</Tag></div>;
}

export function HouseholdGrid({ rows, onOpen }: { rows: Row[]; onOpen: (row: Row) => void }) {
  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { headerName: "Household", field: "name", pinned: "left", flex: 1.6, minWidth: 260, cellRenderer: HouseholdCell, filter: "agTextColumnFilter", getQuickFilterText: (p) => `${p.data?.name} ${p.data?.address}` },
      { headerName: "How they are paid", colId: "channel", valueGetter: (p) => p.data?.fourChecks?.paymentChannel?.label, flex: 1.2, minWidth: 200, cellRenderer: ChannelCell, filter: "agSetColumnFilter" },
      { headerName: "Where they live", colId: "residence", valueGetter: (p) => p.data?.fourChecks?.residenceEvidence?.label, flex: 1.2, minWidth: 200, cellRenderer: ResidenceCell, filter: "agSetColumnFilter" },
      { headerName: "Storm reaches them?", colId: "exposure", valueGetter: (p) => p.data?.fourChecks?.exposure?.label, flex: 1, minWidth: 180, cellRenderer: ExposureCell, filter: "agSetColumnFilter" },
      { headerName: "Need", colId: "need", valueGetter: (p) => p.data?.fourChecks?.need?.label, flex: 1, minWidth: 170, cellRenderer: NeedCell, filter: "agSetColumnFilter" },
      {
        headerName: "",
        colId: "open",
        pinned: "right",
        width: 112,
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div className="flex h-full items-center">
            <button type="button" onClick={() => p.data && onOpen(p.data)} className="text-[13px] font-semibold text-ink underline decoration-ink-3/60 underline-offset-[3px] hover:decoration-accent">
              Open
            </button>
          </div>
        ),
      },
    ],
    [onOpen]
  );

  return (
    <div className="pane overflow-hidden" data-testid="household-grid">
      <div style={{ height: Math.min(640, 52 + Math.max(rows.length, 3) * 64 + 2) }}>
        <AgGridReact<Row>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: true }}
          theme={landfallGridTheme}
          rowHeight={64}
          headerHeight={44}
          getRowId={(p) => String(p.data.id)}
          onRowDoubleClicked={(e) => e.data && onOpen(e.data)}
          suppressCellFocus
          tooltipShowDelay={250}
        />
      </div>
    </div>
  );
}
