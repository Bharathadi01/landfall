"use client";

import React, { useEffect, useState, useCallback } from "react";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Dialog } from "@/components/ui/Dialog";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import type { ProposalView } from "@/lib/proposals/types";

/**
 * Approve ONE proposal. Everything shown here comes from the server's copy of the proposal: who has approved, what is
 * still missing, and whether the money moved. This dialog never claims an approval until the server says 200.
 */
export interface Me { id: string; name: string; role: string }

export const describeProposal = (p: ProposalView): { title: string; detail: string; usd: string } => {
  if (p.payload.kind === "CANCEL_ITEM") {
    return { title: "Cancel an unclaimed payment", detail: `PayPal item ${p.payload.paypalItemId}. The funds return to the fund; the resident’s claim link stops working.`, usd: `$${(p.payload.amountCents / 100).toFixed(2)}` };
  }
  const n = p.payload.items.length;
  return { title: p.payload.kind === "REISSUE" ? "Replacement payment" : "New relief payment batch", detail: `${n} household${n === 1 ? "" : "s"}, sent through PayPal Payouts (Sandbox).`, usd: `$${(p.payload.totalAmountCents / 100).toFixed(2)}` };
};

export function ApprovalDialog({ proposal, me, open, onClose, onChanged }: { proposal: ProposalView; me: Me | null; open: boolean; onClose: () => void; onChanged: (p: ProposalView) => void }) {
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState(false);
  const info = describeProposal(proposal);
  const mine = proposal.approvals.find((a) => a.approverId === me?.id);
  const canApprove = !!me && (me.role === "coordinator" || me.role === "finance") && proposal.status === "PROPOSED" && !mine;

  useEffect(() => {
    setPasskeys(browserSupportsWebAuthn());
  }, []);

  const send = useCallback(
    async (body: unknown) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/proposals/${proposal.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => ({}));
        if (j.proposal) onChanged(j.proposal);
        if (j.executed) {
          toast({ tone: j.ok ? "success" : "error", title: j.ok ? "Approved and executed" : "Approved, but PayPal did not complete it", body: j.message });
          onClose();
        } else if (res.ok) {
          toast({ tone: "success", title: "Your approval is recorded", body: (j.proposal?.needs ?? []).join(" · ") || undefined });
          setPin("");
        } else {
          setError(j.message ?? "The approval was not accepted.");
        }
      } catch {
        setError("Couldn’t reach the server. Nothing was approved.");
      } finally {
        setBusy(false);
      }
    },
    [proposal.id, onChanged, onClose, toast]
  );

  const withPasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await fetch(`/api/proposals/${proposal.id}/approve/options`, { method: "POST" });
      const oj = await o.json().catch(() => ({}));
      if (!o.ok) {
        setError(oj.error === "no_passkey" ? "You haven’t registered a passkey on this device yet. Register one below, or use the demo PIN." : oj.message ?? "Couldn’t start the passkey approval.");
        setBusy(false);
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: oj.options });
      setBusy(false);
      await send({ method: "WEBAUTHN", response: assertion });
    } catch {
      setError("The passkey prompt was cancelled or failed. Nothing was approved.");
      setBusy(false);
    }
  };

  const registerPasskey = async () => {
    setBusy(true);
    setError(null);
    try {
      const o = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      const oj = await o.json();
      if (!o.ok) throw new Error("options");
      const att = await startRegistration({ optionsJSON: oj.options });
      const v = await fetch("/api/auth/passkey/register-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: att }) });
      if (!v.ok) throw new Error("verify");
      toast({ tone: "success", title: "Passkey registered", body: "You can now approve with it." });
    } catch {
      setError("Couldn’t register a passkey on this device. The demo PIN still works.");
    } finally {
      setBusy(false);
    }
  };

  const status = proposal.status;
  return (
    <Dialog open={open} onClose={onClose} title="Two-person approval" description="Two different people must approve this exact action, one of them from Finance. The server checks each approval; this page only reports what it says.">
      <div className="rounded-2xl border border-ink/[0.07] bg-ink/[0.04] p-4" data-testid="proposal-summary">
        <div className="text-[13px] text-ink-2">{info.title}</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-[28px] font-semibold tabular text-accent-strong">{info.usd}</span>
          <Tag tone={status === "EXECUTED" ? "delivered" : status === "FAILED" || status === "REJECTED" ? "danger" : "amber"}>{status}</Tag>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">{info.detail}</p>
        <p className="mt-3 truncate font-mono text-[10.5px] text-ink-3" title={proposal.payloadHash}>Payload hash {proposal.payloadHash}</p>
      </div>

      <ol className="mt-4 space-y-2" aria-label="Approvals so far">
        {proposal.approvals.length === 0 && <li className="text-[13px] text-ink-3">No approvals yet.</li>}
        {proposal.approvals.map((a) => (
          <li key={a.approverId} className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-2 text-[13px]">
            <span className="text-ink">{a.approverName} <span className="text-ink-3">· {a.role}</span></span>
            <Tag tone={a.method === "WEBAUTHN" ? "paypal" : "amber"} title={a.method === "WEBAUTHN" ? "Verified passkey signature" : "Demo approval key (labelled, not a passkey)"}>{a.method === "WEBAUTHN" ? "Passkey" : "Demo key"}</Tag>
          </li>
        ))}
        {proposal.needs.length > 0 && <li className="text-[12.5px] text-amber">Still needed: {proposal.needs.join(" · ")}</li>}
      </ol>

      {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-[12.5px] text-danger">{error}</p>}

      {!me && <p className="mt-4 text-[13px] text-ink-3">Sign in as a coordinator or finance persona to approve.</p>}
      {me && mine && status === "PROPOSED" && <p className="mt-4 text-[13px] text-ink-2">You approved this as {mine.role}. A different person must approve next.</p>}
      {me && !mine && !canApprove && status === "PROPOSED" && <p className="mt-4 text-[13px] text-ink-3">Your role ({me.role}) can’t approve.</p>}
      {status === "EXECUTED" && <p className="mt-4 text-[13px] text-accent-strong">Executed. Statuses now arrive from PayPal by webhook or refresh.</p>}
      {status === "FAILED" && <p className="mt-4 text-[13px] text-danger">PayPal did not complete this. Check the case’s real status before trying again; Landfall will not resend automatically.</p>}

      {canApprove && (
        <div className="mt-5 space-y-3">
          {passkeys && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={withPasskey} className="field-btn field-btn-primary" data-testid="approve-passkey">Approve with passkey</button>
              <button type="button" disabled={busy} onClick={registerPasskey} className="field-btn field-btn-secondary">Register a passkey</button>
            </div>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send({ method: "DEMO_KEY", pin });
            }}
          >
            <label className="text-[12.5px] text-ink-2">
              Demo approval PIN <span className="text-ink-3">(on the judge card; labelled demo key)</span>
              <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" autoComplete="off" className="mt-1 block w-44 rounded-lg border border-ink/10 bg-ink/[0.04] px-3 py-2 text-[14px] text-ink" data-testid="demo-pin" />
            </label>
            <button type="submit" disabled={busy || pin.length < 4} className="field-btn field-btn-secondary" data-testid="approve-pin">Approve with demo key</button>
          </form>
        </div>
      )}
    </Dialog>
  );
}
