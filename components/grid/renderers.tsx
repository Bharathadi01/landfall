"use client";

import React from "react";
import { Tag } from "@/components/ui/Tag";
import { PayPalStatusBadge, ProvenanceTag, EvidenceState } from "@/components/relief/parts";
import { STAGES, type StageKey } from "@/lib/relief/cases";
import { cn } from "@/lib/utils";

/** Priority tier → on-air tag. */
export function TierCell({ value }: { value?: number }) {
  if (!value) return null;
  return <Tag tone={value === 1 ? "danger" : value === 2 ? "amber" : "delivered"}>Tier {value}</Tag>;
}

export function StatusCell({ value }: { value?: string }) {
  return value ? <PayPalStatusBadge status={value} /> : null;
}

/** Five-dot delivery trail that follows the row's own stage fields (so it updates live with the feed). */
export function StageCell({ data, value }: { data?: { stageKey: StageKey; stagesReached: Record<StageKey, boolean> }; value?: string }) {
  if (!data) return <span>{value}</span>;
  const current = STAGES.find((s) => s.key === data.stageKey);
  return (
    <span className="inline-flex items-center gap-2 leading-none" aria-label={`Stage: ${current?.label}`}>
      <span className="inline-flex items-center gap-1" aria-hidden>
        {STAGES.map((s) => (
          <span
            key={s.key}
            className={cn(
              "h-2 w-2 rounded-full transition-colors duration-500",
              data.stagesReached[s.key as StageKey]
                ? s.key === "CREDITED" ? "bg-paypal" : s.key === "CONFIRMED" || s.key === "CLOSED" ? "bg-delivered" : "bg-ink-2"
                : "bg-ink/12"
            )}
          />
        ))}
      </span>
      <span className="text-[12.5px] text-ink">{current?.label}</span>
    </span>
  );
}

export function EvidenceCell({ data, value }: { data?: { evidencePct: number }; value?: string }) {
  if (!data) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink/10">
        <span className={cn("block h-full rounded-full", data.evidencePct === 100 ? "bg-delivered" : "bg-amber")} style={{ width: `${data.evidencePct}%` }} />
      </span>
      <span className="tabular text-[12px] text-ink-2">{value}</span>
    </span>
  );
}

export const ProvenanceCell = ({ value }: { value?: any }) => <ProvenanceTag provenance={value} />;
export const EvidenceStateCell = ({ value }: { value?: any }) => <EvidenceState state={value} />;

/** Custom tooltip for the "Next permitted action" column: the reason, then why this case ranks where it does. */
export function CaseTooltip(params: { data?: { _case?: any } }) {
  const c = params.data?._case;
  if (!c) return null;
  return (
    <div className="glass-hud max-w-[340px] p-3.5 text-[12.5px] leading-snug text-ink">
      <div className="eyebrow mb-1.5">Why this action</div>
      <p className="text-ink-2">{c.nextAction.reason || c.nextAction.plain}</p>
      {c.priority.reasons.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-ink/10 pt-2.5">
          {c.priority.reasons.slice(0, 4).map((r: { label: string; points: number }) => (
            <li key={r.label} className="flex justify-between gap-4 text-ink-2">
              <span>{r.label}</span>
              <span className="font-mono text-ink-3">+{r.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NoCasesOverlay() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 text-center">
      <span className="eyebrow">No matching cases</span>
      <p className="max-w-xs text-[13px] text-ink-2">Nothing fits these filters. Clear a filter, or ask the grid for “reset all grid filters”.</p>
    </div>
  );
}
