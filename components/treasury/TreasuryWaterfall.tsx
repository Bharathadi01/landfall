"use client";

import React, { useState, useEffect } from "react";

export interface TreasuryWaterfallData {
  paypalAvailableCents: number;
  reserveProtectedCents: number;
  feesReservedCents: number;
  committedCents: number;
  allocatableCents: number;
  contingentPledgesCents: number;
  activePledgesCount: number;
  activeSustainersCount?: number;
  monthlySustainerCents?: number;
  eligibleHouseholdsCount: number;
  tranche1CostPerHouseholdCents: number;
  coveragePercentage: number;
  paidOutCents?: number;
  returnedCents?: number;
  timestamp?: string;
}

interface TreasuryWaterfallProps {
  initialData?: TreasuryWaterfallData;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function TreasuryWaterfall({ initialData }: TreasuryWaterfallProps) {
  const [data, setData] = useState<TreasuryWaterfallData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await fetch("/api/treasury/waterfall");
      if (!res.ok) {
        throw new Error(`Failed to load treasury data: HTTP ${res.status}`);
      }
      const json: TreasuryWaterfallData = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [initialData]);

  if (loading) {
    return (
      <div className="w-full p-8 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mb-4" />
        <div className="h-24 w-full bg-slate-800/60 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-20 bg-slate-800/40 rounded" />
          <div className="h-20 bg-slate-800/40 rounded" />
          <div className="h-20 bg-slate-800/40 rounded" />
          <div className="h-20 bg-slate-800/40 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full p-6 rounded-xl bg-red-950/40 border border-red-800 text-red-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-red-300">Treasury Sync Error</h3>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-red-100 rounded text-sm transition"
          >
            Retry
          </button>
        </div>
        <p className="text-sm opacity-90">{error || "No treasury data available"}</p>
      </div>
    );
  }

  const {
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    allocatableCents,
    contingentPledgesCents,
    activePledgesCount,
    activeSustainersCount = 0,
    monthlySustainerCents = 0,
    eligibleHouseholdsCount,
    coveragePercentage,
    timestamp,
  } = data;

  return (
    <div className="w-full rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-6 text-slate-100">
      {/* Header and Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-blue-400">#0B3D91</span> Storm Treasury Waterfall
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic liquidity ladder · Real-time ledger accounting · Zero hallucinated balances
          </p>
        </div>

        <div className="flex items-center gap-3">
          {timestamp && (
            <span className="text-xs text-slate-500 font-mono">
              Synced: {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition flex items-center gap-1.5"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            {refreshing ? "Refreshing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* Main Waterfall Visual Ladder */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 my-6">
        {/* Step 1: PayPal Available */}
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/60 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
              1. PayPal Available
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {formatCents(paypalAvailableCents)}
            </div>
          </div>
          <div className="text-[11px] text-blue-300/70 mt-3 border-t border-blue-900/40 pt-2">
            Liquid sandbox balance
          </div>
        </div>

        {/* Step 2: Protected Floor */}
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              2. Protected Floor
            </div>
            <div className="text-2xl font-bold text-emerald-200 mt-1">
              −{formatCents(reserveProtectedCents)}
            </div>
          </div>
          <div className="text-[11px] text-emerald-300/70 mt-3 border-t border-emerald-900/40 pt-2">
            Unlocked for Tranche 1
          </div>
        </div>

        {/* Step 3: Fees Reserved */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              3. Fees Reserved
            </div>
            <div className="text-2xl font-bold text-slate-300 mt-1">
              −{formatCents(feesReservedCents)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400/70 mt-3 border-t border-slate-800 pt-2">
            Reserved per PayPal fee
          </div>
        </div>

        {/* Step 4: Committed */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              4. Committed Plans
            </div>
            <div className="text-2xl font-bold text-slate-300 mt-1">
              −{formatCents(committedCents)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400/70 mt-3 border-t border-slate-800 pt-2">
            Locked in pending batches
          </div>
        </div>

        {/* Step 5: Allocatable Cash */}
        <div className="p-4 rounded-xl bg-amber-950/30 border-2 border-amber-500/80 shadow-lg shadow-amber-950/40 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
              <span>5. Allocatable Cash</span>
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-amber-200 mt-1">
              {formatCents(allocatableCents)}
            </div>
          </div>
          <div className="text-[11px] font-medium text-amber-300/80 mt-3 border-t border-amber-900/50 pt-2">
            Ready for instant dispatch
          </div>
        </div>
      </div>

      {/* Contingent Pledges & Monthly Sustainers Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/80">
        {/* Contingent Storm Pledges */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
              Contingent Storm Pledges
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded border border-purple-700/60">
              Contingent Only
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-purple-100">
              {formatCents(contingentPledgesCents)}
            </div>
            <span className="text-xs text-purple-300">
              from {activePledgesCount} active donor pledge{activePledgesCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-[11px] text-purple-300/70 mt-2 leading-relaxed">
            Saved PayPal via Vault v3. Merchant-initiated charges execute strictly upon approved Tranche 1 activation.
            Never counted in allocatable cash until captured.
          </p>
        </div>

        {/* Monthly Sustainers */}
        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
              Monthly Sustainers
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-cyan-900/60 text-cyan-200 px-2 py-0.5 rounded border border-cyan-700/60">
              PayPal Subscriptions
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold text-cyan-100">
              {formatCents(monthlySustainerCents)}
              <span className="text-xs font-normal text-cyan-300">/mo</span>
            </div>
            <span className="text-xs text-cyan-300">
              from {activeSustainersCount} sustainer{activeSustainersCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-[11px] text-cyan-300/70 mt-2 leading-relaxed">
            Automated recurring contributions build the protected reserve floor month-over-month.
            Settles idempotently via <code className="font-mono text-cyan-200">PAYMENT.SALE.COMPLETED</code>.
          </p>
        </div>
      </div>

      {/* Coverage Progress Bar */}
      <div className="mt-6 pt-6 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">Tranche 1 Immediate Coverage</span>
            <span className="text-xs text-slate-400">
              ({eligibleHouseholdsCount} eligible household{eligibleHouseholdsCount === 1 ? "" : "s"})
            </span>
          </div>
          <div className="text-sm font-bold text-amber-400">
            {coveragePercentage}% of demand covered
          </div>
        </div>

        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              coveragePercentage >= 100
                ? "bg-emerald-500"
                : coveragePercentage >= 50
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(5, coveragePercentage))}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
          <span>
            Allocatable Cash: <strong className="text-slate-200">{formatCents(allocatableCents)}</strong>
          </span>
          <span>
            {coveragePercentage >= 100
              ? "✓ Sufficient liquid funds for full Tranche 1 dispatch"
              : `⚠ Deficit of ${formatCents(
                  Math.max(0, eligibleHouseholdsCount * 10225 - allocatableCents)
                )} for 100% household coverage`}
          </span>
        </div>
      </div>
    </div>
  );
}
export default TreasuryWaterfall;

