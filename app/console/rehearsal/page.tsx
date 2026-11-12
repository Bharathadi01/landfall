"use client";


import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { I } from "@/components/icons";
import React, { useState, useEffect } from "react";
import {
  REHEARSAL_STORMS,
  REHEARSAL_SCENARIOS,
  runStormRehearsal,
  type RehearsalScenarioId,
  type RehearsalStep,
  type RehearsalExecutionResult,
} from "@/lib/rehearsal/lab";

export default function StormRehearsalLabPage() {
  const [selectedStormId, setSelectedStormId] = useState<string>("milton-2024");
  const [selectedScenarioId, setSelectedScenarioId] = useState<RehearsalScenarioId>("NORMAL_FUNDING");
  const [activeStep, setActiveStep] = useState<RehearsalStep>("RECONCILIATION");
  const [result, setResult] = useState<RehearsalExecutionResult | null>(null);
  const [passkeysApproved, setPasskeysApproved] = useState(false);
    const [rehearsalExecuted, setRehearsalExecuted] = useState(false);

  useEffect(() => {
    const res = runStormRehearsal({
      stormId: selectedStormId,
      scenarioId: selectedScenarioId,
      targetStep: activeStep,
    });
    setResult(res);
    setPasskeysApproved(false);
    setRehearsalExecuted(false);
  }, [selectedStormId, selectedScenarioId, activeStep]);

  if (!result) return null;

  const currentStorm = result.storm;
  const currentScenario = result.scenario;
  const readiness = result.readiness;

  const stepsList: Array<{ id: RehearsalStep; label: string; num: string }> = [
    { id: "WATCH_ISSUANCE", label: "Watch Issuance", num: "1" },
    { id: "WARNING_UPGRADE", label: "Warning Upgrade", num: "2" },
    { id: "EXPOSURE_EVALUATION", label: "Exposure Check", num: "3" },
    { id: "PLAN_GENERATION", label: "Plan & Liquidity", num: "4" },
    { id: "AI_PLAN_REVIEW", label: "AI Audit Review", num: "5" },
    { id: "DUAL_PASSKEY_APPROVAL", label: "Dual Approval", num: "6" },
    { id: "SANDBOX_PAYOUT_REHEARSAL", label: "Sandbox Payout", num: "7" },
    { id: "RECONCILIATION", label: "Reconciliation", num: "8" },
  ];

  const money = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const stepIdx = stepsList.findIndex((x) => x.id === activeStep);
  const statusWord: Record<string, { w: string; tone: "delivered" | "amber" | "neutral" }> = {
    COMPLETED_SANDBOX: { w: "Would be paid (simulated)", tone: "delivered" },
    HALTED_BY_POLICY: { w: "Stopped by the rules", tone: "amber" },
  };
  const st = statusWord[result.rehearsalPayoutStatus] ?? { w: String(result.rehearsalPayoutStatus).toLowerCase().replace(/_/g, " "), tone: "neutral" as const };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Before landfall · Storm Drill · simulated, no money moves"
        title="Practise on real storms"
        accent="before the next one."
        description="Replay Milton, Helene or Idalia against seven stress tests: shortfalls, false alarms, failed payouts. Every number is computed by the same rules the real response uses."
        actions={
          <SegmentedTabs<string>
            ariaLabel="Storm"
            value={selectedStormId}
            onChange={(id) => setSelectedStormId(id)}
            tabs={REHEARSAL_STORMS.map((x) => ({ id: x.stormId, label: `${x.name} (${x.year})` }))}
          />
        }
      />

      <div className="note" data-tone="amber">
        <span className="note-label">Drill mode</span>
        Results are simulated. Nothing here signs, approves or sends money.
      </div>

      {/* 1 — the stress test */}
      <section aria-labelledby="scen-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="scen-h" className="text-title-2 text-ink">Choose a stress test</h2>
          <span className="text-[13px] text-ink-3">Each one pushes the rules a different way</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Stress test">
          {Object.values(REHEARSAL_SCENARIOS).map((sc) => {
            const on = selectedScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`pane flex items-start gap-3 p-3.5 text-left transition-colors ${on ? "!border-accent ring-2 ring-accent/15" : "hover:!border-line-strong"}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-accent" : "border-line-strong"}`} aria-hidden>
                  {on && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{sc.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3 line-clamp-2">{sc.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 — the eight steps */}
      <nav aria-label="Response steps" className="pane p-4">
        <ol className="relative grid grid-cols-4 gap-y-4 md:grid-cols-8">
          {stepsList.map((step, i) => {
            const on = activeStep === step.id;
            const done = i < stepIdx;
            return (
              <li key={step.id} className="relative flex flex-col items-center text-center">
                {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[13px] h-px w-full ${i <= stepIdx ? "bg-accent" : "bg-line"}`} />}
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  aria-current={on ? "step" : undefined}
                  className="group relative z-10 flex flex-col items-center gap-2 px-1"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold tabular transition-colors ${on ? "border-accent bg-accent text-on-accent" : done ? "border-accent bg-surface text-accent-strong" : "border-line-strong bg-surface text-ink-3 group-hover:border-ink-3"}`}>
                    {done ? <I.check className="h-3.5 w-3.5" /> : step.num}
                  </span>
                  <span className={`text-[12.5px] leading-tight ${on ? "font-semibold text-ink" : "text-ink-2"}`}>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 3 — what happened */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <section className="pane space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="text-[12.5px] text-ink-3">{currentStorm.name} {currentStorm.year} · peak category {currentStorm.peakCategory}</div>
                <h2 className="mt-1 text-title-2 text-ink">{currentScenario.title}</h2>
              </div>
              <Tag tone={st.tone}>{st.w}</Tag>
            </div>
            <p className="text-[14.5px] leading-relaxed text-ink-2">{result.explanation}</p>
            <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
              <Fig label="Weather office" value={String(currentStorm.landfallWfo)} />
              <Fig label="Warning came" value={`${currentStorm.historicalLeadTimeHours} h before`} />
              <Fig label="Paid within" value="52 h window" />
            </dl>
          </section>

          <section className="pane p-6" aria-labelledby="exp-h">
            <h3 id="exp-h" className="text-[16px] font-semibold text-ink">Household Exposure & Prioritization</h3>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              <Fig big label="In the warning area" value={String(result.exposedHouseholdsCount)} />
              <Fig big label="Paid first" value={String(result.fundedCount)} tone="delivered" />
              <Fig big label="Waiting or in review" value={String(result.waitlistedCount + result.needsReviewCount)} tone="amber" />
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-3">Tested with a point-in-polygon check in code. Families who evacuated keep their home location. The AI never sets eligibility.</p>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-6">
          <section className="pane p-6" aria-labelledby="lad-h">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <h3 id="lad-h" className="text-[16px] font-semibold text-ink">Pre-Disaster Liquidity Ladder</h3>
              <Tag tone={readiness.isFullyFunded ? "delivered" : "amber"}>{readiness.isFullyFunded ? "Can pay everyone" : String(readiness.state).toLowerCase().replace(/_/g, " ")}</Tag>
            </div>
            <dl className="mt-2 divide-y divide-line text-[14px]">
              <LadderRow label="Cash at PayPal" value={money(readiness.waterfall.paypalAvailableCents)} />
              <LadderRow label="Protected reserve (30%), never spent" value={`− ${money(readiness.waterfall.reserveProtectedCents)}`} tone="amber" />
              <LadderRow label="Free for the first payments" value={money(readiness.allocatableCents)} strong />
              <LadderRow label="Pledged by standby donors" value={money(readiness.contingentPledgesCents)} tone="paypal" />
            </dl>
          </section>

          <section className="pane space-y-4 p-6" aria-labelledby="appr-h">
            <h3 id="appr-h" className="text-[16px] font-semibold text-ink">Two-Person Approval Rehearsal (simulated)</h3>
            <ul className="divide-y divide-line rounded-md border border-line">
              {[
                ["Rehearsal approver A", "Fictional coordinator · no real key"],
                ["Rehearsal approver B", "Fictional finance director · no real key"],
              ].map(([who, role]) => (
                <li key={who} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{who}</span>
                    <span className="block text-[12.5px] text-ink-3">{role}</span>
                  </span>
                  <Tag tone={passkeysApproved ? "delivered" : "neutral"}>{passkeysApproved ? "Approved (simulated)" : "Not yet"}</Tag>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" onClick={() => setPasskeysApproved(true)} disabled={passkeysApproved} leading={<I.twoKeyApproval className="h-4 w-4" />}>
                {passkeysApproved ? "Approvals simulated" : "Simulate both approvals"}
              </Button>
              <Button variant="signal" onClick={() => setRehearsalExecuted(true)} disabled={rehearsalExecuted || !passkeysApproved}>
                {rehearsalExecuted ? "Rehearsal complete" : "Run the rehearsal"}
              </Button>
            </div>
            <p className="text-[12.5px] text-ink-3">Real payments use real, server-checked approvals on the Approvals page. This rehearsal never signs or sends anything.</p>
          </section>

          <section className="pane p-6" aria-labelledby="rec-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
              <h3 id="rec-h" className="text-[16px] font-semibold text-ink">Reconciliation & Audit Hash</h3>
              <span className="font-code text-[11.5px] text-ink-3">{result.reconciliationSummary.paypalBatchId}</span>
            </div>
            <dl className="mt-2 divide-y divide-line text-[14px]">
              <LadderRow label="Sent in the rehearsal" value={result.reconciliationSummary.totalAmountGrossFormatted} />
              <LadderRow label="PayPal fees ($0.25 a payment)" value={result.reconciliationSummary.totalFeesFormatted} />
              <LadderRow label="Relief that reached families" value={result.reconciliationSummary.netReliefDeliveredFormatted} strong tone="delivered" />
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
              <span className="text-ink-3">Audit hash</span>
              <span className="truncate font-code text-ink-2" title={result.reconciliationSummary.immutableAuditHash}>{result.reconciliationSummary.immutableAuditHash}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Fig({ label, value, tone, big }: { label: string; value: string; tone?: "delivered" | "amber"; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        {tone && <span className={`h-1.5 w-1.5 rounded-full ${tone === "delivered" ? "bg-delivered" : "bg-amber"}`} aria-hidden />}
        {label}
      </dt>
      <dd className={big ? "figure mt-1.5 text-[34px] leading-none text-ink" : "mt-1 text-[14.5px] font-semibold text-ink"}>{value}</dd>
    </div>
  );
}

function LadderRow({ label, value, tone, strong }: { label: string; value: string; tone?: "amber" | "paypal" | "delivered"; strong?: boolean }) {
  const c = tone === "amber" ? "text-amber" : tone === "paypal" ? "text-paypal" : tone === "delivered" ? "text-delivered" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-2"}>{label}</dt>
      <dd className={`tabular ${strong ? "text-[16px] font-semibold" : "font-medium"} ${c}`}>{value}</dd>
    </div>
  );
}
