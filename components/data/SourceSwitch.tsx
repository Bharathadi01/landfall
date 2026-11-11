"use client";

import React from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Tag } from "@/components/ui/Tag";
import { useCases, type Source } from "./DataSourceProvider";

/** The single, always-visible answer to "is this real?". */
export function SourceSwitch({ size = "sm" }: { size?: "sm" | "md" }) {
  const { source, setSource, liveAvailable, status } = useCases();
  return (
    <div className="flex items-center gap-2" data-testid="source-switch">
      <SegmentedTabs<Source>
        ariaLabel="Data source"
        size={size}
        value={source}
        onChange={(s) => {
          if (s === "live" && !liveAvailable) return;
          setSource(s);
        }}
        tabs={[
          { id: "live", label: "Live Sandbox" },
          { id: "replay", label: "Milton replay" },
        ]}
      />
      {!liveAvailable && status !== "loading" && (
        <Tag tone="amber" title="No PayPal payments are stored on this deployment yet, so there is no live data to show.">No live data yet</Tag>
      )}
    </div>
  );
}

/** "synced 3 min ago" — never claims freshness it doesn't have. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "never refreshed";
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
