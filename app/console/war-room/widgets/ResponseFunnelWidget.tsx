"use client";

import React from "react";

export interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
  description: string;
}

export function ResponseFunnelWidget({
  stages = [
    { label: "1. Enrolled Directory", count: 6, percentage: 100, description: "Total registered households" },
    { label: "2. Geo-Screened", count: 6, percentage: 100, description: "Verified coordinates & boundaries" },
    { label: "3. Storm Polygon Exposed", count: 5, percentage: 83, description: "Inside NWS Hurricane Warning polygon" },
    { label: "4. Policy Eligible", count: 5, percentage: 83, description: "Qualified by vulnerability priority (P1-P4)" },
    { label: "5. Passkey Approved", count: 5, percentage: 83, description: "Dual WebAuthn signatures executed" },
    { label: "6. Disbursed via PayPal", count: 5, percentage: 83, description: "Payout batch submitted to PayPal Sandbox" },
  ],
}: {
  stages?: FunnelStage[];
}) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider font-mono">
            4. Anticipatory Response Funnel
          </h3>
        </div>
        <span className="text-xs text-emerald-400 font-mono font-semibold">
          Conversion: 83% (1 Excluded Safely)
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {stages.map((st, i) => (
          <div key={st.label} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-200 font-medium">{st.label}</span>
              <span className="text-sky-400 font-bold">
                {st.count} households ({st.percentage}%)
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-500"
                style={{ width: `${st.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-sans">{st.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

