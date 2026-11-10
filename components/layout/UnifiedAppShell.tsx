"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Workflow,
  Radar,
  FlaskConical,
  Sparkles,
  Users,
  ReceiptText,
  Globe2,
  HeartHandshake,
  Menu,
  X,
  ArrowUpRight,
  PlayCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { LandfallMark, LandfallWordmark } from "@/components/brand/LandfallMark";
import { MEANING, MeaningDot, type Tone } from "@/components/ui/primitives";

type Variant = "PUBLIC" | "OPERATIONS" | "RESIDENT";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: Tone;
  hint: string;
  tag?: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { label: "Command Center", href: "/console/war-room", icon: LayoutDashboard, tone: "accent", hint: "What needs attention right now" },
      { label: "Analytics Studio", href: "/console/studio", icon: BarChart3, tone: "paypal", hint: "Ask questions of the relief data", tag: "AG" },
    ],
  },
  {
    group: "Respond",
    items: [
      { label: "Guided Response", href: "/console/golden-flow", icon: Workflow, tone: "accent", hint: "Warning to payout in 8 steps" },
      { label: "Storm Map", href: "/console/sentinel", icon: Radar, tone: "storm", hint: "Who is in the storm's path" },
      { label: "Storm Drill", href: "/console/rehearsal", icon: FlaskConical, tone: "amber", hint: "Rehearse on past hurricanes" },
    ],
  },
  {
    group: "Verify",
    items: [
      { label: "AI Watch Officer", href: "/console/watch-officer", icon: Sparkles, tone: "ai", hint: "Read-only briefing & investigation" },
      { label: "Households", href: "/console/recipients", icon: Users, tone: "accent", hint: "Enrolled residents & priority" },
      { label: "Money Trail", href: "/spike", icon: ReceiptText, tone: "paypal", hint: "Every PayPal dollar, reconciled" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

const toneActive: Record<Tone, string> = {
  accent: "text-accent-strong",
  paypal: "text-paypal",
  ai: "text-ai",
  amber: "text-amber",
  storm: "text-storm",
  danger: "text-danger",
  neutral: "text-ink",
};

const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  paypal: "bg-paypal",
  ai: "bg-ai",
  amber: "bg-amber",
  storm: "bg-storm",
  danger: "bg-danger",
  neutral: "bg-ink",
};

function useVariant(pathname: string): Variant {
  return useMemo(() => {
    if (pathname.startsWith("/console") || pathname === "/spike") return "OPERATIONS";
    if (pathname.startsWith("/r/")) return "RESIDENT";
    return "PUBLIC";
  }, [pathname]);
}

export function UnifiedAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const variant = useVariant(pathname);
  if (variant === "PUBLIC") return <PublicShell>{children}</PublicShell>;
  if (variant === "RESIDENT") return <ResidentShell pathname={pathname}>{children}</ResidentShell>;
  return <OperationsShell pathname={pathname}>{children}</OperationsShell>;
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
      <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <header
          className={`flex w-full max-w-5xl items-center justify-between gap-4 px-3 py-2.5 transition-all duration-500 ${
            scrolled ? "glass-strong" : "border border-transparent"
          }`}
          style={{ borderRadius: 18 }}
        >
          <Link href="/" className="pl-1">
            <LandfallWordmark size={30} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-[13.5px] text-ink-2">
            {[
              ["How it works", "#how-it-works"],
              ["PayPal", "#paypal"],
              ["AG Studio", "#studio"],
              ["Safety", "#safety"],
            ].map(([l, h]) => (
              <a key={h} href={h} className="rounded-lg px-3 py-2 transition-colors hover:bg-white/5 hover:text-ink">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/r/enroll" className="field-btn field-btn-subtle hidden sm:inline-flex text-[13px] px-3 py-2">
              I need help
            </Link>
            <Link href="/console/war-room" className="field-btn field-btn-primary text-[13px] px-4 py-2.5">
              Open console
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </header>
      </div>

      <main className="flex-1">{children}</main>

      <footer className="relative border-t border-white/5 py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <LandfallWordmark size={28} sub="Relief before landfall" />
            <p className="max-w-sm text-[13px] text-ink-3">
              Open-source, PayPal-native relief payouts for community funds. Built for the PayPal AI Hackathon 2026. MIT licensed.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2">
            <Link href="/console/war-room" className="hover:text-ink">Command Center</Link>
            <Link href="/console/studio" className="hover:text-ink">Analytics Studio</Link>
            <Link href="/console/golden-flow" className="hover:text-ink">Guided Response</Link>
            <Link href="/r/enroll" className="hover:text-ink">Resident portal</Link>
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
      <header className="sticky top-0 z-40 border-b border-white/5 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/">
            <LandfallWordmark size={30} sub="Resident help" />
          </Link>
          <nav className="hidden sm:flex items-center gap-1 rounded-xl border border-white/5 bg-white/[0.03] p-1 text-[13px]">
            {[
              ["Get help", "/r/enroll"],
              ["Report a problem", "/r/complaints"],
            ].map(([l, h]) => (
              <Link
                key={h}
                href={h}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  pathname === h ? "bg-white/10 text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {l}
              </Link>
            ))}
          </nav>
          <span className="hidden md:inline-flex items-center gap-2 text-[12px] text-ink-3">
            <Globe2 className="h-4 w-4 text-accent-strong" />
            5 languages
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">{children}</main>

      <footer className="border-t border-white/5 px-4 py-8 text-center text-[12.5px] text-ink-3">
        Your details are encrypted. Need a person? Use “Report a problem” — a coordinator replies within 24 hours.
      </footer>
    </div>
  );
}

/* ── Operations ───────────────────────────────────────────── */

function OperationsShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  const current = ALL_ITEMS.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/[0.06] bg-canvas/40 backdrop-blur-2xl transition-[width] duration-500 ease-[cubic-bezier(.16,1,.3,1)] lg:flex ${
          collapsed ? "w-[76px]" : "w-[268px]"
        }`}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[284px] max-w-[86vw] flex-col border-r border-white/10 bg-canvas/95 backdrop-blur-2xl animate-field-drawer">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-ink-2 hover:bg-white/5"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-canvas/55 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-ink-2 hover:bg-white/5 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="hidden text-ink-3 sm:inline">Tampa Bay Relief Fund</span>
              <span className="hidden text-ink-3/50 sm:inline">/</span>
              <span className="truncate font-medium text-ink">{current?.label ?? "Console"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-paypal/25 bg-paypal/10 px-3 py-1.5 text-[11.5px] font-medium text-paypal">
              <span className="live-dot" />
              PayPal Sandbox mode
            </span>
            {pathname !== "/console/golden-flow" && (
              <Link href="/console/golden-flow" className="field-btn field-btn-primary px-3.5 py-2 text-[13px]">
                <PlayCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Run guided response</span>
                <span className="sm:hidden">Run</span>
              </Link>
            )}
          </div>
        </header>

        <main className="relative flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
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
  return (
    <>
      <div className={`flex h-16 shrink-0 items-center border-b border-white/[0.06] ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        <Link href="/" aria-label="Landfall home">
          {collapsed ? <LandfallMark size={32} /> : <LandfallWordmark size={30} sub="Relief console" />}
        </Link>
        {onToggle && !collapsed && (
          <button onClick={onToggle} className="rounded-lg p-1.5 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed ? (
          <Link
            href="/console/sentinel"
            className="group relative mb-6 block overflow-hidden rounded-2xl border border-storm/25 bg-gradient-to-br from-storm/[0.14] via-storm/[0.05] to-transparent p-3.5"
          >
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full border border-storm/30" aria-hidden />
            <div className="absolute -right-2 -top-2 h-12 w-12 rounded-full border border-storm/40" aria-hidden />
            <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.12em] text-storm">
              <span className="live-dot" />
              Active incident
            </div>
            <div className="mt-2 text-[14px] font-semibold text-ink">Hurricane Milton</div>
            <div className="mt-0.5 text-[12px] text-ink-2">Cat 4 · Tampa Bay · landfall in ~12h</div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-3">
              Replay of Oct 2024 data
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </Link>
        ) : (
          <Link href="/console/sentinel" className="mb-5 flex justify-center" title="Active incident: Hurricane Milton">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-storm/30 bg-storm/10 text-storm">
              <Radar className="h-4 w-4" />
            </span>
          </Link>
        )}

        <nav className="space-y-6">
          {NAV.map((g) => (
            <div key={g.group}>
              {!collapsed && <div className="mb-2 px-3 text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-3">{g.group}</div>}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : item.hint}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all ${
                          collapsed ? "justify-center" : ""
                        } ${active ? "bg-white/[0.07] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink"}`}
                      >
                        {active && <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ${toneBar[item.tone]}`} />}
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? toneActive[item.tone] : "text-ink-3 group-hover:text-ink-2"}`} strokeWidth={1.75} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate font-medium">{item.label}</span>
                            {item.tag && (
                              <span className="rounded-md border border-paypal/30 bg-paypal/10 px-1.5 py-0.5 text-[9.5px] font-mono font-semibold tracking-wider text-paypal">
                                {item.tag}
                              </span>
                            )}
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
            {!collapsed && <div className="mb-2 px-3 text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-3">Public</div>}
            <ul className="space-y-0.5">
              {[
                { label: "Public site", href: "/", icon: Globe2 },
                { label: "Resident portal", href: "/r/enroll", icon: HeartHandshake },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    title={l.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink ${collapsed ? "justify-center" : ""}`}
                  >
                    <l.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span>{l.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-4">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3">Colour key</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] text-ink-2">
              {MEANING.map((m) => (
                <span key={m.label} className="flex items-center gap-1.5">
                  <MeaningDot tone={m.tone} />
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          onToggle && (
            <button onClick={onToggle} className="mx-auto flex rounded-lg p-2 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label="Expand sidebar">
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )
        )}
      </div>
    </>
  );
}
