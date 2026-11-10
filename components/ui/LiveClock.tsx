"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * On-air clock. UTC first (the weather world's shared time), local time optional.
 * Renders a stable placeholder on the server to avoid hydration mismatch.
 */
export function LiveClock({ local = false, className }: { local?: boolean; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const utc = now ? now.toISOString().slice(11, 19) : "--:--:--";
  const loc = now
    ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";

  return (
    <span className={cn("inline-flex items-baseline gap-2 font-mono tabular text-[12px] tracking-[0.04em] text-ink-2", className)}>
      <span className="text-ink">{utc}</span>
      <span className="text-ink-3">UTC</span>
      {local && (
        <>
          <span className="text-ink-3">·</span>
          <span>{loc}</span>
          <span className="text-ink-3">local</span>
        </>
      )}
    </span>
  );
}
