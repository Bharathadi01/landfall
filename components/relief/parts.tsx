import React from "react";
import { Check, Minus } from "lucide-react";
import type { Provenance, StageKey, ReliefCase } from "@/lib/relief/cases";
import { STAGES } from "@/lib/relief/cases";

/**
 * Who says so? Every piece of evidence in Landfall carries one of these labels so a judge,
 * auditor or coordinator can tell provider-verified facts from self-reported ones.
 */
const PROV: Record<Provenance, { label: string; cls: string }> = {
  PROVIDER: { label: "PayPal", cls: "border-paypal/30 bg-paypal/10 text-paypal" },
  INTERNAL: { label: "Landfall", cls: "border-white/15 bg-white/[0.05] text-ink-2" },
  RECIPIENT_REPORTED: { label: "Resident-reported", cls: "border-accent/30 bg-accent/10 text-accent-strong" },
  OPERATOR_ATTESTED: { label: "Operator", cls: "border-amber/30 bg-amber/10 text-amber" },
};

export function ProvenanceTag({ provenance, className = "" }: { provenance: Provenance; className?: string }) {
  const p = PROV[provenance];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[5px] font-mono text-[10px] font-medium uppercase leading-none tracking-wide ${p.cls} ${className}`}
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
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "field-badge-success",
  UNCLAIMED: "field-badge-warning",
  PENDING: "field-badge-neutral",
  ONHOLD: "field-badge-critical",
  BLOCKED: "field-badge-critical",
  FAILED: "field-badge-critical",
  RETURNED: "field-badge-warning",
  REFUNDED: "field-badge-warning",
  REVERSED: "field-badge-warning",
};

export function PayPalStatusBadge({ status }: { status: string }) {
  return <span className={`field-badge ${STATUS_STYLE[status] ?? "field-badge-neutral"}`}>{status}</span>;
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
                  ? "bg-accent"
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
      <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-none text-accent-strong">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Present
      </span>
    );
  if (state === "missing")
    return <span className="inline-flex items-center gap-1 text-[12px] font-medium leading-none text-amber">● Missing</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] leading-none text-ink-3">
      <Minus className="h-3.5 w-3.5" /> Not expected
    </span>
  );
}

export const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const money2 = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
