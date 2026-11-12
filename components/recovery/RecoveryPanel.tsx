"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ApprovalDialog, describeProposal, type Me } from "./ApprovalDialog";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { recoveryOptionsForCase, type RecoveryOption } from "@/lib/recovery/decision";
import { LIVE_CASE_PREFIX_CLIENT } from "@/lib/relief/live-ref";
import type { ReliefCase } from "@/lib/relief/case-types";
import type { ProposalView } from "@/lib/proposals/types";

/**
 * Recovery for ONE case. The deterministic gate decides what is allowed (the same function the server re-runs when a
 * proposal is created); this panel only proposes. Nothing here moves money: that takes two approvals.
 */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => alive && setMe(j.authenticated && j.session?.id ? { id: j.session.id, name: j.session.name, role: j.session.role } : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

const LABEL: Record<RecoveryOption["kind"], string> = { CANCEL_ITEM: "Cancel and return the funds", REISSUE: "Send a replacement payment" };

export function RecoveryPanel({ c, me }: { c: ReliefCase; me: Me | null }) {
  const toast = useToast();
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const live = c.origin === "SANDBOX_LIVE";
  const senderItemId = c.caseRef.startsWith(LIVE_CASE_PREFIX_CLIENT) ? c.caseRef.slice(LIVE_CASE_PREFIX_CLIENT.length) : null;
  const reportedReceived = c.evidence.some((e) => e.key === "recipient" && /reported they received it/.test(e.detail));
  const options = recoveryOptionsForCase({ status: c.status, claimDaysLeft: c.claimDaysLeft, barrier: c.barrier ?? null, reportedReceived });
  const canPropose = !!me && (me.role === "coordinator" || me.role === "finance");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/proposals");
      if (!r.ok) return;
      const j = await r.json();
      setProposals((j.proposals as ProposalView[]).filter((p) => (senderItemId && (p.payload as { senderItemId?: string }).senderItemId === senderItemId) || (p.payload as { parentSenderItemId?: string }).parentSenderItemId === senderItemId));
    } catch {
      /* keep what we have */
    }
  }, [senderItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const propose = async (kind: RecoveryOption["kind"]) => {
    setBusy(kind);
    try {
      const r = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, caseRef: c.caseRef }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ tone: "error", title: "Couldn’t create the proposal", body: j.message });
        return;
      }
      toast({ tone: "success", title: j.created ? "Proposal created" : "This proposal already exists", body: "It needs two approvals before anything happens." });
      await load();
      setOpenId(j.proposal.id);
    } finally {
      setBusy(null);
    }
  };

  const open = proposals.find((p) => p.id === openId) ?? null;

  if (!live) {
    return (
      <section aria-label="Recovery" className="text-[13.5px] text-ink-2">
        Recovery actions are available on Live Sandbox cases only. Replay cases are historical records, so there is nothing to change at PayPal.
      </section>
    );
  }

  return (
    <section aria-label="Recovery" className="space-y-3" data-testid="recovery-panel">
      <h2 className="text-title-2 text-ink">What can safely be done</h2>
      <p className="text-[13px] text-ink-3">The recovery rules decide what is possible. Any action needs two approvals before PayPal is touched.</p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.kind} className="rounded-md border border-line p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">{LABEL[o.kind]}</span>
              <Tag tone={o.allowed ? "delivered" : "neutral"}>{o.allowed ? "Allowed" : "Not allowed"}</Tag>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{o.reason}</p>
            {o.allowed && (
              <button type="button" disabled={!canPropose || busy !== null} onClick={() => propose(o.kind)} className="field-btn field-btn-secondary mt-2" data-testid={`propose-${o.kind}`}>
                {busy === o.kind ? "Creating…" : "Propose this (needs two approvals)"}
              </button>
            )}
            {o.allowed && !canPropose && <p className="mt-1 text-[12px] text-ink-3">Sign in as a coordinator or finance persona to propose.</p>}
          </li>
        ))}
      </ul>

      {proposals.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium text-ink-2">Proposals for this payment</h4>
          <ul className="mt-2 space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-[13px]">
                <span className="text-ink">{describeProposal(p).title} · {describeProposal(p).usd}</span>
                <span className="flex items-center gap-2">
                  <Tag tone={p.status === "EXECUTED" ? "delivered" : p.status === "FAILED" || p.status === "REJECTED" ? "danger" : "amber"}>{p.status}</Tag>
                  <button type="button" onClick={() => setOpenId(p.id)} className="text-[12.5px] text-accent-strong underline-offset-2 hover:underline">Open</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <ApprovalDialog
          proposal={open}
          me={me}
          open
          onClose={() => setOpenId(null)}
          onChanged={(p) => setProposals((cur) => cur.map((x) => (x.id === p.id ? p : x)))}
        />
      )}
    </section>
  );
}
