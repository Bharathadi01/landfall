"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { Tag } from "@/components/ui/Tag";
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
    <section className="glass space-y-3 p-4" aria-label="New Sandbox payout">
      <h3 className="text-[15px] font-semibold text-ink">New PayPal Sandbox payout</h3>
      <p className="text-[12.5px] text-ink-3">Households with a payout route configured on the server. Each payment is capped at ${(routes.maxItemCents / 100).toFixed(0)} and a proposal at ${(routes.maxTotalCents / 100).toFixed(0)}. Sandbox money only.</p>
      <div className="flex flex-wrap gap-3">
        {routes.households.map((h) => (
          <label key={h} className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={picked.includes(h)} onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, h] : cur.filter((x) => x !== h)))} /> {h}
          </label>
        ))}
      </div>
      <label className="block text-[12.5px] text-ink-2">
        Amount per household (USD)
        <input value={dollars} onChange={(e) => setDollars(e.target.value)} inputMode="decimal" className="mt-1 block w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-ink" />
      </label>
      <button type="button" disabled={!staff || busy || picked.length === 0 || !(cents > 0)} onClick={submit} className="field-btn field-btn-primary" data-testid="propose-payout">
        {busy ? "Creating…" : "Propose payout (needs two approvals)"}
      </button>
      {!staff && <p className="text-[12px] text-ink-3">Sign in as a coordinator or finance persona to propose.</p>}
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
    <div className="space-y-5">
      <PageHeader eyebrow="Approvals" title="Proposed actions" description="Nothing moves money until two different people approve the exact action, one of them from Finance. The Treasurer then runs it once." />
      <NewPayout me={me} onCreated={(p) => { setItems((cur) => [p, ...(cur ?? []).filter((x) => x.id !== p.id)]); setOpenId(p.id); }} />
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">{error}</p>}
      {items === null && !error && <p className="text-[13px] text-ink-3">Loading…</p>}
      {items?.length === 0 && (
        <p className="glass p-5 text-[14px] text-ink-2">
          No proposals yet. Open a live case and choose a recovery action, or <Link href="/console/golden-flow" className="text-accent-strong underline">start from the guided flow</Link>.
        </p>
      )}
      <ul className="space-y-3">
        {items?.map((p) => {
          const d = describeProposal(p);
          return (
            <li key={p.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4" data-testid="proposal-row">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink">{d.title} · {d.usd}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-3">{p.approvals.length} of 2 approvals · proposed {new Date(p.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <Tag tone={p.status === "EXECUTED" ? "delivered" : p.status === "FAILED" || p.status === "REJECTED" ? "danger" : "amber"}>{p.status}</Tag>
                <button type="button" onClick={() => setOpenId(p.id)} className="field-btn field-btn-secondary">Review</button>
              </div>
            </li>
          );
        })}
      </ul>
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
