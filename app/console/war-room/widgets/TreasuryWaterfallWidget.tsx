"use client";

import React from "react";
import { useCases } from "@/components/data/DataSourceProvider";

export interface TreasuryWaterfallProps {
  totalCashCents?: number;
  reserveProtectedCents?: number;
  feesReservedCents?: number;
  allocatableCents?: number;
  committedCents?: number;
}

export function TreasuryWaterfallWidget(props: TreasuryWaterfallProps) {
  const { treasury: TREASURY } = useCases();
  const SENT_USD = TREASURY.paidOut + TREASURY.inFlight;
  const {
    totalCashCents = Math.round(TREASURY.total * 100), // funds received
    reserveProtectedCents = Math.round(TREASURY.reserve * 100), // protected reserve
    feesReservedCents = 0, // PayPal fees are booked as they are charged (see the ledger), not reserved separately
    allocatableCents = Math.round((TREASURY.allocatable + SENT_USD) * 100), // tranche budget = still-allocatable + already sent
    committedCents = Math.round(SENT_USD * 100), // credited, unclaimed, held or pending at PayPal
  } = props;
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-ink/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-delivered0" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Treasury waterfall
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-delivered">
          Total: {formatUsd(totalCashCents)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-ink/[0.04] p-3 rounded-lg border border-ink/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Protected reserve</div>
          <div className="text-sm font-bold text-amber mt-0.5">
            {formatUsd(reserveProtectedCents)}
          </div>
          <div className="text-[10px] text-ink0 mt-0.5">Solvency firewall</div>
        </div>

        <div className="bg-ink/[0.04] p-3 rounded-lg border border-ink/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Fee Buffer</div>
          <div className="text-sm font-bold text-ink-2 mt-0.5">
            {formatUsd(feesReservedCents)}
          </div>
          <div className="text-[10px] text-ink0 mt-0.5">Billed per item, not reserved</div>
        </div>

        <div className="bg-ink/[0.04] p-3 rounded-lg border border-ink/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Tranche 1 budget</div>
          <div className="text-sm font-bold text-paypal mt-0.5">
            {formatUsd(allocatableCents)}
          </div>
          <div className="text-[10px] text-ink0 mt-0.5">Cash minus reserve, incl. already sent</div>
        </div>

        <div className="bg-ink/[0.04] p-3 rounded-lg border border-ink/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Sent so far</div>
          <div className="text-sm font-bold text-delivered mt-0.5">
            {formatUsd(committedCents)}
          </div>
          <div className="text-[10px] text-delivered0 mt-0.5">Sent to PayPal (credited, unclaimed, held or pending)</div>
        </div>
      </div>

      {/* Visual waterfall bar */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-mono text-ink-2 mb-1.5">
          <span>Capital Allocation Breakdown</span>
          <span>{Math.round((committedCents / totalCashCents) * 100)}% Deployed</span>
        </div>
        <div className="h-3 w-full bg-surface rounded-full flex overflow-hidden border border-ink/[0.07]">
          <div
            className="bg-delivered0 h-full"
            style={{ width: `${(committedCents / totalCashCents) * 100}%` }}
            title={`Committed Relief: ${formatUsd(committedCents)}`}
          />
          <div
            className="bg-paypal0/40 h-full"
            style={{
              width: `${Math.max(0, (allocatableCents - committedCents) / totalCashCents) * 100}%`,
            }}
            title={`Remaining Allocatable: ${formatUsd(allocatableCents - committedCents)}`}
          />
          <div
            className="bg-line-strong/60 h-full"
            style={{ width: `${(feesReservedCents / totalCashCents) * 100}%` }}
            title={`Fee Reserve: ${formatUsd(feesReservedCents)}`}
          />
          <div
            className="bg-amber0/80 h-full"
            style={{ width: `${(reserveProtectedCents / totalCashCents) * 100}%` }}
            title={`Protected Floor: ${formatUsd(reserveProtectedCents)}`}
          />
        </div>
        <div className="flex gap-4 mt-2 text-[10px] font-mono text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-delivered0" /> Committed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-paypal0/40" /> Buffer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-line-strong/60" /> Fees
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-amber0/80" /> Protected reserve
          </span>
        </div>
      </div>
    </div>
  );
}

