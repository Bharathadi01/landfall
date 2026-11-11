"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BADGE_LABEL, STEPS, type Badge, type Step } from "./steps";
import { mayClick } from "./safety";
import { clickable, findByText, findTarget } from "./dom";

type Status = "idle" | "intro" | "running" | "done";

const AI_GAP_MS = 20_000; // the free AI tier allows ~8k tokens a minute: never fire two live calls back to back
const BADGE_TONE: Record<Badge, string> = {
  REAL_SANDBOX: "rgb(var(--c-money))",
  LIVE_FEED: "rgb(var(--c-money))",
  LIVE_AI: "rgb(var(--c-accent))",
  REPLAY: "rgb(var(--c-amber))",
  SIMULATED: "rgb(var(--c-amber))",
  NOTE: "rgb(var(--c-ink-3, 160 160 165))",
};

/** Put the target near the top of whichever box scrolls, so the caption dock at the bottom never covers it. */
function scrollTargetIntoView(el: HTMLElement) {
  el.scrollIntoView({ block: "start", behavior: "smooth" });
  window.setTimeout(() => {
    let p: HTMLElement | null = el.parentElement;
    while (p && p !== document.body && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    const box = p && p !== document.body ? p : null;
    const r = el.getBoundingClientRect();
    const want = 120; // px below the top edge
    const delta = r.top - want;
    if (Math.abs(delta) > 4) (box ?? document.scrollingElement ?? document.documentElement).scrollBy({ top: delta, behavior: "smooth" });
  }, 60);
}

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One floating button (bottom right). Pressed, it signs the visitor in read-only if needed and then walks the whole product by itself:
 * it navigates, spotlights, presses a short allow-list of safe controls, and explains each screen with a provenance badge.
 * It cannot reach anything that moves money or writes data (see ./safety.ts). Esc leaves at any time.
 */
export function TourProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ai, setAi] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const token = useRef(0);
  const pausedRef = useRef(false);
  const aiRef = useRef(true);
  const targetEl = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastAi = useRef(0);
  const startPath = useRef<string>("/");
  const statusRef = useRef<Status>("idle");
  statusRef.current = status;
  void pathname;

  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem("landfall.tour.ai");
      if (v !== null) { setAi(v === "1"); aiRef.current = v === "1"; }
    } catch { /* storage may be blocked */ }
  }, []);
  const setAiOpt = (v: boolean) => { setAi(v); aiRef.current = v; try { window.sessionStorage.setItem("landfall.tour.ai", v ? "1" : "0"); } catch { /* ignore */ } };

  /* ---- spotlight + pointer follow the target every frame (style written directly: no React churn) ---- */
  useEffect(() => {
    if (status !== "running") return;
    let raf = 0;
    const tick = () => {
      const el = targetEl.current; const ring = ringRef.current;
      if (ring) {
        if (el && document.contains(el)) {
          const r = el.getBoundingClientRect(); const pad = 10;
          const vw = window.innerWidth, vh = window.innerHeight;
          const x = Math.max(6, r.left - pad), y = Math.max(6, r.top - pad);
          const w = Math.min(vw - 12 - x, r.width + pad * 2), h = Math.min(vh - 12 - y, r.height + pad * 2);
          ring.style.opacity = r.bottom < 0 || r.top > vh ? "0" : "1";
          ring.style.transform = `translate(${x}px, ${y}px)`; ring.style.width = `${Math.max(40, w)}px`; ring.style.height = `${Math.max(32, h)}px`;
        } else ring.style.opacity = "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const alive = (t: number) => token.current === t && statusRef.current !== "idle";
  const pausableSleep = async (ms: number, t: number) => { let left = ms; while (left > 0 && alive(t)) { if (!pausedRef.current) left -= 100; await sleepMs(100); } };
  const waitUntil = async (fn: () => boolean, timeout: number, t: number, every = 120) => { const end = Date.now() + timeout; while (alive(t) && Date.now() < end) { if (fn()) return true; await sleepMs(every); } return fn(); };

  const movePointer = (el: HTMLElement | null) => {
    const c = cursorRef.current; if (!c) return;
    if (!el) { c.style.opacity = "0"; return; }
    const r = el.getBoundingClientRect();
    c.style.opacity = "1"; c.style.transform = `translate(${Math.min(window.innerWidth - 30, r.left + Math.min(r.width / 2, 120))}px, ${Math.min(window.innerHeight - 30, r.top + Math.min(r.height / 2, 40))}px)`;
  };

  const ensureSession = async (): Promise<boolean> => {
    try {
      const s = (await (await fetch("/api/auth/session", { cache: "no-store" })).json()) as { authenticated?: boolean };
      if (s.authenticated) return true;
      const r = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: "judge-viewer" }) });
      return r.ok;
    } catch { return false; }
  };

  const goTo = async (route: string, t: number) => {
    const want = route.split("?")[0];
    if (window.location.pathname === want) return true;
    router.push(route);
    return waitUntil(() => window.location.pathname === want, 15000, t, 100);
  };

  const runStep = async (step: Step, t: number) => {
    setNote(null); setBusy("Loading…"); targetEl.current = null; movePointer(null);
    if (step.route) {
      const route = typeof step.route === "function" ? await step.route() : step.route;
      if (!alive(t)) return;
      if (!route) { setNote("This part isn't available in the data you're looking at, so the tour skips it."); setBusy(null); await pausableSleep(1800, t); return; }
      if (route.startsWith("/console") && !(await ensureSession())) { setNote("Judge sign-in is switched off on this deployment, so the console can't be toured."); setBusy(null); await pausableSleep(2500, t); return; }
      if (!(await goTo(route, t))) { setNote("That page didn't open in time, so the tour moves on."); setBusy(null); await pausableSleep(1500, t); return; }
    }
    if (!alive(t)) return;
    if (step.ready) await waitUntil(() => !!findTarget(step.ready), 15000, t);
    await sleepMs(500);

    for (const a of step.actions ?? []) {
      if (!alive(t)) return;
      if ("wait" in a) { await pausableSleep(a.wait, t); continue; }
      const check = mayClick(a.click, { ai: aiRef.current });
      if (!check.ok) { if (check.reason === "ai_off") setNote("Live AI is switched off for this tour, so this step is described but not run."); continue; }
      await waitUntil(() => !!findByText(a.click, true), 12000, t, 200); // the page may still be fetching its own state
      const raw = findByText(a.click, true);
      if (!raw) { setNote(`“${a.click}” isn't available on this screen right now, so the tour moves on.`); continue; }
      const el = clickable(raw);
      const isAi = step.ai === true;
      if (isAi) {
        const gap = AI_GAP_MS - (Date.now() - lastAi.current);
        if (gap > 0) { setBusy("Giving the free AI quota a moment…"); await pausableSleep(gap, t); }
        lastAi.current = Date.now();
      }
      scrollTargetIntoView(el); await pausableSleep(700, t);
      targetEl.current = el; movePointer(el); await pausableSleep(700, t);
      if (!alive(t)) return;
      el.click();
      if (isAi) setBusy("Waiting for the live model…");
      if (a.waitCss) await waitUntil(() => !!document.querySelector(a.waitCss as string), a.timeoutMs ?? 15000, t);
      if (a.waitText) { const texts = a.waitText; await waitUntil(() => texts.some((x) => !!findByText(x)), a.timeoutMs ?? 20000, t, 250); }
      setBusy(null); await pausableSleep(900, t);
    }
    if (!alive(t)) return;

    const el = findTarget(step.target);
    targetEl.current = el; setBusy(null);
    if (el) { scrollTargetIntoView(el); await pausableSleep(900, t); movePointer(el); }
    await pausableSleep(step.ms, t);
  };

  const play = useCallback(async (from: number) => {
    const t = ++token.current; setStatus("running"); statusRef.current = "running";
    for (let i = from; i < STEPS.length && alive(t); i++) { setIdx(i); await runStep(STEPS[i], t); }
    if (alive(t)) { targetEl.current = null; movePointer(null); setBusy(null); setStatus("done"); statusRef.current = "done"; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => { startPath.current = window.location.pathname; pausedRef.current = false; setPaused(false); void play(0); };
  const stop = useCallback(() => { token.current++; setStatus("idle"); statusRef.current = "idle"; setPaused(false); pausedRef.current = false; targetEl.current = null; setBusy(null); setNote(null); }, []);
  const jump = (to: number) => { if (to < 0 || to >= STEPS.length) return; pausedRef.current = false; setPaused(false); void play(to); };
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); };

  useEffect(() => {
    if (status === "idle" || status === "intro") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "Escape") stop();
      else if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      else if (e.key === " " && statusRef.current === "running") { e.preventDefault(); togglePause(); }
      else if (e.key === "ArrowRight") jump(Math.min(STEPS.length - 1, idx + 1));
      else if (e.key === "ArrowLeft") jump(Math.max(0, idx - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, idx, stop]);

  useEffect(() => () => { token.current++; }, []);

  const step = STEPS[idx];
  const pct = status === "done" ? 100 : Math.round(((idx + 1) / STEPS.length) * 100);

  return (
    <div data-tour-ui className="print:hidden">
      {status === "idle" && (
        <button
          type="button"
          data-testid="tour-fab"
          onClick={() => setStatus("intro")}
          className="fixed bottom-4 right-4 z-[95] flex items-center gap-2 border border-accent bg-accent px-4 py-3 text-[14px] font-semibold text-[#17141a] shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none sm:bottom-6 sm:right-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          Take the tour
        </button>
      )}

      {status === "intro" && (
        <div role="dialog" aria-modal="false" aria-label="Guided tour" data-testid="tour-intro" className="fixed bottom-4 right-4 z-[95] w-[min(92vw,380px)] border border-line-strong bg-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:bottom-6 sm:right-6">
          <div className="font-serif text-[22px] leading-tight text-ink">Take the 3-minute tour</div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">Landfall will walk through the whole product for you: the dashboard, live storm data, every payment&rsquo;s evidence, the AI, approvals and the resident&rsquo;s view. It signs you in read-only. <b className="text-ink">Nothing is paid or changed.</b></p>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]" checked={ai} onChange={(e) => setAiOpt(e.target.checked)} />
            <span>Include the two live AI steps <span className="text-ink-3">(uses the free AI quota; unchecked, they are described but not run)</span></span>
          </label>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStatus("idle")} className="px-3 py-2 text-[13px] text-ink-3 hover:text-ink">Not now</button>
            <button type="button" data-testid="tour-start" onClick={start} className="border border-accent bg-accent px-5 py-2.5 text-[14px] font-semibold text-[#17141a] hover:brightness-110">Start the tour</button>
          </div>
        </div>
      )}

      {(status === "running" || status === "done") && (
        <>
          <div className="fixed inset-0 z-[90]" aria-hidden onClick={(e) => e.stopPropagation()} />
          <div ref={ringRef} className="pointer-events-none fixed left-0 top-0 z-[91] border-2 border-accent opacity-0 transition-[transform,width,height,opacity] duration-500 ease-out motion-reduce:transition-none" style={{ boxShadow: "0 0 0 9999px rgba(8,8,10,0.62), 0 0 28px 2px rgba(255,107,44,0.35)" }} />
          <div ref={cursorRef} className="pointer-events-none fixed left-0 top-0 z-[92] opacity-0 transition-[transform,opacity] duration-700 ease-in-out motion-reduce:transition-none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M4 2l15 9-6.6 1.5L9.6 19z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </div>

          <div role="region" aria-label="Guided tour" data-testid="tour-dock" className="fixed inset-x-3 bottom-3 z-[95] mx-auto w-auto max-w-[760px] border border-line-strong bg-surface p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] sm:bottom-6 sm:p-5">
            {status === "running" ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 border border-line-strong px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-2"><span className="h-2 w-2" style={{ background: BADGE_TONE[step.badge] }} />{BADGE_LABEL[step.badge]}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">Step {idx + 1} of {STEPS.length}</span>
                  <span className="ml-auto text-[12px] text-ink-3" aria-live="polite">{busy ?? (paused ? "Paused" : "")}</span>
                </div>
                <div className="mt-2 font-serif text-[20px] leading-tight text-ink">{step.title}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2" aria-live="polite">{!ai && step.ai && step.captionNoAi ? step.captionNoAi : step.caption}</p>
                {note && <p className="mt-1.5 text-[12.5px] text-amber" role="status">{note}</p>}
              </>
            ) : (
              <>
                <div className="font-serif text-[22px] leading-tight text-ink">That&rsquo;s Landfall.</div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2" aria-live="polite">Every relief payment deserves an answer. Nothing was paid or changed during the tour. Open any screen from the sidebar, or run the tour again.</p>
              </>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="h-1 basis-full bg-white/10 sm:flex-1 sm:basis-0" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tour progress"><div className="h-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} /></div>
              {status === "running" ? (
                <>
                  <button type="button" onClick={() => jump(idx - 1)} disabled={idx === 0} className="border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink disabled:opacity-40" aria-label="Back to the previous step">Back</button>
                  <button type="button" data-testid="tour-pause" onClick={togglePause} className="border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-white/5" aria-label={paused ? "Resume tour" : "Pause tour"}>{paused ? "Play" : "Pause"}</button>
                  <button type="button" onClick={() => jump(idx + 1)} className="border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink" aria-label="Next step">Next</button>
                </>
              ) : (
                <button type="button" onClick={start} className="border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-white/5">Run again</button>
              )}
              <button type="button" data-testid="tour-exit" onClick={stop} className="ml-auto px-3 py-1.5 sm:ml-0 text-[13px] text-ink-3 hover:text-ink" aria-label="Exit the tour (Escape)">{status === "done" ? "Close" : "Exit"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
