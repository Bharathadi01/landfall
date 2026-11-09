"use client";

import React, { useState } from "react";

export interface MoneyPathNode {
  step: number;
  label: string;
  sublabel: string;
  referenceId: string;
  status: "CONFIRMED" | "IN_PROGRESS" | "EXCEPTION" | "RESOLVED";
  amountFormatted?: string;
  details: string;
  timestamp: string;
}

export function PayPalMoneyPathExplorer() {
  const [activeStep, setActiveStep] = useState<number>(5);

  const nodes: MoneyPathNode[] = [
    {
      step: 1,
      label: "Donor Inflow",
      sublabel: "PayPal Orders v2",
      referenceId: "Order: 35996334K7032164X",
      status: "CONFIRMED",
      amountFormatted: "$1.00 USD",
      details: "Inflow captured via PayPal Sandbox checkout. Pre-disaster funding committed to storm relief account.",
      timestamp: "2024-10-09 14:22:10 UTC",
    },
    {
      step: 2,
      label: "Storm Treasury",
      sublabel: "Double-Entry Ledger",
      referenceId: "Tx: tx_ledger_inflow_881920",
      status: "CONFIRMED",
      amountFormatted: "$1.00 USD",
      details: "Debited Assets:PayPalCash ($1.00), Credited Equity:StormFund ($1.00). Strict balanced double-entry.",
      timestamp: "2024-10-09 14:22:11 UTC",
    },
    {
      step: 3,
      label: "Relief Obligation",
      sublabel: "Deterministic Policy",
      referenceId: "Obligation: ob_milton_hh_001",
      status: "CONFIRMED",
      amountFormatted: "$100.00 USD",
      details: "Household in mandatory surge zone with electric medical device (Priority Tier 1). Plan hash locked.",
      timestamp: "2024-10-09 18:00:00 UTC",
    },
    {
      step: 4,
      label: "Dual Passkey Sign-off",
      sublabel: "FIDO2 WebAuthn",
      referenceId: "Hash: 46d87f7396a84f3e...",
      status: "CONFIRMED",
      details: "Two distinct passkey signatures: Dr. Sarah Lin (Ops) + Marcus Vance (Finance). Zero AI approval.",
      timestamp: "2024-10-09 18:04:12 UTC",
    },
    {
      step: 5,
      label: "PayPal Payout Batch",
      sublabel: "Payouts v1 API",
      referenceId: "Batch: 7Y5GP4ETNLCUQ",
      status: "EXCEPTION",
      amountFormatted: "$2.00 USD",
      details: "Batch dispatched. Item 1 (FR7DHMX8QE59A) = SUCCESS. Item 2 (2FN4JTY2SF8A2) = UNCLAIMED in PayPal escrow.",
      timestamp: "2024-10-09 18:15:30 UTC",
    },
    {
      step: 6,
      label: "AI Money Investigator",
      sublabel: "Read-Only Analysis",
      referenceId: "Case: rcv_2fn4jty2sf8a2",
      status: "IN_PROGRESS",
      details: "Identified unregistered PayPal email. Verified 30-day escrow window. Blocked duplicate payout. Prepared SMS guidance.",
      timestamp: "2024-10-09 18:15:45 UTC",
    },
    {
      step: 7,
      label: "Cryptographic Proof",
      sublabel: "SHA-256 Chain of Custody",
      referenceId: "Proof: prf_rcv_master_9921",
      status: "RESOLVED",
      details: "Master proof binds Obligation + Payout Trace + Webhook Verification + Ledger Trace + Passkey Authorization.",
      timestamp: "2024-10-09 18:20:00 UTC",
    },
  ];

  const currentNode = nodes.find((n) => n.step === activeStep) || nodes[0];

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            PayPal End-to-End Money Path Explorer
          </span>
          <p className="text-xs text-slate-400 mt-0.5">
            Proof-carrying relief recovery tracing: Inflow → Ledger → Obligation → Payout → Exception → Proof
          </p>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
          7-Stage Lifecycle
        </span>
      </div>

      {/* Interactive Horizontal Lifecycle Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {nodes.map((n) => {
          const isSelected = n.step === activeStep;
          let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
          if (n.status === "CONFIRMED") badgeColor = "bg-emerald-950/80 text-emerald-300 border-emerald-800";
          if (n.status === "EXCEPTION") badgeColor = "bg-rose-950/80 text-rose-300 border-rose-800";
          if (n.status === "IN_PROGRESS") badgeColor = "bg-amber-950/80 text-amber-300 border-amber-800";
          if (n.status === "RESOLVED") badgeColor = "bg-purple-950/80 text-purple-300 border-purple-800";

          return (
            <button
              key={n.step}
              onClick={() => setActiveStep(n.step)}
              className={`p-2.5 rounded-lg border text-left transition-all relative ${
                isSelected
                  ? "border-sky-400 bg-slate-800/90 shadow-md ring-1 ring-sky-400/50"
                  : "border-white/[0.07] bg-slate-950/50 hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Stage {n.step}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeColor}`}>
                  {n.status}
                </span>
              </div>
              <div className="text-xs font-bold text-white mt-1 truncate">{n.label}</div>
              <div className="text-[10px] text-slate-400 truncate">{n.sublabel}</div>
            </button>
          );
        })}
      </div>

      {/* Selected Node Forensic Card */}
      <div className="p-4 bg-slate-950 rounded-xl border border-white/[0.07] space-y-3 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.07]/60 pb-2">
          <div>
            <span className="text-slate-400">Stage {currentNode.step}: </span>
            <span className="text-white font-bold">{currentNode.label}</span>
            <span className="text-slate-400 ml-2">({currentNode.sublabel})</span>
          </div>
          <span className="text-slate-400 text-[11px]">{currentNode.timestamp}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-2.5 bg-slate-900 rounded border border-white/[0.07] space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Reference Identifier</span>
            <span className="text-sky-300 font-bold break-all block">{currentNode.referenceId}</span>
          </div>
          {currentNode.amountFormatted && (
            <div className="p-2.5 bg-slate-900 rounded border border-white/[0.07] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Transacted Amount</span>
              <span className="text-emerald-400 font-bold block">{currentNode.amountFormatted}</span>
            </div>
          )}
        </div>

        <div className="p-2.5 bg-slate-900/80 rounded border border-white/[0.07] space-y-1 font-sans text-xs leading-relaxed text-slate-300">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Auditable Trace</span>
          {currentNode.details}
        </div>
      </div>
    </div>
  );
}

