"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Zap,
  Activity,
  CloudRain,
  ShieldAlert,
  Users,
  HeartHandshake,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  FileText,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Globe2,
  ArrowRight,
  Radio,
  Clock,
  HelpCircle,
} from "lucide-react";

export type ExperienceVariant = "PUBLIC" | "OPERATIONS" | "RESIDENT";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: "COMMAND" | "AUDIT" | "PORTAL";
  badge?: string;
  description: string;
}

const OPERATIONS_NAV_ITEMS: NavItem[] = [
  {
    id: "war-room",
    label: "War Room",
    href: "/console/war-room",
    icon: Zap,
    section: "COMMAND",
    badge: "AG Studio 3.1",
    description: "Operational overview & exception resolution queue",
  },
  {
    id: "golden-flow",
    label: "Golden Workflow",
    href: "/console/golden-flow",
    icon: Activity,
    section: "COMMAND",
    badge: "8-Stage",
    description: "Guided end-to-end anticipatory relief pipeline",
  },
  {
    id: "sentinel",
    label: "Sentinel Weather",
    href: "/console/sentinel",
    icon: CloudRain,
    section: "COMMAND",
    badge: "Storm Atlas",
    description: "Overhead meteorological intelligence & household exposure",
  },
  {
    id: "rehearsal",
    label: "Rehearsal Lab",
    href: "/console/rehearsal",
    icon: ShieldAlert,
    section: "COMMAND",
    badge: "Simulation",
    description: "Disaster scenario stress testing & reserve verification",
  },
  {
    id: "watch-officer",
    label: "Watch Officer AI",
    href: "/console/watch-officer",
    icon: Sparkles,
    section: "AUDIT",
    badge: "Read-Only",
    description: "Evidence-oriented briefing & payout exception investigator",
  },
  {
    id: "recipients",
    label: "Recipient Directory",
    href: "/console/recipients",
    icon: Users,
    section: "AUDIT",
    badge: "AES-256",
    description: "Vulnerable household roster with eligibility scoring",
  },
  {
    id: "spike",
    label: "PayPal Audit Ledger",
    href: "/spike",
    icon: FileText,
    section: "AUDIT",
    badge: "Double-Entry",
    description: "Financial ledger reconciliation & transaction verification",
  },
];

export function UnifiedAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState("English");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  // Determine current experience variant
  const experienceVariant: ExperienceVariant = useMemo(() => {
    if (pathname.startsWith("/console") || pathname === "/spike") return "OPERATIONS";
    if (pathname.startsWith("/r/")) return "RESIDENT";
    return "PUBLIC";
  }, [pathname]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setLanguageMenuOpen(false);
  }, [pathname]);

  // Contextual breadcrumb details
  const breadcrumb = useMemo(() => {
    if (pathname === "/") {
      return { section: "Public", title: "Overview", subtitle: "Anticipatory Relief · PayPal Connected" };
    }
    if (pathname === "/console/war-room") {
      return { section: "Operations", title: "Coordinator War Room", subtitle: "AG Studio 3.1 · Operations Overview" };
    }
    if (pathname === "/console/golden-flow") {
      return { section: "Operations", title: "Golden Workflow", subtitle: "8-Stage Anticipatory Pipeline" };
    }
    if (pathname === "/console/sentinel") {
      return { section: "Operations", title: "Sentinel Weather Intelligence", subtitle: "NOAA nowCOAST WMS & GOES-16 ABI" };
    }
    if (pathname === "/console/rehearsal") {
      return { section: "Operations", title: "Storm Rehearsal Lab", subtitle: "Milton 2024 Replay · Simulation Drill" };
    }
    if (pathname === "/console/recipients") {
      return { section: "Operations", title: "Recipient Directory", subtitle: "Encrypted Household Vulnerability Tiers" };
    }
    if (pathname === "/console/watch-officer") {
      return { section: "Operations", title: "Watch Officer AI", subtitle: "Groq Zero-Cost Payout Investigator" };
    }
    if (pathname === "/spike") {
      return { section: "Operations", title: "PayPal Audit Ledger", subtitle: "Double-Entry Invariant Reconciliation" };
    }
    if (pathname === "/r/enroll") {
      return { section: "Resident Portal", title: "Household Enrollment", subtitle: "Encrypted Intake · Recipient V1" };
    }
    if (pathname === "/r/complaints") {
      return { section: "Resident Portal", title: "Community Grievances", subtitle: "24-Hour Review SLA & Appeals" };
    }
    return { section: "Landfall", title: "Platform Surface", subtitle: "Field Atlas" };
  }, [pathname]);

  // --- 1. PUBLIC EXPERIENCE SHELL (/) ---
  if (experienceVariant === "PUBLIC") {
    return (
      <div className="min-h-screen bg-[#F4F2EC] text-[#192A24] flex flex-col font-sans selection:bg-[#E0EEE7] selection:text-[#175B47]">
        {/* Editorial Top Navigation Header */}
        <header className="sticky top-0 z-40 bg-[#FFFEFA]/90 backdrop-blur-md border-b border-[#DEDCD3] transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Brand Logo & Editorial Mark */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#175B47] text-[#FFFEFA] flex items-center justify-center font-bold text-sm tracking-wider shadow-sm group-hover:bg-[#124938] transition-colors">
                LF
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[15px] tracking-tight text-[#192A24]">
                  LANDFALL
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#58665F]">
                  Field Atlas · Anticipatory Aid
                </span>
              </div>
            </Link>

            {/* Public Visitor Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-medium text-[#58665F]">
              <Link href="#problem" className="hover:text-[#175B47] transition-colors">
                The Problem
              </Link>
              <Link href="#how-it-works" className="hover:text-[#175B47] transition-colors">
                How It Works
              </Link>
              <Link href="#governance" className="hover:text-[#175B47] transition-colors">
                PayPal Governance
              </Link>
              <Link href="#investigation" className="hover:text-[#175B47] transition-colors">
                AI Investigation
              </Link>
              <Link href="#evidence" className="hover:text-[#175B47] transition-colors">
                Evidence
              </Link>
            </nav>

            {/* Action CTAs */}
            <div className="flex items-center gap-3">
              <Link
                href="/r/enroll"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#175B47] hover:text-[#124938] px-3 py-1.5 rounded-lg border border-[#DEDCD3] bg-[#FFFEFA] hover:bg-[#ECEAE2] transition-colors shadow-sm"
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Resident Assistance</span>
              </Link>

              <Link
                href="/console/war-room"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFFEFA] bg-[#175B47] hover:bg-[#124938] px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <span>Open War Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Public Breadcrumb Bar */}
        <div className="bg-[#ECEAE2] border-b border-[#DEDCD3] py-2 px-4 text-xs font-mono text-[#58665F]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#175B47]">{breadcrumb.section}</span>
              <span className="text-[#7B847D]">/</span>
              <span className="text-[#192A24] font-bold">{breadcrumb.title}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>PayPal Sandbox Verified · Zero-Cost AI Active</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1">{children}</main>

        {/* Editorial Footer */}
        <footer className="bg-[#ECEAE2] border-t border-[#DEDCD3] py-12 px-4 sm:px-6 text-xs text-[#58665F]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#192A24]">LANDFALL</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#DEDCD3] text-[#192A24]">
                  FIELD ATLAS EDITION
                </span>
              </div>
              <p className="max-w-md text-[#58665F]">
                Anticipatory disaster relief powered by verified PayPal Sandbox payouts, NWS alerts, NOAA radar, and Groq zero-cost AI governance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 font-medium">
              <Link href="/console/war-room" className="hover:text-[#175B47]">
                War Room
              </Link>
              <Link href="/console/golden-flow" className="hover:text-[#175B47]">
                Golden Workflow
              </Link>
              <Link href="/console/sentinel" className="hover:text-[#175B47]">
                Sentinel Weather
              </Link>
              <Link href="/r/enroll" className="hover:text-[#175B47]">
                Resident Portal
              </Link>
              <Link href="/r/complaints" className="hover:text-[#175B47]">
                Grievances
              </Link>
              <Link href="/spike" className="hover:text-[#175B47]">
                Audit Ledger
              </Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // --- 2. RESIDENT EXPERIENCE SHELL (/r/*) ---
  if (experienceVariant === "RESIDENT") {
    const languages = [
      "English",
      "Español (Spanish)",
      "Kreyòl Ayisyen (Haitian Creole)",
      "Tiếng Việt (Vietnamese)",
      "简体中文 (Simplified Chinese)",
    ];

    return (
      <div className="min-h-screen bg-[#F4F2EC] text-[#192A24] flex flex-col font-sans selection:bg-[#E0EEE7] selection:text-[#175B47]">
        {/* Calm Resident Header */}
        <header className="sticky top-0 z-40 bg-[#FFFEFA] border-b border-[#DEDCD3] shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#175B47] text-[#FFFEFA] flex items-center justify-center font-bold text-sm">
                LF
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#192A24]">
                  Community Relief Assistance
                </span>
                <span className="text-[10px] text-[#58665F]">
                  Encrypted Resident Portal
                </span>
              </div>
            </Link>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DEDCD3] bg-[#FFFEFA] hover:bg-[#ECEAE2] text-xs font-semibold text-[#192A24] transition-colors"
                title="Select Language"
              >
                <Globe2 className="w-3.5 h-3.5 text-[#175B47]" />
                <span>{activeLanguage.split(" ")[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#58665F]" />
              </button>

              {languageMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-[#FFFEFA] border border-[#DEDCD3] rounded-xl shadow-xl py-1 z-50 text-xs">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setActiveLanguage(lang);
                        setLanguageMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-[#E0EEE7] transition-colors flex items-center justify-between ${
                        activeLanguage === lang ? "font-bold text-[#175B47] bg-[#E0EEE7]/50" : "text-[#192A24]"
                      }`}
                    >
                      <span>{lang}</span>
                      {activeLanguage === lang && <CheckCircle2 className="w-3.5 h-3.5 text-[#175B47]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Resident Breadcrumb */}
        <div className="bg-[#ECEAE2] border-b border-[#DEDCD3] py-2 px-4 text-xs font-mono text-[#58665F]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#175B47]">{breadcrumb.section}</span>
              <span className="text-[#7B847D]">/</span>
              <span className="text-[#192A24] font-bold">{breadcrumb.title}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <Link href="/r/enroll" className={`hover:text-[#175B47] ${pathname === "/r/enroll" ? "font-bold text-[#175B47]" : ""}`}>
                Enrollment
              </Link>
              <span>·</span>
              <Link href="/r/complaints" className={`hover:text-[#175B47] ${pathname === "/r/complaints" ? "font-bold text-[#175B47]" : ""}`}>
                Grievances
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 py-6 px-4">{children}</main>

        <footer className="bg-[#ECEAE2] border-t border-[#DEDCD3] py-6 px-4 text-center text-xs text-[#58665F]">
          <div className="max-w-md mx-auto space-y-1">
            <p>Your information is encrypted with bank-grade AES-256 protection.</p>
            <p className="text-[11px] text-[#7B847D]">
              Need help? Contact the community response coordinator or submit a grievance review.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // --- 3. OPERATIONS EXPERIENCE SHELL (/console/*, /spike) ---
  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#192A24] flex font-sans selection:bg-[#E0EEE7] selection:text-[#175B47]">
      {/* COMPACT COLLAPSIBLE LEFT SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col bg-[#FFFEFA] border-r border-[#DEDCD3] transition-all duration-300 z-30 ${
          sidebarCollapsed ? "w-[68px]" : "w-[244px]"
        }`}
      >
        {/* Sidebar Header with Brand & Collapse Toggle */}
        <div className="h-16 border-b border-[#DEDCD3] px-3.5 flex items-center justify-between">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#175B47] text-[#FFFEFA] flex items-center justify-center font-bold text-xs tracking-wider shadow-sm">
                LF
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight text-[#192A24]">
                  LANDFALL
                </span>
                <span className="text-[9px] uppercase font-mono tracking-wider text-[#58665F]">
                  Operations Desk
                </span>
              </div>
            </Link>
          )}

          {sidebarCollapsed && (
            <Link href="/" className="mx-auto">
              <div className="w-7 h-7 rounded-lg bg-[#175B47] text-[#FFFEFA] flex items-center justify-center font-bold text-xs">
                LF
              </div>
            </Link>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2] transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {/* Section: COMMAND */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#7B847D] font-bold">
                Command & Execution
              </div>
            )}
            {OPERATIONS_NAV_ITEMS.filter((item) => item.section === "COMMAND").map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#E0EEE7] text-[#175B47] shadow-sm font-bold"
                      : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
                  } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#175B47]" : "text-[#58665F]"}`} />
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FFFEFA] border border-[#DEDCD3] text-[#58665F]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Section: AUDIT & INTELLIGENCE */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#7B847D] font-bold">
                Intelligence & Audit
              </div>
            )}
            {OPERATIONS_NAV_ITEMS.filter((item) => item.section === "AUDIT").map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#E0EEE7] text-[#175B47] shadow-sm font-bold"
                      : "text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2]"
                  } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#175B47]" : "text-[#58665F]"}`} />
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FFFEFA] border border-[#DEDCD3] text-[#58665F]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Public & Resident Quick Access */}
          <div className="space-y-1 pt-3 border-t border-[#DEDCD3]">
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#7B847D] font-bold">
                External Surfaces
              </div>
            )}
            <Link
              href="/"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2] transition-colors ${
                sidebarCollapsed ? "justify-center px-0" : ""
              }`}
              title="Public Overview"
            >
              <Compass className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Public Overview</span>}
            </Link>
            <Link
              href="/r/enroll"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#58665F] hover:text-[#192A24] hover:bg-[#ECEAE2] transition-colors ${
                sidebarCollapsed ? "justify-center px-0" : ""
              }`}
              title="Resident Portal"
            >
              <HeartHandshake className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Resident Portal</span>}
            </Link>
          </div>
        </div>

        {/* Sidebar Footer: Provider Verification Badge */}
        <div className="p-3 border-t border-[#DEDCD3] bg-[#ECEAE2]/60">
          {!sidebarCollapsed ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#175B47]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>SANDBOX VERIFIED</span>
              </div>
              <div className="text-[10px] text-[#58665F] leading-tight font-mono">
                PayPal Payouts · Groq AI ($0)
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="PayPal Sandbox Verified">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            </div>
          )}
        </div>
      </aside>

      {/* MAIN OPERATIONAL WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* RESTRAINED CONTEXTUAL TOOLBAR */}
        <header className="sticky top-0 z-30 bg-[#FFFEFA]/95 backdrop-blur-md border-b border-[#DEDCD3] h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Breadcrumb Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#DEDCD3] text-[#58665F] hover:bg-[#ECEAE2]"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-xs text-[#58665F]">
                <span>{breadcrumb.section}</span>
                <span className="text-[#7B847D]">/</span>
                <span className="font-bold text-[#192A24]">{breadcrumb.title}</span>
              </div>
              <span className="text-[11px] text-[#7B847D] font-mono hidden sm:inline">
                {breadcrumb.subtitle}
              </span>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Environment Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-[#E0EEE7] text-[#175B47] border border-[#97D5B2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#175B47] animate-pulse" />
              <span>SANDBOX</span>
            </div>

            {/* Quick Navigation to Golden Flow */}
            <Link
              href="/console/golden-flow"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#DEDCD3] bg-[#FFFEFA] hover:bg-[#ECEAE2] text-[#192A24] transition-colors shadow-sm"
            >
              <Activity className="w-3.5 h-3.5 text-[#175B47]" />
              <span className="hidden sm:inline">Golden Pipeline</span>
            </Link>

            {/* Rehearsal Link */}
            <Link
              href="/console/rehearsal"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#175B47] hover:bg-[#124938] text-[#FFFEFA] transition-colors shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Drill</span>
            </Link>
          </div>
        </header>

        {/* Operational Breadcrumb Telemetry Bar */}
        <div className="bg-[#ECEAE2] border-b border-[#DEDCD3] py-1.5 px-4 sm:px-6 text-xs font-mono text-[#58665F]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                PayPal Sandbox API: Active
              </span>
              <span className="text-[#DEDCD3]">|</span>
              <span className="text-[#58665F]">
                NWS Alert Ingestion: <span className="text-[#192A24] font-semibold">Live (v1.12)</span>
              </span>
              <span className="text-[#DEDCD3] hidden md:inline">|</span>
              <span className="text-[#58665F] hidden md:inline">
                AI Investigator: <span className="text-[#175B47] font-semibold">Groq Free Tier ($0.00)</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#7B847D]">
              <Clock className="w-3 h-3 text-[#7B847D]" />
              <span>Last Sync: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* MOBILE OPERATIONS NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-[#FFFEFA] border-r border-[#DEDCD3] flex flex-col p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEDCD3]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#175B47] text-[#FFFEFA] flex items-center justify-center font-bold text-xs">
                  LF
                </div>
                <span className="font-bold text-sm text-[#192A24]">Landfall Operations</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-[#58665F] hover:bg-[#ECEAE2]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {OPERATIONS_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                      isActive
                        ? "bg-[#E0EEE7] text-[#175B47] font-bold"
                        : "text-[#58665F] hover:bg-[#ECEAE2]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-3 border-t border-[#DEDCD3]">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#58665F] hover:bg-[#ECEAE2]"
                >
                  <Compass className="w-4 h-4" />
                  <span>Public Overview</span>
                </Link>
                <Link
                  href="/r/enroll"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#58665F] hover:bg-[#ECEAE2]"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Resident Portal</span>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
