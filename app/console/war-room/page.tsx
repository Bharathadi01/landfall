"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { PageHeader } from "@/components/ui/primitives";
import { Ticker } from "@/components/ui/Ticker";
import { Tag } from "@/components/ui/Tag";
import { ProvenanceTag, money, money2 } from "@/components/relief/parts";
import { ACCESS_REASON_LABEL, type ReliefCase } from "@/lib/relief/cases";
import { studioApprovalEvents, studioWebhookObservations } from "@/lib/studio/landfall-studio-data";
import { useCases } from "@/components/data/DataSourceProvider";
import { relativeTime } from "@/components/data/SourceSwitch";
import { FLOW } from "@/components/layout/flow";
import { I } from "@/components/icons";

// AG Charts loads after the numbers are on screen.
const MoneyDonut = dynamic(() => import("./MoneyDonut"), { ssr: false, loading: () => <div className="skeleton mx-auto h-[210px] w-[210px] rounded-full" aria-hidden /> });

/**
 * COMMAND CENTER — the console's home. It answers one question first: what needs a person right now?
 * Three calm zones, nothing else:
 *   1. the delivery line: each payment's journey, and the gap between "PayPal credited it" and "the family confirmed it"
 *   2. the people who still need an answer, each with one clear next action
 *   3. the fund: what can be spent, what is protected, what has gone out
 */
export default function CommandCenterPage() {
  const { cases, summary: sum, queue, treasury: T, source, lastSyncedAt } = useCases();
  const live = source === "live";

  const reports = useMemo(
    () =>
      cases.flatMap((c) =>
        c.barrier ? [`“Can’t access: ${ACCESS_REASON_LABEL[c.barrier ?? "OTHER"].toLowerCase()}”`] : c.evidence.some((e) => e.key === "recipient" && /reported they received it/.test(e.detail)) ? ["“I received it”"] : []
      ),
    [cases]
  );

  const activity = useMemo(() => {
    if (live) {
      const now = Date.now();
      return cases
        .map((c) => ({ t: new Date(now - c.ageHours * 3_600_000).toISOString(), who: "PayPal", text: `${c.status.toLowerCase()} · ${c.resident}` }))
        .sort((a, b) => b.t.localeCompare(a.t))
        .slice(0, 4);
    }
    const ev = [
      { t: "2024-10-09T18:05:00Z", who: "NWS", text: "Hurricane Warning issued for Tampa Bay" },
      ...studioApprovalEvents.map((a) => ({ t: a.approved_at, who: "Approval", text: `${a.approver_role} signed the plan` })),
      ...studioWebhookObservations.map((w) => ({ t: w.received_time, who: "PayPal", text: `${w.event_type.replace("PAYMENT.PAYOUTS-ITEM.", "").toLowerCase()} · ${w.item_id}` })),
    ];
    return ev.sort((a, b) => b.t.localeCompare(a.t)).slice(0, 4);
  }, [live, cases]);

  const open = sum.needPersonCount;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={live ? `Live PayPal Sandbox · PayPal asked ${relativeTime(lastSyncedAt)}` : "Hurricane Milton replay · 12 hours to landfall"}
        title={open === 0 ? "Every payment has an answer." : `${open} ${open === 1 ? "payment still needs" : "payments still need"} an answer.`}
        accent={open === 0 ? "Nothing needs you right now." : "Here is what to do."}
        description={`${sum.households} ${live ? "real PayPal Sandbox payments" : "households paid"} · ${money(sum.approvedUsd)} sent · ${sum.creditedCount} credited by PayPal · ${sum.confirmedCount} confirmed by the family.`}
      />

      <ResponsePath />

      <DeliveryLine sum={sum} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* 2 — people who still need an answer */}
        <section className="pane p-6 xl:col-span-7" aria-labelledby="needs-person">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 id="needs-person" className="text-title-2 text-ink">Needs a person</h2>
              <p className="mt-1 text-[13px] text-ink-3">Ranked by stated rules: every point of priority has a reason you can read.</p>
            </div>
            <Link href="/console/payments" className="text-[13.5px] font-semibold text-ink link">All payments</Link>
          </div>

          {reports.length > 0 && (
            <div className="note mt-5" data-tone="delivered" data-testid="resident-reports-banner">
              <span className="note-label">
                {reports.length} {reports.length === 1 ? "family has" : "families have"} answered <ProvenanceTag provenance="RECIPIENT_REPORTED" className="ml-1.5 align-middle" />
              </span>
              {reports.slice(-3).reverse().join(" · ")}. Self-reported, shown as such, never as PayPal’s confirmation.
            </div>
          )}

          <ul className="mt-2 divide-y divide-line">
            {queue.map((c) => (
              <QueueRow key={c.caseRef} c={c} />
            ))}
            {queue.length === 0 && <li className="py-6 text-[14px] text-ink-2">Nothing needs a person right now.</li>}
          </ul>
        </section>

        {/* 3 — the fund */}
        <section className="pane p-6 xl:col-span-5" aria-labelledby="the-fund">
          <div className="border-b border-line pb-4">
            <h2 id="the-fund" className="text-title-2 text-ink">The fund</h2>
            <p className="mt-1 text-[13px] text-ink-3">{live ? "From the ledger, posted from PayPal’s own statuses." : "Replay ledger, synthetic."}</p>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-4">
            <Figure label="Free to send" value={T.allocatable} tone="delivered" />
            <Figure label="Protected reserve" value={T.reserve} tone="amber" />
            <Figure label="Sent to PayPal" value={T.paidOut + T.inFlight} tone="paypal" />
          </dl>
          <div className="mt-4 h-[240px]">
            <MoneyDonut allocatable={T.allocatable} reserve={T.reserve} sent={T.paidOut + T.inFlight} total={T.total} />
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <div className="text-[13px] font-semibold text-ink">Latest from the record</div>
            <ol className="mt-3 space-y-2.5">
              {activity.map((a) => (
                <li key={a.t + a.text} className="grid grid-cols-[64px_1fr_auto] items-baseline gap-3 text-[13px]">
                  <span className={`text-[12px] font-semibold ${a.who === "PayPal" ? "text-paypal" : "text-ink-3"}`}>{a.who}</span>
                  <span className="truncate text-ink-2">{a.text}</span>
                  <span className="font-code text-[11.5px] text-ink-3">{a.t.slice(11, 16)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Orientation: the three questions of a relief response, each one click away. Quiet, one line. */
function ResponsePath() {
  const stages = FLOW.filter((g) => g.stage);
  return (
    <nav aria-label="The three stages of a response" className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3" data-testid="response-path">
      {stages.map((g, i) => (
        <Link key={g.stage} href={g.pages[0].href} className="group flex items-start gap-3 bg-canvas p-4 transition-colors hover:bg-surface">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[12px] font-semibold tabular text-ink-2 group-hover:border-accent group-hover:text-accent-strong">{i + 1}</span>
          <span className="min-w-0">
            <span className="block text-[12.5px] text-ink-3">{g.stage}</span>
            <span className="block text-[14.5px] font-semibold text-ink">{g.question}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-ink-3 group-hover:text-ink-2">{g.pages.map((p) => p.label).join(" · ")}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * The delivery line. Five facts about every payment, in order. The bars grow in on arrival so the eye reads it left to right,
 * and the gap that matters — credited by PayPal, not yet confirmed by the family — is called out in words, not just colour.
 */
function DeliveryLine({ sum }: { sum: ReturnType<typeof useCases>["summary"] }) {
  const ref = useRef<HTMLElement>(null);
  const total = Math.max(1, sum.households);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bars = el.querySelectorAll<HTMLElement>("[data-bar]");
    const tw = gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.1, ease: "expo.out", stagger: 0.09, delay: 0.25 });
    return () => { tw.kill(); };
  }, [sum.households, sum.creditedCount, sum.confirmedCount]);

  const gap = sum.creditedUnconfirmedCount;
  return (
    <section ref={ref} className="pane p-6" aria-labelledby="delivery-line">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="delivery-line" className="text-title-2 text-ink">Where each payment is</h2>
        <span className="text-[13px] text-ink-3">Out of {sum.households}</span>
      </div>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-5 sm:gap-3">
        {sum.stageCounts.map((s, i) => {
          const isGap = s.key === "CONFIRMED" && gap > 0;
          const tone = s.key === "CREDITED" ? "bg-paypal" : s.key === "CONFIRMED" || s.key === "CLOSED" ? "bg-delivered" : "bg-ink-2";
          return (
            <li key={s.key} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="figure text-[34px] leading-none text-ink">
                  <Ticker value={s.count} />
                </span>
                <span className="text-[12.5px] text-ink-3">of {sum.households}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line-strong/60">
                <div data-bar className={`h-full rounded-full ${tone}`} style={{ width: `${(s.count / total) * 100}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <span className="text-[11.5px] font-semibold tabular text-ink-3">{i + 1}</span> {s.label}
              </div>
              <p className={`mt-0.5 text-[12.5px] leading-snug ${isGap ? "text-amber" : "text-ink-3"}`}>{isGap ? `${gap} credited by PayPal, not yet confirmed by the family` : s.help}</p>
            </li>
          );
        })}
      </ol>
      {gap > 0 && (
        <p className="mt-6 border-t border-line pt-4 text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">Why two facts?</span> PayPal’s <span className="text-paypal">SUCCESS</span> means the money reached an account. It does not prove a family can use it: the account may be locked, the phone lost, the household evacuated. Landfall keeps asking until the family answers.
        </p>
      )}
    </section>
  );
}

function QueueRow({ c }: { c: ReliefCase }) {
  const WORD: Record<string, string> = { UNCLAIMED: "Waiting to be claimed", RETURNED: "Returned by PayPal", PENDING: "Pending at PayPal", ONHOLD: "On hold at PayPal", FAILED: "Failed at PayPal", BLOCKED: "Blocked at PayPal", REFUNDED: "Refunded", REVERSED: "Reversed" };
  const state = c.barrier
    ? { word: "Family reported a problem", tone: "danger" as const }
    : c.status === "SUCCESS"
    ? { word: "Credited, not confirmed", tone: "paypal" as const }
    : { word: WORD[c.status] ?? c.status, tone: (c.status === "FAILED" || c.status === "BLOCKED" ? "danger" : "amber") as "danger" | "amber" };
  const href = `/console/cases/${encodeURIComponent(c.caseRef)}`;
  return (
    <li className="group py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[15px] font-semibold text-ink">{c.resident}</span>
        <Tag tone={state.tone}>{state.word}</Tag>
        <span className="figure ml-auto text-[17px] text-ink">{money2(c.amountUsd)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-[13.5px] text-ink-2">{c.nextAction.plain}</p>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink link" data-testid="queue-open">
          Open and ask the AI <I.arrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </li>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: "delivered" | "amber" | "paypal" }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        {tone && <span className={`h-2 w-2 rounded-full ${tone === "delivered" ? "bg-delivered" : tone === "paypal" ? "bg-paypal" : "bg-amber"}`} aria-hidden />}
        {label}
      </dt>
      <dd className="figure mt-1.5 truncate text-[26px] leading-none text-ink">
        <Ticker value={value} prefix="$" />
      </dd>
    </div>
  );
}
