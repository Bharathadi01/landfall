"use client";

import React from "react";

export interface TreasuryWaterfallProps {
  totalCashCents?: number;
  reserveProtectedCents?: number;
  feesReservedCents?: number;
  allocatableCents?: number;
  committedCents?: number;
}

export function TreasuryWaterfallWidget({
  totalCashCents = 100000, // $1,000.00
  reserveProtectedCents = 30000, // $300.00 (30%)
  feesReservedCents = 5000, // $50.00
  allocatableCents = 65000, // $650.00
  committedCents = 50000, // $500.00 committed (5 x $100)
}: TreasuryWaterfallProps) {
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            3. Treasury Waterfall & Liquidity
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-400">
          Total: {formatUsd(totalCashCents)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Protected Floor (30%)</div>
          <div className="text-sm font-bold text-amber-400 mt-0.5">
            {formatUsd(reserveProtectedCents)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Solvency firewall</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Fee Buffer</div>
          <div className="text-sm font-bold text-slate-300 mt-0.5">
            {formatUsd(feesReservedCents)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">PayPal batch costs</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Allocatable Limit</div>
          <div className="text-sm font-bold text-sky-400 mt-0.5">
            {formatUsd(allocatableCents)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Max Tranche 1 budget</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Committed Plan</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">
            {formatUsd(committedCents)}
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5">5 households @ $100</div>
        </div>
      </div>

      {/* Visual waterfall bar */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1.5">
          <span>Capital Allocation Breakdown</span>
          <span>{Math.round((committedCents / totalCashCents) * 100)}% Deployed</span>
        </div>
        <div className="h-3 w-full bg-slate-950 rounded-full flex overflow-hidden border border-white/[0.07]">
          <div
            className="bg-emerald-500 h-full"
            style={{ width: `${(committedCents / totalCashCents) * 100}%` }}
            title={`Committed Relief: ${formatUsd(committedCents)}`}
          />
          <div
            className="bg-sky-500/40 h-full"
            style={{
              width: `${Math.max(0, (allocatableCents - committedCents) / totalCashCents) * 100}%`,
            }}
            title={`Remaining Allocatable: ${formatUsd(allocatableCents - committedCents)}`}
          />
          <div
            className="bg-slate-600/60 h-full"
            style={{ width: `${(feesReservedCents / totalCashCents) * 100}%` }}
            title={`Fee Reserve: ${formatUsd(feesReservedCents)}`}
          />
          <div
            className="bg-amber-500/80 h-full"
            style={{ width: `${(reserveProtectedCents / totalCashCents) * 100}%` }}
            title={`Protected Floor: ${formatUsd(reserveProtectedCents)}`}
          />
        </div>
        <div className="flex gap-4 mt-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-emerald-500" /> Committed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-sky-500/40" /> Buffer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-slate-600/60" /> Fees
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-amber-500/80" /> 30% Floor
          </span>
        </div>
      </div>
    </div>
  );
}

