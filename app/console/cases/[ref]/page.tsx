"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { CaseOfficerPanel } from "@/components/ai/CaseOfficerPanel";
import { RecoveryPanel, useMe } from "@/components/recovery/RecoveryPanel";
import { ProvenanceTag, PayPalStatusBadge, StageDots, EvidenceState, money2 } from "@/components/relief/parts";
import type { ReliefCase } from "@/lib/relief/case-types";

/** One payment, from PayPal's evidence to the resident's answer, with the recovery actions the rules allow. */
export default function CasePage() {
  const params = useParams<{ ref: string }>();
  const ref = decodeURIComponent(params.ref);
  const me = useMe();
  const [c, setC] = useState<ReliefCase | null | undefined>(undefined);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    let alive = true;
    fetch("/api/cases")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSource(j.source);
        setC((j.cases as ReliefCase[]).find((x) => x.caseRef === ref) ?? null);
      })
      .catch(() => alive && setC(null));
    return () => {
      alive = false;
    };
  }, [ref]);

  if (c === undefined)
    return (
      <div className="space-y-4" role="status" aria-label="Loading the payment">
        <div className="skeleton h-4 w-40" /><div className="skeleton h-10 w-2/3" /><div className="skeleton h-40 w-full" />
      </div>
    );
  if (c === null) {
    return (
      <div className="pane space-y-3 p-6">
        <p className="text-[14.5px] text-ink-2">We couldn’t find that payment in the current data source{source ? ` (${source})` : ""}. Switch the data source at the top of the page, or go back to Payments.</p>
        <Link href="/console/payments" className="link font-semibold">Back to Payments</Link>
      </div>
    );
  }

  const live = c.origin === "SANDBOX_LIVE";
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${live ? "Live PayPal Sandbox" : "Milton replay · synthetic"} · ${c.zone}`}
        title={`${c.resident} · ${money2(c.amountUsd)}`}
        description={<><span className="font-semibold text-ink">Next: </span>{c.nextAction.plain}</>}
      />

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* the record */}
        <div className="space-y-6">
          <section className="pane p-5" aria-label="Where this payment is">
            <div className="flex flex-wrap items-center gap-3">
              <PayPalStatusBadge status={c.status} />
              <StageDots c={c} />
              {c.claimDaysLeft !== null && <span className="text-[13px] font-semibold text-amber">{c.claimDaysLeft} day{c.claimDaysLeft === 1 ? "" : "s"} left to claim at PayPal</span>}
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
              <div><dt className="text-ink-3">PayPal item</dt><dd className="mt-0.5 truncate font-code text-[12.5px] text-ink">{c.itemId}</dd></div>
              <div><dt className="text-ink-3">Batch</dt><dd className="mt-0.5 truncate font-code text-[12.5px] text-ink">{c.batchId}</dd></div>
              <div><dt className="text-ink-3">Evidence</dt><dd className="mt-0.5 font-semibold text-ink">{c.evidenceCount.present} of {c.evidenceCount.applicable} present</dd></div>
            </dl>
          </section>

          <section className="pane p-5" aria-labelledby="ev-h">
            <h2 id="ev-h" className="text-title-2 text-ink">Evidence</h2>
            <p className="mt-1 text-[13px] text-ink-3">Each fact says who reported it. Missing evidence is shown as missing, never assumed.</p>
            <ul className="mt-3 divide-y divide-line">
              {c.evidence.map((e) => (
                <li key={e.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-ink">{e.title}</div>
                    <div className="mt-0.5 text-[13px] text-ink-2">{e.detail}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <EvidenceState state={e.state} />
                    <ProvenanceTag provenance={e.provenance} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* what you can do */}
        <div className="space-y-6">
          <CaseOfficerPanel caseRef={c.caseRef} />
          <section className="pane p-5" aria-label="What can safely be done">
            <RecoveryPanel c={c} me={me} />
          </section>
        </div>
      </div>
    </div>
  );
}
