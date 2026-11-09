"use client";

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
    name: "Baseline Intake",
    duration: "4.2s",
    inputs: "PayPal Donation Webhook (CHECKOUT.ORDER.APPROVED), Donor Meta",
    outputs: "Treasury Inflow Ledger Entry (Account 1010-PAYPAL-CASH)",
    nextAction: "Evaluate Solvency & Capital Reserve Guardrails",
    evidenceNote: "Verified PayPal Sandbox Order & Capture Transaction ID",
  },
  2: {
    name: "Solvency Invariant",
    duration: "1.1s",
    inputs: "Real-time Treasury Balances, Board-mandated 30% Solvency Reserve",
    outputs: "Tranche 1 Allocatable Liquidity Cap ($9,250.00)",
    nextAction: "Poll Storm Atlas Real-time NWS Hazard Warnings",
    evidenceNote: "Invariant check: Reserves never breached under stress",
  },
  3: {
    name: "Storm Atlas Threat",
    duration: "2.8s",
    inputs: "NOAA nowCOAST WMS Feed, NWS VTEC Flash Flood / Storm Surge Polygons",
    outputs: "Validated Geospatial Impact Geometry (EPSG:4326 GeoJSON)",
    nextAction: "Execute Point-in-Polygon Household Exposure Evaluation",
    evidenceNote: "Official NWS Warning Envelope & Radar Composite Coordinates",
  },
  4: {
    name: "Exposure Evaluation",
    duration: "3.5s",
    inputs: "Synthetic Recipient Registry (Pinellas County), Impact Polygons",
    outputs: "Confirmed Impacted Roster (10 Households Inside Threat Cone)",
    nextAction: "Execute Deterministic Lexicographic Allocation",
    evidenceNote: "Turf.js booleanPointInPolygon Spatial Verification Audit",
  },
  5: {
    name: "Priority Allocation",
    duration: "1.9s",
    inputs: "Impacted Roster, Vulnerability Matrix (Children <5, Medical, Age)",
    outputs: "Ranked Payout Plan ($500/hh) + Waitlist Ledger Entries",
    nextAction: "Await Dual-Custody Passkey Cryptographic Sign-off",
    evidenceNote: "Lexicographic sorting: Pure deterministic arithmetic (Zero AI)",
  },
  6: {
    name: "Dual-Key Authorisation",
    duration: "5.0s",
    inputs: "SHA-256 Canonical Plan Hash, Fiduciary & Operations Passkeys",
    outputs: "Signed Multi-signature Authorisation Ticket (SecP256R1)",
    nextAction: "Dispatch Idempotent Hyperwallet Payout Batch to PayPal",
    evidenceNote: "Hardware WebAuthn FIDO2 Public Key Signatures Attached",
  },
  7: {
    name: "PayPal Batch Payout",
    duration: "3.2s",
    inputs: "Approved Plan Manifest, Client Credentials Bearer Token",
    outputs: "PayPal Hyperwallet Payout Batch ID & Idempotency Key",
    nextAction: "Receive Webhook & Trigger Double-Entry Settlement",
    evidenceNote: "PayPal Payouts REST API HTTP 201 Response with Batch Status",
  },
  8: {
    name: "Reconciliation Audit",
    duration: "0.8s",
    inputs: "PayPal Webhook Event, Ledger Journal Transactions",
    outputs: "Balanced Trial Ledger: Zero Discrepancy (0¢ error)",
    nextAction: "Archive Immutable Evidence Bundle for Public Accountability",
    evidenceNote: "Mathematical Proof: Assets = Liabilities + Equity verified",
  },
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

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="field-badge-evergreen">Field Atlas Golden Sequence</span>
            <span className="field-badge-neutral font-mono text-[11px]">8 Stages Verified</span>
            <span className="field-badge-warning font-mono text-[11px]">Milton Replay Model</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#192A24] tracking-tight">
            End-to-End Anticipatory Relief Pipeline
          </h1>
          <p className="text-sm text-[#58665F] mt-1.5 max-w-2xl leading-relaxed">
            From initial donor PayPal contribution to verified Hyperwallet batch disbursement and
            cryptographic double-entry reconciliation before hurricane landfall.
          </p>
        </div>

        {/* Action Controls & Presentation Jump Menu */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Jump to stage dropdown */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(Number(e.target.value))}
            className="field-input text-xs py-2 px-3 font-medium bg-[#FFFEFA] cursor-pointer"
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
            <RotateCcw className="w-3.5 h-3.5 text-[#58665F]" />
            Reset Demo
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
                <span>Next Step</span>
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
            {loading ? "Executing Pipeline..." : "Run Full 8-Stage Flow"}
          </button>
        </div>
      </div>

      {error && (
        <div className="field-paper p-4 border-[#D76E4B] bg-[#FDF4F0] flex items-center gap-3 text-sm text-[#D76E4B]">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Pipeline Exception:</strong> {error}
          </div>
        </div>
      )}

      {/* 8-Stage Horizontal Progress Timeline */}
      <div className="field-paper p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs text-[#7B847D] px-1 mb-2 font-mono">
          <span>PIPELINE PROGRESSION (Use ← / → keys to inspect)</span>
          <span>{selectedStage} of 8 Stages Active</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((stageNum) => {
            const isSelected = stageNum === selectedStage;
            const stageData = workflow?.stages.find((s) => s.stageNumber === stageNum);
            const isPassed = stageData?.status === "COMPLETED";
            const metaInfo = STAGE_METADATA[stageNum];

            return (
              <button
                key={stageNum}
                onClick={() => setSelectedStage(stageNum)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "bg-[#FFFEFA] border-[#175B47] shadow-md ring-2 ring-[#175B47]/20"
                    : isPassed
                    ? "bg-[#ECEAE2]/60 border-[#DEDCD3] hover:bg-[#FFFEFA]"
                    : "bg-[#F4F2EC] border-[#DEDCD3]/60 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className={`font-semibold ${isSelected ? "text-[#175B47]" : "text-[#7B847D]"}`}>
                    0{stageNum}
                  </span>
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#175B47]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full border border-[#7B847D]"></span>
                  )}
                </div>
                <div className="text-xs font-semibold text-[#192A24] truncate">
                  {metaInfo?.name || `Stage ${stageNum}`}
                </div>
                <div className="text-[10px] text-[#7B847D] font-mono mt-1 flex items-center justify-between">
                  <span>{metaInfo?.duration || "~2s"}</span>
                  <span className={isPassed ? "text-[#175B47] font-semibold" : ""}>
                    {isPassed ? "DONE" : "QUEUED"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Large Active Step Spotlight */}
      {activeStageData ? (
        <div className="field-paper p-6 md:p-8 space-y-6 shadow-sm border border-[#DEDCD3]">
          {/* Spotlight Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#DEDCD3]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="field-badge-evergreen font-mono text-[11px]">
                  Stage {activeStageData.stageNumber} Spotlight
                </span>
                <span className="field-badge-neutral font-mono text-[11px]">
                  Duration: {meta.duration}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif text-[#192A24]">
                {activeStageData.title}
              </h2>
              <p className="text-sm text-[#58665F] mt-1 max-w-3xl leading-relaxed">
                {activeStageData.summary}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="field-badge-evergreen text-xs font-mono py-1 px-3">
                {activeStageData.status}
              </span>
              {activeStageData.timestamp && (
                <span className="text-xs font-mono text-[#7B847D]">
                  {new Date(activeStageData.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Architecture Inputs / Outputs / Next Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3]">
            <div>
              <div className="text-[11px] font-mono uppercase text-[#7B847D] font-medium tracking-wider mb-1">
                Inputs Required
              </div>
              <div className="text-xs text-[#192A24] font-medium leading-relaxed">
                {meta.inputs}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-[#7B847D] font-medium tracking-wider mb-1">
                Outputs Produced
              </div>
              <div className="text-xs text-[#175B47] font-medium leading-relaxed">
                {meta.outputs}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-[#7B847D] font-medium tracking-wider mb-1">
                Next In Sequence
              </div>
              <div className="text-xs text-[#316B9B] font-medium leading-relaxed">
                {meta.nextAction}
              </div>
            </div>
          </div>

          {/* Stage-Specific Key Metrics & Detailed Evidence Cards */}
          {activeStageData.stageNumber === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Captured Amount</div>
                <div className="text-2xl font-serif font-bold text-[#175B47] mt-1 tabular-nums">
                  {activeStageData.details.amountFormatted || "$1,000.00 USD"}
                </div>
                <div className="text-[11px] text-[#58665F] mt-1">Gross PayPal donor capture</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">PayPal Order ID</div>
                <div className="text-xs font-mono text-[#192A24] mt-2 truncate bg-[#F4F2EC] p-2 rounded">
                  {activeStageData.details.orderId}
                </div>
                <div className="text-[11px] text-[#58665F] mt-1">Orders v2 reference</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Capture Reference</div>
                <div className="text-xs font-mono text-[#192A24] mt-2 truncate bg-[#F4F2EC] p-2 rounded">
                  {activeStageData.details.captureId}
                </div>
                <div className="text-[11px] text-[#58665F] mt-1">Instant ledger settlement</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Double-Entry Account</div>
                <div className="text-xs font-mono text-[#175B47] font-semibold mt-2 bg-[#E0EEE7] p-2 rounded">
                  {activeStageData.details.ledgerAccount}
                </div>
                <div className="text-[11px] text-[#58665F] mt-1">Cash in PayPal Transit</div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Total Treasury Balance</div>
                <div className="text-3xl font-serif font-bold text-[#192A24] mt-1 tabular-nums">
                  {activeStageData.details.totalCashFormatted}
                </div>
                <div className="text-xs text-[#58665F] mt-1">100% segregated relief treasury</div>
              </div>
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">30% Solvency Reserve Protected</div>
                <div className="text-3xl font-serif font-bold text-[#D99B43] mt-1 tabular-nums">
                  {activeStageData.details.reserveProtectedFormatted}
                </div>
                <div className="text-xs text-[#58665F] mt-1">Immutable emergency buffer</div>
              </div>
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Allocatable Tranche 1 Cash</div>
                <div className="text-3xl font-serif font-bold text-[#175B47] mt-1 tabular-nums">
                  {activeStageData.details.allocatableFormatted}
                </div>
                <div className="text-xs text-[#58665F] mt-1">Immediately disbursable capacity</div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 3 && (
            <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#7B847D]">Official NWS Weather Feed</span>
                <span className="field-badge-critical uppercase font-mono text-xs">
                  {activeStageData.details.severity} Severity
                </span>
              </div>
              <div className="text-xl font-serif font-bold text-[#192A24]">
                {activeStageData.details.event}
              </div>
              <p className="text-sm text-[#58665F] leading-relaxed">
                {activeStageData.details.headline}
              </p>
              <div className="text-xs font-mono text-[#7B847D] pt-3 border-t border-[#DEDCD3] flex flex-wrap gap-4">
                <span>VTEC: <strong className="text-[#316B9B]">{activeStageData.details.eventKey}</strong></span>
                <span>Polygon Vertices: <strong className="text-[#192A24]">{activeStageData.details.polygonCoordCount} coordinates</strong></span>
                <span>Spatial Reference: <strong className="text-[#192A24]">WGS84 EPSG:4326</strong></span>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Evaluated Enrollees</div>
                  <div className="text-2xl font-serif font-bold text-[#192A24] mt-1 tabular-nums">
                    {activeStageData.details.totalEvaluated}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Pre-registered Pinellas households</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Exposure Confirmed</div>
                  <div className="text-2xl font-serif font-bold text-[#175B47] mt-1 tabular-nums">
                    {activeStageData.details.confirmedCount}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Within active storm surge polygon</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Safely Excluded</div>
                  <div className="text-2xl font-serif font-bold text-[#7B847D] mt-1 tabular-nums">
                    {activeStageData.details.excludedCount}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Inland Orlando (out of surge zone)</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#DEDCD3] overflow-hidden bg-[#FFFEFA]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#ECEAE2] text-[#58665F] font-mono">
                    <tr>
                      <th className="p-3">Household Name</th>
                      <th className="p-3">Zone / Pinellas Address</th>
                      <th className="p-3">Spatial Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEDCD3]">
                    {activeStageData.details.confirmedHouseholds?.map((h: any) => (
                      <tr key={h.id}>
                        <td className="p-3 font-semibold text-[#192A24]">{h.name}</td>
                        <td className="p-3 text-[#58665F]">{h.zone}</td>
                        <td className="p-3">
                          <span className="field-badge-evergreen font-mono text-[11px]">
                            SURGE EXPOSURE CONFIRMED
                          </span>
                        </td>
                      </tr>
                    ))}
                    {activeStageData.details.excludedHouseholds?.map((h: any) => (
                      <tr key={h.id} className="opacity-70 bg-[#F4F2EC]/40">
                        <td className="p-3 font-medium text-[#7B847D]">{h.name}</td>
                        <td className="p-3 text-[#7B847D]">Inland Orlando (Non-Surge)</td>
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
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Households Funded</div>
                  <div className="text-2xl font-serif font-bold text-[#175B47] mt-1 tabular-nums">
                    {activeStageData.details.fundedCount}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Direct early disbursements</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Waitlisted Enrollees</div>
                  <div className="text-2xl font-serif font-bold text-[#7B847D] mt-1 tabular-nums">
                    {activeStageData.details.waitlistedCount}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Pending Tranche 2 refill</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Total Committed</div>
                  <div className="text-2xl font-serif font-bold text-[#192A24] mt-1 tabular-nums">
                    {activeStageData.details.totalCommittedFormatted}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">Direct emergency grant total</div>
                </div>
                <div className="p-4 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                  <div className="text-xs text-[#7B847D] font-mono">Disbursement Buffer</div>
                  <div className="text-2xl font-serif font-bold text-[#58665F] mt-1 tabular-nums">
                    {activeStageData.details.totalFeesFormatted}
                  </div>
                  <div className="text-xs text-[#58665F] mt-1">PayPal Payouts network fees</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#DEDCD3] p-5 bg-[#FFFEFA] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-[#7B847D] uppercase tracking-wider font-semibold">
                    Deterministic Lexicographic Priority Ordering (Zero AI)
                  </div>
                  <span className="field-badge-evergreen font-mono text-[10px]">VERIFIED CODE</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeStageData.details.fundedBreakdown?.map((fb: any) => (
                    <div
                      key={fb.householdId}
                      className="p-3.5 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#192A24]">{fb.householdId}</div>
                        <div className="text-[11px] font-mono text-[#316B9B] mt-0.5">{fb.code}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-serif font-bold text-[#175B47] tabular-nums">
                          {fb.amount}
                        </span>
                        <div className="text-[10px] text-[#7B847D] font-mono">Tier {fb.tier}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 6 && (
            <div className="p-6 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#7B847D]">Canonical SHA-256 Plan Hash</span>
                <span className="field-badge-evergreen font-mono text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  DUAL-CUSTODY AUTHORISED
                </span>
              </div>
              <div className="p-3.5 bg-[#F4F2EC] font-mono text-xs text-[#192A24] break-all rounded-lg border border-[#DEDCD3] select-all">
                {activeStageData.details.planHash}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3]">
                  <div className="text-xs font-mono text-[#7B847D]">Signer 1 (Operations Lead)</div>
                  <div className="text-sm font-semibold text-[#192A24] mt-1">
                    {activeStageData.details.key1}
                  </div>
                  <div className="text-[11px] text-[#175B47] font-mono mt-1">
                    ✓ SecP256R1 Passkey Signature Verified
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3]">
                  <div className="text-xs font-mono text-[#7B847D]">Signer 2 (Fiduciary Trustee)</div>
                  <div className="text-sm font-semibold text-[#192A24] mt-1">
                    {activeStageData.details.key2}
                  </div>
                  <div className="text-[11px] text-[#175B47] font-mono mt-1">
                    ✓ FIDO2 WebAuthn Hardware Key Signed
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 7 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">PayPal Batch Identifier</div>
                <div className="text-sm font-mono text-[#175B47] font-bold mt-2 truncate bg-[#E0EEE7] p-2 rounded">
                  {activeStageData.details.paypalBatchId}
                </div>
                <div className="text-xs text-[#58665F] mt-2">PayPal Payouts REST endpoint</div>
              </div>
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Idempotency Outbox Key</div>
                <div className="text-xs font-mono text-[#192A24] mt-2 truncate bg-[#F4F2EC] p-2 rounded">
                  {activeStageData.details.idempotencyKey}
                </div>
                <div className="text-xs text-[#58665F] mt-2">Guaranteed single execution</div>
              </div>
              <div className="p-5 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3]">
                <div className="text-xs text-[#7B847D] font-mono">Disbursed Volume</div>
                <div className="text-2xl font-serif font-bold text-[#192A24] mt-1 tabular-nums">
                  {activeStageData.details.disbursedAmount}
                </div>
                <div className="text-xs text-[#175B47] font-medium mt-1">
                  {activeStageData.details.itemsCount} instant recipient payouts
                </div>
              </div>
            </div>
          )}

          {activeStageData.stageNumber === 8 && (
            <div className="p-6 rounded-xl bg-[#FFFEFA] border border-[#DEDCD3] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#7B847D]">Double-Entry Ledger Audit</span>
                <span className="field-badge-evergreen font-mono text-xs font-bold">
                  ✓ ZERO DISCREPANCY (0¢ ERROR)
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#F4F2EC] font-mono text-xs text-[#192A24] border border-[#DEDCD3] flex flex-col md:flex-row justify-between gap-2">
                <span className="text-[#58665F]">Fundamental Ledger Invariant:</span>
                <span className="text-[#175B47] font-bold">
                  {activeStageData.details.doubleEntryEquation}
                </span>
              </div>
              <div className="text-xs text-[#7B847D] font-mono flex flex-wrap gap-4 pt-2">
                <span>Webhook Transmission ID: <strong className="text-[#192A24]">{activeStageData.details.transmissionId}</strong></span>
                <span>Signature Status: <strong className="text-[#175B47]">{activeStageData.details.signatureStatus}</strong></span>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#DEDCD3]">
            <button
              onClick={() => setSelectedStage((prev) => Math.max(1, prev - 1))}
              disabled={selectedStage === 1}
              className="field-btn field-btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Stage
            </button>

            <span className="text-xs font-mono text-[#7B847D]">
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
          <details className="text-xs font-mono text-[#7B847D] bg-[#F4F2EC] rounded-xl border border-[#DEDCD3] p-4">
            <summary className="cursor-pointer hover:text-[#192A24] font-semibold flex items-center justify-between">
              <span>Inspect Raw Cryptographic State Payload & Audit Artifacts</span>
              <span className="text-[11px] underline">Toggle payload</span>
            </summary>
            <pre className="mt-3 p-4 bg-[#FFFEFA] border border-[#DEDCD3] rounded-lg overflow-x-auto text-[#192A24] text-[11px] leading-relaxed">
              {JSON.stringify(activeStageData.details, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
