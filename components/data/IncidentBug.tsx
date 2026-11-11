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

/** Sidebar card: the active data set, with where it comes from. */
export function SidebarIncident() {
  const { source, cases, lastSyncedAt, status } = useCases();
  if (status === "loading") {
    return (
      <>
        <Tag tone="neutral">Loading…</Tag>
        <div className="mt-2.5 font-serif text-[22px] leading-none tracking-[-0.02em] text-ink">Checking records</div>
        <div className="mt-1.5 text-[12px] text-ink-2">Looking for stored PayPal payments</div>
      </>
    );
  }
  if (source === "live") {
    return (
      <>
        <Tag tone="paypal" solid live>Live Sandbox</Tag>
        <div className="mt-2.5 font-serif text-[22px] leading-none tracking-[-0.02em] text-ink">Real payments</div>
        <div className="mt-1.5 text-[12px] text-ink-2">{cases.length} PayPal Sandbox payments · PayPal asked {relativeTime(lastSyncedAt)}</div>
        <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Open command center</div>
      </>
    );
  }
  return (
    <>
      <Tag tone="storm" solid live>Replay</Tag>
      <div className="mt-2.5 font-serif text-[22px] leading-none tracking-[-0.02em] text-ink">Hurricane Milton</div>
      <div className="mt-1.5 text-[12px] text-ink-2">Cat 4 · Tampa Bay · synthetic scenario</div>
      <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">Oct 2024 data · open storm desk</div>
    </>
  );
}
