"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
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

  if (c === undefined) return <p className="text-[13px] text-ink-3">Loading case…</p>;
  if (c === null) {
    return (
      <div className="space-y-3">
        <p className="glass p-5 text-[14px] text-ink-2">We couldn’t find that case in the current data source{source ? ` (${source})` : ""}. Switch the source at the top of the page, or go back to the war room.</p>
        <Link href="/console/war-room" className="text-accent-strong underline">Back to the war room</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={c.origin === "SANDBOX_LIVE" ? "Live PayPal Sandbox" : "Milton replay"} title={`${c.resident} · ${money2(c.amountUsd)}`} description={c.nextAction.plain} />
      <section className="glass space-y-3 p-4" aria-label="Where this payment is">
        <div className="flex flex-wrap items-center gap-3">
          <PayPalStatusBadge status={c.status} />
          <StageDots c={c} />
          {c.claimDaysLeft !== null && <span className="text-[13px] text-amber">{c.claimDaysLeft} day{c.claimDaysLeft === 1 ? "" : "s"} left in PayPal’s claim window</span>}
        </div>
        <p className="text-[12.5px] text-ink-3">PayPal item {c.itemId} · batch {c.batchId} · {c.evidenceCount.present} of {c.evidenceCount.applicable} pieces of evidence present</p>
      </section>
      <section className="glass p-4" aria-label="Evidence">
        <h3 className="text-[15px] font-semibold text-ink">Evidence</h3>
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {c.evidence.map((e) => (
            <li key={e.key} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink">{e.title}</div>
                <div className="text-[12.5px] text-ink-3">{e.detail}</div>
              </div>
              <div className="flex items-center gap-2">
                <EvidenceState state={e.state} />
                <ProvenanceTag provenance={e.provenance} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <div className="glass p-4">
        <RecoveryPanel c={c} me={me} />
      </div>
    </div>
  );
}
