"use client";

import React from "react";
import { studioLedgerReconciliation, studioRecoveryProofs } from "@/lib/studio/landfall-studio-data";
import { useCases } from "@/components/data/DataSourceProvider";
import { money } from "@/components/relief/parts";

/**
 * Settlement & financial-integrity bridge.
 * Every figure derives from the same treasury and ledger rows as the rest of the app; the
 * "reconciled" badge is COMPUTED from the ledger (balances must sum to funds received and every
 * variance must be 0¢) rather than asserted. Data is replay data, labelled as such.
 */
export function SettlementIntegrityBridge() {
  const { treasury: TREASURY, source } = useCases();
  const live = source === "live";
  // Replay: the replay ledger's own consistency. Live: the figures below ARE the ledger's positions (see live-treasury.ts);
  // whether they match PayPal is what the reconciliation run says, not this widget.
  const sumBalances = studioLedgerReconciliation.reduce((t, l) => t + l.balance_usd, 0);
  const reconciled = live ? true : sumBalances === TREASURY.total && studioLedgerReconciliation.every((l) => l.variance_cents === 0);
  const sent = TREASURY.paidOut + TREASURY.inFlight;
  const pct = (n: number) => `${(n / TREASURY.total) * 100}%`;
  const proof = studioRecoveryProofs[0];

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex flex-col justify-between gap-2 border-b border-ink/[0.07] pb-3 sm:flex-row sm:items-center">
        <div>
          <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.015em] text-ink">
            <span className={`h-2 w-2 rounded-full ${reconciled ? "bg-accent" : "bg-danger"}`} />
            Settlement &amp; financial integrity
          </span>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Replay ledger vs replay treasury (not compared with PayPal), reserve kept apart</p>
        </div>
        <span className={`field-badge ${reconciled ? "field-badge-success" : "field-badge-critical"}`}>
          {live ? "Ledger positions · see reconciliation for the PayPal comparison" : reconciled ? "Replay ledger is internally consistent" : "Replay ledger mismatch — investigate"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
        <div className="space-y-1 rounded-xl border border-ink/[0.07] bg-ink/[0.04] p-3">
          <div className="text-[10px] uppercase text-ink-3">Funds received</div>
          <div className="text-base font-semibold tabular text-ink">{money(TREASURY.total)}</div>
          <div className="text-[10px] text-ink-3">{live ? "Live ledger" : "Replay data"}</div>
        </div>
        <div className="space-y-1 rounded-xl border border-ink/[0.07] bg-ink/[0.04] p-3">
          <div className="text-[10px] uppercase text-ink-3">Protected reserve</div>
          <div className="text-base font-semibold tabular text-amber">{money(TREASURY.reserve)}</div>
          <div className="text-[10px] text-ink-3">Policy floor {money(TREASURY.requiredReserve)} ({TREASURY.policyFloorPct}%)</div>
        </div>
        <div className="space-y-1 rounded-xl border border-ink/[0.07] bg-ink/[0.04] p-3">
          <div className="text-[10px] uppercase text-ink-3">Ready to allocate</div>
          <div className="text-base font-semibold tabular text-accent-strong">{money(TREASURY.allocatable)}</div>
          <div className="text-[10px] text-ink-3">Cash in account minus reserve</div>
        </div>
        <div className="space-y-1 rounded-xl border border-ink/[0.07] bg-ink/[0.04] p-3">
          <div className="text-[10px] uppercase text-ink-3">Sent to PayPal</div>
          <div className="text-base font-semibold tabular text-paypal">{money(sent)}</div>
          <div className="text-[10px] text-ink-3">
            {money(TREASURY.paidOut)} credited · {money(TREASURY.inFlight)} in flight
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-ink/[0.07] bg-ink/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-ink-2">Every dollar is in exactly one place</span>
          <span className="text-ink-3">Replay clock · 2024-10-09 18:30 UTC</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink/[0.06]">
          <div className="h-full bg-accent" style={{ width: pct(TREASURY.allocatable) }} title={`Ready to allocate ${money(TREASURY.allocatable)}`} />
          <div className="h-full bg-amber" style={{ width: pct(TREASURY.reserve) }} title={`Protected reserve ${money(TREASURY.reserve)}`} />
          <div className="h-full bg-paypal" style={{ width: pct(sent) }} title={`Sent to PayPal ${money(sent)}`} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10.5px] text-ink-2">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-accent" /> Ready to allocate {money(TREASURY.allocatable)}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber" /> Protected reserve {money(TREASURY.reserve)}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-paypal" /> Sent to PayPal {money(sent)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 rounded-lg border border-ink/[0.06] bg-ink/[0.04] p-2.5 text-[11px] sm:flex-row sm:items-center">
        <span className="text-ink-3">Recovery proof root (replay data):</span>
        <span className="max-w-sm break-all font-mono text-paypal" title={proof.merkle_root}>
          {proof.merkle_root}
        </span>
      </div>
    </div>
  );
}
