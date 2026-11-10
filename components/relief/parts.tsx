import React from "react";
import { I } from "@/components/icons";
import type { Provenance, StageKey, ReliefCase } from "@/lib/relief/cases";
import { STAGES } from "@/lib/relief/cases";
import { Tag, type Tone } from "@/components/ui/Tag";

/**
 * Who says so? Every piece of evidence in Landfall carries one of these labels so a judge,
 * auditor or coordinator can tell provider-verified facts from self-reported ones.
 */
const PROV: Record<Provenance, { label: string; tone: Tone }> = {
  PROVIDER: { label: "PayPal", tone: "paypal" },
  INTERNAL: { label: "Landfall", tone: "neutral" },
  RECIPIENT_REPORTED: { label: "Resident-reported", tone: "delivered" },
  OPERATOR_ATTESTED: { label: "Operator", tone: "amber" },
};

export function ProvenanceTag({ provenance, className = "" }: { provenance: Provenance; className?: string }) {
  const p = PROV[provenance];
  return (
    <Tag
      tone={p.tone}
      className={className}
      title={
        provenance === "PROVIDER"
          ? "Reported by PayPal"
          : provenance === "RECIPIENT_REPORTED"
          ? "Reported by the household — never upgraded to provider-verified"
          : provenance === "OPERATOR_ATTESTED"
          ? "Attested by an operator"
          : "Recorded by Landfall"
      }
    >
      {p.label}
    </Tag>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  SUCCESS: "delivered",
  UNCLAIMED: "amber",
  PENDING: "neutral",
  ONHOLD: "danger",
  BLOCKED: "danger",
  FAILED: "danger",
  RETURNED: "amber",
  REFUNDED: "amber",
  REVERSED: "amber",
};

export function PayPalStatusBadge({ status }: { status: string }) {
  return <Tag tone={STATUS_TONE[status] ?? "neutral"}>{status}</Tag>;
}

/** Five dots: approved → sent → credited → confirmed → closed. A filled dot = that fact is evidenced. */
export function StageDots({ c, showLabel = true }: { c: Pick<ReliefCase, "stagesReached" | "stage">; showLabel?: boolean }) {
  const current = STAGES.find((s) => s.key === c.stage);
  return (
    <span className="inline-flex items-center gap-2 leading-none" aria-label={`Stage: ${current?.label}`}>
      <span className="inline-flex items-center gap-1" aria-hidden>
        {STAGES.map((s) => (
          <span
            key={s.key}
            className={`h-2 w-2 rounded-full transition-colors ${
              c.stagesReached[s.key as StageKey]
                ? s.key === "CREDITED"
                  ? "bg-paypal"
                  : s.key === "CONFIRMED" || s.key === "CLOSED"
                  ? "bg-delivered"
                  : "bg-ink-2"
                : "bg-white/12"
            }`}
          />
        ))}
      </span>
      {showLabel && <span className="text-[12.5px] leading-none text-ink">{current?.label}</span>}
    </span>
  );
}

export function EvidenceState({ state }: { state: "present" | "missing" | "not_expected" }) {
  if (state === "present")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-none text-delivered">
        <I.check className="h-3.5 w-3.5" strokeWidth={2.5} /> Present
      </span>
    );
  if (state === "missing")
    return <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-none text-amber">● Missing</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] leading-none text-ink-3">
      <I.minus className="h-3.5 w-3.5" /> Not expected
    </span>
  );
}

export const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const money2 = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
