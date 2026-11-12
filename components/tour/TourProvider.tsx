"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { BADGE_LABEL, CHAPTERS, PARTS, TOTAL_SECTIONS, type Action, type Badge, type Chapter, type Section } from "./steps";
import { mayClick, mayType } from "./safety";
import { clickable, findByText, findTarget, isVisible } from "./dom";

type Status = "idle" | "intro" | "running" | "done";

const AI_GAP_MS = 15_000; // never fire two live AI calls back to back (free-tier quota)
const SPEEDS = [1, 1.5, 2] as const;
const BADGE_DOT: Record<Badge, string> = {
  REAL_SANDBOX: "bg-paypal",
  LIVE_FEED: "bg-delivered",
  LIVE_AI: "bg-ink-2",
  REPLAY: "bg-amber",
  SIMULATED: "bg-amber",
  NOTE: "bg-ink-3",
};
const TOP_GAP = 84; // where a framed target sits: just under the console header
const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** The scrolling box that holds a page: usually the document. */
function scroller(el?: HTMLElement | null): HTMLElement {
  let p: HTMLElement | null = el?.parentElement ?? null;
  while (p && p !== document.body && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
  return p && p !== document.body ? p : ((document.scrollingElement as HTMLElement | null) ?? document.documentElement);
}

function scrollTargetIntoPlace(el: HTMLElement) {
  const box = scroller(el);
  const delta = el.getBoundingClientRect().top - TOP_GAP;
  if (Math.abs(delta) > 4) box.scrollBy({ top: delta, behavior: reduced() ? "auto" : "smooth" });
}

function scrollPageToTop() {
  window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
}

/** A control a person would press, matched by its label: exact text, its aria-label, or a label followed by a count ("Appeals Queue 2"). */
function findClickable(label: string): HTMLElement | null {
  const want = norm(label);
  const cands = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role=tab], [role=button], [role=radio]")).filter((el) => !el.closest("[data-tour-ui]") && isVisible(el));
  const exact = cands.find((el) => norm(el.textContent) === want || norm(el.getAttribute("aria-label")) === want);
  if (exact) return exact;
  const esc = want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const counted = cands.find((el) => new RegExp(`^${esc}( \\d+)?$`).test(norm(el.textContent)));
  if (counted) return counted;
  const raw = findByText(label, true);
  return raw ? clickable(raw) : null;
}

/** Set a React-controlled input's value the way typing does, so its onChange fires. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function findField(into: string): HTMLInputElement | HTMLTextAreaElement | null {
  const want = into.toLowerCase();
  const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).filter((f) => !f.closest("[data-tour-ui]") && isVisible(f));
  return fields.find((f) => `${f.placeholder ?? ""} ${f.getAttribute("aria-label") ?? ""}`.toLowerCase().includes(want)) ?? null;
}

/**
 * THE GUIDED TOUR — the button a judge presses.
 * Pressed, it shows the whole outline first (people relax when they can see the path), then walks the product by itself in the order of the
 * product: the public site top to bottom, the door, the Command Center, then each stage of a response. A spotlight frames exactly what each
 * caption describes and glides to the next thing. It presses only a short allow-list of safe controls (./safety.ts): it cannot move money or
 * write data. Esc leaves at any time; Pause hands the page back; the chapter menu jumps anywhere.
 */
export function TourProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ai, setAi] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [mounted, setMounted] = useState(false); // the button appears only once it can respond (never a dead click before hydration)

  const token = useRef(0);
  const pausedRef = useRef(false);
  const aiRef = useRef(true);
  const speedRef = useRef(1);
  const statusRef = useRef<Status>("idle");
  const chapterRef = useRef(0);
  const cursorRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const spotTarget = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const lastAi = useRef(0);
  statusRef.current = status;
  chapterRef.current = chapterIdx;

  useEffect(() => {
    try {
      const v = window.sessionStorage.getItem("landfall.tour.ai");
      if (v !== null) { setAi(v === "1"); aiRef.current = v === "1"; }
    } catch { /* storage may be blocked */ }
    setMounted(true);
    const open = () => { if (statusRef.current === "idle" || statusRef.current === "done") setStatus("intro"); };
    window.addEventListener("landfall:tour", open);
    return () => window.removeEventListener("landfall:tour", open);
  }, []);
  const setAiOpt = (v: boolean) => { setAi(v); aiRef.current = v; try { window.sessionStorage.setItem("landfall.tour.ai", v ? "1" : "0"); } catch { /* ignore */ } };
  const cycleSpeed = () => setSpeedIdx((i) => { const n = (i + 1) % SPEEDS.length; speedRef.current = SPEEDS[n]; return n; });

  const alive = (t: number) => token.current === t && statusRef.current !== "idle";
  const pausableSleep = async (ms: number, t: number) => { let left = ms; while (left > 0 && alive(t)) { if (!pausedRef.current) left -= 100; await sleepMs(100); } };
  const dwell = (ms: number, t: number) => pausableSleep((ms * 0.85) / speedRef.current, t);
  const waitUntil = async (fn: () => boolean, timeout: number, t: number, every = 120) => { const end = Date.now() + timeout; while (alive(t) && Date.now() < end) { if (fn()) return true; await sleepMs(every); } return fn(); };

  /* ── spotlight: frames the thing being described, and follows it while the page scrolls ── */
  const placeSpot = useCallback((animate: boolean) => {
    const s = spotRef.current; if (!s) return;
    const el = spotTarget.current;
    if (!el || !el.isConnected || !isVisible(el)) { gsap.to(s, { opacity: 0, duration: 0.3, overwrite: "auto" }); return; }
    const r = el.getBoundingClientRect();
    const dockTop = dockRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    const pad = 8;
    const top = Math.max(64, r.top - pad);
    const bottom = Math.min(dockTop - 12, r.bottom + pad);
    const left = Math.max(8, r.left - pad);
    const right = Math.min(window.innerWidth - 8, r.right + pad);
    if (bottom - top < 24 || right - left < 24) { gsap.to(s, { opacity: 0, duration: 0.3, overwrite: "auto" }); return; }
    const props = { x: left, y: top, width: right - left, height: bottom - top, opacity: 1 };
    if (animate && !reduced()) gsap.to(s, { ...props, duration: 0.7, ease: "expo.out", overwrite: "auto" });
    else gsap.set(s, props);
  }, []);

  const frame = useCallback((el: HTMLElement | null) => { spotTarget.current = el; placeSpot(true); }, [placeSpot]);

  useEffect(() => {
    if (status !== "running") return;
    let raf = 0;
    const loop = () => { placeSpot(false); raf = requestAnimationFrame(loop); };
    // follow the page as it scrolls, once the glide to the new subject has finished
    const t = window.setTimeout(() => { raf = requestAnimationFrame(loop); }, 750);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [status, chapterIdx, sectionIdx, placeSpot]);

  /** The pointer is shown only while the tour presses something, so it is clear what it pressed. */
  const showPointer = (el: HTMLElement) => {
    const c = cursorRef.current; if (!c) return;
    const r = el.getBoundingClientRect();
    gsap.to(c, { x: Math.min(window.innerWidth - 30, r.left + Math.min(r.width / 2, 120)), y: Math.min(window.innerHeight - 30, r.top + Math.min(r.height / 2, 40)), opacity: 1, duration: reduced() ? 0 : 0.5, ease: "power3.out" });
  };
  const hidePointer = () => { if (cursorRef.current) gsap.to(cursorRef.current, { opacity: 0, duration: 0.25 }); };

  const ensureSession = async (): Promise<boolean> => {
    try {
      const s = (await (await fetch("/api/auth/session", { cache: "no-store" })).json()) as { authenticated?: boolean; session?: { role?: string } };
      if (s.authenticated && s.session?.role !== "resident") return true; // a resident sign-in cannot open the console
      const r = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: "judge-viewer" }) });
      return r.ok;
    } catch { return false; }
  };

  const goTo = async (route: string, t: number) => {
    const want = route.split("?")[0];
    const here = () => window.location.pathname === want || decodeURIComponent(window.location.pathname) === decodeURIComponent(want);
    if (here()) return true;
    router.push(route);
    return waitUntil(here, 15000, t, 100);
  };

  const typeInto = async (into: string, text: string, t: number, enter?: boolean): Promise<boolean> => {
    if (!mayType(into)) return false;
    await waitUntil(() => !!findField(into), 12000, t, 200);
    const el = findField(into);
    if (!el) { setNote(`The “${into}” box isn’t available right now, so the tour moves on.`); return false; }
    if (el.getBoundingClientRect().top < 70 || el.getBoundingClientRect().bottom > window.innerHeight - 200) { scrollTargetIntoPlace(el); await dwell(600, t); }
    showPointer(el); el.focus();
    for (let i = 1; i <= text.length && alive(t); i++) { setNativeValue(el, text.slice(0, i)); await sleepMs(26); }
    if (enter && alive(t)) {
      await dwell(400, t);
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      // the chat box sends on Enter; if its text is still there, press the box's own Send button (a chat message to the read-only assistant)
      await sleepMs(700);
      if (el.value.trim()) {
        const scope = el.closest("form, div") as HTMLElement | null;
        const send = Array.from((scope?.parentElement ?? document).querySelectorAll<HTMLElement>("button")).find((b) => /^send$/i.test((b.textContent ?? "").trim()) && isVisible(b));
        send?.click();
      }
    }
    hidePointer();
    return true;
  };

  const fillResident = async (t: number) => {
    try {
      const r = await fetch("/api/judge/demo-resident", { cache: "no-store" });
      if (!r.ok) { setNote("Judge test access is switched off here, so the resident lookup is skipped."); return; }
      const { ref, code } = (await r.json()) as { ref: string; code: string };
      await typeInto("Your reference", ref, t);
      await typeInto("6-digit code", code, t);
    } catch { setNote("The resident lookup could not start, so the tour moves on."); }
  };

  const runAction = async (a: Action, section: Section, t: number) => {
    if ("wait" in a) return dwell(a.wait, t);
    if ("expandRow" in a) {
      const chev = Array.from(document.querySelectorAll<HTMLElement>(".ag-row .ag-icon-tree-closed")).find(isVisible);
      if (!chev) return;
      showPointer(chev); await dwell(600, t); chev.click(); hidePointer();
      return;
    }
    if ("fillResident" in a) return fillResident(t);
    if ("type" in a) {
      const ok = await typeInto(a.type.into, a.type.text, t, a.type.enter);
      if (ok && a.waitText) { const texts = a.waitText; await waitUntil(() => texts.some((x) => !!findByText(x)), a.timeoutMs ?? 20000, t, 250); }
      return;
    }
    const check = mayClick(a.click, { ai: aiRef.current });
    if (!check.ok) { if (check.reason === "ai_off") setNote("Live AI is switched off for this tour, so this step is described but not run."); return; }
    await waitUntil(() => !!findClickable(a.click), 12000, t, 200); // the page may still be fetching its own state
    const el = findClickable(a.click);
    if (!el) { setNote(`“${a.click}” isn’t available on this screen right now, so the tour moves on.`); return; }
    if (el.getBoundingClientRect().top < 70 || el.getBoundingClientRect().bottom > window.innerHeight - 200) { scrollTargetIntoPlace(el); await dwell(650, t); }
    if (!alive(t)) return;
    showPointer(el); await dwell(650, t);
    if (!alive(t)) return;
    el.click();
    if (section.ai) setBusy("Waiting for the live model…");
    if (a.waitCss) await waitUntil(() => !!document.querySelector(a.waitCss as string), a.timeoutMs ?? 15000, t);
    if (a.waitText) { const texts = a.waitText; await waitUntil(() => texts.some((x) => !!findByText(x)), a.timeoutMs ?? 20000, t, 250); }
    if (a.waitGone) { const css = a.waitGone; await waitUntil(() => !!document.querySelector(css), 3000, t, 100); await waitUntil(() => !document.querySelector(css), a.timeoutMs ?? 20000, t, 250); }
    hidePointer(); setBusy(null);
    await dwell(600, t);
  };

  const runSection = async (section: Section, t: number) => {
    setNote(null);
    // frame the subject first, so the viewer sees what is about to happen
    const pre = findTarget(section.target);
    if (pre) { scrollTargetIntoPlace(pre); await sleepMs(450); frame(pre); } else { frame(null); if (!section.target) scrollPageToTop(); }
    const skipAi = section.ai === true && !aiRef.current;
    if (!skipAi) {
      if (section.ai) {
        const gap = AI_GAP_MS - (Date.now() - lastAi.current);
        if (gap > 0) { setBusy("Giving the free AI quota a moment…"); await pausableSleep(gap, t); setBusy(null); }
        lastAi.current = Date.now();
      }
      for (const a of section.actions ?? []) { if (!alive(t)) return; await runAction(a, section, t); }
      if (section.ai) lastAi.current = Date.now();
    } else {
      setNote("Live AI is switched off for this tour, so this step is described but not run.");
    }
    if (!alive(t)) return;
    hidePointer();
    const el = findTarget(section.target);
    if (el) { scrollTargetIntoPlace(el); await sleepMs(350); frame(el); }
    else if (!section.target) frame(null);
    await dwell(section.ms ?? 5500, t);
  };

  const runChapter = async (chapter: Chapter, t: number) => {
    setNote(null); setBusy("Opening the page…"); hidePointer(); frame(null);
    const route = typeof chapter.route === "function" ? await chapter.route() : chapter.route;
    if (!alive(t)) return;
    if (!route) { setNote("This part isn’t available in the data you’re looking at, so the tour skips it."); setBusy(null); await pausableSleep(1800, t); return; }
    if (route.startsWith("/console") && !(await ensureSession())) { setNote("Judge sign-in is switched off on this deployment, so the console can’t be toured."); setBusy(null); await pausableSleep(2500, t); return; }
    if (!(await goTo(route, t))) { setNote("That page didn’t open in time, so the tour moves on."); setBusy(null); await pausableSleep(1500, t); return; }
    if (!alive(t)) return;
    if (chapter.ready) await waitUntil(() => !!findTarget(chapter.ready), 15000, t);
    await sleepMs(500);
    scrollPageToTop();
    await sleepMs(300);
    setBusy(null);
    for (let s = 0; s < chapter.sections.length && alive(t); s++) { setSectionIdx(s); await runSection(chapter.sections[s], t); }
  };

  const play = useCallback(async (from: number) => {
    const t = ++token.current; setStatus("running"); statusRef.current = "running"; setMenu(false);
    for (let i = from; i < CHAPTERS.length && alive(t); i++) { setChapterIdx(i); setSectionIdx(0); await runChapter(CHAPTERS[i], t); }
    if (alive(t)) { hidePointer(); frame(null); setBusy(null); setNote(null); setStatus("done"); statusRef.current = "done"; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => { pausedRef.current = false; setPaused(false); void play(0); };
  const stop = useCallback(() => { token.current++; setStatus("idle"); statusRef.current = "idle"; setPaused(false); pausedRef.current = false; hidePointer(); spotTarget.current = null; setBusy(null); setNote(null); setMenu(false); }, []);
  const jump = (to: number) => { if (to < 0 || to >= CHAPTERS.length) return; pausedRef.current = false; setPaused(false); void play(to); };
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); };

  useEffect(() => {
    if (status === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "Escape") { if (statusRef.current === "intro") setStatus("idle"); else stop(); }
      else if (statusRef.current !== "running" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      else if (e.key === " ") { e.preventDefault(); togglePause(); }
      else if (e.key === "ArrowRight") jump(Math.min(CHAPTERS.length - 1, chapterRef.current + 1));
      else if (e.key === "ArrowLeft") jump(Math.max(0, chapterRef.current - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stop]);

  useEffect(() => () => { token.current++; }, []);

  // motion: the outline rises in, part by part; each new caption crossfades
  useLayoutEffect(() => {
    if (status !== "intro" || !introRef.current || reduced()) return;
    const tl = gsap.timeline();
    tl.fromTo(introRef.current, { autoAlpha: 0, y: 18, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "expo.out" })
      .fromTo(introRef.current.querySelectorAll("[data-part]"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: "power3.out" }, "-=0.3");
    return () => { tl.kill(); };
  }, [status]);
  useLayoutEffect(() => {
    if (!captionRef.current || reduced()) return;
    const tw = gsap.fromTo(captionRef.current, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" });
    return () => { tw.kill(); };
  }, [chapterIdx, sectionIdx, status]);

  const chapter = CHAPTERS[chapterIdx];
  const section = chapter.sections[Math.min(sectionIdx, chapter.sections.length - 1)];
  const doneBefore = useMemo(() => CHAPTERS.slice(0, chapterIdx).reduce((n, c) => n + c.sections.length, 0), [chapterIdx]);
  const stepNo = doneBefore + sectionIdx + 1;
  const pct = status === "done" ? 100 : Math.round((stepNo / TOTAL_SECTIONS) * 100);
  const caption = section.ai && !ai && section.captionNoAi ? section.captionNoAi : section.caption;
  const badge = section.badge ?? chapter.badge;
  const minutes = Math.max(1, Math.round(CHAPTERS.reduce((n, c) => n + c.sections.reduce((m, s) => m + (s.ms ?? 5500) * 0.85 + 1800, 0), 0) / 60000));

  return (
    <div data-tour-ui className="print:hidden">
      {/* in the console the tour lives in the top bar (it never covers content); on public pages it floats */}
      {status === "idle" && mounted && !pathname.startsWith("/console") && (
        <button
          type="button"
          data-testid="tour-fab"
          onClick={() => setStatus("intro")}
          className="group fixed bottom-4 right-4 z-[95] flex items-center gap-2.5 rounded-full border border-line-strong bg-surface py-2 pl-2 pr-4 text-[13.5px] font-semibold text-ink shadow-[0_10px_30px_-10px_rgb(60_48_30/0.45)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgb(60_48_30/0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
          Guided tour
        </button>
      )}

      {status === "intro" && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-ink/30 p-4" onClick={(e) => { if (e.target === e.currentTarget) setStatus("idle"); }}>
          <div ref={introRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" data-testid="tour-intro" className="max-h-[90vh] w-[min(96vw,620px)] overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-[0_40px_90px_-30px_rgb(24_34_30/0.55)] sm:p-8">
            <p className="eyebrow">About {minutes} minutes · read-only · nothing is paid or changed</p>
            <h2 id="tour-title" className="mt-2 text-title-1 text-ink">See Landfall work, start to finish.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">The tour drives the product for you, in the order a relief response happens. A frame shows exactly what each caption is about. Pause, skip or leave at any time with Esc.</p>

            <ol className="mt-6 space-y-3 border-t border-line pt-5">
              {PARTS.map((part, i) => (
                <li key={part} data-part className="grid grid-cols-[24px_1fr] gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line-strong text-[11.5px] font-semibold tabular text-ink-2">{i + 1}</span>
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{part}</span>
                    <span className="block text-[13px] text-ink-3">{CHAPTERS.filter((c) => c.part === part).map((c) => c.title).join(" · ")}</span>
                  </span>
                </li>
              ))}
            </ol>

            <label className="mt-6 flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-2/50 p-3 text-[13.5px] text-ink-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={ai} onChange={(e) => setAiOpt(e.target.checked)} />
              <span><span className="font-semibold text-ink">Include the live AI steps.</span> They call the model on a free quota; unchecked, they are described but not run.</span>
            </label>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setStatus("idle")} className="rounded-md px-4 py-2.5 text-[14px] font-medium text-ink-2 hover:bg-ink/5 hover:text-ink">Not now</button>
              <button type="button" data-testid="tour-start" onClick={start} className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-on-accent shadow-[0_1px_2px_rgb(14_107_80/0.3)] hover:bg-accent-strong">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>
                Start the tour
              </button>
            </div>
          </div>
        </div>
      )}

      {(status === "running" || status === "done") && (
        <>
          {/* while it runs, page clicks are blocked so nothing derails a step; Pause hands the page back */}
          {status === "running" && !paused && <div className="fixed inset-0 z-[90]" aria-hidden />}

          {/* the spotlight: the rest of the page dims a little, the subject is framed in refuge green */}
          {status === "running" && (
            <div ref={spotRef} aria-hidden data-testid="tour-spotlight" className="pointer-events-none fixed left-0 top-0 z-[91] rounded-lg opacity-0" style={{ boxShadow: "0 0 0 2px rgb(var(--c-accent)), 0 0 0 6px rgb(var(--c-accent) / 0.18), 0 0 0 200vmax rgb(24 34 30 / 0.2)", width: 0, height: 0 }} />
          )}

          <div ref={cursorRef} className="pointer-events-none fixed left-0 top-0 z-[93] opacity-0" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M4 2l15 9-6.6 1.5L9.6 19z" fill="#fff" stroke="#18221E" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </div>

          <div ref={dockRef} role="region" aria-label="Guided tour" data-testid="tour-dock" className="fixed inset-x-3 bottom-3 z-[95] mx-auto w-auto max-w-[820px] rounded-xl border border-line bg-surface p-4 shadow-[0_30px_70px_-24px_rgb(24_34_30/0.5)] sm:bottom-5 sm:p-5">
            {menu && status === "running" && (
              <div className="absolute bottom-[calc(100%+8px)] right-0 max-h-[60vh] w-[min(92vw,360px)] overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-[0_20px_50px_-20px_rgb(24_34_30/0.45)]" role="menu" aria-label="Chapters">
                {PARTS.map((part) => (
                  <div key={part} className="py-1">
                    <div className="px-2.5 py-1 text-[11.5px] font-semibold text-ink-3">{part}</div>
                    {CHAPTERS.map((c, i) => (c.part !== part ? null : (
                      <button key={c.id} type="button" role="menuitem" onClick={() => jump(i)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13.5px] ${i === chapterIdx ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-2 hover:bg-ink/5 hover:text-ink"}`}>
                        {c.title}
                        {i < chapterIdx && <span className="text-[11.5px] font-normal text-ink-3">seen</span>}
                      </button>
                    )))}
                  </div>
                ))}
              </div>
            )}

            {status === "running" ? (
              <div ref={captionRef}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-2 py-0.5 text-[12px] font-medium text-ink-2"><span className={`h-1.5 w-1.5 rounded-full ${BADGE_DOT[badge]}`} />{BADGE_LABEL[badge]}</span>
                  <span className="text-[12px] text-ink-3">{chapter.part} · Step {stepNo} of {TOTAL_SECTIONS}</span>
                  <span className="ml-auto text-[12px] font-medium text-ink-3" aria-live="polite">{busy ?? (paused ? "Paused: the page is yours" : "")}</span>
                </div>
                <div className="mt-2 font-serif text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink">{chapter.title}</div>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2" aria-live="polite">{caption}</p>
                {note && <p className="mt-1.5 text-[13px] text-amber" role="status">{note}</p>}
              </div>
            ) : (
              <div ref={captionRef}>
                <div className="font-serif text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">That&rsquo;s Landfall.</div>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2" aria-live="polite">Every relief payment deserves an answer. Nothing was paid or changed during the tour. Open any screen from the sidebar, or run the tour again.</p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex h-1.5 basis-full gap-[3px] sm:flex-1 sm:basis-0" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tour progress">
                {CHAPTERS.map((c, i) => (
                  <span key={c.id} className="relative h-full overflow-hidden rounded-full bg-line" style={{ flex: c.sections.length }}>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: status === "done" || i < chapterIdx ? "100%" : i === chapterIdx ? `${((sectionIdx + 1) / c.sections.length) * 100}%` : "0%" }} />
                  </span>
                ))}
              </div>
              {status === "running" ? (
                <>
                  <DockBtn onClick={() => jump(chapterIdx - 1)} disabled={chapterIdx === 0} label="Back to the previous chapter">Back</DockBtn>
                  <DockBtn onClick={togglePause} label={paused ? "Resume tour" : "Pause tour"} testid="tour-pause" strong>{paused ? "Play" : "Pause"}</DockBtn>
                  <DockBtn onClick={() => jump(chapterIdx + 1)} disabled={chapterIdx >= CHAPTERS.length - 1} label="Next chapter">Next</DockBtn>
                  <DockBtn onClick={() => setMenu((m) => !m)} label="Chapters" pressed={menu}>Chapters</DockBtn>
                  <DockBtn onClick={cycleSpeed} label={`Tour speed ${SPEEDS[speedIdx]} times, press to change`}>{SPEEDS[speedIdx]}×</DockBtn>
                </>
              ) : (
                <DockBtn onClick={start} label="Run the tour again" strong>Run again</DockBtn>
              )}
              <button type="button" data-testid="tour-exit" onClick={stop} className="ml-auto rounded-md px-3 py-1.5 text-[13px] font-medium text-ink-3 hover:bg-ink/5 hover:text-ink sm:ml-0" aria-label="Exit the tour (Escape)">{status === "done" ? "Close" : "Exit"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DockBtn({ children, onClick, disabled, label, testid, strong, pressed }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; testid?: string; strong?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testid}
      className={`rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40 ${strong ? "border-accent bg-accent text-on-accent hover:bg-accent-strong" : pressed ? "border-ink-3 bg-surface-2 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
