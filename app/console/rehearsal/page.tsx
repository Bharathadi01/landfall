"use client";

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
      {/* Rehearsal Drill Disclaimer Banner */}
      <div className="field-paper p-4 border-[#D99B43] bg-[#FDF8EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-[#D99B43]/20 text-[#D99B43] font-bold text-lg">
            ⚡
          </span>
          <div>
            <p className="font-bold text-xs font-mono uppercase tracking-wider text-[#D99B43]">
              Storm Rehearsal Lab · Operational Drill Environment
            </p>
            <p className="text-xs text-[#58665F] mt-0.5">
              Practice full anticipatory response workflows against historical storms and liquidity shocks. Zero live funds moved. Simulated scenario results.
            </p>
          </div>
        </div>
        <span className="field-badge-warning font-mono text-xs self-start sm:self-auto">
          REHEARSAL MODE
        </span>
      </div>

      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="field-badge-evergreen">Field Atlas Rehearsal Lab</span>
            <span className="field-badge-neutral font-mono text-[11px]">Milton 2024 & Historical Storms</span>
            <span className="field-badge-warning font-mono text-[11px]">Passkey Rehearsal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#192A24] tracking-tight">
            Anticipatory Disaster Drill & Stress Testing
          </h1>
          <p className="text-sm text-[#58665F] mt-1.5 max-w-2xl leading-relaxed">
            Rehearse hurricane response sequences, simulate liquidity drawdown edge cases, test dual WebAuthn
            passkeys, and verify PayPal sandbox batch execution.
          </p>
        </div>

        {/* Storm Selector Pills */}
        <div className="flex items-center gap-1.5 bg-[#ECEAE2] p-1.5 rounded-xl border border-[#DEDCD3]">
          <span className="text-xs text-[#7B847D] font-mono px-2">Storm:</span>
          {REHEARSAL_STORMS.map((s) => (
            <button
              key={s.stormId}
              onClick={() => setSelectedStormId(s.stormId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedStormId === s.stormId
                  ? "bg-[#FFFEFA] text-[#192A24] font-semibold shadow-xs"
                  : "text-[#7B847D] hover:text-[#192A24]"
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
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
            Select Response Scenario & Stress-Test:
          </span>
          <span className="text-xs text-[#7B847D] font-mono">
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
                    ? "bg-[#FFFEFA] border-[#175B47] text-[#192A24] shadow-md ring-2 ring-[#175B47]/20"
                    : "bg-[#ECEAE2]/60 border-[#DEDCD3] text-[#58665F] hover:bg-[#FFFEFA]"
                }`}
              >
                <span className="text-xs font-semibold block">{sc.title}</span>
                <span className="text-[10px] text-[#7B847D] mt-1.5 block line-clamp-2 leading-relaxed">
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
                    ? "bg-[#175B47] text-white shadow-xs font-semibold"
                    : "text-[#58665F] hover:bg-[#ECEAE2]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent ? "bg-white text-[#175B47]" : "bg-[#ECEAE2] text-[#7B847D]"
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
            <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-3">
              <div>
                <span className="field-badge-evergreen font-mono text-[11px]">
                  {currentStorm.stormId.toUpperCase()} · Peak Cat {currentStorm.peakCategory}
                </span>
                <h2 className="text-xl font-serif font-bold text-[#192A24] mt-2">
                  {currentScenario.title}
                </h2>
              </div>
              <span className="field-badge-neutral font-mono text-xs">
                Lead Time: +{currentStorm.historicalLeadTimeHours}h
              </span>
            </div>

            <p className="text-xs text-[#58665F] leading-relaxed bg-[#F4F2EC] p-4 rounded-xl border border-[#DEDCD3]">
              {result.explanation}
            </p>

            {/* Storm Historical Facts */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
              <div className="bg-[#F4F2EC] p-3 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] text-[11px] block font-mono">Landfall WFO</span>
                <span className="font-bold text-[#192A24] mt-0.5 block">{currentStorm.landfallWfo}</span>
              </div>
              <div className="bg-[#F4F2EC] p-3 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] text-[11px] block font-mono">Warning Window</span>
                <span className="font-bold text-[#175B47] mt-0.5 block">52 Hours Prior</span>
              </div>
              <div className="bg-[#F4F2EC] p-3 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] text-[11px] block font-mono">Rehearsal Status</span>
                <span
                  className={`font-bold mt-0.5 block font-mono ${
                    result.rehearsalPayoutStatus === "COMPLETED_SANDBOX"
                      ? "text-[#175B47]"
                      : result.rehearsalPayoutStatus === "HALTED_BY_POLICY"
                      ? "text-[#D99B43]"
                      : "text-[#D76E4B]"
                  }`}
                >
                  {result.rehearsalPayoutStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Household Exposure & Tiers Breakdown */}
          <div className="field-paper p-6 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
              Household Exposure & Prioritization (§4.4)
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-[#F4F2EC] p-3.5 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] block font-mono text-[11px]">Exposed in Polygon</span>
                <span className="text-xl font-serif font-bold text-[#D76E4B] mt-1 block tabular-nums">
                  {result.exposedHouseholdsCount}
                </span>
              </div>
              <div className="bg-[#F4F2EC] p-3.5 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] block font-mono text-[11px]">Funded Immediately</span>
                <span className="text-xl font-serif font-bold text-[#175B47] mt-1 block tabular-nums">
                  {result.fundedCount}
                </span>
              </div>
              <div className="bg-[#F4F2EC] p-3.5 rounded-xl border border-[#DEDCD3]">
                <span className="text-[#7B847D] block font-mono text-[11px]">Waitlisted / Review</span>
                <span className="text-xl font-serif font-bold text-[#D99B43] mt-1 block tabular-nums">
                  {result.waitlistedCount + result.needsReviewCount}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#7B847D] italic">
              Evaluated with Turf.js point-in-polygon. Displaced residents preserve original landfall coordinates. AI is strictly barred from setting eligibility.
            </p>
          </div>
        </div>

        {/* Right Column: Financial Liquidity Ladder & Rehearsal Payout Receipt */}
        <div className="lg:col-span-6 space-y-6">
          {/* Treasury Liquidity Ladder Card */}
          <div className="field-paper p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
                Pre-Disaster Liquidity Ladder (§4.2)
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
              <div className="flex justify-between p-2.5 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                <span className="text-[#58665F]">Total Liquid PayPal Cash:</span>
                <span className="font-bold text-[#192A24] tabular-nums">
                  ${(readiness.waterfall.paypalAvailableCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                <span className="text-[#58665F]">Protected 30% Solvency Reserve:</span>
                <span className="font-bold text-[#D99B43] tabular-nums">
                  -${(readiness.waterfall.reserveProtectedCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-[#E0EEE7] border border-[#175B47]/20">
                <span className="text-[#175B47] font-semibold">Net Allocatable for Tranche 1:</span>
                <span className="font-bold text-[#175B47] tabular-nums">
                  ${(readiness.allocatableCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                <span className="text-[#58665F]">Contingent Standby Pledges:</span>
                <span className="font-bold text-[#316B9B] tabular-nums">
                  ${(readiness.contingentPledgesCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Two-Person Passkey Approval Simulation */}
          <div className="field-paper p-6 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
              Two-Person Passkey Authorization Rehearsal (§4.5)
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 bg-[#F4F2EC] rounded-xl border border-[#DEDCD3] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#192A24] block">Dr. Sarah Lin</span>
                  <span className="text-[11px] text-[#58665F]">Emergency Operations Lead (Key 1)</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                  passkeysApproved
                    ? "field-badge-evergreen"
                    : "field-badge-neutral"
                }`}>
                  {passkeysApproved ? "✓ WEBAUTHN SIGNED" : "AWAITING WEBAUTHN"}
                </span>
              </div>
              <div className="p-3 bg-[#F4F2EC] rounded-xl border border-[#DEDCD3] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#192A24] block">Marcus Vance</span>
                  <span className="text-[11px] text-[#58665F]">Fiduciary Trustee (Key 2)</span>
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
                className="w-full py-2.5 rounded-xl text-xs font-medium border border-[#316B9B]/30 bg-[#316B9B]/10 hover:bg-[#316B9B]/20 text-[#316B9B] transition flex items-center justify-center gap-2"
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
                    ? "bg-[#ECEAE2] text-[#7B847D] cursor-not-allowed border border-[#DEDCD3]"
                    : !passkeysApproved
                    ? "bg-[#ECEAE2] text-[#7B847D] cursor-not-allowed border border-[#DEDCD3]"
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
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
                Reconciliation & Audit Hash (§4.6)
              </h3>
              <span className="text-[10px] font-mono text-[#175B47] font-semibold">
                Batch: {result.reconciliationSummary.paypalBatchId}
              </span>
            </div>

            <div className="p-3.5 bg-[#F4F2EC] rounded-xl border border-[#DEDCD3] text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#58665F]">Gross Rehearsal Disbursed:</span>
                <span className="text-[#192A24] font-bold tabular-nums">
                  {result.reconciliationSummary.totalAmountGrossFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58665F]">PayPal Rail Fees ($0.25/item):</span>
                <span className="text-[#58665F] tabular-nums">
                  {result.reconciliationSummary.totalFeesFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58665F]">Net Relief Delivered:</span>
                <span className="text-[#175B47] font-bold tabular-nums">
                  {result.reconciliationSummary.netReliefDeliveredFormatted}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#DEDCD3] text-[10px]">
                <span className="text-[#7B847D]">Audit Trail Hash:</span>
                <span className="text-[#316B9B] truncate max-w-[200px]">
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
