"use client";

import React from "react";
import { Tag } from "@/components/ui/Tag";
import { useCases } from "./DataSourceProvider";
import { relativeTime } from "./SourceSwitch";

/** The on-air bug: says in one glance whether the console is showing real PayPal Sandbox records or a synthetic replay. */
export function IncidentBug() {
  const { source, lastSyncedAt, status, cases } = useCases();
  if (status === "loading") return <div className="hidden min-w-0 items-center gap-2.5 xl:flex" aria-label="Data source loading"><Tag tone="neutral">Loading…</Tag></div>;
  if (source === "live") {
    return (
      <div className="hidden shrink-0 items-center gap-2.5 xl:flex" aria-label="Data source: live PayPal Sandbox">
        <Tag tone="paypal" solid live>Live Sandbox</Tag>
        <span className="hidden whitespace-nowrap font-mono text-[12px] tracking-[0.04em] text-ink-2 2xl:inline">
          {cases.length} real payment{cases.length === 1 ? "" : "s"} · PayPal asked {relativeTime(lastSyncedAt)}
        </span>
      </div>
    );
  }
  return (
    <div className="hidden min-w-0 items-center gap-2.5 xl:flex" aria-label="Data source: synthetic replay">
      <Tag tone="storm" solid>Replay · Oct 2024</Tag>
      <span className="hidden whitespace-nowrap font-mono text-[12px] tracking-[0.04em] text-ink-2 2xl:inline">MILTON · CAT 4 · SYNTHETIC</span>
    </div>
  );
}

/** Sidebar: which data set is active and where it comes from — two quiet lines, no card. */
export function SidebarIncident() {
  const { source, cases, lastSyncedAt, status } = useCases();
  if (status === "loading") {
    return (
      <>
        <div className="text-[13px] font-medium text-ink-2">Checking records…</div>
        <div className="mt-0.5 text-[12px] text-ink-3">Looking for stored PayPal payments</div>
      </>
    );
  }
  if (source === "live") {
    return (
      <>
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink"><span className="h-1.5 w-1.5 bg-delivered" aria-hidden /> Live PayPal Sandbox</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{cases.length} payments · asked {relativeTime(lastSyncedAt)}</div>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink"><span className="h-1.5 w-1.5 bg-amber" aria-hidden /> Replay · Hurricane Milton</div>
      <div className="mt-0.5 text-[12px] text-ink-3">Synthetic scenario, Oct 2024</div>
    </>
  );
}
