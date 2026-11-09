"use client";

import React, { useState } from "react";
import { BarChart3, Palette, Puzzle, MousePointerClick, Sparkles, Eye, PencilRuler, Lock } from "lucide-react";
import { LandfallStudio } from "@/components/studio/LandfallStudio";
import { PageHeader, Chip, IconTile } from "@/components/ui/primitives";

const FEATURES = [
  { icon: Palette, tone: "accent" as const, title: "Landfall theme", body: "AG Theming API — canvas, widgets, grid & charts" },
  { icon: Puzzle, tone: "paypal" as const, title: "Custom widget", body: "“Relief Solvency” reads Studio’s data engine" },
  { icon: MousePointerClick, tone: "amber" as const, title: "Cross-filtering", body: "Tap a tier — every chart follows" },
  { icon: Sparkles, tone: "ai" as const, title: "Studio Agent", body: "“Build with AI” — ask in plain English" },
];

export default function AnalyticsStudioPage() {
  const [mode, setMode] = useState<"view" | "edit">("view");

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Analytics Studio · AG Studio 3.1"
        icon={BarChart3}
        tone="paypal"
        title="Every relief dollar,"
        accent="explorable."
        description="One live workspace over households, treasury and payouts. Filter by priority, ask the AI agent a question, or rearrange the board — nothing here can move money."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Studio mode">
            {(
              [
                ["view", "Present", Eye],
                ["edit", "Build with AI", PencilRuler],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all ${
                  mode === m ? "bg-white/10 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass flex items-center gap-3 px-4 py-3.5" data-reveal>
            <IconTile icon={f.icon} tone={f.tone} />
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink">{f.title}</div>
              <div className="truncate text-[12px] text-ink-3">{f.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-strong relative overflow-hidden p-2 sm:p-3" data-reveal="scale">
        <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </span>
            <span className="ml-2 text-[12.5px] font-medium text-ink-2">Hurricane Milton · Relief board</span>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="ai">
              <Lock className="h-3 w-3" /> AI read-only
            </Chip>
            <Chip tone="accent" live>
              Live data
            </Chip>
          </div>
        </div>
        <div className="h-[900px] w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-canvas/60">
          <LandfallStudio mode={mode} />
        </div>
      </div>
    </div>
  );
}
