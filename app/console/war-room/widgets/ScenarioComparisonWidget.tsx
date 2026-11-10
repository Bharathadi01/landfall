"use client";

import React from "react";

export interface ScenarioComparisonProps {
  currentScenario?: "BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS";
  onSelectScenario?: (sc: "BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS") => void;
}

export function ScenarioComparisonWidget({
  currentScenario = "BASELINE",
  onSelectScenario,
}: ScenarioComparisonProps) {
  const scenarios = [
    {
      id: "BASELINE",
      name: "Scenario A: Baseline Plan",
      allocatable: "$650.00",
      fundedCount: 5,
      waitlistedCount: 0,
      description: "Default 30% reserve floor; all 5 confirmed exposed households funded at $100.00 each.",
    },
    {
      id: "CONSTRAINED_RESERVE",
      name: "Scenario B: 50% High-Risk Reserve",
      allocatable: "$450.00",
      fundedCount: 4,
      waitlistedCount: 1,
      description: "Higher reserve floor to withstand secondary flooding; lowest priority tier (P5) waitlisted.",
    },
    {
      id: "PRIORITY_TIER_FOCUS",
      name: "Scenario C: Tier 1 & 2 Medical Focus",
      allocatable: "$650.00",
      fundedCount: 2,
      waitlistedCount: 3,
      description: "Doubles allocation to $200.00 for life-safety Tier 1 (medical device) & Tier 2 (elderly alone).",
    },
  ];

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Response Scenario Stress Simulation
          </h3>
        </div>
        <span className="text-xs text-purple-400 font-mono">Deterministic Policy Simulator</span>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((sc) => {
          const isSelected = currentScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario?.(sc.id as any)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? "bg-purple-950/40 border-purple-500/80 shadow-md ring-1 ring-purple-500/50"
                  : "bg-black/20 border-white/[0.06] hover:border-slate-700"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs text-slate-100 font-mono">{sc.name}</span>
                {isSelected && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500 text-white">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-purple-300 font-mono mt-1">
                {sc.fundedCount} Funded <span className="text-slate-400 font-normal">/ {sc.waitlistedCount} Waitlisted</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-sans leading-relaxed">
                {sc.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

