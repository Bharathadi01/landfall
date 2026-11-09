"use client";

import dynamic from "next/dynamic";
import { LandfallMark } from "@/components/brand/LandfallMark";

/** Client-only AG Studio canvas wrapped in Landfall's glass frame. */
export const LandfallStudio = dynamic(() => import("./StudioCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-ink-3">
      <div className="relative">
        <LandfallMark size={44} className="animate-pulse" />
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Loading AG Studio workspace…</span>
    </div>
  ),
});
