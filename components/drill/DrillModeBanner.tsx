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
    <div className="bg-amber0/10 border-b border-amber0/30 px-4 py-2.5 text-amber text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-amber0/20 text-amber border border-amber0/40 text-[10px] font-bold uppercase">
            DRILL / REHEARSAL MODE
          </span>
          <span className="font-medium text-ink">
            {eventName}
          </span>
          <span className="hidden md:inline text-amber/70">
            · {sourceArchive}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-ink-2">
            Real funds protected · Live Sandbox Payouts API verified
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber hover:text-ink underline"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

