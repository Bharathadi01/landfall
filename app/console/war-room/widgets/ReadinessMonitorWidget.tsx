"use client";

import React from "react";
import { type ReadinessEvaluationResult } from "@/lib/treasury/readiness-monitor";

export function ReadinessMonitorWidget({
  readiness = {
    overallScore: 100,
    status: "READY",
    evaluatedAt: new Date().toISOString(),
    financial: {
      totalCashCents: 100000,
      reserveFloorCents: 30000,
      feeBufferCents: 5000,
      allocatableCents: 65000,
      estimatedDemandCents: 50000,
      shortfallCents: 0,
      isSolvent: true,
      score: 100,
      blockingReasons: [],
    },
    recipient: {
      totalEnrolled: 6,
      geoVerifiedCount: 6,
      paymentRouteVerifiedCount: 6,
      staleEnrollmentCount: 0,
      readyForDisbursementCount: 6,
      score: 100,
      blockingReasons: [],
    },
    operational: {
      isEmergencyStopActive: false,
      hasOperationsApprover: true,
      hasFinanceApprover: true,
      registeredPasskeysCount: 2,
      isDualCustodyReady: true,
      score: 100,
      blockingReasons: [],
    },
    hazard: {
      isSentinelFeedFresh: true,
      hasActiveDisasterAlert: true,
      isGeometryValid: true,
      polygonVertexCount: 14,
      triggerPhenomenonMatched: true,
      matchedPhenomena: "HU",
      score: 100,
      blockingReasons: [],
    },
    allBlockingReasons: [],
    actionableChecklist: [
      { pillar: "FINANCIAL", title: "Treasury Solvency & Reserve Floor", isSatisfied: true, detail: "$650.00 allocatable ($300.00 protected)" },
      { pillar: "RECIPIENT", title: "Household Directory Verification", isSatisfied: true, detail: "6 of 6 recipients verified for instant disbursement" },
      { pillar: "OPERATIONAL", title: "Dual-Custody WebAuthn Governance", isSatisfied: true, detail: "Two-key passkey signatories active" },
      { pillar: "HAZARD", title: "Sentinel Disaster Telemetry", isSatisfied: true, detail: "HU.W Warning active with valid polygon" },
    ],
  },
}: {
  readiness?: ReadinessEvaluationResult;
}) {
  const getBadgeColor = (status: string) => {
    switch (status) {
      case "READY":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "DEGRADED":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            6. Pre-Disaster Readiness Monitor
          </h3>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-xs text-slate-400">Score: {readiness.overallScore}%</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeColor(
              readiness.status
            )}`}
          >
            {readiness.status}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Financial Pillar</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">
            {readiness.financial.score}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {readiness.financial.isSolvent ? "Solvent & Funded" : "Insolvent"}
          </div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Recipient Pillar</div>
          <div className="text-sm font-bold text-sky-400 mt-0.5">
            {readiness.recipient.score}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {readiness.recipient.readyForDisbursementCount} Ready
          </div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Operational Pillar</div>
          <div className="text-sm font-bold text-purple-400 mt-0.5">
            {readiness.operational.score}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {readiness.operational.isDualCustodyReady ? "Passkeys Active" : "Blocked"}
          </div>
        </div>

        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
          <div className="text-[11px] text-slate-400 font-mono">Hazard Pillar</div>
          <div className="text-sm font-bold text-amber-400 mt-0.5">
            {readiness.hazard.score}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {readiness.hazard.isSentinelFeedFresh ? "Feed Fresh" : "Stale Feed"}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {readiness.actionableChecklist.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between text-xs bg-slate-950/40 p-2 rounded border border-white/[0.07]/60 font-mono"
          >
            <div className="flex items-center gap-2">
              <span className={item.isSatisfied ? "text-emerald-400" : "text-rose-400"}>
                {item.isSatisfied ? "✓" : "✗"}
              </span>
              <span className="text-slate-300 font-medium">{item.title}</span>
            </div>
            <span className="text-slate-400 text-[11px] font-sans">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

