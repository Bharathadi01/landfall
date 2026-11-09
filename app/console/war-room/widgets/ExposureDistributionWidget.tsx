"use client";

import React from "react";

export interface ZoneExposureItem {
  zone: string;
  name: string;
  count: number;
  evacMandatory: boolean;
  color: string;
}

export function ExposureDistributionWidget({
  items = [
    { zone: "Zone A", name: "Coastal / Barrier Islands", count: 2, evacMandatory: true, color: "bg-rose-500" },
    { zone: "Zone B", name: "Low-Lying Estuary", count: 2, evacMandatory: true, color: "bg-amber-500" },
    { zone: "Zone C", name: "Inland Surge Buffer", count: 1, evacMandatory: false, color: "bg-sky-500" },
    { zone: "Outside Warning", name: "Inland Central FL (Orange Co.)", count: 1, evacMandatory: false, color: "bg-slate-600" },
  ],
}: {
  items?: ZoneExposureItem[];
}) {
  const total = items.reduce((sum, it) => sum + it.count, 0);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            2. Exposure by Evacuation Zone
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">{total} Enrolled Households</span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.zone} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200 font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  {item.zone} — <span className="text-slate-400 font-sans">{item.name}</span>
                </span>
                <span className="text-slate-300 font-bold">
                  {item.count} ({pct}%)
                  {item.evacMandatory && (
                    <span className="ml-2 text-[10px] text-rose-400 font-mono font-semibold uppercase">
                      Evac Mandatory
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/[0.07]">
                <div
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

