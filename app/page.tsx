"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { I } from "@/components/icons";
import { StormDesk } from "@/components/sentinel/desk/StormDesk";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CASE_SUMMARY } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";
import { COMMUNITY_FUNDS_GEO } from "@/lib/sentinel/weather-client";
import { IconTile, Chip, type Tone } from "@/components/ui/primitives";

gsap.registerPlugin(useGSAP);

const STEPS: { icon: any; tone: Tone; who: string; title: string; body: string }[] = [
  { icon: I.stormEye, tone: "storm", who: "NOAA · NWS", title: "Warn", body: "An official hurricane warning maps every enrolled home inside the storm’s path." },
  { icon: I.balance, tone: "money", who: "Policy engine", title: "Decide", body: "Fixed rules — not AI — set who is paid and how much. Medical-device homes first." },
  { icon: I.aiAdvisor, tone: "ai", who: "AI Watch Officer", title: "Check", body: "AI challenges the plan for duplicates and shortfalls. It can read; it cannot pay." },
  { icon: I.twoKeyApproval, tone: "amber", who: "Two people", title: "Approve", body: "A coordinator and a finance officer each sign with a passkey. One isn’t enough." },
  { icon: I.payout, tone: "paypal", who: "PayPal", title: "Pay & prove", body: "PayPal Payouts sends the cash. Webhooks and a double-entry ledger prove every cent." },
];

const PAYPAL_APIS = [
  { icon: I.donation, name: "Orders v2", role: "Donations in" },
  { icon: I.payout, name: "Payouts", role: "Relief out, idempotent" },
  { icon: I.webhook, name: "Webhooks", role: "Signed status updates" },
  { icon: I.ledger, name: "Reporting", role: "Ledger reconciliation" },
  { icon: I.repeat, name: "Subscriptions", role: "Monthly sustainers" },
];


/** One "artifact" per story step — what you would actually see on screen at that moment. */
export default function HomePage() {
  const root = useRef<HTMLDivElement>(null);
  const fund = COMMUNITY_FUNDS_GEO[0];

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      // hero intro
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-chip", { y: 12, autoAlpha: 0, duration: 0.8 })
        .from(".hero-line", { yPercent: 115, duration: 1.2, stagger: 0.1 }, "-=0.5")
        .from(".hero-sub", { y: 16, autoAlpha: 0, filter: "blur(6px)", duration: 0.9 }, "-=0.8")
        .from(".hero-cta > *", { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, "-=0.6");
    },
    { scope: root }
  );

  return (
    <div ref={root} className="overflow-x-hidden">
      {/* ── HERO: the live globe is the background ─────────── */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-y-0 right-[-8%] w-[88%] lg:w-[78%]">
            <StormDesk variant="hero" fund={fund} alerts={[]} clusters={null} className="!h-full !rounded-none !border-0 !bg-transparent" />
          </div>
          <div className="absolute inset-0 bg-canvas/55 lg:hidden" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_10_12)_0%,rgb(10_10_12/0.92)_34%,rgb(10_10_12/0.35)_62%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-canvas to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-28 pt-32">
          <div className="max-w-3xl space-y-8">
            <div className="hero-chip flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className="text-[13px] text-ink-2">PayPal AI Hackathon · anticipatory cash relief · open source</span>
            </div>

            <h1 className="text-hero text-ink">
              <span className="block overflow-hidden pb-1"><span className="hero-line block">Relief that lands</span></span>
              <span className="block overflow-hidden pb-4">
                <span className="hero-line block text-ink-2">before the storm.</span>
              </span>
            </h1>

            <p className="hero-sub max-w-xl text-body-large text-ink-2">
              When a hurricane warning is issued, Landfall turns it into cash for the families in its path —
              decided by rules, checked by AI, approved by two people, paid through PayPal{" "}
              <span className="text-ink">hours before landfall, not months after.</span>
            </p>

            <div className="hero-cta flex flex-wrap items-center gap-3">
              <Button href="/console/golden-flow" variant="signal" size="lg">
                Watch a live response
              </Button>
              <Button href="/console/sentinel" variant="glass" size="lg">
                Open the storm desk
              </Button>
            </div>
          </div>

        </div>

      </section>

      {/* ── THE GAP ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid grid-cols-1 gap-4">
          <div className="p-2 md:max-w-4xl" data-reveal>
            <div className="eyebrow">The problem</div>
            <p className="mt-5 text-title-2 text-ink">
              Disaster aid can arrive <span className="text-storm">weeks or months</span> after the storm. Families need it{" "}
              <span className="text-ink">before</span> — for fuel, medicine and a way out.
            </p>
          </div>
        </div>

        {/* Evidence for why the "did it actually reach them?" problem is real. Each item links to its source. */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3" data-reveal>
          {[
            {
              k: "4.2%",
              t: "of US households (about 5.6 million) were unbanked in 2023; two-thirds of them rely entirely on cash. A payment “credited” to an account is not the same as help they can use.",
              src: "FDIC National Survey of Unbanked and Underbanked Households, 2023",
              href: "https://fdic.gov/household-survey/2023-fdic-national-survey-unbanked-and-underbanked-households-executive-summary",
            },
            {
              k: "Lowest",
              t: "scoring of the nine Core Humanitarian Standard commitments is Commitment 5: letting people safely report concerns and get them addressed. Funds rarely close the loop on whether aid arrived.",
              src: "CHS Alliance verification data and Humanitarian Accountability Report",
              href: "https://www.chsalliance.org/get-support/article/meeting-chs-commitment-5-five-best-practice-tips-when-responding-to-complaints/",
            },
            {
              k: "939",
              t: "applicants failed ID checks in one AI-triggered cash programme in Nigeria, and others were excluded for lacking a charged phone. AI that decides without an answer loop can leave the most vulnerable behind.",
              src: "The New Humanitarian, 31 Aug 2026",
              href: "https://www.thenewhumanitarian.org/investigations/2026/08/31/givedirectlys-ai-experiment-left-vulnerable-flood-victims-behind-nigeria",
            },
          ].map((e) => (
            <figure key={e.k} className="glass p-6">
              <div className="font-serif text-[38px] leading-none tracking-[-0.03em] text-ink">{e.k}</div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{e.t}</p>
              <figcaption className="mt-3 text-[12px] text-ink-3">
                Source: <a href={e.href} target="_blank" rel="noreferrer" className="text-accent-strong underline underline-offset-2">{e.src}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS: pinned story ───────────────────── */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-8">
          <SectionHeading eyebrow="How it works" title="From warning to wallet in" accent="five steps." description="Every step is visible, every decision is explainable, and no single person — or model — can move money alone." />
        </div>

        <ol className="mx-auto max-w-5xl divide-y divide-line border-y border-line px-6">
          {STEPS.map((st, i) => (
            <li key={st.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-1 py-6 sm:grid-cols-[3rem_10rem_1fr] sm:items-baseline" data-reveal>
              <span className="font-mono text-[12px] text-ink-3 tabular">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-serif text-[28px] leading-none tracking-[-0.02em] text-ink">{st.title}</h3>
              <p className="col-span-2 text-[15px] leading-relaxed text-ink-2 sm:col-span-1">
                <span className="text-ink-3">{st.who}.</span> {st.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── DELIVERY ASSURANCE ───────────────────────────── */}
      <section id="assurance" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-24">
        <div className="glass-strong relative overflow-hidden p-8 md:p-12" data-reveal="scale">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-paypal/15 blur-[100px]" aria-hidden />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="eyebrow text-delivered">Beyond “paid”</div>
            <h2 className="mt-4 text-title-1 text-ink">
              PayPal says <span className="font-mono text-[0.8em] text-paypal">SUCCESS</span>.{" "}
              <span className="text-ink-2">Did the family get it?</span>
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
              <li key={t} className={`rounded-2xl border p-4 ${i === 3 ? "border-delivered/35 bg-delivered/[0.07]" : "border-white/[0.08] bg-white/[0.025]"}`}>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">0{i + 1}</div>
                <div className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-ink">{t}</div>
                <div className="mt-1 text-[12.5px] text-ink-3">{d}</div>
                <div className="mt-3 font-mono text-[10.5px] uppercase tracking-wide text-ink-2">{who}</div>
              </li>
            ))}
          </ol>

          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-ink-2">
            <span>
              In the Milton replay: <span className="tabular text-paypal">{CASE_SUMMARY.creditedCount}</span> credited by PayPal,{" "}
              <span className="tabular text-delivered">{CASE_SUMMARY.confirmedCount}</span> confirmed by the household.
            </span>
            <Button href="/console/war-room" variant="ghost" size="sm" trailing={<I.arrowUpRight className="h-3.5 w-3.5" />}>See the cases</Button>
          </div>
        </div>
      </section>

      {/* ── PAYPAL ───────────────────────────────────────── */}
      <section id="paypal" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <SectionHeading eyebrow="Built on PayPal, end to end" tone="paypal" title="Donations in. Relief out." accent="Every cent accounted for." description="Five PayPal APIs carry the money from a donor’s checkout to a family’s wallet — and back into a double-entry ledger that reconciles against PayPal’s own records." />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" data-reveal>
              {PAYPAL_APIS.map((a) => (
                <div key={a.name} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
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
      <section id="studio" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-24">
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
                Ask the relief data <span className="text-ink-2">anything.</span>
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
                    <Icon className="h-4 w-4 shrink-0 text-paypal" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button href="/console/studio" variant="glass" trailing={<I.arrowUpRight className="h-4 w-4" />}>Open Analytics Studio</Button>
                <Button href="/console/war-room" variant="ghost" trailing={<I.arrowRight className="h-4 w-4" />}>See the case grid</Button>
              </div>
            </div>
            <StudioPreview />
          </div>
        </div>
      </section>

      {/* ── SAFETY ───────────────────────────────────────── */}
      <section id="safety" className="mx-auto max-w-7xl scroll-mt-28 px-6 py-24">
        <SectionHeading align="center" tone="ai" eyebrow="Safety by design" title="Code decides. AI advises." accent="Humans approve." />
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: I.balance, tone: "money" as Tone, t: "Rules decide money", b: "Eligibility and amounts come from a tested policy engine. AI never sets either." },
            { icon: I.readOnly, tone: "ai" as Tone, t: "AI can’t move money", b: "The AI has no write tools. Payment code can’t even import an AI SDK — enforced in CI." },
            { icon: I.twoKeyApproval, tone: "amber" as Tone, t: "Two keys, one plan", b: "Two different people sign the exact plan hash. Change one number and both must sign again." },
          ].map((c) => (
            <div key={c.t} className="glass card-hover p-7" data-reveal>
              <IconTile icon={c.icon} tone={c.tone} size="lg" />
              <h3 className="mt-5 font-serif text-[26px] leading-tight tracking-[-0.025em] text-ink">{c.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{c.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-ink-3" data-reveal>
          <I.database className="h-4 w-4" /> Database truth overrides model output — any number an AI writes is checked against the ledger.
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-28 pt-10">
        <div className="glass-strong relative overflow-hidden px-8 py-16 text-center md:px-16" data-reveal="scale">
          <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[36rem] rounded-full bg-accent/20 blur-[110px]" aria-hidden />
          <h2 className="relative text-title-1 text-ink">
            See a full response, <span className="text-ink-2">start to finish.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-body-base text-ink-2">
            Replay Hurricane Milton: warning, decision, AI check, two approvals and a real PayPal Sandbox payout — in under a minute.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/console/golden-flow" variant="signal" size="lg">Run the guided response</Button>
            <Button href="/r/enroll" variant="glass" size="lg" leading={<I.household className="h-4 w-4" />}>I’m a resident</Button>
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
                on ? "border-money/60 bg-money/15 text-money shadow-[0_0_0_4px_rgb(var(--c-money)/0.08)]" : "border-white/10 bg-white/[0.03] text-ink hover:bg-white/[0.06]"
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
        <div className="mt-4 rounded-xl border border-delivered/30 bg-delivered/10 p-3.5 text-[12.5px] animate-field-fade">
          <div className="flex items-center gap-2 font-semibold text-delivered">
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
    { l: "Available", v: TREASURY.allocatable, c: "bg-money" },
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
            <circle cx="37" cy="37" r="28" stroke="#6FD49A" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="176 176" transform="rotate(-90 37 37)" />
            <text x="37" y="42" textAnchor="middle" fill="#F3EFE8" fontSize="14" fontWeight="600">{coverage}×</text>
          </svg>
          <div className="mt-1 text-[10px] text-ink-3">Can we pay everyone?</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 transition group-hover:ring-paypal/30" />
    </Link>
  );
}
