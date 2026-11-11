"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { I } from "@/components/icons";
import { Button, GlassPane, Tag } from "@/components/ui";
import { PERSONAS } from "@/lib/auth/personas";

/** Safe post-login redirect: only same-site paths. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/console/war-room";
  return next;
}

const ROLE_ICON = { coordinator: I.person, finance: I.treasury, viewer: I.view } as const;

export function SignInClient() {
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: id }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not sign in. Try again.");
        return;
      }
      // Full navigation, not router.push: the client router may hold a cached "redirect to /signin" for this
      // console page from before sign-in, which left people stuck on this screen after a successful sign-in.
      window.location.assign(safeNext(params.get("next")));
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-14 pt-24 sm:pt-28">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="amber" solid>DEMO PERSONAS</Tag>
        <Tag tone="paypal">PayPal Sandbox</Tag>
      </div>
      <h1 className="mt-4 text-title-1 text-ink">
        Choose who you are, <span className="font-accent italic font-normal text-ink-2">then use everything.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-body-base text-ink-2">
        These are fictional demo people so you can try the console in one click. The server checks the role on every request, so a viewer genuinely cannot propose or approve money movement.
        Two different people must approve a payment — try it by signing in as the coordinator, then as Finance.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PERSONAS.map((p) => {
          const Icon = ROLE_ICON[p.role];
          return (
            <GlassPane key={p.id} level={2} className="flex flex-col">
              <span className="icon-tile tone-accent"><Icon /></span>
              <div className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-ink">{p.name}</div>
              <div className="text-[12.5px] text-ink-3">{p.title}</div>
              <ul className="mt-3 space-y-1 text-[12.5px] text-ink-2">
                {p.can.map((c) => (
                  <li key={c} className="flex gap-1.5"><I.check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" />{c}</li>
                ))}
                {p.cannot.map((c) => (
                  <li key={c} className="flex gap-1.5 text-ink-3"><I.close className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c}</li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                <Button variant={p.role === "viewer" ? "glass" : "signal"} className="w-full" loading={busy === p.id} disabled={busy !== null} onClick={() => signIn(p.id)} trailing={<I.arrowRight />}>
                  Continue as {p.name.split(" ")[0]}
                </Button>
              </div>
            </GlassPane>
          );
        })}
      </div>

      <p className="mt-8 text-[12.5px] text-ink-3">
        Are you a resident checking a payment? <a className="text-accent-strong underline underline-offset-2" href="/r/enroll">Use your reference and code here</a>.
        Judges: the <a className="text-accent-strong underline underline-offset-2" href="/judges">test card</a> lists everything you need.
      </p>
    </div>
  );
}
