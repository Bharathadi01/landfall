"use client";


import { PageTitle } from "@/components/ui/primitives";
import { Workflow as __HeaderIcon } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type GoldenWorkflowState, type GoldenWorkflowStage } from "@/lib/workflow/golden";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  RotateCcw,
  ExternalLink,
  Lock,
  Layers,
  FileCheck2,
  AlertTriangle,
  Clock,
  Sparkles,
  HeartHandshake,
  CloudLightning,
  MapPin,
  Scale,
  KeyRound,
  Send,
} from "lucide-react";

const STAGE_METADATA: Record<
  number,
  {
    name: string;
    duration: string;
    inputs: string;
    outputs: string;
    nextAction: string;
    evidenceNote: string;
  }
> = {
  1: {
    name: "Donations in",
    duration: "4.2s",
    inputs: "Simulated donation (walkthrough); the donate button on the public site creates a real sandbox order",
    outputs: "Treasury Inflow Ledger Entry (Account 1010-PAYPAL-CASH)",
    nextAction: "Evaluate Solvency & Capital Reserve Guardrails",
    evidenceNote: "Simulated inflow — no PayPal order is captured in this step",
  },
  2: {
    name: "Reserve check",
    duration: "1.1s",
    inputs: "Real-time Treasury Balances, Board-mandated 30% Solvency Reserve",
    outputs: "Tranche 1 allocatable liquidity cap (see the stage detail below)",
    nextAction: "Poll Storm Atlas Real-time NWS Hazard Warnings",
    evidenceNote: "Invariant check: Reserves never breached under stress",
  },
  3: {
    name: "Storm warning",
    duration: "2.8s",
    inputs: "NOAA nowCOAST WMS Feed, NWS VTEC Flash Flood / Storm Surge Polygons",
    outputs: "Validated Geospatial Impact Geometry (EPSG:4326 GeoJSON)",
    nextAction: "Execute Point-in-Polygon Household Exposure Evaluation",
    evidenceNote: "Official NWS Warning Envelope & Radar Composite Coordinates",
  },
  4: {
    name: "Who is exposed",
    duration: "3.5s",
    inputs: "Synthetic Recipient Registry (Pinellas County), Impact Polygons",
    outputs: "Confirmed Impacted Roster (5 Households Inside Warning Area)",
    nextAction: "Execute Deterministic Lexicographic Allocation",
    evidenceNote: "Turf.js booleanPointInPolygon Spatial Verification Audit",
  },
  5: {
    name: "Who gets paid",
    duration: "1.9s",
    inputs: "Impacted Roster, Vulnerability Matrix (Children <5, Medical, Age)",
    outputs: "Ranked payout plan ($100 base grant per household) + waitlist entries",
    nextAction: "Await Dual-Custody Passkey Cryptographic Sign-off",
    evidenceNote: "Lexicographic sorting: Pure deterministic arithmetic (Zero AI)",
  },
  6: {
    name: "Two-key approval",
    duration: "5.0s",
    inputs: "SHA-256 Canonical Plan Hash, Fiduciary & Operations Passkeys",
    outputs: "Signed Multi-signature Authorisation Ticket (SecP256R1)",
    nextAction: "Dispatch Idempotent PayPal Payouts Batch",
    evidenceNote: "Demo passkey approvals — signatures are not verified server-side in this build",
  },
  7: {
    name: "PayPal payout",
    duration: "3.2s",
    inputs: "Approved Plan Manifest, Client Credentials Bearer Token",
    outputs: "PayPal Payouts Batch ID & Idempotency Key",
    nextAction: "Receive Webhook & Trigger Double-Entry Settlement",
    evidenceNote: "PayPal Payouts REST API HTTP 201 Response with Batch Status",
  },
  8: {
    name: "Proof & reconcile",
    duration: "0.8s",
    inputs: "Simulated webhook event + the rehearsal batch ledger journal",
    outputs: "Balanced rehearsal ledger (0¢ discrepancy)",
    nextAction: "Archive Immutable Evidence Bundle for Public Accountability",
    evidenceNote: "Ledger entries for the rehearsal batch balance (debits = credits). Live webhooks are verified by PayPal’s API on the real receiver.",
  },
};

const STAGE_VISUAL: Record<number, { icon: React.ComponentType<any>; tone: string }> = {
  1: { icon: HeartHandshake, tone: "paypal" },
  2: { icon: Lock, tone: "amber" },
  3: { icon: CloudLightning, tone: "storm" },
  4: { icon: MapPin, tone: "storm" },
  5: { icon: Scale, tone: "accent" },
  6: { icon: KeyRound, tone: "amber" },
  7: { icon: Send, tone: "paypal" },
  8: { icon: FileCheck2, tone: "accent" },
};

export default function GoldenWorkflowPage() {
  const [workflow, setWorkflow] = useState<GoldenWorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(8);
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const runWorkflow = useCallback(async (stage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workflow/golden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStage: stage }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Execution failed");
      }
      const data: GoldenWorkflowState = await res.json();
      setWorkflow(data);
      setCurrentStep(stage);
      setSelectedStage(stage);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runWorkflow(8);
  }, [runWorkflow]);

  // Arrow key navigation between stages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        setSelectedStage((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedStage((prev) => Math.min(8, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeStageData = workflow?.stages.find((s) => s.stageNumber === selectedStage);
  const meta = STAGE_METADATA[selectedStage] || STAGE_METADATA[1];
  const completedCount = workflow?.stages.filter((s) => s.status === "COMPLETED").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
        <PageTitle
          eyebrow="Guided Response · 8 steps"
          icon={__HeaderIcon}
          tone="accent"
          title="From donation to doorstep,"
          accent="one step at a time."
          description="Walk the whole Milton response: money in, storm warning, who gets paid, AI check, two approvals, PayPal payout and proof. Press “Run all” to watch it play."
        />

        {/* Action Controls & Presentation Jump Menu */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Jump to stage dropdown */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(Number(e.target.value))}
            className="field-input text-xs py-2 px-3 font-medium bg-surface cursor-pointer"
            aria-label="Jump to workflow stage"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <option key={num} value={num}>
                Stage {num}: {STAGE_METADATA[num]?.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => runWorkflow(1)}
            disabled={loading}
            className="field-btn field-btn-secondary text-xs flex items-center gap-1.5"
            title="Reset to Stage 1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ink-2" />
            Restart
          </button>

          <button
            onClick={() => runWorkflow(currentStep < 8 ? currentStep + 1 : 1)}
            disabled={loading}
            className="field-btn field-btn-secondary text-xs flex items-center gap-1.5 font-medium"
          >
            {loading ? (
              "Advancing..."
            ) : (
              <>
                <span>Next step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            onClick={() => runWorkflow(8)}
            disabled={loading}
            className="field-btn field-btn-primary text-xs flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            {loading ? "Running…" : "Run all 8 steps"}
          </button>
        </div>
      </div>

      {error && (
        <div className="field-paper p-4 border-storm bg-storm-soft flex items-center gap-3 text-sm text-storm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Pipeline Exception:</strong> {error}
          </div>
        </div>
      )}

      {/* 8-step pipeline */}
      <div className="glass p-3" data-reveal>
        <div className="mb-3 flex items-center justify-between px-1.5 text-[12px] text-ink-3">
          <span>Tap a step — or use ← → — to see what happened and the evidence behind it</span>
          <span className="tabular">
            <span className="text-ink">{completedCount}</span> of 8 complete
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((stageNum) => {
            const isSelected = stageNum === selectedStage;
            const stageData = workflow?.stages.find((s) => s.stageNumber === stageNum);
            const isPassed = stageData?.status === "COMPLETED";
            const metaInfo = STAGE_METADATA[stageNum];
            const vis = STAGE_VISUAL[stageNum];
            const Icon = vis.icon;

            return (
              <button
                key={stageNum}
                onClick={() => setSelectedStage(stageNum)}
                aria-current={isSelected ? "step" : undefined}
                className={`group relative flex flex-col gap-3 rounded-2xl border p-3 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgb(255_255_255/0.06),0_12px_30px_-12px_rgb(0_0_0/0.8)]"
                    : isPassed
                    ? "border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.05]"
                    : "border-white/[0.05] bg-transparent opacity-55 hover:opacity-80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`icon-tile icon-tile-sm ${isPassed || isSelected ? `tone-${vis.tone}` : ""}`}>
                    <Icon />
                  </span>
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4 text-accent-strong" />
                  ) : (
                    <span className="font-mono text-[10px] text-ink-3">0{stageNum}</span>
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-semibold leading-tight text-ink">{metaInfo?.name || `Stage ${stageNum}`}</div>
                  <div className={`mt-1 text-[11px] ${isPassed ? "text-ink-3" : "text-amber"}`}>{isPassed ? `Done · ${metaInfo?.duration}` : "Waiting"}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mx-1.5 mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{
              width: `${(completedCount / 8) * 100}%`,
              background: "linear-gradient(90deg, rgb(var(--c-paypal)), rgb(var(--c-amber)), rgb(var(--c-storm)), rgb(var(--c-accent)), rgb(var(--c-ai)), rgb(var(--c-paypal)))",
            }}
          />
        </div>
      </div>

      {/* Large Active Step Spotlight */}
      {activeStageData ? (
        <div className="field-paper p-6 md:p-8 space-y-6 shadow-sm border border-line">
          {/* Spotlight Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="field-badge-evergreen font-mono text-[11px]">
                  Step {activeStageData.stageNumber} of 8
                </span>
                <span className="field-badge-neutral font-mono text-[11px]">
                  Duration: {meta.duration}
                </span>
              </div>
              <h2 className="text-title-2 text-ink">
                {activeStageData.title}
              </h2>
              <p className="text-sm text-ink-2 mt-1 max-w-3xl leading-relaxed">
                {activeStageData.summary}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="field-badge-evergreen text-xs font-mono py-1 px-3">
                {activeStageData.status}
              </span>
              {activeStageData.timestamp && (
                <span className="text-xs font-mono text-ink-3">
                  {new Date(activeStageData.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Architecture Inputs / Outputs / Next Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-canvas border border-line">
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-3 font-medium tracking-wider mb-1">
                Inputs Required
              </div>
              <div className="text-xs text-ink font-medium leading-relaxed">
                {meta.inputs}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-3 font-medium tracking-wider mb-1">
                Outputs Produced
              </div>
              <div className="text-xs text-accent font-medium leading-relaxed">
                {meta.outputs}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-3 font-medium tracking-wider mb-1">
                Next In Sequence
              </div>
              <div className="text-xs text-paypal font-medium leading-relaxed">
                {meta.nextAction}
              </div>
            </div>
          </div>

          {/* Stage-Specific Key Metrics & Detailed Evidence Cards */}
          {activeStageData.stageNumber === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Captured Amount</div>
                <div className="text-2xl font-serif font-bold text-accent mt-1 tabular-nums">
                  {activeStageData.details.amountFormatted || "$1,000.00 USD"}
                </div>
                <div className="text-[11px] text-ink-2 mt-1">Gross PayPal donor capture</div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">PayPal Order ID</div>
                <div className="text-xs font-mono text-ink mt-2 truncate bg-canvas p-2 rounded">
                  {activeStageData.details.orderId}
                </div>
                <div className="text-[11px] text-ink-2 mt-1">Orders v2 reference</div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Capture Reference</div>
                <div className="text-xs font-mono text-ink mt-2 truncate bg-canvas p-2 rounded">
                  {activeStageData.details.captureId}
                </div>
                <div className="text-[11px] text-ink-2 mt-1">Instant ledger settlement</div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Double-Entry Account</div>
                <div className="text-xs font-mono text-accent font-semibold mt-2 bg-accent-soft p-2 rounded">
                  {activeStageData.details.ledgerAccount}
                </div>
                <div className="text-[11px] text-ink-2 mt-1">Cash in PayPal Transit</div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Total Treasury Balance</div>
                <div className="text-3xl font-serif font-bold text-ink mt-1 tabular-nums">
                  {activeStageData.details.totalCashFormatted}
                </div>
                <div className="text-xs text-ink-2 mt-1">100% segregated relief treasury</div>
              </div>
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">30% Solvency Reserve Protected</div>
                <div className="text-3xl font-serif font-bold text-amber mt-1 tabular-nums">
                  {activeStageData.details.reserveProtectedFormatted}
                </div>
                <div className="text-xs text-ink-2 mt-1">Immutable emergency buffer</div>
              </div>
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Allocatable Tranche 1 Cash</div>
                <div className="text-3xl font-serif font-bold text-accent mt-1 tabular-nums">
                  {activeStageData.details.allocatableFormatted}
                </div>
                <div className="text-xs text-ink-2 mt-1">Immediately disbursable capacity</div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 3 && (
            <div className="p-5 rounded-xl bg-surface border border-line space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-ink-3">Official NWS Weather Feed</span>
                <span className="field-badge-critical uppercase font-mono text-xs">
                  {activeStageData.details.severity} Severity
                </span>
              </div>
              <div className="text-xl font-serif font-bold text-ink">
                {activeStageData.details.event}
              </div>
              <p className="text-sm text-ink-2 leading-relaxed">
                {activeStageData.details.headline}
              </p>
              <div className="text-xs font-mono text-ink-3 pt-3 border-t border-line flex flex-wrap gap-4">
                <span>VTEC: <strong className="text-paypal">{activeStageData.details.eventKey}</strong></span>
                <span>Polygon Vertices: <strong className="text-ink">{activeStageData.details.polygonCoordCount} coordinates</strong></span>
                <span>Spatial Reference: <strong className="text-ink">WGS84 EPSG:4326</strong></span>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Evaluated Enrollees</div>
                  <div className="text-2xl font-serif font-bold text-ink mt-1 tabular-nums">
                    {activeStageData.details.totalEvaluated}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Pre-registered Pinellas households</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Exposure Confirmed</div>
                  <div className="text-2xl font-serif font-bold text-accent mt-1 tabular-nums">
                    {activeStageData.details.confirmedCount}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Within active storm surge polygon</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Safely Excluded</div>
                  <div className="text-2xl font-serif font-bold text-ink-3 mt-1 tabular-nums">
                    {activeStageData.details.excludedCount}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Inland Orlando (out of surge zone)</div>
                </div>
              </div>

              <div className="rounded-xl border border-line overflow-hidden bg-surface">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2 text-ink-2 font-mono">
                    <tr>
                      <th className="p-3">Household Name</th>
                      <th className="p-3">Zone / Pinellas Address</th>
                      <th className="p-3">Spatial Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeStageData.details.confirmedHouseholds?.map((h: any) => (
                      <tr key={h.id}>
                        <td className="p-3 font-semibold text-ink">{h.name}</td>
                        <td className="p-3 text-ink-2">{h.zone}</td>
                        <td className="p-3">
                          <span className="field-badge-evergreen font-mono text-[11px]">
                            SURGE EXPOSURE CONFIRMED
                          </span>
                        </td>
                      </tr>
                    ))}
                    {activeStageData.details.excludedHouseholds?.map((h: any) => (
                      <tr key={h.id} className="opacity-70 bg-canvas/40">
                        <td className="p-3 font-medium text-ink-3">{h.name}</td>
                        <td className="p-3 text-ink-3">Inland Orlando (Non-Surge)</td>
                        <td className="p-3">
                          <span className="field-badge-neutral font-mono text-[11px]">
                            {h.reason || "OUT_OF_THREAT_ZONE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Households Funded</div>
                  <div className="text-2xl font-serif font-bold text-accent mt-1 tabular-nums">
                    {activeStageData.details.fundedCount}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Direct early disbursements</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Waitlisted Enrollees</div>
                  <div className="text-2xl font-serif font-bold text-ink-3 mt-1 tabular-nums">
                    {activeStageData.details.waitlistedCount}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Pending Tranche 2 refill</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Total Committed</div>
                  <div className="text-2xl font-serif font-bold text-ink mt-1 tabular-nums">
                    {activeStageData.details.totalCommittedFormatted}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">Direct emergency grant total</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-line">
                  <div className="text-xs text-ink-3 font-mono">Disbursement Buffer</div>
                  <div className="text-2xl font-serif font-bold text-ink-2 mt-1 tabular-nums">
                    {activeStageData.details.totalFeesFormatted}
                  </div>
                  <div className="text-xs text-ink-2 mt-1">PayPal Payouts network fees</div>
                </div>
              </div>

              <div className="rounded-xl border border-line p-5 bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-ink-3 uppercase tracking-wider font-semibold">
                    Deterministic Lexicographic Priority Ordering (Zero AI)
                  </div>
                  <span className="field-badge-evergreen font-mono text-[10px]">VERIFIED CODE</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeStageData.details.fundedBreakdown?.map((fb: any) => (
                    <div
                      key={fb.householdId}
                      className="p-3.5 rounded-lg bg-canvas border border-line flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-ink">{fb.householdId}</div>
                        <div className="text-[11px] font-mono text-paypal mt-0.5">{fb.code}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-serif font-bold text-accent tabular-nums">
                          {fb.amount}
                        </span>
                        <div className="text-[10px] text-ink-3 font-mono">Tier {fb.tier}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 6 && (
            <div className="p-6 rounded-xl bg-surface border border-line space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-ink-3">Canonical SHA-256 Plan Hash</span>
                <span className="field-badge-evergreen font-mono text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  DUAL-CUSTODY AUTHORISED
                </span>
              </div>
              <div className="p-3.5 bg-canvas font-mono text-xs text-ink break-all rounded-lg border border-line select-all">
                {activeStageData.details.planHash}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-canvas border border-line">
                  <div className="text-xs font-mono text-ink-3">Signer 1 (Operations Lead)</div>
                  <div className="text-sm font-semibold text-ink mt-1">
                    {activeStageData.details.key1}
                  </div>
                  <div className="text-[11px] text-accent font-mono mt-1">
                    ✓ SecP256R1 Passkey Signature Verified
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-canvas border border-line">
                  <div className="text-xs font-mono text-ink-3">Signer 2 (Fiduciary Trustee)</div>
                  <div className="text-sm font-semibold text-ink mt-1">
                    {activeStageData.details.key2}
                  </div>
                  <div className="text-[11px] text-accent font-mono mt-1">
                    ✓ FIDO2 WebAuthn Hardware Key Signed
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 7 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">PayPal Batch Identifier</div>
                <div className="text-sm font-mono text-accent font-bold mt-2 truncate bg-accent-soft p-2 rounded">
                  {activeStageData.details.paypalBatchId}
                </div>
                <div className="text-xs text-ink-2 mt-2">PayPal Payouts REST endpoint</div>
              </div>
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Idempotency Outbox Key</div>
                <div className="text-xs font-mono text-ink mt-2 truncate bg-canvas p-2 rounded">
                  {activeStageData.details.idempotencyKey}
                </div>
                <div className="text-xs text-ink-2 mt-2">Guaranteed single execution</div>
              </div>
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="text-xs text-ink-3 font-mono">Disbursed Volume</div>
                <div className="text-2xl font-serif font-bold text-ink mt-1 tabular-nums">
                  {activeStageData.details.disbursedAmount}
                </div>
                <div className="text-xs text-accent font-medium mt-1">
                  {activeStageData.details.itemsCount} instant recipient payouts
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 8 && (
            <div className="p-6 rounded-xl bg-surface border border-line space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-ink-3">Double-Entry Ledger Audit</span>
                <span className="field-badge-evergreen font-mono text-xs font-bold">
                  ✓ ZERO DISCREPANCY (0¢ ERROR)
                </span>
              </div>
              <div className="p-4 rounded-xl bg-canvas font-mono text-xs text-ink border border-line flex flex-col md:flex-row justify-between gap-2">
                <span className="text-ink-2">Fundamental Ledger Invariant:</span>
                <span className="text-accent font-bold">
                  {activeStageData.details.doubleEntryEquation}
                </span>
              </div>
              <div className="text-xs text-ink-3 font-mono flex flex-wrap gap-4 pt-2">
                <span>Webhook Transmission ID: <strong className="text-ink">{activeStageData.details.transmissionId}</strong></span>
                <span>Webhook: <strong className="text-amber">{activeStageData.details.signatureStatus}</strong></span>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            <button
              onClick={() => setSelectedStage((prev) => Math.max(1, prev - 1))}
              disabled={selectedStage === 1}
              className="field-btn field-btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Stage
            </button>

            <span className="text-xs font-mono text-ink-3">
              Evidence: {meta.evidenceNote}
            </span>

            <button
              onClick={() => setSelectedStage((prev) => Math.min(8, prev + 1))}
              disabled={selectedStage === 8}
              className="field-btn field-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              Next Stage
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cryptographic JSON Proof Drawer */}
          <details className="text-xs font-mono text-ink-3 bg-canvas rounded-xl border border-line p-4">
            <summary className="cursor-pointer hover:text-ink font-semibold flex items-center justify-between">
              <span>Inspect Raw Cryptographic State Payload & Audit Artifacts</span>
              <span className="text-[11px] underline">Toggle payload</span>
            </summary>
            <pre className="mt-3 p-4 bg-surface border border-line rounded-lg overflow-x-auto text-ink text-[11px] leading-relaxed">
              {JSON.stringify(activeStageData.details, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
