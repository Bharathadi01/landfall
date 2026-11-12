"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { I } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { PERSONAS, type Persona } from "@/lib/auth/personas";
import { FLOW } from "@/components/layout/flow";

/** Safe post-login redirect: only same-site paths. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/console/war-room";
  return next;
}

/** A judge's first look should be the read-only seat; the two approvers are there to try the two-person rule. */
const ORDER = ["judge-viewer", "dana-ortiz", "sam-patel"];
const NOTE: Record<string, string> = {
  "judge-viewer": "Recommended for a first look",
  "dana-ortiz": "Try the two-person rule: approve first as Dana…",
  "sam-patel": "…then sign out and approve second as Sam",
};

export function SignInClient() {
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [current, setCurrent] = useState<{ name: string; role: string } | null>(null);
  const target = safeNext(params.get("next"));
  const root = useRef<HTMLDivElement>(null);

  // Warm the destination while the visitor is choosing, so the console opens straight away after the click.
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.href = target;
    document.head.appendChild(l);
    return () => l.remove();
  }, [target]);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.authenticated && j.session?.role !== "resident" && setCurrent({ name: j.session.name, role: j.session.role }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), 2500);
    return () => window.clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-in]", { autoAlpha: 0, y: 16, duration: 0.8, ease: "expo.out", stagger: 0.07 });
    }, root);
    return () => ctx.revert();
  }, []);

  async function signIn(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: id }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not sign in. Try again.");
        setBusy(null);
        return;
      }
      // Full navigation, not router.push: the client router may hold a cached "redirect to /signin" for this console page.
      window.location.assign(target);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(null);
    }
  }

  const personas = ORDER.map((id) => PERSONAS.find((p) => p.id === id)).filter(Boolean) as Persona[];

  return (
    <div ref={root} className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-20 pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-36">
      {/* left: what you are about to enter */}
      <div className="space-y-8">
        <div className="space-y-4" data-in>
          <p className="eyebrow">The relief console · demo people · PayPal Sandbox</p>
          <h1 className="text-title-1 text-ink">
            Choose a seat at the desk. <span className="block text-ink-2">The server holds you to it.</span>
          </h1>
          <p className="text-[15.5px] leading-relaxed text-ink-2">
            These are fictional people, so you can try everything in one click. Every request is checked against the role you pick: a read-only seat genuinely cannot move money.
          </p>
        </div>

        <div data-in>
          <div className="text-[12.5px] font-semibold text-ink-2">Inside, a response runs in three stages</div>
          <ol className="mt-3 space-y-3">
            {FLOW.filter((g) => g.stage).map((g, i) => (
              <li key={g.stage} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[12px] font-semibold tabular text-ink-2">{i + 1}</span>
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{g.stage}</span>
                  <span className="block text-[13px] text-ink-3">{g.question} {g.pages.map((p) => p.label).join(", ")}.</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* right: the seats */}
      <div className="space-y-4">
        {current && !busy && (
          <div className="note" data-tone="delivered" data-in data-testid="signin-current">
            <span className="note-label">You are signed in as {current.name}</span>
            <Link href={target} className="link font-semibold text-ink">Continue to the console</Link>, or choose a different seat below.
          </div>
        )}

        {busy && (
          <div role="status" aria-live="polite" data-testid="signin-progress" className="note" data-tone="accent">
            <span className="note-label">Signed in</span>
            Opening the console as {PERSONAS.find((p) => p.id === busy)?.name ?? "you"}…
            {slow && " The demo server can take up to half a minute to wake up the first time. You don’t need to click again."}
          </div>
        )}

        {error && (
          <div role="alert" className="note" data-tone="danger">
            <span className="note-label">Could not sign in</span>
            {error}
          </div>
        )}

        <ul className="space-y-3">
          {personas.map((p, i) => {
            const primary = i === 0;
            return (
              <li key={p.id} data-in className={`pane p-5 ${primary ? "border-line-strong bg-surface-2" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[15px] font-semibold ${primary ? "border-accent/60 text-accent-strong" : "border-line-strong text-ink-2"}`}>
                      {p.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[16px] font-semibold text-ink">{p.name.replace(" (read-only)", "")}</div>
                      <div className="text-[13px] text-ink-3">{p.title}</div>
                    </div>
                  </div>
                  <Button className="shrink-0" variant={primary ? "signal" : "glass"} loading={busy === p.id} disabled={busy !== null} onClick={() => signIn(p.id)} data-testid={`signin-${p.id}`}>
                    Continue as {p.name.split(" ")[0]}
                  </Button>
                </div>
                <p className={`mt-3 text-[13px] ${primary ? "text-accent-strong" : "text-ink-2"}`}>{NOTE[p.id]}</p>
                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-line pt-3 text-[13px] sm:grid-cols-2">
                  {p.can.map((c) => (
                    <div key={c} className="flex gap-2 text-ink-2"><I.check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-delivered" aria-hidden />{c}</div>
                  ))}
                  {p.cannot.map((c) => (
                    <div key={c} className="flex gap-2 text-ink-3"><I.minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span><span className="sr-only">Cannot: </span>{c}</span></div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="pt-2 text-[13px] text-ink-3" data-in>
          Checking your own payment? <Link className="link" href="/r/enroll?tab=status">Use your reference and code</Link>. Judges: the <Link className="link" href="/judges">test card</Link> has the household codes.
        </p>
      </div>
    </div>
  );
}
