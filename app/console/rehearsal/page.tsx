"use client";


import { PageTitle } from "@/components/ui/primitives";
import { FlaskConical as __HeaderIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import {
  REHEARSAL_STORMS,
  REHEARSAL_SCENARIOS,
  runStormRehearsal,
  type RehearsalScenarioId,
  type RehearsalStep,
  type RehearsalExecutionResult,
} from "@/lib/rehearsal/lab";
import { PasskeyApprovalModal } from "@/components/security/PasskeyApprovalModal";
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Users,
} from "lucide-react";

export default function StormRehearsalLabPage() {
  const [selectedStormId, setSelectedStormId] = useState<string>("milton-2024");
  const [selectedScenarioId, setSelectedScenarioId] = useState<RehearsalScenarioId>("NORMAL_FUNDING");
  const [activeStep, setActiveStep] = useState<RehearsalStep>("RECONCILIATION");
  const [result, setResult] = useState<RehearsalExecutionResult | null>(null);
  const [passkeysApproved, setPasskeysApproved] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
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

  return (
    <div className="space-y-6">
      {/* Rehearsal notice */}
      <div className="inline-flex items-center gap-2 rounded-full border border-amber/25 bg-amber/[0.08] px-3.5 py-1.5 text-[12px] text-amber">
        <span className="live-dot" /> Drill mode · simulated results · no real funds move
      </div>

      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
        <PageTitle
          eyebrow="Storm Drill · past hurricanes"
          icon={__HeaderIcon}
          tone="amber"
          title="Practice on real storms"
          accent="before the next one."
          description="Replay Milton, Helene or Idalia against seven stress tests — shortfalls, false alarms, failed payouts — with zero real money moving."
        />

        {/* Storm Selector Pills */}
        <div className="flex items-center gap-1.5 bg-surface-2 p-1.5 rounded-xl border border-line">
          <span className="text-xs text-ink-3 font-mono px-2">Storm:</span>
          {REHEARSAL_STORMS.map((s) => (
            <button
              key={s.stormId}
              onClick={() => setSelectedStormId(s.stormId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedStormId === s.stormId
                  ? "bg-surface text-ink font-semibold shadow-xs"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {s.name} ({s.year})
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Stress-Test Selector Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Select Response Scenario & Stress-Test:
          </span>
          <span className="text-xs text-ink-3 font-mono">
            Evaluates deterministic guardrails under operational pressure
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.values(REHEARSAL_SCENARIOS).map((sc) => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioId(sc.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-surface border-accent text-ink shadow-md ring-2 ring-accent/20"
                    : "bg-surface-2/60 border-line text-ink-2 hover:bg-surface"
                }`}
              >
                <span className="text-xs font-semibold block">{sc.title}</span>
                <span className="text-[10px] text-ink-3 mt-1.5 block line-clamp-2 leading-relaxed">
                  {sc.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 8-Stage Rehearsal Stepper */}
      <div className="field-paper p-2.5 overflow-x-auto shadow-sm">
        <div className="flex items-center justify-between min-w-[700px] gap-2">
          {stepsList.map((step) => {
            const isCurrent = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-accent text-white shadow-xs font-semibold"
                    : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent ? "bg-surface text-accent" : "bg-surface-2 text-ink-3"
                  }`}
                >
                  {step.num}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Split Operational Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario Narrative & Policy Constraints */}
        <div className="lg:col-span-6 space-y-6">
          {/* Narrative Card */}
          <div className="field-paper p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="field-badge-evergreen font-mono text-[11px]">
                  {currentStorm.stormId.toUpperCase()} · Peak Cat {currentStorm.peakCategory}
                </span>
                <h2 className="text-xl font-serif font-bold text-ink mt-2">
                  {currentScenario.title}
                </h2>
              </div>
              <span className="field-badge-neutral font-mono text-xs">
                Lead Time: +{currentStorm.historicalLeadTimeHours}h
              </span>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed bg-canvas p-4 rounded-xl border border-line">
              {result.explanation}
            </p>

            {/* Storm Historical Facts */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
              <div className="bg-canvas p-3 rounded-xl border border-line">
                <span className="text-ink-3 text-[11px] block font-mono">Landfall WFO</span>
                <span className="font-bold text-ink mt-0.5 block">{currentStorm.landfallWfo}</span>
              </div>
              <div className="bg-canvas p-3 rounded-xl border border-line">
                <span className="text-ink-3 text-[11px] block font-mono">Warning Window</span>
                <span className="font-bold text-accent mt-0.5 block">52 Hours Prior</span>
              </div>
              <div className="bg-canvas p-3 rounded-xl border border-line">
                <span className="text-ink-3 text-[11px] block font-mono">Rehearsal Status</span>
                <span
                  className={`font-bold mt-0.5 block font-mono ${
                    result.rehearsalPayoutStatus === "COMPLETED_SANDBOX"
                      ? "text-accent"
                      : result.rehearsalPayoutStatus === "HALTED_BY_POLICY"
                      ? "text-amber"
                      : "text-storm"
                  }`}
                >
                  {result.rehearsalPayoutStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Household Exposure & Tiers Breakdown */}
          <div className="field-paper p-6 space-y-4">
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
              Household Exposure & Prioritization
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-canvas p-3.5 rounded-xl border border-line">
                <span className="text-ink-3 block font-mono text-[11px]">Exposed in Polygon</span>
                <span className="text-xl font-serif font-bold text-storm mt-1 block tabular-nums">
                  {result.exposedHouseholdsCount}
                </span>
              </div>
              <div className="bg-canvas p-3.5 rounded-xl border border-line">
                <span className="text-ink-3 block font-mono text-[11px]">Funded Immediately</span>
                <span className="text-xl font-serif font-bold text-accent mt-1 block tabular-nums">
                  {result.fundedCount}
                </span>
              </div>
              <div className="bg-canvas p-3.5 rounded-xl border border-line">
                <span className="text-ink-3 block font-mono text-[11px]">Waitlisted / Review</span>
                <span className="text-xl font-serif font-bold text-amber mt-1 block tabular-nums">
                  {result.waitlistedCount + result.needsReviewCount}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-ink-3 italic">
              Evaluated with Turf.js point-in-polygon. Displaced residents preserve original landfall coordinates. AI is strictly barred from setting eligibility.
            </p>
          </div>
        </div>

        {/* Right Column: Financial Liquidity Ladder & Rehearsal Payout Receipt */}
        <div className="lg:col-span-6 space-y-6">
          {/* Treasury Liquidity Ladder Card */}
          <div className="field-paper p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
                Pre-Disaster Liquidity Ladder
              </h3>
              <span
                className={`field-badge-${
                  readiness.isFullyFunded ? "evergreen" : "warning"
                } uppercase font-mono text-[11px]`}
              >
                {readiness.state}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2.5 rounded-lg bg-canvas border border-line">
                <span className="text-ink-2">Total Liquid PayPal Cash:</span>
                <span className="font-bold text-ink tabular-nums">
                  ${(readiness.waterfall.paypalAvailableCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-canvas border border-line">
                <span className="text-ink-2">Protected 30% Solvency Reserve:</span>
                <span className="font-bold text-amber tabular-nums">
                  -${(readiness.waterfall.reserveProtectedCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-accent-soft border border-accent/20">
                <span className="text-accent font-semibold">Net Allocatable for Tranche 1:</span>
                <span className="font-bold text-accent tabular-nums">
                  ${(readiness.allocatableCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-canvas border border-line">
                <span className="text-ink-2">Contingent Standby Pledges:</span>
                <span className="font-bold text-paypal tabular-nums">
                  ${(readiness.contingentPledgesCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Two-Person Passkey Approval Simulation */}
          <div className="field-paper p-6 space-y-4">
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
              Two-Person Passkey Authorization Rehearsal
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 bg-canvas rounded-xl border border-line flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-ink block">Dr. Sarah Lin</span>
                  <span className="text-[11px] text-ink-2">Emergency Operations Lead (Key 1)</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                  passkeysApproved
                    ? "field-badge-evergreen"
                    : "field-badge-neutral"
                }`}>
                  {passkeysApproved ? "✓ WEBAUTHN SIGNED" : "AWAITING WEBAUTHN"}
                </span>
              </div>
              <div className="p-3 bg-canvas rounded-xl border border-line flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-ink block">Marcus Vance</span>
                  <span className="text-[11px] text-ink-2">Fiduciary Trustee (Key 2)</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                  passkeysApproved
                    ? "field-badge-evergreen"
                    : "field-badge-neutral"
                }`}>
                  {passkeysApproved ? "✓ WEBAUTHN SIGNED" : "AWAITING WEBAUTHN"}
                </span>
              </div>
            </div>

            {/* Passkey Modal Trigger & Execution Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setIsPasskeyModalOpen(true)}
                className="w-full py-2.5 rounded-xl text-xs font-medium border border-paypal/30 bg-paypal/10 hover:bg-paypal/20 text-paypal transition flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {passkeysApproved
                    ? "Passkeys Verified (Click to Re-authenticate)"
                    : "Authenticate Dual WebAuthn Passkeys (Hardware / Biometric)"}
                </span>
              </button>

              <button
                onClick={() => setRehearsalExecuted(true)}
                disabled={rehearsalExecuted || !passkeysApproved}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  rehearsalExecuted
                    ? "bg-surface-2 text-ink-3 cursor-not-allowed border border-line"
                    : !passkeysApproved
                    ? "bg-surface-2 text-ink-3 cursor-not-allowed border border-line"
                    : "field-btn-primary"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {rehearsalExecuted
                    ? "Rehearsal Sandbox Payout Completed"
                    : !passkeysApproved
                    ? "Dual Passkeys Required to Rehearse Payout"
                    : "Execute Rehearsal Payout (PayPal Sandbox Labelled)"}
                </span>
              </button>
            </div>

            {/* Passkey Approval Modal */}
            <PasskeyApprovalModal
              isOpen={isPasskeyModalOpen}
              onClose={() => setIsPasskeyModalOpen(false)}
              planId={`rehearsal_${currentStorm.stormId}_${currentScenario.id}`}
              planHash={result.reconciliationSummary.immutableAuditHash}
              recipientCount={result.fundedCount}
              totalAmountCents={result.fundedCount * 10025}
              onBothApproved={() => {
                setPasskeysApproved(true);
                setIsPasskeyModalOpen(false);
              }}
            />
          </div>

          {/* Simulated / Sandbox Reconciliation Receipt */}
          <div className="field-paper p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
                Reconciliation & Audit Hash
              </h3>
              <span className="text-[10px] font-mono text-accent font-semibold">
                Batch: {result.reconciliationSummary.paypalBatchId}
              </span>
            </div>

            <div className="p-3.5 bg-canvas rounded-xl border border-line text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-2">Gross Rehearsal Disbursed:</span>
                <span className="text-ink font-bold tabular-nums">
                  {result.reconciliationSummary.totalAmountGrossFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">PayPal Rail Fees ($0.25/item):</span>
                <span className="text-ink-2 tabular-nums">
                  {result.reconciliationSummary.totalFeesFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">Net Relief Delivered:</span>
                <span className="text-accent font-bold tabular-nums">
                  {result.reconciliationSummary.netReliefDeliveredFormatted}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-line text-[10px]">
                <span className="text-ink-3">Audit Trail Hash:</span>
                <span className="text-paypal truncate max-w-[200px]">
                  {result.reconciliationSummary.immutableAuditHash}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
