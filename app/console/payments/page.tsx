"use client";

import React, { Suspense, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useCases } from "@/components/data/DataSourceProvider";
import { relativeTime } from "@/components/data/SourceSwitch";
import { useToast } from "@/components/ui/Toast";
import { I } from "@/components/icons";
import { money } from "@/components/relief/parts";

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="pane space-y-3 p-6" role="status" aria-label={label}>
      <div className="skeleton h-4 w-48" />
      <div className="skeleton h-[420px] w-full" />
    </div>
  );
}
const panelLoading = (label: string) => {
  const Loading = () => <PanelLoading label={label} />;
  Loading.displayName = `Loading(${label})`;
  return Loading;
};

// The grid (and its Enterprise modules) is ~1 MB: it loads on this page only.
const CaseGrid = dynamic(() => import("@/components/grid/CaseGrid").then((m) => m.CaseGrid), { ssr: false, loading: panelLoading("Loading the payments grid") });
const SettlementIntegrityBridge = dynamic(() => import("../war-room/widgets/SettlementIntegrityBridge").then((m) => m.SettlementIntegrityBridge), { ssr: false, loading: panelLoading("Loading") });
const TreasuryWaterfallWidget = dynamic(() => import("../war-room/widgets/TreasuryWaterfallWidget").then((m) => m.TreasuryWaterfallWidget), { ssr: false, loading: panelLoading("Loading") });
const PayPalMoneyPathExplorer = dynamic(() => import("../war-room/widgets/PayPalMoneyPathExplorer").then((m) => m.PayPalMoneyPathExplorer), { ssr: false, loading: panelLoading("Loading") });
const ImpactEvidenceWidget = dynamic(() => import("../war-room/widgets/ImpactEvidenceWidget").then((m) => m.ImpactEvidenceWidget), { ssr: false, loading: panelLoading("Loading") });

type Tab = "GRID" | "TRAIL";

/**
 * Payments: the centre of "Did it land?". Every PayPal payment in one AG Grid, each with PayPal's own status and the household's
 * answer kept apart. The second tab is the money trail: where every dollar sits and how one payment is traced from donor to proof.
 */
export default function PaymentsRoute() {
  return (
    <Suspense fallback={null}>
      <PaymentsPage />
    </Suspense>
  );
}

function PaymentsPage() {
  const params = useSearchParams();
  const pendingOpen = useRef<string | null>(params.get("open"));
  const [tab, setTab] = useState<Tab>(params.get("tab") === "trail" ? "TRAIL" : "GRID");
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const { cases, summary: sum, queue, source, lastSyncedAt, refreshFromPayPal } = useCases();
  const live = source === "live";

  const doRefresh = async () => {
    setRefreshing(true);
    const r = await refreshFromPayPal();
    setRefreshing(false);
    toast({ title: r.ok ? "Refreshed from PayPal" : "Could not refresh", body: r.message, tone: r.ok ? (r.changed ? "success" : "info") : "warn" });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={live ? `Live PayPal Sandbox · PayPal asked ${relativeTime(lastSyncedAt)}` : "Hurricane Milton replay · synthetic people"}
        title="Every payment,"
        accent="answered or not yet."
        description={
          <>
            PayPal’s <span className="font-semibold text-ink">SUCCESS</span> means the money was credited to an account, not that the family can use it. Each row keeps PayPal’s word and the household’s word apart.{" "}
            <span className="text-ink-3">{sum.households} payments · {money(sum.approvedUsd)} sent.</span>
          </>
        }
        actions={
          live ? (
            <Button variant="glass" onClick={doRefresh} loading={refreshing} leading={<I.refresh className="h-4 w-4" />} data-testid="refresh-paypal">
              {refreshing ? "Asking PayPal…" : "Refresh from PayPal"}
            </Button>
          ) : undefined
        }
      />

      <div className="tabs" role="tablist" aria-label="Payments views">
        {(
          [
            ["GRID", "Every payment", String(cases.length)],
            ["TRAIL", "Money trail", null],
          ] as const
        ).map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {label}
            {count && <span className="tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "GRID" && <CaseGrid cases={cases} queue={queue} openRef={pendingOpen} />}

      {tab === "TRAIL" && (
        <div className="space-y-6">
          <p className="max-w-3xl text-[14px] text-ink-2">Where every dollar sits, in exactly one place; how one payment is traced from a donor to proof; and the tests behind the safety claims.</p>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SettlementIntegrityBridge />
            <TreasuryWaterfallWidget />
          </div>
          <PayPalMoneyPathExplorer />
          <ImpactEvidenceWidget />
        </div>
      )}
    </div>
  );
}
