"use client";

import React from "react";
import { useCases } from "@/components/data/DataSourceProvider";

export interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
  description: string;
}

export function ResponseFunnelWidget({ stages: stagesProp }: { stages?: FunnelStage[] }) {
  const { summary } = useCases();
  const stages: FunnelStage[] =
    stagesProp ??
    summary.stageCounts.map((st, i) => ({
      label: `${i + 1}. ${st.label}`,
      count: st.count,
      percentage: summary.households ? Math.round((st.count / summary.households) * 100) : 0,
      description: st.help,
    }));
  const confirmed = summary.confirmedCount;
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-ink/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-paypal0" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Delivery funnel
          </h3>
        </div>
        <span className="text-xs text-delivered font-mono font-semibold">
          {confirmed} of {summary.households} confirmed by the household
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {stages.map((st, i) => (
          <div key={st.label} className="bg-ink/[0.04] p-2.5 rounded-lg border border-ink/[0.06]">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-ink font-medium">{st.label}</span>
              <span className="text-paypal font-bold">
                {st.count} households ({st.percentage}%)
              </span>
            </div>
            <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-paypal0 h-full transition-all duration-500"
                style={{ width: `${st.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-ink-2 mt-1 font-sans">{st.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

