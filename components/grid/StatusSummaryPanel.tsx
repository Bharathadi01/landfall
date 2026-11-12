"use client";

import React, { useEffect, useState } from "react";
import type { IStatusPanelParams } from "ag-grid-community";
import { money2 } from "@/components/relief/parts";

/**
 * Custom AG Grid status-bar panel: dollars by outcome across the rows currently shown (after filters),
 * with PayPal credit and household confirmation kept apart.
 */
export function StatusSummaryPanel(props: IStatusPanelParams) {
  const [s, setS] = useState({ rows: 0, total: 0, credited: 0, stuck: 0, failed: 0 });

  useEffect(() => {
    const calc = () => {
      let rows = 0, total = 0, credited = 0, stuck = 0, failed = 0;
      props.api.forEachNodeAfterFilter((n) => {
        if (n.group || !n.data) return;
        rows++;
        const a = Number(n.data.amount) || 0;
        total += a;
        const st = n.data.payoutStatus;
        if (st === "SUCCESS") credited += a;
        else if (st === "UNCLAIMED" || st === "PENDING" || st === "ONHOLD" || st === "BLOCKED") stuck += a;
        else if (st === "FAILED" || st === "RETURNED" || st === "REFUNDED" || st === "REVERSED") failed += a;
      });
      setS({ rows, total, credited, stuck, failed });
    };
    calc();
    const evts = ["modelUpdated", "filterChanged", "cellValueChanged", "rowDataUpdated"] as const;
    evts.forEach((e) => props.api.addEventListener(e, calc));
    return () => evts.forEach((e) => props.api.removeEventListener(e, calc));
  }, [props.api]);

  const Item = ({ label, value, cls }: { label: string; value: string; cls: string }) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className={`tabular text-[12.5px] font-semibold ${cls}`}>{value}</span>
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2" data-testid="grid-status-summary">
      <Item label="Showing" value={`${s.rows} cases · ${money2(s.total)}`} cls="text-ink" />
      <Item label="Credited by PayPal" value={money2(s.credited)} cls="text-paypal" />
      <Item label="Waiting on someone" value={money2(s.stuck)} cls="text-amber" />
      <Item label="Returned or failed" value={money2(s.failed)} cls="text-danger" />
    </div>
  );
}
