"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { I } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Tag, type Tone } from "@/components/ui/Tag";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

/* ── Timeline model ─────────────────────────────────────────
 * One slider covers 2 h of observations (30% of the track), "now", and 48 h of forecast (70%).
 */
export const OBS_MIN = -120;
export const FC_MIN = 48 * 60;
const OBS_SHARE = 300; // of 1000

export const sliderToMinutes = (s: number) =>
  s <= OBS_SHARE ? OBS_MIN + (s / OBS_SHARE) * -OBS_MIN : ((s - OBS_SHARE) / (1000 - OBS_SHARE)) * FC_MIN;

export const minutesToSlider = (m: number) =>
  m <= 0 ? ((m - OBS_MIN) / -OBS_MIN) * OBS_SHARE : OBS_SHARE + (m / FC_MIN) * (1000 - OBS_SHARE);

export function formatOffset(min: number): string {
  if (Math.abs(min) < 1) return "NOW";
  const sign = min < 0 ? "−" : "+";
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}`;
}

export type DeskLayerKey = "clouds" | "radar" | "rain" | "wind" | "warnings" | "households" | "track" | "night";

export const LAYER_DEFS: { key: DeskLayerKey; label: string; tone: Tone; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "clouds", label: "Clouds", tone: "neutral", icon: I.satellite },
  { key: "radar", label: "Radar", tone: "delivered", icon: I.radar },
  { key: "rain", label: "Rain", tone: "paypal", icon: I.rain },
  { key: "wind", label: "Wind", tone: "ai", icon: I.wind },
  { key: "warnings", label: "Warnings", tone: "danger", icon: I.hazard },
  { key: "households", label: "Households", tone: "money", icon: I.household },
  { key: "track", label: "Storm track", tone: "storm", icon: I.stormEye },
  { key: "night", label: "Day / night", tone: "amber", icon: I.world },
];

const dot: Record<Tone, string> = {
  accent: "bg-accent", money: "bg-money", delivered: "bg-delivered", paypal: "bg-paypal", ai: "bg-ai",
  amber: "bg-amber", storm: "bg-storm", danger: "bg-danger", neutral: "bg-ink-2",
};

export function LayerChips({
  active,
  onToggle,
  available,
}: {
  active: Record<DeskLayerKey, boolean>;
  onToggle: (k: DeskLayerKey) => void;
  available: Partial<Record<DeskLayerKey, boolean>>;
}) {
  return (
    <div className="glass-hud flex max-w-full flex-wrap items-center gap-1 p-1.5" role="group" aria-label="Map layers">
      {LAYER_DEFS.map((l) => {
        const on = active[l.key];
        const ok = available[l.key] !== false;
        return (
          <button
            key={l.key}
            type="button"
            aria-pressed={on}
            disabled={!ok}
            title={ok ? l.label : `${l.label}: no data`}
            onClick={() => onToggle(l.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              on ? "bg-white/[0.12] text-ink shadow-[inset_0_1px_0_rgb(255_244_232/0.22)]" : "text-ink-3 hover:bg-white/[0.06] hover:text-ink-2",
              !ok && "cursor-not-allowed opacity-40"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? dot[l.tone] : "bg-ink-3/50")} />
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

export function Timeline({
  slider,
  minutes,
  playing,
  onSlider,
  onPlay,
  segmentLabel,
  segmentKind,
  loading,
  now,
}: {
  slider: number;
  minutes: number;
  playing: boolean;
  onSlider: (s: number) => void;
  onPlay: () => void;
  segmentLabel: string;
  segmentKind: "observed" | "forecast";
  loading?: string | null;
  now: Date;
}) {
  const valid = new Date(now.getTime() + minutes * 60_000);
  const utc = valid.toISOString().slice(5, 16).replace("T", " ") + " UTC";
  const ticks = [
    { s: 0, label: "−2h" },
    { s: 150, label: "−1h" },
    { s: 300, label: "NOW" },
    { s: minutesToSlider(12 * 60), label: "+12h" },
    { s: minutesToSlider(24 * 60), label: "+24h" },
    { s: minutesToSlider(36 * 60), label: "+36h" },
    { s: 1000, label: "+48h" },
  ];
  return (
    <div className="glass-hud w-full px-4 pb-3 pt-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          variant="signal"
          size="sm"
          iconOnly
          aria-label={playing ? "Pause timeline" : "Play timeline"}
          onClick={onPlay}
        >
          {playing ? <I.pause className="h-4 w-4" /> : <I.play className="h-4 w-4" />}
        </Button>
        <Tag tone={segmentKind === "observed" ? "delivered" : "ai"} solid>
          {segmentKind === "observed" ? "Observed" : "Forecast"}
        </Tag>
        <span className="font-mono text-[12px] tracking-[0.03em] text-ink">{formatOffset(minutes)}</span>
        <span className="font-mono text-[11.5px] tracking-[0.03em] text-ink-3">{utc}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[12px] text-ink-2">{loading ?? segmentLabel}</span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="absolute inset-y-0 left-0 bg-delivered/45" style={{ width: "30%" }} />
          <div className="absolute inset-y-0 right-0 bg-ai/35" style={{ width: "70%" }} />
          <div className="absolute inset-y-0 w-[3px] bg-accent" style={{ left: "calc(30% - 1.5px)" }} />
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(slider)}
          onChange={(e) => onSlider(Number(e.target.value))}
          aria-label="Weather timeline: two hours of observations through a 48-hour forecast"
          aria-valuetext={`${formatOffset(minutes)} — ${segmentKind}`}
          className="desk-range relative z-10 w-full"
        />
      </div>
      <div className="relative mt-1 h-4">
        {ticks.map((t) => (
          <span
            key={t.label}
            className={cn("absolute -translate-x-1/2 font-mono text-[10px] tracking-[0.06em]", t.label === "NOW" ? "text-accent-strong" : "text-ink-3")}
            style={{ left: `${t.s / 10}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Ramp({ title, stops, labels }: { title: string; stops: string; labels: [string, string] }) {
  return (
    <div className="min-w-[132px]">
      <div className="eyebrow mb-1">{title}</div>
      <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}

export function Legends({ show }: { show: { radar: boolean; clouds: boolean; wind: boolean } }) {
  if (!show.radar && !show.clouds && !show.wind) return null;
  return (
    <div className="glass-hud flex flex-wrap items-end gap-x-5 gap-y-2 px-3.5 py-2.5">
      {show.clouds && <Ramp title="Cloud tops" stops="rgb(150 160 180), rgb(235 238 245), #fff" labels={["low", "high · cold"]} />}
      {show.radar && <Ramp title="Radar" stops="#7fd3ff, #2f8cff, #3bd16f, #ffe14d, #ff8a3d, #ff3b4e" labels={["light", "extreme"]} />}
      {show.wind && <Ramp title="Wind (kt)" stops="#73ccff, #ebfaff, #ffe673, #ff8538, #ff47a0" labels={["0", "55+"]} />}
    </div>
  );
}

export type CameraPreset = "globe" | "gulf" | "bay";

export function CameraPresets({ value, onChange }: { value: CameraPreset | null; onChange: (p: CameraPreset) => void }) {
  return (
    <div className="glass-hud p-1">
      <SegmentedTabs<CameraPreset>
        ariaLabel="Camera"
        size="sm"
        value={value ?? "globe"}
        onChange={onChange}
        tabs={[
          { id: "globe", label: "Globe" },
          { id: "gulf", label: "Gulf" },
          { id: "bay", label: "Tampa Bay 3D" },
        ]}
      />
    </div>
  );
}
