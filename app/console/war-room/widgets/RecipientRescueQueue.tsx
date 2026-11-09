"use client";

import React, { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  type ColDef,
  ModuleRegistry,
  AllCommunityModule,
} from "ag-grid-community";
import { runOfflineInvestigation, type InvestigationResult } from "@/lib/ai/investigator/agent";
import type { ReliefObligation, PayoutItemRecord } from "@/lib/recovery/types";
import { landfallDarkTheme } from "@/styles/ag-grid-theme";

ModuleRegistry.registerModules([AllCommunityModule]);

interface RescueQueueItem {
  caseId: string;
  householdId: string;
  recipientName: string;
  zone: string;
  priorityTier: number;
  amountFormatted: string;
  payoutBatchId: string;
  payoutItemId: string;
  status: "SUCCESS" | "UNCLAIMED" | "FAILED" | "RETURNED" | "ONHOLD";
  ageHours: number;
  safeAction: string;
  rawRecord: {
    obligation: ReliefObligation;
    payoutItem: PayoutItemRecord;
  };
}

export function RecipientRescueQueue() {
  const [selectedCase, setSelectedCase] = useState<RescueQueueItem | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);

  const queueData: RescueQueueItem[] = [
    {
      caseId: "rcv_case_001",
      householdId: "hh_pinellas_001",
      recipientName: "Maria Santos",
      zone: "Zone A (Surge 10-15ft)",
      priorityTier: 1,
      amountFormatted: "$100.00",
      payoutBatchId: "7Y5GP4ETNLCUQ",
      payoutItemId: "2FN4JTY2SF8A2",
      status: "UNCLAIMED",
      ageHours: 4,
      safeAction: "CONTACT_RECIPIENT",
      rawRecord: {
        obligation: {
          obligationId: "ob_milton_hh_001",
          householdId: "hh_pinellas_001",
          recipientName: "Maria Santos",
          targetAmountCents: 10000,
          currency: "USD",
          stormId: "milton-2024",
          policyTranche: 1,
          approvedPlanId: "plan_milton_tranche1",
          approvedPlanHash: "46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c",
          approvedAt: "2024-10-09T18:00:00.000Z",
          dualSignatures: {
            coordinatorKeyId: "key_sarah_lin_passkey_001",
            financeKeyId: "key_marcus_vance_passkey_002",
          },
        },
        payoutItem: {
          payoutBatchId: "7Y5GP4ETNLCUQ",
          payoutItemId: "2FN4JTY2SF8A2",
          status: "UNCLAIMED",
          amountCents: 10000,
          feeCents: 25,
          currency: "USD",
          recipientIdentifier: "maria.santos@unregistered.example",
          submittedAt: "2024-10-09T18:15:30.000Z",
          lastUpdatedAt: "2024-10-09T18:20:00.000Z",
          rawStatusDescription: "Recipient has not registered PayPal account or claimed funds.",
        },
      },
    },
    {
      caseId: "rcv_case_002",
      householdId: "hh_tampa_004",
      recipientName: "David Chen",
      zone: "Zone A",
      priorityTier: 3,
      amountFormatted: "$100.00",
      payoutBatchId: "BATCH_FAIL_001",
      payoutItemId: "ITEM_FAIL_001",
      status: "FAILED",
      ageHours: 6,
      safeAction: "PREPARE_NEW_APPROVED_PAYOUT",
      rawRecord: {
        obligation: {
          obligationId: "ob_milton_hh_004",
          householdId: "hh_tampa_004",
          recipientName: "David Chen",
          targetAmountCents: 10000,
          currency: "USD",
          stormId: "milton-2024",
          policyTranche: 1,
          approvedPlanId: "plan_milton_tranche1",
          approvedPlanHash: "46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c",
          approvedAt: "2024-10-09T18:00:00.000Z",
          dualSignatures: {
            coordinatorKeyId: "key_sarah_lin_passkey_001",
            financeKeyId: "key_marcus_vance_passkey_002",
          },
        },
        payoutItem: {
          payoutBatchId: "BATCH_FAIL_001",
          payoutItemId: "ITEM_FAIL_001",
          status: "FAILED",
          amountCents: 10000,
          feeCents: 0,
          currency: "USD",
          recipientIdentifier: "closed.account@test.example",
          submittedAt: "2024-10-09T18:15:30.000Z",
          lastUpdatedAt: "2024-10-09T18:16:00.000Z",
          errorDetails: {
            name: "RECEIVER_UNREGISTERED",
            message: "Receiver account closed or invalid currency preference.",
          },
        },
      },
    },
    {
      caseId: "rcv_case_003",
      householdId: "hh_sarasota_002",
      recipientName: "Eleanor Vance",
      zone: "Zone B",
      priorityTier: 2,
      amountFormatted: "$100.00",
      payoutBatchId: "CYX4HC52K54WN",
      payoutItemId: "XVV68QXJWJ66Y",
      status: "SUCCESS",
      ageHours: 8,
      safeAction: "CLOSE_AS_RESOLVED",
      rawRecord: {
        obligation: {
          obligationId: "ob_milton_hh_002",
          householdId: "hh_sarasota_002",
          recipientName: "Eleanor Vance",
          targetAmountCents: 10000,
          currency: "USD",
          stormId: "milton-2024",
          policyTranche: 1,
          approvedPlanId: "plan_milton_tranche1",
          approvedPlanHash: "46d87f7396a84f3e53e16447c23179541a761e0bbdce34a1ef96b0266205790c",
          approvedAt: "2024-10-09T18:00:00.000Z",
          dualSignatures: {
            coordinatorKeyId: "key_sarah_lin_passkey_001",
            financeKeyId: "key_marcus_vance_passkey_002",
          },
        },
        payoutItem: {
          payoutBatchId: "CYX4HC52K54WN",
          payoutItemId: "XVV68QXJWJ66Y",
          paypalTransactionId: "6SM40781T11720216",
          status: "SUCCESS",
          amountCents: 10000,
          feeCents: 25,
          currency: "USD",
          recipientIdentifier: "eleanor.vance@test.example",
          submittedAt: "2024-10-09T18:15:30.000Z",
          lastUpdatedAt: "2024-10-09T18:16:30.000Z",
        },
      },
    },
  ];

  const handleInspectRow = (row: RescueQueueItem) => {
    setSelectedCase(row);
    const report = runOfflineInvestigation({
      caseId: row.caseId,
      env: {
        obligation: row.rawRecord.obligation,
        payoutItem: row.rawRecord.payoutItem,
      },
    });
    setInvestigation(report);
  };

  const columnDefs: ColDef<RescueQueueItem>[] = [
    {
      field: "householdId",
      headerName: "Household",
      width: 140,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-sky-400">{p.value}</span>
      ),
    },
    {
      field: "recipientName",
      headerName: "Recipient Name",
      width: 150,
      cellRenderer: (p: any) => <span className="font-semibold text-white">{p.value}</span>,
    },
    {
      field: "status",
      headerName: "Rail Status",
      width: 130,
      cellRenderer: (p: any) => {
        let badge = "bg-slate-800 text-slate-300";
        if (p.value === "SUCCESS") badge = "bg-emerald-950 text-emerald-300 border-emerald-800";
        if (p.value === "UNCLAIMED") badge = "bg-amber-950 text-amber-300 border-amber-800 animate-pulse";
        if (p.value === "FAILED") badge = "bg-rose-950 text-rose-300 border-rose-800";
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge}`}>
            {p.value}
          </span>
        );
      },
    },
    {
      field: "amountFormatted",
      headerName: "Obligation",
      width: 110,
      cellRenderer: (p: any) => (
        <span className="font-mono text-emerald-400 font-bold">{p.value}</span>
      ),
    },
    {
      field: "safeAction",
      headerName: "Authoritative Action",
      flex: 1,
      minWidth: 180,
      cellRenderer: (p: any) => (
        <span className="font-mono text-[11px] text-slate-300">{p.value}</span>
      ),
    },
    {
      headerName: "Forensic Investigation",
      width: 140,
      cellRenderer: (p: any) => (
        <button
          onClick={() => handleInspectRow(p.data)}
          className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 transition"
        >
          🔍 Inspect Case
        </button>
      ),
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Recipient Rescue & Payout Exception Queue
          </span>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational triage queue for anomalous PayPal payout items requiring investigation or re-routing
          </p>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
          Zero Silent Failures (§3)
        </span>
      </div>

      {/* AG Grid Operational Table */}
      <div className="w-full h-56 rounded-lg overflow-hidden border border-slate-800">
        <AgGridReact
          theme={landfallDarkTheme}
          rowData={queueData}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          pagination={false}
        />
      </div>

      {/* Forensic Inspection Modal / Drawer */}
      {selectedCase && investigation && (
        <div className="p-4 bg-slate-950 rounded-xl border border-sky-800/80 space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <span className="text-sky-400 font-bold">Investigation Case: {selectedCase.caseId}</span>
              <span className="text-slate-400 ml-2">({selectedCase.recipientName})</span>
            </div>
            <button
              onClick={() => setSelectedCase(null)}
              className="text-slate-400 hover:text-white text-xs font-sans"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-bold">Verified Evidence Facts:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-sans">
                {investigation.verified_facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1">
              <span className="text-amber-400 block font-bold">Root Cause Hypotheses:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-sans">
                {investigation.hypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 bg-sky-950/40 rounded border border-sky-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-sky-400 uppercase tracking-wider block">Recommended Safe Operational Action</span>
              <span className="text-white font-bold text-sm">{investigation.recommended_next_action}</span>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5">{investigation.safe_action_reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-slate-900 text-slate-300 border border-slate-700 text-[10px]">
                Immediate Reissue: {investigation.can_reissue_now ? "ALLOWED" : "LOCKED"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

