"use client";

import React from "react";

export interface HazardIntelligenceProps {
  stormName?: string;
  category?: string;
  maxWindsMph?: number;
  centralPressureMb?: number;
  stormSurgeFeet?: string;
  warningOffice?: string;
  headline?: string;
  polygonVertexCount?: number;
  isRehearsal?: boolean;
}

export function HazardIntelligenceWidget({
  stormName = "Hurricane Milton",
  category = "Category 4",
  maxWindsMph = 145,
  centralPressureMb = 929,
  stormSurgeFeet = "10 - 15 ft",
  warningOffice = "NWS Tampa Bay (TBW)",
  headline = "Life-threatening storm surge and catastrophic hurricane-force winds forecasted along Tampa Bay and Florida Gulf Coast.",
  polygonVertexCount = 14,
  isRehearsal = true,
}: HazardIntelligenceProps) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-danger0 animate-pulse" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Hazard Intelligence & Telemetry
          </h3>
        </div>
        {isRehearsal && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber0/20 text-amber border border-amber0/30">
            IEM HISTORICAL REPLAY
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Intensity</div>
          <div className="text-base font-bold text-danger mt-0.5">{category}</div>
          <div className="text-[10px] text-ink0 mt-0.5">{maxWindsMph} mph sustained</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Central Pressure</div>
          <div className="text-base font-bold text-paypal mt-0.5">{centralPressureMb} mb</div>
          <div className="text-[10px] text-ink0 mt-0.5">Rapidly deepening</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Peak Storm Surge</div>
          <div className="text-base font-bold text-amber mt-0.5">{stormSurgeFeet}</div>
          <div className="text-[10px] text-ink0 mt-0.5">Tampa Bay inundation</div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-ink-2 font-mono">Warning Office</div>
          <div className="text-base font-bold text-ink mt-0.5">{warningOffice}</div>
          <div className="text-[10px] text-ink0 mt-0.5">{polygonVertexCount} vertex polygon</div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-danger-soft/20 border border-danger-line/40 rounded-lg text-xs text-danger/90 leading-relaxed font-sans">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-danger block mb-0.5 font-mono">
          Official Warning Bulletin:
        </span>
        {headline}
      </div>
    </div>
  );
}

