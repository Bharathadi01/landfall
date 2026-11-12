"use client";

import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { type ColDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { runOfflineInvestigation, type InvestigationResult } from "@/lib/ai/investigator/agent";
import type { ReliefObligation, PayoutItemRecord } from "@/lib/recovery/types";
import { landfallDarkTheme } from "@/styles/ag-grid-theme";
import type { ReliefCase } from "@/lib/relief/cases";
import { useCases } from "@/components/data/DataSourceProvider";
import { studioApprovalEvents } from "@/lib/studio/landfall-studio-data";
import { PayPalStatusBadge } from "@/components/relief/parts";

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
  status: PayoutItemRecord["status"];
  ageHours: number;
  safeAction: string;
  rawRecord: {
    obligation: ReliefObligation;
    payoutItem: PayoutItemRecord;
  };
}

/** Replay clock used by the demo data (matches the Studio data model). */
const REPLAY_NOW = Date.parse("2024-10-09T18:30:00Z");

/** The investigator works on the SAME cases as the Command Center grid: every payout that is not SUCCESS. */
function toQueueItems(cases: ReliefCase[]): RescueQueueItem[] {
  const planHash = studioApprovalEvents[0].plan_hash;
  return cases.filter((c) => c.status !== "SUCCESS").map((c) => ({
    caseId: c.caseRef,
    householdId: c.householdRef,
    recipientName: c.resident,
    zone: c.zone,
    priorityTier: c.tier,
    amountFormatted: `$${c.amountUsd.toFixed(2)}`,
    payoutBatchId: c.batchId,
    payoutItemId: c.itemId,
    status: c.status,
    ageHours: c.ageHours,
    safeAction: c.nextAction.plain,
    rawRecord: {
      obligation: {
        obligationId: c.obligationId,
        householdId: c.householdRef,
        recipientName: c.resident,
        targetAmountCents: Math.round(c.amountUsd * 100),
        currency: "USD",
        stormId: "milton-2024",
        policyTranche: 1,
        approvedPlanId: "plan_milton_tranche1",
        approvedPlanHash: planHash,
        approvedAt: "2024-10-09T18:12:00.000Z",
        dualSignatures: { coordinatorKeyId: "demo_passkey_coordinator", financeKeyId: "demo_passkey_finance" },
      },
      payoutItem: {
        payoutBatchId: c.batchId,
        payoutItemId: c.itemId,
        status: c.status,
        amountCents: Math.round(c.amountUsd * 100),
        feeCents: 25,
        currency: "USD",
        recipientIdentifier: `${c.householdRef}@masked`,
        submittedAt: new Date(REPLAY_NOW - c.ageHours * 3_600_000).toISOString(),
        lastUpdatedAt: new Date(REPLAY_NOW).toISOString(),
        rawStatusDescription: `Replay data · PayPal item status ${c.status}`,
      },
    },
  }));
}

export function RecipientRescueQueue() {
  const [selectedCase, setSelectedCase] = useState<RescueQueueItem | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const { cases } = useCases();
  const queueData = useMemo(() => toQueueItems(cases), [cases]);

  const handleInspectRow = (row: RescueQueueItem) => {
    setSelectedCase(row);
    setInvestigation(
      runOfflineInvestigation({
        caseId: row.caseId,
        env: { obligation: row.rawRecord.obligation, payoutItem: row.rawRecord.payoutItem },
      })
    );
  };

  const columnDefs: ColDef<RescueQueueItem>[] = [
    { field: "recipientName", headerName: "Household", flex: 1.2, minWidth: 170, cellClass: "font-semibold text-ink" },
    { field: "status", headerName: "PayPal status", width: 140, cellRenderer: (p: any) => <PayPalStatusBadge status={p.value} /> },
    { field: "amountFormatted", headerName: "Amount", width: 100, cellClass: "tabular font-semibold text-accent-strong" },
    { field: "safeAction", headerName: "Next permitted action", flex: 2, minWidth: 260, cellClass: "text-ink-2" },
    {
      headerName: "Investigation",
      width: 150,
      cellRenderer: (p: any) => (
        <button onClick={() => handleInspectRow(p.data)} className="field-btn field-btn-secondary px-2.5 py-1 text-[11.5px]">
          Inspect case
        </button>
      ),
    },
  ];

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex flex-col justify-between gap-2 border-b border-ink/[0.07] pb-3 sm:flex-row sm:items-center">
        <div>
          <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.015em] text-ink">
            <span className="h-2 w-2 rounded-full bg-danger" />
            Payout exception queue
          </span>
          <p className="mt-0.5 text-[12.5px] text-ink-3">The same cases as the Cases grid — every payout that is not yet SUCCESS</p>
        </div>
        <span className="field-badge field-badge-ai">Read-only investigator</span>
      </div>

      <div className="h-56 w-full overflow-hidden rounded-lg border border-ink/[0.07]">
        <AgGridReact theme={landfallDarkTheme} rowData={queueData} columnDefs={columnDefs} defaultColDef={{ resizable: true, sortable: true }} pagination={false} />
      </div>

      {selectedCase && investigation && (
        <div className="space-y-3 rounded-xl border border-ai/25 bg-ai/[0.05] p-4 text-xs">
          <div className="flex flex-col justify-between gap-2 border-b border-ink/[0.07] pb-2 sm:flex-row sm:items-center">
            <div>
              <span className="font-semibold text-ink">Investigation: {selectedCase.recipientName}</span>
              <span className="ml-2 font-mono text-[10.5px] text-ink-3">{selectedCase.caseId}</span>
            </div>
            <button onClick={() => setSelectedCase(null)} className="text-xs text-ink-3 hover:text-ink">
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 text-[11.5px] md:grid-cols-2">
            <div className="space-y-1 rounded border border-ink/[0.07] bg-ink/[0.04] p-2.5">
              <span className="block font-semibold text-ink-2">Verified evidence facts</span>
              <ul className="list-inside list-disc space-y-0.5 text-ink-2">
                {investigation.verified_facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1 rounded border border-ink/[0.07] bg-ink/[0.04] p-2.5">
              <span className="block font-semibold text-amber">Root-cause hypotheses (not facts)</span>
              <ul className="list-inside list-disc space-y-0.5 text-ink-2">
                {investigation.hypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded border border-ai/30 bg-ai/[0.06] p-3 sm:flex-row sm:items-center">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-ai">Recommended safe action</span>
              <span className="text-sm font-semibold text-ink">{investigation.recommended_next_action}</span>
              <p className="mt-0.5 text-[11.5px] text-ink-2">{investigation.safe_action_reason}</p>
            </div>
            <span className="field-badge field-badge-neutral">Immediate reissue: {investigation.can_reissue_now ? "ALLOWED" : "LOCKED"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
