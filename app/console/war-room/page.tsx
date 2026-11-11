"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgCharts } from "ag-charts-react";
import {
  type AgChartOptions,
  ModuleRegistry as AgChartsModuleRegistry,
  AllCommunityModule as AgChartsAllCommunityModule,
} from "ag-charts-community";
import { PasskeyApprovalModal } from "@/components/security/PasskeyApprovalModal";
import { chartTheme } from "@/styles/ag-studio-theme";
import { registerAg } from "@/lib/ag/register";
import { CaseGrid } from "@/components/grid/CaseGrid";
import { LandfallStudio } from "@/components/studio/LandfallStudio";
import { PageHeader, StatCard, SectionHeader, Chip, IconTile, type Tone } from "@/components/ui/primitives";
import { ProvenanceTag, PayPalStatusBadge, StageDots, EvidenceState, money, money2 } from "@/components/relief/parts";
import {
  buildReliefCases,
  summarizeCases,
  attentionQueue,
  STAGES,
  ACCESS_REASON_LABEL,
  type AccessReport,
  type ReliefCase,
} from "@/lib/relief/cases";
import { TREASURY, studioApprovalEvents, studioWebhookObservations } from "@/lib/studio/landfall-studio-data";
import {
  HazardIntelligenceWidget,
  ExposureDistributionWidget,
  TreasuryWaterfallWidget,
  ResponseFunnelWidget,
  PayoutHealthWidget,
  ReadinessMonitorWidget,
  ImpactTimelineWidget,
  PayPalMoneyPathExplorer,
  SettlementIntegrityBridge,
  RecipientRescueQueue,
  ImpactEvidenceWidget,
} from "./widgets";
import { I } from "@/components/icons";

AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule]);
registerAg();

type Tab = "OVERVIEW" | "GRID" | "STUDIO" | "WIDGETS" | "SETTLEMENT";

const STAGE_ICON = {
  APPROVED: I.approved,
  SENT: I.send,
  CREDITED: I.treasury,
  CONFIRMED: I.relief,
  CLOSED: I.doubleCheck,
} as const;
const STAGE_TONE: Record<string, Tone> = { APPROVED: "neutral", SENT: "neutral", CREDITED: "paypal", CONFIRMED: "accent", CLOSED: "accent" };

export default function CommandCenterPage() {
  const pendingOpen = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [reports, setReports] = useState<AccessReport[]>([]);

  // Resident-reported access reports (from the resident portal) join the cases.
  useEffect(() => {
    let alive = true;
    fetch("/api/recipients/access-report")
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((j) => alive && setReports(j.reports ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const cases = useMemo(() => buildReliefCases(reports), [reports]);
  const sum = useMemo(() => summarizeCases(cases), [cases]);
  const queue = useMemo(() => attentionQueue(cases, 3), [cases]);

  const activity = useMemo(() => {
    const ev = [
      { t: "2024-10-09T18:05:00Z", icon: I.stormEye, tone: "storm" as Tone, text: "NWS Hurricane Warning TBW:HU.W:0009 issued" },
      ...studioApprovalEvents.map((a) => ({ t: a.approved_at, icon: I.twoKeyApproval, tone: "amber" as Tone, text: `${a.approver_role} signed the plan (demo passkey)` })),
      ...studioWebhookObservations.map((w) => ({
        t: w.received_time,
        icon: I.send,
        tone: "paypal" as Tone,
        text: `PayPal ${w.event_type.replace("PAYMENT.PAYOUTS-ITEM.", "")} · ${w.item_id}`,
      })),
    ];
    return ev.sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5);
  }, []);

  const openCase = (c: ReliefCase) => {
    pendingOpen.current = c.caseRef;
    setTab("GRID");
  };

  /* ── Money chart (derived: segments sum to funds received) ── */

  const chartOptions = useMemo<AgChartOptions>(
    () =>
      ({
        theme: chartTheme(),
        data: [
          { bucket: "Ready to allocate", amount: TREASURY.allocatable },
          { bucket: "Protected reserve", amount: TREASURY.reserve },
          { bucket: "Sent to PayPal", amount: TREASURY.paidOut + TREASURY.inFlight },
        ],
        series: [
          {
            type: "donut",
            angleKey: "amount",
            legendItemKey: "bucket",
            innerRadiusRatio: 0.72,
            fills: ["#6FD49A", "#FFB020", "#4C9BFF"],
            strokes: ["#141316", "#141316", "#141316"],
            strokeWidth: 3,
            cornerRadius: 6,
            innerLabels: [
              { text: money(TREASURY.total), fontSize: 26, fontWeight: 650, color: "#F3EFE8" },
              { text: "funds received", fontSize: 12, color: "#8A847B", spacing: 6 },
            ],
            tooltip: { renderer: (p: any) => ({ heading: p.datum.bucket, data: [{ label: "Amount", value: money(p.datum.amount) }] }) },
          },
        ],
        legend: { position: "bottom", item: { label: { color: "#B9B3AA", fontSize: 12 }, marker: { shape: "circle" } } },
        padding: { top: 4, bottom: 4 },
      }) as any,
    []
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "OVERVIEW", label: "Overview", icon: I.dashboard },
    { id: "GRID", label: "Cases · AG Grid", icon: I.people },
    { id: "STUDIO", label: "Relief Studio · AG Studio", icon: I.chart },
    { id: "WIDGETS", label: "All widgets", icon: I.boxes },
    { id: "SETTLEMENT", label: "Settlement proof", icon: I.evidence },
  ];

  const statusTone = (s: string): Tone => (s === "UNCLAIMED" || s === "RETURNED" ? "amber" : s === "SUCCESS" ? "paypal" : s === "PENDING" ? "neutral" : "danger");

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Command Center · Hurricane Milton"
        icon={I.dashboard}
        tone="accent"
        title="12 hours to landfall."
        accent="Here’s what needs you."
        description={`${sum.households} households approved · ${money(sum.approvedUsd)} sent to PayPal · ${sum.creditedCount} credited by PayPal, ${sum.confirmedCount} confirmed by residents · ${sum.needPersonCount} need a person.`}
        meta={
          <>
            <Chip tone="storm" live>
              Replay · Oct 2024
            </Chip>
            <Chip tone="neutral">Synthetic scenario</Chip>
          </>
        }
        actions={
          <>
            <Link href="/console/studio" className="field-btn field-btn-secondary">
              <I.chart className="h-4 w-4 text-paypal" /> Analytics Studio
            </Link>
            <button onClick={() => setPasskeyOpen(true)} className="field-btn field-btn-primary">
              <I.twoKeyApproval className="h-4 w-4" /> Approve payout plan
            </button>
          </>
        }
      />

      {/* Delivery tracker — PayPal credit is not the finish line */}
      <section className="glass p-3" data-reveal aria-label="Relief delivery progress">
        <ol className="grid grid-cols-1 gap-1 sm:grid-cols-5">
          {sum.stageCounts.map((s, i) => {
            const Icon = STAGE_ICON[s.key as keyof typeof STAGE_ICON];
            const gap = s.key === "CONFIRMED" && sum.creditedUnconfirmedCount > 0;
            return (
              <li key={s.key} className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 ${gap ? "bg-amber/[0.07]" : ""}`}>
                <IconTile icon={Icon} tone={gap ? "amber" : STAGE_TONE[s.key]} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 text-[13.5px] font-semibold text-ink">
                    {s.label}
                    <span className="tabular text-[12px] font-normal text-ink-3">
                      {s.count}/{sum.households}
                    </span>
                  </div>
                  <div className={`truncate text-[12px] ${gap ? "text-amber" : "text-ink-3"}`}>
                    {gap ? `${sum.creditedUnconfirmedCount} credited, not confirmed` : s.help}
                  </div>
                </div>
                {i < sum.stageCounts.length - 1 && <I.arrowRight className="absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-ink-3/50 sm:block" />}
              </li>
            );
          })}
        </ol>
        {sum.creditedUnconfirmedCount > 0 && (
          <p className="px-3.5 pb-2 pt-1 text-[12.5px] text-ink-2">
            PayPal <span className="font-mono text-paypal">SUCCESS</span> means credited to the account — not proof the household can use the money. Landfall keeps the two facts apart.
          </p>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash in PayPal account" value={TREASURY.available} prefix="$" tone="paypal" icon={I.wallet} hint="Replay data · includes the protected reserve" />
        <StatCard label="Protected reserve" value={TREASURY.reserve} prefix="$" tone="amber" icon={I.reserve} hint={`Policy floor ${money(TREASURY.requiredReserve)} (${TREASURY.policyFloorPct}%) · can’t be spent`} />
        <StatCard label="Ready to allocate" value={TREASURY.allocatable} prefix="$" tone="accent" icon={I.payout} hint="Cash in account minus the reserve" />
        <StatCard label="Need a person" value={sum.needPersonCount} tone="danger" icon={I.needPerson} hint={`${money(sum.needPersonUsd)} across cases needing follow-up`} />
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1 backdrop-blur" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium transition-all ${
              tab === t.id ? "bg-white/10 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-ink-3 hover:text-ink"
            }`}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "OVERVIEW" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 animate-field-fade">
          <section className="glass p-6 xl:col-span-7" data-reveal>
            <SectionHeader
              icon={I.warning}
              tone="danger"
              title="Needs your attention"
              description="Ranked by explainable rules — every point has a stated reason"
              right={
                <Link href="/console/watch-officer" className="field-btn field-btn-secondary px-3.5 py-2 text-[13px]">
                  <I.aiAdvisor className="h-4 w-4 text-ai" /> Ask the AI why
                </Link>
              }
            />
            {reports.length > 0 && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-3.5" data-testid="resident-reports-banner">
                <I.relief className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
                <div className="text-[13px] text-ink">
                  <span className="font-semibold">{reports.length} resident report{reports.length === 1 ? "" : "s"} received</span>{" "}
                  <ProvenanceTag provenance="RECIPIENT_REPORTED" className="ml-1" />
                  <div className="mt-1 text-ink-2">
                    {reports
                      .slice(-3)
                      .reverse()
                      .map((r) => (r.kind === "RECEIVED" ? "“I received it”" : `“Can’t access: ${ACCESS_REASON_LABEL[r.reason ?? "OTHER"].toLowerCase()}”`))
                      .join(" · ")}
                    . Self-reported — shown as such, never as PayPal confirmation.
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-5 space-y-3">
              {queue.map((c) => (
                <li key={c.caseRef} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.035]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[15px] font-semibold text-ink">{c.resident}</span>
                    <span className="text-[12.5px] text-ink-3">{c.zone}</span>
                    <Chip tone={statusTone(c.status)}>{c.barrier ? "Resident reported a problem" : c.status === "SUCCESS" ? "Credited · unconfirmed" : c.status}</Chip>
                    <span className="ml-auto text-[15px] font-semibold tabular text-ink">{money2(c.amountUsd)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.priority.reasons.slice(0, 3).map((r) => (
                      <span key={r.label} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-2">
                        {r.label} <span className="font-mono text-ink-3">+{r.points}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 text-[13px] text-accent-strong">
                      <I.enter className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-180" /> {c.nextAction.plain}
                    </p>
                    <button onClick={() => openCase(c)} className="field-btn field-btn-secondary shrink-0 px-3 py-2 text-[12.5px]">
                      Open case evidence <I.arrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[10.5px] text-ink-3">{c.caseRef}</div>
                </li>
              ))}
              {queue.length === 0 && <li className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 text-[13.5px] text-accent-strong">Nothing needs a person right now.</li>}
            </ul>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-ink-3">
                <I.summary className="h-3.5 w-3.5" /> Plain-English summary · computed from the case data
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                {sum.needPersonCount} of {sum.households} cases need a person, and none of them should trigger a second payout.{" "}
                <span className="tabular text-accent-strong">{money(TREASURY.allocatable)}</span> is allocatable and the{" "}
                <span className="tabular text-amber">{money(TREASURY.reserve)}</span> reserve is untouched. PayPal has credited{" "}
                <span className="tabular text-paypal">{money(sum.creditedUsd)}</span>; {sum.confirmedCount} of {sum.creditedCount} credited payments are confirmed by the household.
              </p>
              <p className="mt-2 text-[12px] text-ink-3">The AI Watch Officer page runs the live read-only model against this same data.</p>
            </div>
          </section>

          <div className="space-y-6 xl:col-span-5">
            <section className="glass p-6" data-reveal>
              <SectionHeader icon={I.wallet} tone="paypal" title="Where the money sits" right={<Chip tone="amber">Replay ledger · not checked against PayPal</Chip>} />
              <div className="mt-2 h-[300px]">
                <AgCharts options={chartOptions} />
              </div>
            </section>

            <section className="glass p-6" data-reveal>
              <SectionHeader icon={I.clock} title="Latest activity" description="Replay clock · UTC" />
              <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/[0.07]">
                {activity.map((a) => (
                  <li key={a.t + a.text} className="relative flex items-center gap-3">
                    <IconTile icon={a.icon} tone={a.tone} size="sm" className="relative z-10 !bg-surface" />
                    <span className="flex-1 text-[13.5px] text-ink-2">{a.text}</span>
                    <span className="font-mono text-[11px] text-ink-3">{a.t.slice(11, 16)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 space-y-3">
                <div>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-ink-2">Credited by PayPal</span>
                    <span className="tabular text-ink">
                      {sum.creditedCount} of {sum.households}
                    </span>
                  </div>
                  <div className="meter mt-2">
                    <span style={{ width: `${(sum.creditedCount / sum.households) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-ink-2">Confirmed by the household</span>
                    <span className="tabular text-ink">
                      {sum.confirmedCount} of {sum.households}
                    </span>
                  </div>
                  <div className="meter mt-2">
                    <span style={{ width: `${(sum.confirmedCount / sum.households) * 100}%` }} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Link href="/console/studio" className="glass card-hover group flex flex-col gap-4 p-6 sm:flex-row sm:items-center xl:col-span-12" data-reveal>
            <IconTile icon={I.chart} tone="paypal" size="lg" />
            <div className="flex-1">
              <div className="text-[16px] font-semibold text-ink">Explore this response in Analytics Studio</div>
              <div className="text-[13.5px] text-ink-3">AG Studio workspace · custom widgets · cross-filters · ask the Studio agent in plain English</div>
            </div>
            <span className="field-btn field-btn-secondary">
              Open Studio <I.arrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      )}

      {tab === "GRID" && <CaseGrid cases={cases} queue={queue} openRef={pendingOpen} />}

      <div
        className="h-[920px] w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-canvas/60"
        style={{ display: tab === "STUDIO" ? "block" : "none" }}
      >
        <LandfallStudio mode="view" />
      </div>

      {tab === "WIDGETS" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 animate-field-fade">
          <HazardIntelligenceWidget />
          <ExposureDistributionWidget />
          <TreasuryWaterfallWidget />
          <ResponseFunnelWidget />
          <PayoutHealthWidget />
          <ReadinessMonitorWidget />
          <ImpactTimelineWidget />
          <PayPalMoneyPathExplorer />
          <SettlementIntegrityBridge />
          <RecipientRescueQueue />
          <ImpactEvidenceWidget />
        </div>
      )}

      {tab === "SETTLEMENT" && (
        <div className="space-y-6 animate-field-fade">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PayPalMoneyPathExplorer />
            <SettlementIntegrityBridge />
          </div>
          <ImpactEvidenceWidget />
        </div>
      )}

      {passkeyOpen && (
        <PasskeyApprovalModal
          isOpen={passkeyOpen}
          planHash={studioApprovalEvents[0].plan_hash}
          onClose={() => setPasskeyOpen(false)}
          onApproved={() => setPasskeyOpen(false)}
          planSummary={{
            title: "Tranche 1 · Hurricane Milton relief grants",
            totalAmountFormatted: `${money2(sum.approvedUsd)} USD`,
            householdsCount: sum.households,
            tranche: 1,
          }}
        />
      )}
    </div>
  );
}
