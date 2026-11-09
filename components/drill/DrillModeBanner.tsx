"use client";

import React, { useState } from "react";

export interface DrillModeBannerProps {
  eventName?: string;
  sourceArchive?: string;
  isDrillActive?: boolean;
  onToggleDrill?: (active: boolean) => void;
}

export function DrillModeBanner({
  eventName = "Hurricane Milton (Historical Oct 2024 Replay)",
  sourceArchive = "NWS IEM Archive · WFO TBW",
  isDrillActive = true,
}: DrillModeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isDrillActive) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-amber-300 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 text-[10px] font-bold uppercase">
            DRILL / REHEARSAL MODE
          </span>
          <span className="font-medium text-slate-200">
            {eventName}
          </span>
          <span className="hidden md:inline text-amber-400/70">
            · {sourceArchive}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-400">
            Real funds protected · Live Sandbox Payouts API verified
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-white underline"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

