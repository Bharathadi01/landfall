"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { I } from "@/components/icons";
import { LandfallMark, LandfallWordmark } from "@/components/brand/LandfallMark";
import { Button } from "@/components/ui/Button";
import { SessionChip } from "@/components/auth/SessionChip";
import { DataSourceProvider, useCases } from "@/components/data/DataSourceProvider";
import { SourceSwitch } from "@/components/data/SourceSwitch";
import { SidebarIncident } from "@/components/data/IncidentBug";
import { FLOW, flowPage, flowStage, nextFlowPage } from "./flow";

type Variant = "PUBLIC" | "OPERATIONS" | "RESIDENT";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function variantOf(pathname: string): Variant {
  if (pathname.startsWith("/console")) return "OPERATIONS";
  if (pathname.startsWith("/r/")) return "RESIDENT";
  return "PUBLIC";
}

export function UnifiedAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const variant = variantOf(pathname);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-[13px] font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline focus:outline-2 focus:outline-accent"
      >
        Skip to content
      </a>
      {variant === "PUBLIC" ? (
        <PublicShell pathname={pathname}>{children}</PublicShell>
      ) : variant === "RESIDENT" ? (
        <ResidentShell pathname={pathname}>{children}</ResidentShell>
      ) : (
        <OperationsShell pathname={pathname}>{children}</OperationsShell>
      )}
    </>
  );
}

/** Content enters the way a page of a report is turned to: the header first, then each block a beat later. Calm, never bouncy. */
function usePageEntrance(ref: React.RefObject<HTMLElement | null>, key: string) {
  useIso(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const kids = Array.from(el.children).slice(0, 8) as HTMLElement[];
    if (!kids.length) return;
    const tween = gsap.fromTo(
      kids,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.055, clearProps: "transform,opacity,visibility" }
    );
    return () => { tween.kill(); gsap.set(kids, { clearProps: "transform,opacity,visibility" }); };
  }, [key]);
}

/* ── Public ───────────────────────────────────────────────── */

function PublicShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && setSignedIn(!!j.authenticated && j.session?.role !== "resident"))
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  const home = pathname === "/";
  const anchor = (h: string) => (home ? h : `/${h}`);

  return (
    <div className="flex min-h-screen flex-col">
      <div className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${scrolled ? "border-line bg-canvas/92 backdrop-blur-md" : "border-transparent"}`}>
        <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/" aria-label="Landfall home" className="rounded-md">
            <LandfallWordmark size={28} />
          </Link>
          <nav className="hidden items-center gap-1 text-[14px] text-ink-2 md:flex" aria-label="Sections">
            {[
              ["How it works", "#how-it-works"],
              ["Proof it landed", "#assurance"],
              ["Give", "#paypal"],
              ["Safety", "#safety"],
            ].map(([l, h]) => (
              <a key={h} href={anchor(h)} className="rounded-md px-3 py-2 font-medium transition-colors hover:bg-ink/5 hover:text-ink">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button href="/r/enroll" variant="ghost" size="sm" className="hidden sm:inline-flex">
              I need help
            </Button>
            {pathname !== "/signin" && (
              <Button href={signedIn ? "/console/war-room" : "/signin"} variant="signal" size="sm" data-testid="enter-console">
                {signedIn ? "Back to the console" : "Enter the console"}
              </Button>
            )}
          </div>
        </header>
      </div>

      <main id="main" tabIndex={-1} className="reveal-scope flex-1 outline-none">{children}</main>

      <footer className="relative border-t border-line py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-[1.2fr_2fr]">
          <div className="space-y-3">
            <LandfallWordmark size={26} sub="Relief that lands before the storm" />
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
              Open-source, PayPal-native relief payouts for community funds. Built for the PayPal AI Hackathon 2026. MIT licensed. All people shown are fictional; all money is PayPal Sandbox play money.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[13.5px] sm:grid-cols-3">
            <FooterCol title="For coordinators" links={[["Enter the console", "/signin"], ["Payments (AG Grid)", "/console/payments"], ["Analytics Studio", "/console/studio"]]} />
            <FooterCol title="For residents" links={[["Get help", "/r/enroll"], ["Check a payment", "/r/enroll?tab=status"], ["Report a problem", "/r/complaints"]]} />
            <FooterCol title="For judges" links={[["Judge test card", "/judges"], ["Give feedback", "/validate"], ["Source on GitHub", "https://github.com/Bharathadi01/landfall"]]} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-ink">{title}</div>
      <ul className="mt-2 space-y-0.5">
        {links.map(([l, h]) => (
          <li key={h}>
            {h.startsWith("http") ? (
              <a href={h} target="_blank" rel="noreferrer" className="inline-flex min-h-[28px] items-center text-ink-3 transition-colors hover:text-ink">{l}</a>
            ) : (
              <Link href={h} className="inline-flex min-h-[28px] items-center text-ink-3 transition-colors hover:text-ink">{l}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Resident ─────────────────────────────────────────────── */

function ResidentShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref, pathname);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/" className="rounded-md">
            <LandfallWordmark size={28} sub="Help for residents" />
          </Link>
          <nav className="seg hidden sm:inline-flex" aria-label="Resident pages">
            {[
              ["Get help", "/r/enroll"],
              ["Report a problem", "/r/complaints"],
            ].map(([l, h]) => (
              <Link key={h} href={h} aria-current={pathname === h ? "page" : undefined} className="seg-btn">
                {l}
              </Link>
            ))}
          </nav>
          <span className="hidden items-center gap-2 text-[12.5px] text-ink-3 md:inline-flex">
            <I.globe className="h-4 w-4" />
            English · Español · Tiếng Việt · Kreyòl
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 px-4 py-10 outline-none">
        <div ref={ref}>{children}</div>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-[13px] text-ink-3">
        Your details are encrypted. Need a person? Use “Report a problem” and a coordinator replies within 24 hours.
      </footer>
    </div>
  );
}

/* ── Operations ───────────────────────────────────────────── */

function OperationsShell(props: { children: React.ReactNode; pathname: string }) {
  return (
    <DataSourceProvider>
      <OperationsShellInner {...props} />
    </DataSourceProvider>
  );
}

function OperationsShellInner({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  const page = flowPage(pathname);
  const stage = flowStage(pathname);
  const isCase = pathname.startsWith("/console/cases/");

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-canvas transition-[width] duration-300 lg:flex ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/[0.04]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[284px] max-w-[86vw] flex-col overflow-hidden border-r border-line bg-canvas animate-field-drawer">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 rounded-md p-2 text-ink-2 hover:bg-ink/5" aria-label="Close navigation">
              <I.close className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-4 border-b border-line bg-canvas/92 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" iconOnly aria-label="Open navigation" className="shrink-0 lg:hidden" onClick={() => setMobileOpen(true)}>
              <I.menu className="h-4 w-4" />
            </Button>
            <nav aria-label="You are here" className="flex min-w-0 items-center gap-2 text-[13px]">
              {stage?.stage && <span className="hidden whitespace-nowrap text-ink-3 sm:inline">{stage.stage}</span>}
              {stage?.stage && <I.chevronRight className="hidden h-3.5 w-3.5 shrink-0 text-ink-3 sm:inline" aria-hidden />}
              {isCase ? (
                <>
                  <Link href="/console/payments" className="whitespace-nowrap text-ink-3 hover:text-ink">Payments</Link>
                  <I.chevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
                  <span className="truncate font-semibold text-ink">One payment</span>
                </>
              ) : (
                <span className="truncate font-semibold text-ink">{page?.label ?? "Console"}</span>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Button
              variant="glass"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("landfall:tour"))}
              leading={<span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent"><svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg></span>}
              data-testid="tour-header"
            >
              Guided tour
            </Button>
            <SourceSwitch />
            <span className="hidden h-6 w-px bg-line lg:block" aria-hidden />
            <SessionChip />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="relative flex-1 px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1440px]">
            <ConsoleContent pathname={pathname}>{children}</ConsoleContent>
            <NextStep pathname={pathname} />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Wayfinding: every console page ends by saying what comes next in a relief response, so no one is left wondering where to go. */
function NextStep({ pathname }: { pathname: string }) {
  const next = nextFlowPage(pathname);
  if (!next || pathname.startsWith("/console/cases/")) return null;
  const nextStage = FLOW.find((g) => g.pages.includes(next));
  const Icon = next.icon;
  return (
    <nav aria-label="Next step" className="mt-16 border-t border-line pt-8">
      <Link href={next.href} className="next-step group" data-testid="next-step">
        <span className="flex min-w-0 items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-strong text-ink-2">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] text-ink-3">Next{nextStage?.stage ? ` · ${nextStage.stage}` : ""}</span>
            <span className="block text-[16px] font-semibold text-ink">{next.label}</span>
            <span className="block truncate text-[13px] text-ink-2">{next.purpose}</span>
          </span>
        </span>
        <I.arrowRight className="next-arrow h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      </Link>
    </nav>
  );
}

/**
 * Until the case source (live or replay) is known, show a skeleton instead of the page: otherwise the first paint
 * briefly shows the synthetic replay numbers as if they were the app's data before the live records arrive.
 */
function ConsoleContent({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const { status } = useCases();
  const ref = useRef<HTMLDivElement>(null);
  // Only the FIRST load shows a skeleton. Switching Live ⇄ Replay later keeps the page mounted (a heavy page like Analytics
  // Studio must not be torn down and rebuilt — that is what made it look blank).
  const loadedOnce = useRef(false);
  if (status !== "loading") loadedOnce.current = true;
  const ready = !(status === "loading" && !loadedOnce.current);
  usePageEntrance(ref, `${pathname}:${ready}`);
  if (!ready) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading the latest records" className="space-y-6" data-testid="console-skeleton">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-10 w-full max-w-xl" />
        <div className="skeleton h-4 w-full max-w-2xl" />
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
        <span className="sr-only">Loading the latest records…</span>
      </div>
    );
  }
  return <div ref={ref}>{children}</div>;
}

function SidebarContent({ pathname, collapsed, onToggle }: { pathname: string; collapsed: boolean; onToggle?: () => void }) {
  const indRef = useRef<HTMLSpanElement>(null);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const first = useRef(true);
  const activeHref = pathname.startsWith("/console/cases/") ? "/console/payments" : pathname;

  // The "you are here" marker glides between items, so the eye follows the move instead of re-reading the list.
  useIso(() => {
    const link = links.current[activeHref];
    const ind = indRef.current;
    if (!ind) return;
    if (!link) {
      gsap.set(ind, { opacity: 0 });
      return;
    }
    const props = { y: link.offsetTop, height: link.offsetHeight, opacity: 1 };
    if (first.current || reducedMotion()) gsap.set(ind, props);
    else gsap.to(ind, { ...props, duration: 0.55, ease: "expo.out", overwrite: "auto" });
    first.current = false;
  }, [activeHref, collapsed]);

  return (
    <>
      <div className={`flex h-[60px] shrink-0 items-center border-b border-line ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        <Link href="/" aria-label="Landfall home" className="rounded-md">
          {collapsed ? <LandfallMark size={30} /> : <LandfallWordmark size={26} />}
        </Link>
        {onToggle && !collapsed && (
          <button onClick={onToggle} className="rounded-md p-1.5 text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label="Collapse sidebar">
            <I.sidebarClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
        {!collapsed && (
          <Link href="/console/payments" className="mb-5 block rounded-md border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface" data-testid="sidebar-source">
            <SidebarIncident />
          </Link>
        )}

        <nav className="relative space-y-5" aria-label="Console">
          <span ref={indRef} aria-hidden className="pointer-events-none absolute left-0 right-0 top-0 rounded-md bg-surface-2 opacity-0" style={{ height: 0 }}>
            <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent" />
          </span>

          {FLOW.map((g, gi) => (
            <div key={g.stage ?? "home"}>
              {!collapsed && g.stage && (
                <div className="mb-1.5 flex items-baseline gap-2 px-3">
                  <span className="text-[11px] font-semibold tabular text-ink-3">{gi}</span>
                  <span className="eyebrow text-ink-2">{g.stage}</span>
                </div>
              )}
              {collapsed && gi > 0 && <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden />}
              <ul className="space-y-0.5">
                {g.pages.map((item) => {
                  const isActive = activeHref === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        ref={(el) => { links.current[item.href] = el; }}
                        href={item.href}
                        title={collapsed ? `${item.label}: ${item.purpose}` : item.purpose}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative z-10 flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors ${collapsed ? "justify-center" : ""} ${
                          isActive ? "text-ink" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink"
                        }`}
                      >
                        <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? "text-accent-strong" : "text-ink-3 group-hover:text-ink-2"}`} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate font-medium">{item.label}</span>
                            {item.tag && <span className="text-[11px] font-medium text-ink-3">{item.tag}</span>}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t border-line p-3">
        {collapsed ? (
          onToggle && (
            <button onClick={onToggle} className="mx-auto flex rounded-md p-2 text-ink-3 hover:bg-ink/5 hover:text-ink" aria-label="Expand sidebar">
              <I.sidebarOpen className="h-4 w-4" />
            </button>
          )
        ) : (
          <div className="flex flex-wrap gap-x-3 px-1 text-[12.5px]">
            <Link href="/" className="inline-flex min-h-[28px] items-center rounded px-1 text-ink-3 hover:text-ink">Public site</Link>
            <Link href="/r/enroll" className="inline-flex min-h-[28px] items-center rounded px-1 text-ink-3 hover:text-ink">Resident view</Link>
            <Link href="/judges" className="inline-flex min-h-[28px] items-center rounded px-1 text-ink-3 hover:text-ink">Judge card</Link>
          </div>
        )}
      </div>
    </>
  );
}
