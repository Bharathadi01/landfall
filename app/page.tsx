"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { I } from "@/components/icons";
import { StormRadarHero } from "@/components/landing/StormRadarHero";
import { CountUp } from "@/components/motion/CountUp";
import { CASE_SUMMARY } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";
import { IconTile, Chip, type Tone } from "@/components/ui/primitives";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEPS: { icon: any; tone: Tone; who: string; title: string; body: string }[] = [
  { icon: I.stormEye, tone: "storm", who: "NOAA · NWS", title: "Warn", body: "An official hurricane warning maps every enrolled home inside the storm’s path." },
  { icon: I.balance, tone: "accent", who: "Policy engine", title: "Decide", body: "Fixed rules — not AI — set who is paid and how much. Medical-device homes first." },
  { icon: I.aiAdvisor, tone: "ai", who: "AI Watch Officer", title: "Check", body: "AI challenges the plan for duplicates and shortfalls. It can read; it cannot pay." },
  { icon: I.twoKeyApproval, tone: "amber", who: "Two people", title: "Approve", body: "A coordinator and a finance officer each sign with a passkey. One isn’t enough." },
  { icon: I.send, tone: "paypal", who: "PayPal", title: "Pay & prove", body: "PayPal Payouts sends the cash. Webhooks and a double-entry ledger prove every cent." },
];

const PAYPAL_APIS = [
  { icon: I.donation, name: "Orders v2", role: "Donations in" },
  { icon: I.send, name: "Payouts", role: "Relief out, idempotent" },
  { icon: I.webhook, name: "Webhooks", role: "Signed status updates" },
  { icon: I.treasury, name: "Reporting", role: "Ledger reconciliation" },
  { icon: I.repeat, name: "Subscriptions", role: "Monthly sustainers" },
];

export default function HomePage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-chip", { y: 12, autoAlpha: 0, duration: 0.8 })
        .from(".hero-line", { yPercent: 110, duration: 1.1, stagger: 0.09 }, "-=0.5")
        .from(".hero-sub", { y: 16, autoAlpha: 0, filter: "blur(6px)", duration: 0.9 }, "-=0.7")
        .from(".hero-cta > *", { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, "-=0.6")
        .from(".hero-trust > *", { autoAlpha: 0, duration: 0.6, stagger: 0.06 }, "-=0.4")
        .from(".hero-visual", { scale: 0.92, autoAlpha: 0, duration: 1.4 }, 0.2);

      // Draw the connector through the five steps as you scroll.
      gsap.fromTo(
        ".steps-line",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: ".steps-wrap", start: "top 75%", end: "bottom 60%", scrub: 0.6 },
        }
      );
    },
    { scope: root }
  );

  return (
    <div ref={root} className="overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative mx-auto grid min-h-[100svh] max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-32 lg:grid-cols-[1.08fr_1fr] lg:gap-6 lg:pt-28">
        <div className="relative z-10 space-y-8">
          <div className="hero-chip inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-[12.5px] text-ink-2 backdrop-blur">
            <span className="rounded-full bg-paypal/15 px-2 py-0.5 text-[11px] font-semibold text-paypal">PayPal AI Hackathon</span>
            Anticipatory cash relief · open source
          </div>

          <h1 className="text-hero text-ink">
            <span className="block overflow-hidden pb-1"><span className="hero-line block">Relief that lands</span></span>
            <span className="block overflow-hidden pb-3">
              <span className="hero-line block font-accent font-normal italic text-gradient-relief" style={{ letterSpacing: "-0.02em" }}>
                before the storm.
              </span>
            </span>
          </h1>

          <p className="hero-sub max-w-xl text-body-large text-ink-2">
            When a hurricane warning is issued, Landfall turns it into cash for the families in its path —
            decided by rules, checked by AI, approved by two people, and paid through PayPal{" "}
            <span className="text-ink">hours before landfall, not months after.</span>
          </p>

          <div className="hero-cta flex flex-wrap items-center gap-3">
            <Link href="/console/golden-flow" className="field-btn field-btn-primary px-6 py-4 text-[15px]">
              <I.playCircle className="h-5 w-5" />
              Watch a live response
            </Link>
            <Link href="/console/war-room" className="field-btn field-btn-secondary px-6 py-4 text-[15px]">
              Open Command Center
              <I.arrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="hero-trust flex flex-wrap items-center gap-x-6 gap-y-3 pt-2 text-[13px] text-ink-3">
            <span className="flex items-center gap-2"><I.verified className="h-4 w-4 text-paypal" /> Verified on PayPal Sandbox</span>
            <span className="flex items-center gap-2"><I.twoKeyApproval className="h-4 w-4 text-amber" /> Two-person passkey approval</span>
            <span className="flex items-center gap-2"><I.readOnly className="h-4 w-4 text-ai" /> AI can’t move money</span>
          </div>
        </div>

        <div className="hero-visual relative flex justify-center lg:justify-end">
          <StormRadarHero />
        </div>
      </section>

      {/* ── THE GAP ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="glass p-6 md:col-span-2" data-reveal>
            <div className="eyebrow text-storm">The problem</div>
            <p className="mt-4 text-title-2 text-ink">
              Disaster aid usually arrives <span className="text-storm">60–90 days</span> after the storm. Families need it{" "}
              <span className="font-accent italic font-normal text-accent-strong">before</span> — for fuel, medicine and a way out.
            </p>
          </div>
          <div className="glass p-6" data-reveal>
            <div className="eyebrow">Reaches families</div>
            <div className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em] text-accent-strong">
              <CountUp value={99.75} decimals={2} suffix="%" />
            </div>
            <p className="mt-3 text-[13px] text-ink-3">of every $100 grant. PayPal’s flat $0.25 domestic payout fee is the only cost.</p>
          </div>
          <div className="glass p-6" data-reveal>
            <div className="eyebrow">AI inference cost</div>
            <div className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.04em] text-ai">
              $<CountUp value={0} decimals={2} />
            </div>
            <p className="mt-3 text-[13px] text-ink-3">Groq free tier with a deterministic offline fallback. Small funds can afford it.</p>
          </div>
        </div>
      </section>

      {/* ── DELIVERY ASSURANCE ───────────────────────────── */}
      <section id="assurance" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <div className="glass-strong relative overflow-hidden p-8 md:p-12" data-reveal="scale">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-paypal/15 blur-[100px]" aria-hidden />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="eyebrow text-accent-strong">Beyond “paid”</div>
            <h2 className="mt-4 text-title-1 text-ink">
              PayPal says <span className="font-mono text-paypal">SUCCESS</span>.{" "}
              <span className="font-accent italic font-normal text-ink-2">Did the family get it?</span>
            </h2>
            <p className="mt-4 text-body-base text-ink-2">
              A PayPal payout marked SUCCESS means the money was credited to an account — not that a household can reach it, use it, or
              even knows it’s there. Landfall follows every payment, case by case, and keeps each fact apart with who reported it.
            </p>
          </div>

          <ol className="relative mt-10 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {[
              ["Approved", "Two people approved the plan", "Landfall"],
              ["Sent to PayPal", "It’s in a Payouts batch", "Landfall"],
              ["Credited by PayPal", "Provider status SUCCESS", "PayPal"],
              ["Resident confirmed", "The household says they have it", "Resident-reported"],
              ["Closed", "Credited, confirmed, nothing open", "Operator"],
            ].map(([t, d, who], i) => (
              <li key={t} className={`rounded-2xl border p-4 ${i === 3 ? "border-accent/35 bg-accent/[0.07]" : "border-white/[0.08] bg-white/[0.025]"}`}>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">0{i + 1}</div>
                <div className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-ink">{t}</div>
                <div className="mt-1 text-[12.5px] text-ink-3">{d}</div>
                <div className="mt-3 text-[10.5px] font-mono uppercase tracking-wide text-ink-2">{who}</div>
              </li>
            ))}
          </ol>

          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[13px] text-ink-2">
            <span>
              In the Milton replay: <span className="tabular text-paypal">{CASE_SUMMARY.creditedCount}</span> credited by PayPal,{" "}
              <span className="tabular text-accent-strong">{CASE_SUMMARY.confirmedCount}</span> confirmed by the household.
            </span>
            <Link href="/console/war-room" className="inline-flex items-center gap-1 text-accent-strong hover:underline">
              See the cases <I.arrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <div className="eyebrow text-accent-strong">How it works</div>
          <h2 className="mt-4 text-title-1 text-ink">
            From warning to wallet in <span className="font-accent italic font-normal text-ink-2">five steps.</span>
          </h2>
          <p className="mt-4 text-body-base text-ink-2">Every step is visible, every decision is explainable, and no single person — or model — can move money alone.</p>
        </div>

        <div className="steps-wrap relative mt-14">
          <div className="absolute left-[10%] right-[10%] top-[38px] hidden h-px bg-white/[0.06] lg:block" aria-hidden />
          <div
            className="steps-line absolute left-[10%] right-[10%] top-[38px] hidden h-px origin-left lg:block"
            style={{ background: "linear-gradient(90deg, rgb(var(--c-storm)), rgb(var(--c-accent)), rgb(var(--c-ai)), rgb(var(--c-amber)), rgb(var(--c-paypal)))" }}
            aria-hidden
          />
          <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass card-hover p-5" data-reveal>
                <div className="flex items-center justify-between">
                  <IconTile icon={s.icon} tone={s.tone} size="lg" />
                  <span className="font-mono text-[11px] text-ink-3">0{i + 1}</span>
                </div>
                <div className="mt-5 text-[11px] font-mono uppercase tracking-[0.12em] text-ink-3">{s.who}</div>
                <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-ink">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── PAYPAL ───────────────────────────────────────── */}
      <section id="paypal" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6" data-reveal>
            <div className="eyebrow text-paypal">Built on PayPal, end to end</div>
            <h2 className="text-title-1 text-ink">
              Donations in. Relief out.{" "}
              <span className="font-accent italic font-normal text-ink-2">Every cent accounted for.</span>
            </h2>
            <p className="max-w-xl text-body-base text-ink-2">
              Five PayPal APIs carry the money from a donor’s checkout to a family’s wallet — and back into a double-entry ledger that
              reconciles against PayPal’s own records.
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PAYPAL_APIS.map((a) => (
                <div key={a.name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                  <IconTile icon={a.icon} tone="paypal" size="sm" />
                  <div>
                    <div className="text-[13.5px] font-semibold text-ink">{a.name}</div>
                    <div className="text-[12px] text-ink-3">{a.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DonationCard />
        </div>
      </section>

      {/* ── AG STUDIO ────────────────────────────────────── */}
      <section id="studio" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <div className="glass-strong relative overflow-hidden p-8 md:p-12" data-reveal="scale">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-paypal/20 blur-[100px]" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-accent/10 blur-[100px]" aria-hidden />
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <IconTile icon={I.chart} tone="paypal" size="sm" />
                <span className="eyebrow text-paypal">Analytics Studio · powered by AG Studio</span>
              </div>
              <h2 className="text-title-1 text-ink">
                Ask the relief data <span className="font-accent italic font-normal text-ink-2">anything.</span>
              </h2>
              <p className="text-body-base text-ink-2">
                Coordinators answer “can we pay everyone?” in one glance. Filter by priority, and every chart follows. Ask the Studio
                agent in plain English — it can rearrange the board, never the money.
              </p>
              <ul className="space-y-2.5 text-[14px] text-ink-2">
                {[
                  [I.palette, "Landfall theme across canvas, widgets, grids & charts"],
                  [I.widget, "Custom “Relief Solvency” widget on Studio’s data engine"],
                  [I.aiAdvisor, "Studio Agent Framework with relief-specific prompts"],
                ].map(([Icon, t]: any) => (
                  <li key={t} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-paypal" strokeWidth={1.75} />
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/console/studio" className="field-btn field-btn-secondary">
                Open Analytics Studio <I.arrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <StudioPreview />
          </div>
        </div>
      </section>

      {/* ── SAFETY ───────────────────────────────────────── */}
      <section id="safety" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <div className="eyebrow text-ai">Safety by design</div>
          <h2 className="mt-4 text-title-1 text-ink">
            Code decides. AI advises. <span className="font-accent italic font-normal text-ink-2">Humans approve.</span>
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: I.balance, tone: "accent" as Tone, t: "Rules decide money", b: "Eligibility and amounts come from a tested policy engine. AI never sets either." },
            { icon: I.readOnly, tone: "ai" as Tone, t: "AI can’t move money", b: "The AI has no write tools. Payment code can’t even import an AI SDK — enforced in CI." },
            { icon: I.twoKeyApproval, tone: "amber" as Tone, t: "Two keys, one plan", b: "Two different people sign the exact plan hash. Change one number and both must sign again." },
          ].map((c) => (
            <div key={c.t} className="glass card-hover p-6" data-reveal>
              <IconTile icon={c.icon} tone={c.tone} size="lg" />
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em] text-ink">{c.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{c.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-ink-3" data-reveal>
          <I.database className="h-4 w-4" /> Database truth overrides model output — any number an AI writes is checked against the ledger.
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-28 pt-10">
        <div className="glass-strong relative overflow-hidden px-8 py-14 text-center md:px-16" data-reveal="scale">
          <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[36rem] rounded-full bg-accent/15 blur-[110px]" aria-hidden />
          <h2 className="relative text-title-1 text-ink">
            See a full response, <span className="font-accent italic font-normal text-accent-strong">start to finish.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-body-base text-ink-2">
            Replay Hurricane Milton: warning, decision, AI check, two approvals and a real PayPal Sandbox payout — in under a minute.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/console/golden-flow" className="field-btn field-btn-primary px-6 py-4 text-[15px]">
              <I.playCircle className="h-5 w-5" /> Run the guided response
            </Link>
            <Link href="/r/enroll" className="field-btn field-btn-secondary px-6 py-4 text-[15px]">
              <I.household className="h-4 w-4" /> I’m a resident
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Donation (PayPal Orders v2, sandbox) ──────────────── */

function DonationCard() {
  const [amount, setAmount] = useState("50.00");
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const presets = ["25.00", "50.00", "100.00", "250.00"];
  const value = custom ? parseFloat(custom || "0").toFixed(2) : amount;

  const donate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/donations/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: value, fundId: "fund_tbw_001" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.amountUsd?._errors?.[0] || data.error || "Failed to create order");
      setSuccess({ orderId: data.orderId, status: data.status, amount: value });
    } catch (e: any) {
      setError(e.message || "Failed to process sandbox donation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-strong relative p-6 sm:p-7" data-reveal="scale">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={I.donation} tone="money" />
          <div>
            <div className="text-[15px] font-semibold text-ink">Fund the next storm</div>
            <div className="text-[12.5px] text-ink-3">Tampa Bay Relief Fund</div>
          </div>
        </div>
        <Chip tone="paypal">Sandbox</Chip>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {presets.map((p) => {
          const on = amount === p && !custom;
          return (
            <button
              key={p}
              type="button"
              onClick={() => { setAmount(p); setCustom(""); }}
              className={`rounded-xl border py-3 text-[14px] font-semibold tabular transition-all ${
                on ? "border-accent/60 bg-accent/15 text-accent-strong shadow-[0_0_0_4px_rgb(var(--c-accent)/0.08)]" : "border-white/10 bg-white/[0.03] text-ink hover:bg-white/[0.06]"
              }`}
            >
              ${parseFloat(p).toFixed(0)}
            </button>
          );
        })}
      </div>
      <input
        type="number"
        step="0.01"
        min="1.00"
        placeholder="Other amount"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        className="field-input mt-2"
        aria-label="Custom donation amount in USD"
      />

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-[12.5px] text-ink-2">
        <div className="flex justify-between"><span>Your gift</span><span className="tabular text-ink">${value}</span></div>
        <div className="mt-1.5 flex justify-between"><span>Protected reserve floor enforced</span><I.reserve className="h-4 w-4 text-amber" /></div>
        <div className="mt-1.5 flex justify-between"><span>Paid out only after a warning + two approvals</span><I.done className="h-4 w-4 text-accent-strong" /></div>
      </div>

      <button onClick={donate} disabled={loading} className="field-btn field-btn-paypal mt-5 w-full py-4 text-[15px]">
        {loading ? "Creating PayPal order…" : `Donate $${value} with PayPal`}
      </button>

      {success && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3.5 text-[12.5px] animate-field-fade">
          <div className="flex items-center gap-2 font-semibold text-accent-strong">
            <I.done className="h-4 w-4" /> Order created · {success.orderId}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-ink-3">${success.amount} USD · {success.status}</div>
        </div>
      )}
      {error && <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-[12.5px] text-danger animate-field-fade">{error}</div>}

      <div className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-ink-3">
        <I.api className="h-3.5 w-3.5" /> PayPal Orders v2 · POST /v2/checkout/orders
      </div>
    </div>
  );
}

/* ── Studio preview (static, mirrors the live board) ───── */

function StudioPreview() {
  const bars = [
    { l: "Available", v: TREASURY.allocatable, c: "bg-accent" },
    { l: "Reserve", v: TREASURY.reserve, c: "bg-amber" },
    { l: "Sent", v: TREASURY.paidOut + TREASURY.inFlight, c: "bg-paypal" },
  ];
  const biggest = Math.max(...bars.map((b) => b.v));
  const coverage = TREASURY.needsReissue > 0 ? (Math.round((TREASURY.allocatable / TREASURY.needsReissue) * 10) / 10).toFixed(1) : "—";
  return (
    <Link href="/console/studio" className="group relative block rounded-2xl border border-white/10 bg-canvas/70 p-3 shadow-2xl transition-transform duration-500 hover:-translate-y-1">
      <div className="flex items-center gap-1.5 px-1 pb-3">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-white/10" />)}
        <span className="ml-2 text-[11px] text-ink-3">Relief board · AG Studio</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Households", String(CASE_SUMMARY.households), "text-ink"],
          ["Unresolved", `$${CASE_SUMMARY.unresolvedUsd.toLocaleString("en-US")}`, "text-ink"],
          ["Reserve", `$${TREASURY.reserve.toLocaleString("en-US")}`, "text-amber"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-white/[0.06] bg-surface-2/70 p-3">
            <div className="text-[10.5px] text-ink-3">{k}</div>
            <div className={`mt-1 text-[20px] font-semibold tracking-[-0.03em] ${c}`}>{v}</div>
          </div>
        ))}
        <div className="col-span-2 rounded-xl border border-white/[0.06] bg-surface-2/70 p-3">
          <div className="text-[11px] font-medium text-ink">Where the money sits</div>
          <div className="mt-3 space-y-2">
            {bars.map((b) => (
              <div key={b.l} className="flex items-center gap-2">
                <span className="w-16 text-[10.5px] text-ink-3">{b.l}</span>
                <span className={`h-3 rounded ${b.c}`} style={{ width: `${Math.max(3, (b.v / biggest) * 100)}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-surface-2/70 p-3">
          <svg width="74" height="74" viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
            <circle cx="37" cy="37" r="28" stroke="#2DD4BF" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="176 176" transform="rotate(-90 37 37)" />
            <text x="37" y="42" textAnchor="middle" fill="#EEF2F8" fontSize="14" fontWeight="600">{coverage}×</text>
          </svg>
          <div className="mt-1 text-[10px] text-ink-3">Can we pay everyone?</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 transition group-hover:ring-paypal/30" />
    </Link>
  );
}
