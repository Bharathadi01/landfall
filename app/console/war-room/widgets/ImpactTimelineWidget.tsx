"use client";

import React from "react";

export interface TimelineMilestone {
  timeOffset: string;
  stageName: string;
  leadTimeHoursRemaining: string;
  status: "COMPLETED" | "RUNNING" | "PENDING";
  description: string;
}

export function ImpactTimelineWidget({
  milestones = [
    {
      timeOffset: "T - 52 Hours",
      stageName: "NWS Warning Ingested",
      leadTimeHoursRemaining: "52.0 hrs lead time",
      status: "COMPLETED",
      description: "Sentinel ingested Hurricane Milton warning polygon from NWS Tampa Bay (TBW).",
    },
    {
      timeOffset: "T - 51 Hours",
      stageName: "Exposure & Policy Evaluated",
      leadTimeHoursRemaining: "51.0 hrs lead time",
      status: "COMPLETED",
      description: "Resolved 5 exposed households; deterministic policy generated $500.00 plan.",
    },
    {
      timeOffset: "T - 50 Hours",
      stageName: "Two-Key Dual Passkeys Signed",
      leadTimeHoursRemaining: "50.0 hrs lead time",
      status: "COMPLETED",
      description: "Incident Lead Dr. Sarah Lin [DEMO PERSONA] and Fiduciary Officer Marcus Vance [DEMO PERSONA] signed canonical plan hash.",
    },
    {
      timeOffset: "T - 49.5 Hours",
      stageName: "PayPal Payout Batch Dispatched",
      leadTimeHoursRemaining: "49.5 hrs lead time",
      status: "COMPLETED",
      description: "PayPal Payouts Batch CYX4HC52K54WN submitted to sandbox API.",
    },
    {
      timeOffset: "T - 49.2 Hours",
      stageName: "Disbursed to Beneficiary Wallets",
      leadTimeHoursRemaining: "49.2 hrs lead time",
      status: "COMPLETED",
      description: "Funds credited to PayPal recipient accounts for pre-storm fuel, medical batteries, and evacuation supplies.",
    },
    {
      timeOffset: "T - 0 Hours",
      stageName: "Projected Milton Landfall",
      leadTimeHoursRemaining: "0.0 hrs",
      status: "PENDING",
      description: "Eye makes landfall near Siesta Key / Sarasota.",
    },
  ],
}: {
  milestones?: TimelineMilestone[];
}) {
  return (
    <div className="glass p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-ink/[0.07] gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-delivered0" />
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
              Anticipatory Impact Timeline (Cash Before The Storm)
            </h3>
          </div>
          <p className="text-[10px] text-ink-2 mt-0.5 font-mono">
            Modelled scenario metrics based on official NWS Hurricane Milton 2024 Replay
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-delivered self-start sm:self-center">
          +49.2 Hours Modelled Pre-Landfall Lead Time
        </span>
      </div>

      <div className="mt-4 relative pl-4 border-l-2 border-delivered0/40 space-y-4">
        {milestones.map((m, idx) => {
          const isDone = m.status === "COMPLETED";
          return (
            <div key={idx} className="relative group">
              {/* Dot on timeline */}
              <div
                className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                  isDone
                    ? "bg-delivered0 border-delivered"
                    : "bg-surface-2 border-line"
                }`}
              />
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-ink">{m.stageName}</span>
                <span className="text-delivered font-semibold">{m.leadTimeHoursRemaining}</span>
              </div>
              <div className="text-[11px] text-ink-2 mt-0.5 font-sans leading-relaxed">
                {m.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

