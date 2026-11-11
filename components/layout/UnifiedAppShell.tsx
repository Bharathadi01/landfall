"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { I, type IconType } from "@/components/icons";
import { LandfallMark, LandfallWordmark } from "@/components/brand/LandfallMark";
import { MEANING, MeaningDot, type Tone } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { LiveClock } from "@/components/ui/LiveClock";
import { SessionChip } from "@/components/auth/SessionChip";
import { DataSourceProvider, useCases } from "@/components/data/DataSourceProvider";
import { SourceSwitch } from "@/components/data/SourceSwitch";
import { IncidentBug, SidebarIncident } from "@/components/data/IncidentBug";

type Variant = "PUBLIC" | "OPERATIONS" | "RESIDENT";

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
  tone: Tone;
  hint: string;
  tag?: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { label: "Command Center", href: "/console/war-room", icon: I.dashboard, tone: "accent", hint: "What needs attention right now" },
      { label: "Analytics Studio", href: "/console/studio", icon: I.chart, tone: "paypal", hint: "Ask questions of the relief data", tag: "AG" },
    ],
  },
  {
    group: "Respond",
    items: [
      { label: "Guided Response", href: "/console/golden-flow", icon: I.flow, tone: "accent", hint: "Warning to payout in 8 steps" },
      { label: "Storm Desk", href: "/console/sentinel", icon: I.radar, tone: "storm", hint: "Live weather and who is in the path" },
      { label: "Storm Drill", href: "/console/rehearsal", icon: I.lab, tone: "amber", hint: "Rehearse on past hurricanes" },
    ],
  },
  {
    group: "Verify",
    items: [
      { label: "AI Watch Officer", href: "/console/watch-officer", icon: I.aiAdvisor, tone: "ai", hint: "Read-only briefing & investigation" },
      { label: "Households", href: "/console/recipients", icon: I.household, tone: "money", hint: "Enrolled residents & priority" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

const toneActive: Record<Tone, string> = {
  accent: "text-accent-strong",
  money: "text-money",
  delivered: "text-delivered",
  paypal: "text-paypal",
  ai: "text-ai",
  amber: "text-amber",
  storm: "text-storm",
  danger: "text-danger",
  neutral: "text-ink",
};

const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  money: "bg-money",
  delivered: "bg-delivered",
  paypal: "bg-paypal",
  ai: "bg-ai",
  amber: "bg-amber",
  storm: "bg-storm",
  danger: "bg-danger",
  neutral: "bg-ink",
};

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useVariant(pathname: string): Variant {
  return useMemo(() => {
    if (pathname.startsWith("/console")) return "OPERATIONS";
    if (pathname.startsWith("/r/")) return "RESIDENT";
    return "PUBLIC";
  }, [pathname]);
}

export function UnifiedAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const variant = useVariant(pathname);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-surface px-3 py-2 text-[13px] font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline focus:outline-2 focus:outline-accent"
      >
        Skip to content
      </a>
      {variant === "PUBLIC" ? <PublicShell>{children}</PublicShell> : variant === "RESIDENT" ? <ResidentShell pathname={pathname}>{children}</ResidentShell> : <OperationsShell pathname={pathname}>{children}</OperationsShell>}
    </>
  );
}

/* ── Public ───────────────────────────────────────────────── */

function PublicShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${scrolled ? "border-line bg-canvas/95" : "border-transparent"}`}>
        <header
          className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6"
        >
          <Link href="/" aria-label="Landfall home">
            <LandfallWordmark size={30} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-[13.5px] text-ink-2" aria-label="Sections">
            {[
              ["How it works", "#how-it-works"],
              ["PayPal", "#paypal"],
              ["AG Studio", "#studio"],
              ["Safety", "#safety"],
            ].map(([l, h]) => (
              <a key={h} href={h} className="rounded-sm px-3.5 py-2 font-medium transition-colors hover:bg-white/[0.06] hover:text-ink">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Button href="/r/enroll" variant="ghost" size="sm" className="hidden sm:inline-flex">
              I need help
            </Button>
            <Button href="/console/war-room" variant="signal" size="sm" trailing={<I.arrowUpRight className="h-4 w-4" />}>
              Open console
            </Button>
          </div>
        </header>
      </div>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>

      <footer className="relative border-t border-white/[0.06] py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LandfallWordmark size={30} sub="Relief before landfall" />
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
              Open-source, PayPal-native relief payouts for community funds. Built for the PayPal AI Hackathon 2026. MIT licensed.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2">
            <Link href="/console/war-room" className="hover:text-ink">Command Center</Link>
            <Link href="/console/studio" className="hover:text-ink">Analytics Studio</Link>
            <Link href="/console/golden-flow" className="hover:text-ink">Guided Response</Link>
            <Link href="/r/enroll" className="hover:text-ink">Resident portal</Link>
            <Link href="/judges" className="hover:text-ink">Judge test card</Link>
            <Link href="/validate" className="hover:text-ink">Give feedback</Link>
            <a href="https://github.com/Bharathadi01/landfall" className="hover:text-ink" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Resident ─────────────────────────────────────────────── */

function ResidentShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/">
            <LandfallWordmark size={30} sub="Resident help" />
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
          <span className="hidden md:inline-flex items-center gap-2 text-[12px] text-ink-3">
            <I.globe className="h-4 w-4 text-accent-strong" />
            5 languages
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 px-4 py-10 outline-none">{children}</main>

      <footer className="border-t border-white/[0.06] px-4 py-8 text-center text-[12.5px] text-ink-3">
        Your details are encrypted. Need a person? Use “Report a problem” — a coordinator replies within 24 hours.
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

  const current = ALL_ITEMS.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-canvas transition-[width] duration-300 lg:flex ${
          collapsed ? "w-[76px]" : "w-[262px]"
        }`}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[284px] max-w-[86vw] flex-col overflow-hidden border-r border-line bg-canvas animate-field-drawer">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-sm p-2 text-ink-2 hover:bg-white/5"
              aria-label="Close navigation"
            >
              <I.close className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-canvas/95 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" iconOnly aria-label="Open navigation" className="shrink-0 min-w-9 lg:hidden" onClick={() => setMobileOpen(true)}>
              <I.menu className="h-4 w-4" />
            </Button>
            <span className="truncate whitespace-nowrap font-serif text-[18px] tracking-[-0.01em] text-ink">{current?.label ?? "Console"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <SourceSwitch />
            <SessionChip />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="relative flex-1 px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1480px]"><ConsoleContent>{children}</ConsoleContent></div>
        </main>
      </div>
    </div>
  );
}

/**
 * Until the case source (live or replay) is known, show a skeleton instead of the page: otherwise the first paint
 * briefly shows the synthetic replay numbers as if they were the app's data before the live records arrive.
 */
function ConsoleContent({ children }: { children: React.ReactNode }) {
  const { status } = useCases();
  // Only the FIRST load shows a skeleton. Switching Live ⇄ Replay later keeps the page mounted (a heavy page like Analytics
  // Studio must not be torn down and rebuilt — that is what made it look blank), and the header says "Loading…".
  const loadedOnce = useRef(false);
  if (status !== "loading") loadedOnce.current = true;
  if (status === "loading" && !loadedOnce.current) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading the latest records" className="space-y-6" data-testid="console-skeleton">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/[0.12]" />
        <div className="h-24 w-full max-w-2xl animate-pulse rounded-2xl bg-white/[0.10]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/[0.08]" />)}
        </div>
        <span className="sr-only">Loading the latest records…</span>
      </div>
    );
  }
  return <>{children}</>;
}

function SidebarContent({
  pathname,
  collapsed,
  onToggle,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const links = useRef<Record<string, HTMLAnchorElement | null>>({});
  const first = useRef(true);
  const active = ALL_ITEMS.find((i) => i.href === pathname);

  // GSAP-driven active marker that glides between items.
  useIso(() => {
    const link = links.current[pathname];
    const ind = indRef.current;
    if (!ind) return;
    if (!link) {
      gsap.set(ind, { opacity: 0 });
      return;
    }
    const props = { y: link.offsetTop, height: link.offsetHeight, opacity: 1 };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (first.current || reduce) gsap.set(ind, props);
    else gsap.to(ind, { ...props, duration: 0.55, ease: "expo.out", overwrite: "auto" });
    first.current = false;
  }, [pathname, collapsed]);

  return (
    <>
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        <Link href="/" aria-label={collapsed ? "Landfall home" : undefined}>
          {collapsed ? <LandfallMark size={32} /> : <LandfallWordmark size={30} sub="Relief console" />}
        </Link>
        {onToggle && !collapsed && (
          <button onClick={onToggle} className="rounded-sm p-1.5 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label="Collapse sidebar">
            <I.sidebarClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {!collapsed && (
          <Link href="/console/sentinel" className="mb-6 block border-y border-line px-3 py-3 hover:bg-white/[0.03]">
            <SidebarIncident />
          </Link>
        )}

        <nav ref={navRef} className="relative space-y-6" aria-label="Console">
          {/* sliding active marker: a thin accent rule on the left edge */}
          <span
            ref={indRef}
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-0 border-l-2 border-accent bg-white/[0.04] opacity-0"
            style={{ height: 0 }}
          />

          {NAV.map((g) => (
            <div key={g.group}>
              {!collapsed && <div className="mb-2 px-3 eyebrow">{g.group}</div>}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const isActive = pathname === item.href;
                  const n = ALL_ITEMS.findIndex((i) => i.href === item.href) + 1;
                  return (
                    <li key={item.href}>
                      <Link
                        ref={(el) => {
                          links.current[item.href] = el;
                        }}
                        href={item.href}
                        title={collapsed ? item.label : item.hint}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative z-10 flex items-baseline gap-3 px-3 py-2 text-[14px] transition-colors ${
                          collapsed ? "justify-center" : ""
                        } ${isActive ? "text-ink" : "text-ink-2 hover:text-ink"}`}
                      >
                        <span className={`font-mono text-[11px] tabular ${isActive ? "text-accent-strong" : "text-ink-3"}`}>{String(n).padStart(2, "0")}</span>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate font-medium">{item.label}</span>
                            {item.tag && <span className="text-[11px] text-ink-3">{item.tag}</span>}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div>
            {!collapsed && <div className="mb-2 px-3 eyebrow">Public</div>}
            <ul className="space-y-0.5">
              {[
                { label: "Public site", href: "/" },
                { label: "Resident portal", href: "/r/enroll" },
                { label: "Judge test card", href: "/judges" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} title={l.label} className={`flex items-baseline gap-3 px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink ${collapsed ? "justify-center" : ""}`}>
                    <span className="font-mono text-[11px]" aria-hidden>↗</span>
                    {!collapsed && <span>{l.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className="relative shrink-0 border-t border-white/[0.06] p-3">
        {!collapsed ? null : (
          onToggle && (
            <button onClick={onToggle} className="mx-auto flex rounded-sm p-2 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label="Expand sidebar">
              <I.sidebarOpen className="h-4 w-4" />
            </button>
          )
        )}
      </div>
    </>
  );
}
