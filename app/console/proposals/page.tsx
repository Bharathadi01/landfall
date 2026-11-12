"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/icons";
import { ApprovalDialog, describeProposal } from "@/components/recovery/ApprovalDialog";
import { useMe } from "@/components/recovery/RecoveryPanel";
import { useToast } from "@/components/ui/Toast";
import type { ProposalView } from "@/lib/proposals/types";

/** Every proposed money movement and its approvals, as the server records them. */
function NewPayout({ me, onCreated }: { me: { role: string } | null; onCreated: (p: ProposalView) => void }) {
  const toast = useToast();
  const [routes, setRoutes] = useState<{ households: string[]; maxItemCents: number; maxTotalCents: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [dollars, setDollars] = useState("1");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/proposals/routes").then((r) => r.json()).then(setRoutes).catch(() => setRoutes(null));
  }, []);
  const staff = me?.role === "coordinator" || me?.role === "finance";
  if (!routes || routes.households.length === 0) return null;
  const cents = Math.round(Number(dollars) * 100);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "NEW_PAYOUT", items: picked.map((householdId) => ({ householdId, amountCents: cents })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return toast({ tone: "error", title: "Couldn’t create the proposal", body: j.message });
      toast({ tone: "success", title: j.created ? "Proposal created" : "This proposal already exists", body: "It needs two approvals before anything is sent to PayPal." });
      onCreated(j.proposal);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="pane space-y-4 p-6" aria-label="New Sandbox payout">
      <div>
        <h2 className="text-title-2 text-ink">New PayPal Sandbox payout</h2>
        <p className="mt-1 text-[13px] text-ink-3">Households with a payout route configured on the server. Each payment is capped at ${(routes.maxItemCents / 100).toFixed(0)} and a proposal at ${(routes.maxTotalCents / 100).toFixed(0)}. Sandbox money only.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {routes.households.map((h) => (
          <label key={h} className="flex cursor-pointer items-center gap-2 rounded-md border border-line-strong px-3 py-2 text-[13.5px] text-ink-2 has-[:checked]:border-accent has-[:checked]:text-ink">
            <input type="checkbox" checked={picked.includes(h)} onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, h] : cur.filter((x) => x !== h)))} /> {h}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-[13px] font-semibold text-ink-2">
          Amount per household (USD)
          <input value={dollars} onChange={(e) => setDollars(e.target.value)} inputMode="decimal" className="field-input mt-1.5 block !w-32" />
        </label>
        <Button variant="signal" disabled={!staff || busy || picked.length === 0 || !(cents > 0)} loading={busy} onClick={submit} data-testid="propose-payout">
          {busy ? "Creating…" : "Propose payout"}
        </Button>
      </div>
      {!staff && <p className="text-[13px] text-ink-3">You are signed in read-only. Sign in as Dana (coordinator) or Sam (finance) to propose.</p>}
    </section>
  );
}

export default function ProposalsPage() {
  const me = useMe();
  const [items, setItems] = useState<ProposalView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/proposals");
      const j = await r.json();
      if (!r.ok) throw new Error();
      setItems(j.proposals);
      setError(null);
    } catch {
      setError("Couldn’t load proposals. Try again in a moment.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = items?.find((p) => p.id === openId) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Decide and pay · Approvals"
        title="Two people, one exact plan."
        accent="Nothing moves money until both agree."
        description="Two different people approve the exact action, one of them from Finance. Change one number and both must approve again. The Treasurer then runs it once."
      />

      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4" aria-label="How an approval works">
        {[
          [I.document, "Proposed", "A coordinator proposes an exact plan: who, how much, why."],
          [I.person, "First approval", "One person approves that exact plan."],
          [I.twoKeyApproval, "Finance approves", "A different person, from Finance, approves the same plan."],
          [I.payout, "Sent once", "The Treasurer, which is code and not AI, sends it to PayPal once."],
        ].map(([Icon, t, d]: any, i) => (
          <li key={t} className="flex gap-3 bg-surface p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2"><Icon className="h-4 w-4" /></span>
            <span>
              <span className="block text-[12px] text-ink-3">Step {i + 1}</span>
              <span className="block text-[14px] font-semibold text-ink">{t}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      <section aria-labelledby="queue-h" className="space-y-3">
        <h2 id="queue-h" className="text-title-2 text-ink">Waiting for approval</h2>
        {error && <div role="alert" className="note" data-tone="danger">{error}</div>}
        {items === null && !error && <div className="skeleton h-20 w-full" />}
        {items?.length === 0 && (
          <div className="pane p-6 text-[14px] text-ink-2">
            No proposals yet. Open an unclaimed payment in <Link href="/console/payments" className="link font-semibold">Payments</Link> and choose a recovery action, or propose a new payout below.
          </div>
        )}
        <ul className="space-y-2.5">
          {items?.map((p) => {
            const d = describeProposal(p);
            const n = p.approvals.length;
            return (
              <li key={p.id} className="pane flex flex-wrap items-center justify-between gap-4 p-4" data-testid="proposal-row">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-ink">{d.title} · {d.usd}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink-3">Proposed {new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5" aria-label={`${n} of 2 approvals`} title={`${n} of 2 approvals`}>
                    {[0, 1].map((k) => (
                      <span key={k} className={`flex h-6 w-6 items-center justify-center rounded-full border ${k < n ? "border-delivered bg-delivered text-on-accent" : "border-line-strong text-ink-3"}`}>
                        {k < n ? <I.check className="h-3.5 w-3.5" /> : <span className="text-[11px] font-semibold">{k + 1}</span>}
                      </span>
                    ))}
                  </span>
                  <Tag tone={p.status === "EXECUTED" ? "delivered" : p.status === "FAILED" || p.status === "REJECTED" ? "danger" : "amber"}>{String(p.status).toLowerCase().replace(/_/g, " ")}</Tag>
                  <Button variant="glass" size="sm" onClick={() => setOpenId(p.id)}>Review</Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <NewPayout me={me} onCreated={(p) => { setItems((cur) => [p, ...(cur ?? []).filter((x) => x.id !== p.id)]); setOpenId(p.id); }} />
      {open && (
        <ApprovalDialog
          proposal={open}
          me={me}
          open
          onClose={() => setOpenId(null)}
          onChanged={(p) => setItems((cur) => (cur ?? []).map((x) => (x.id === p.id ? p : x)))}
        />
      )}
    </div>
  );
}
