"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { I } from "@/components/icons";
import { StormDesk } from "@/components/sentinel/desk/StormDesk";
import { Button } from "@/components/ui/Button";
import { PayPalCheckout } from "@/components/donate/PayPalCheckout";
import { PayPalSubscribe } from "@/components/donate/PayPalSubscribe";
import { CASE_SUMMARY } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";
import { COMMUNITY_FUNDS_GEO } from "@/lib/sentinel/weather-client";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** How a warning becomes cash, told on the clock: hours before landfall, which is the whole point. */
const STEPS: { t: string; who: string; title: string; body: string; icon: any }[] = [
  { t: "T – 48 h", who: "NOAA · National Weather Service", title: "Warn", body: "An official hurricane warning is issued. Landfall maps every enrolled home inside the warning polygon, never an exact address.", icon: I.stormEye },
  { t: "T – 47 h", who: "Policy engine, not AI", title: "Decide", body: "Fixed, tested rules set who is paid and how much. Homes with medical devices first. A protected reserve is never touched.", icon: I.balance },
  { t: "T – 46 h", who: "AI Watch Officer", title: "Check", body: "An AI reads the plan for duplicates and shortfalls, and cites every fact it uses. It can read. It has no way to pay.", icon: I.aiAdvisor },
  { t: "T – 45 h", who: "Two different people", title: "Approve", body: "A coordinator and a finance officer each approve the exact plan. Change one number and both must approve again.", icon: I.twoKeyApproval },
  { t: "T – 44 h", who: "PayPal Payouts", title: "Pay", body: "PayPal sends the cash, once. Signed webhooks and a double-entry ledger record every cent.", icon: I.payout },
  { t: "After", who: "The family", title: "Confirm", body: "PayPal’s “SUCCESS” is not the finish line. Landfall asks the household until they answer: I have it, or I can’t reach it.", icon: I.household },
];

const PAYPAL_APIS = [
  { name: "Orders v2", role: "Donations in" },
  { name: "Payouts", role: "Relief out, sent once" },
  { name: "Webhooks", role: "Signed status updates" },
  { name: "Transaction search", role: "Ledger reconciliation" },
  { name: "Subscriptions", role: "Monthly sustainers" },
  { name: "Agent Toolkit", role: "AI reads PayPal’s record" },
];

const startTour = () => window.dispatchEvent(new CustomEvent("landfall:tour"));

export default function HomePage() {
  const root = useRef<HTMLDivElement>(null);
  const fund = COMMUNITY_FUNDS_GEO[0];

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      // hero: the headline rises line by line, as if surfacing
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-chip", { y: 12, autoAlpha: 0, duration: 0.8 })
        .from(".hero-line", { yPercent: 110, duration: 1.25, stagger: 0.12 }, "-=0.55")
        .from(".hero-sub", { y: 16, autoAlpha: 0, duration: 0.9 }, "-=0.85")
        .from(".hero-cta > *", { y: 14, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, "-=0.6")
        .from(".hero-proof > *", { autoAlpha: 0, duration: 0.8, stagger: 0.06 }, "-=0.4");

      // how it works: a line draws down the clock as you read, and each step lights up when it reaches the middle of the screen
      gsap.fromTo(".clock-fill", { scaleY: 0 }, {
        scaleY: 1, ease: "none", transformOrigin: "top center",
        scrollTrigger: { trigger: ".clock", start: "top 60%", end: "bottom 60%", scrub: 0.6 },
      });
      gsap.utils.toArray<HTMLElement>(".clock-step").forEach((el) => {
        ScrollTrigger.create({
          trigger: el, start: "top 62%", end: "bottom 38%",
          onToggle: (self) => el.classList.toggle("is-on", self.isActive || self.progress === 1),
          onLeave: () => el.classList.add("is-on"),
        });
      });

      // proof it landed: the five bars grow in sequence
      gsap.from(".assure-bar", {
        scaleX: 0, transformOrigin: "left center", duration: 1.2, ease: "expo.out", stagger: 0.12,
        scrollTrigger: { trigger: "#assurance", start: "top 70%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="overflow-x-hidden">
      {/* ── HERO: the live globe ───────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-y-0 right-[-8%] w-[88%] lg:w-[78%]">
            <StormDesk variant="hero" fund={fund} alerts={[]} clusters={null} className="!h-full !rounded-none !border-0 !bg-transparent" />
          </div>
          <div className="absolute inset-0 bg-canvas/55 lg:hidden" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(246_243_236)_0%,rgb(246_243_236/0.94)_36%,rgb(246_243_236/0.25)_60%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-canvas to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-24 pt-32">
          <div className="max-w-[46rem] space-y-8">
            <p className="hero-chip eyebrow text-ink-2">Anticipatory cash relief · PayPal · open source</p>

            <h1 className="text-hero text-ink">
              <span className="block overflow-hidden pb-1"><span className="hero-line block">Relief that lands</span></span>
              <span className="block overflow-hidden pb-3"><span className="hero-line block font-light text-ink-2">before the storm.</span></span>
            </h1>

            <p className="hero-sub max-w-xl text-body-large text-ink-2">
              When an official hurricane warning is issued, Landfall turns it into cash for the families in its path: decided by rules,
              checked by AI, approved by two people, paid through PayPal. <span className="text-ink">Hours before landfall, not months after.</span>
            </p>

            <div className="hero-cta flex flex-wrap items-center gap-3">
              <Button href="/signin" variant="signal" size="lg" data-testid="hero-enter">Enter the console</Button>
              <Button variant="glass" size="lg" onClick={startTour} leading={<I.playCircle className="h-5 w-5" />} data-testid="hero-tour">
                Watch the guided tour
              </Button>
            </div>

            <dl className="hero-proof grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                ["Real", "PayPal Sandbox payouts, tracked to the family’s answer"],
                ["2", "different people approve every payment"],
                ["0", "ways for the AI to move money"],
              ].map(([k, v]) => (
                <div key={v}>
                  <dt className="figure text-[28px] leading-none text-ink">{k}</dt>
                  <dd className="mt-2 text-[12.5px] leading-snug text-ink-3">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── THE GAP ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24" aria-labelledby="gap">
        <div className="max-w-4xl" data-reveal>
          <p className="eyebrow">The problem</p>
          <h2 id="gap" className="mt-4 text-title-1 text-ink">
            Disaster aid often arrives weeks after the storm. <span className="text-ink-2">Families need it before: for fuel, medicine and a way out.</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 border-t border-line md:grid-cols-3" data-reveal>
          {[
            { k: "4.2%", t: "of U.S. households (about 5.6 million) were unbanked in 2023. A payment “credited” to an account is not the same as help a family can use.", src: "FDIC National Survey, 2023", href: "https://fdic.gov/household-survey/2023-fdic-national-survey-unbanked-and-underbanked-households-executive-summary" },
            { k: "Lowest", t: "scoring of the nine Core Humanitarian Standard commitments: letting people safely report problems and get them fixed. Funds rarely close the loop.", src: "CHS Alliance verification data", href: "https://www.chsalliance.org/get-support/article/meeting-chs-commitment-5-five-best-practice-tips-when-responding-to-complaints/" },
            { k: "939", t: "applicants failed ID checks in one AI-triggered cash programme. AI that decides, with no way to answer back, leaves the most vulnerable behind.", src: "The New Humanitarian, Aug 2026", href: "https://www.thenewhumanitarian.org/investigations/2026/08/31/givedirectlys-ai-experiment-left-vulnerable-flood-victims-behind-nigeria" },
          ].map((e, i) => (
            <figure key={e.k} className={`py-8 md:px-8 ${i > 0 ? "border-t border-line md:border-l md:border-t-0" : "md:pl-0"}`}>
              <div className="figure text-[52px] leading-none text-ink">{e.k}</div>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{e.t}</p>
              <figcaption className="mt-4 text-[12.5px] text-ink-3">
                <a href={e.href} target="_blank" rel="noreferrer" className="link">{e.src}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS: on the clock ─────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-line" aria-labelledby="how">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start" data-reveal>
            <p className="eyebrow">How it works</p>
            <h2 id="how" className="mt-4 text-title-1 text-ink">From warning to wallet, <span className="text-ink-2">on the clock.</span></h2>
            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-2">
              Every step is visible and explainable. No single person, and no model, can move money alone.
            </p>
            <Button href="/signin" variant="glass" className="mt-8">See it in the console</Button>
          </div>

          <ol className="clock relative">
            <span className="absolute bottom-3 left-[19px] top-3 w-px bg-line" aria-hidden />
            <span className="clock-fill absolute bottom-3 left-[19px] top-3 w-px bg-accent" aria-hidden />
            {STEPS.map((st) => {
              const Icon = st.icon;
              return (
                <li key={st.title} className="clock-step relative grid grid-cols-[40px_1fr] gap-x-5 pb-12 last:pb-0">
                  <span className="clock-node relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-canvas text-ink-3 transition-colors duration-500">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="pt-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="clock-time text-[12.5px] font-semibold tabular text-ink-3 transition-colors duration-500">{st.t}</span>
                      <span className="text-[12.5px] text-ink-3">{st.who}</span>
                    </div>
                    <h3 className="clock-title mt-1.5 font-serif text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink-2 transition-colors duration-500">{st.title}</h3>
                    <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">{st.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── PROOF IT LANDED ───────────────────────────────── */}
      <section id="assurance" className="scroll-mt-20 border-t border-line" aria-labelledby="assure">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl" data-reveal>
            <p className="eyebrow">Beyond “paid”</p>
            <h2 id="assure" className="mt-4 text-title-1 text-ink">
              PayPal says <span className="text-paypal">SUCCESS</span>. <span className="text-ink-2">Did the family get it?</span>
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-2">
              SUCCESS means the money was credited to an account, not that a household can reach it, use it, or even knows it is there.
              Landfall follows every payment through five facts and keeps each one apart, with who said so.
            </p>
          </div>

          <ol className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-5 sm:gap-4">
            {[
              ["Approved", "Two people approved the plan", "Landfall", "bg-ink-2", 100],
              ["Sent to PayPal", "It is in a Payouts batch", "Landfall", "bg-ink-2", 100],
              ["Credited by PayPal", "PayPal status SUCCESS", "PayPal", "bg-paypal", 72],
              ["Family confirmed", "The household says they have it", "The family", "bg-delivered", 38],
              ["Closed", "Credited, confirmed, nothing open", "Coordinator", "bg-delivered", 30],
            ].map(([t, d, who, bar, w], i) => (
              <li key={t as string}>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className={`assure-bar h-full rounded-full ${bar}`} style={{ width: `${w}%` }} />
                </div>
                <div className="mt-4 text-[12px] font-semibold tabular text-ink-3">0{i + 1}</div>
                <div className="mt-1 text-[16px] font-semibold text-ink">{t}</div>
                <div className="mt-1 text-[13px] text-ink-3">{d}</div>
                <div className={`mt-3 text-[12.5px] font-semibold ${who === "PayPal" ? "text-paypal" : who === "The family" ? "text-delivered" : "text-ink-2"}`}>Says: {who}</div>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[13px] text-ink-3">
            Illustrative bars. In the Milton replay: {CASE_SUMMARY.creditedCount} credited by PayPal, {CASE_SUMMARY.confirmedCount} confirmed by the household.{" "}
            <Link href="/console/payments" className="link text-ink-2">See every payment</Link>
          </p>
        </div>
      </section>

      {/* ── PAYPAL ─────────────────────────────────────────── */}
      <section id="paypal" className="scroll-mt-20 border-t border-line" aria-labelledby="give">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div data-reveal>
            <p className="eyebrow">Built on PayPal, end to end</p>
            <h2 id="give" className="mt-4 text-title-1 text-ink">Donations in. Relief out. <span className="text-ink-2">Every cent accounted for.</span></h2>
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
              PayPal carries the money from a donor’s checkout to a family’s wallet, and back into a double-entry ledger that reconciles against PayPal’s own records.
            </p>
            <ul className="mt-10 grid grid-cols-1 border-t border-line sm:grid-cols-2">
              {PAYPAL_APIS.map((a) => (
                <li key={a.name} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 sm:odd:pr-6 sm:even:pl-6">
                  <span className="text-[14.5px] font-semibold text-ink">{a.name}</span>
                  <span className="text-[13px] text-ink-3">{a.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <DonationCard />
        </div>
      </section>

      {/* ── AG STUDIO ──────────────────────────────────────── */}
      <section id="studio" className="scroll-mt-20 border-t border-line" aria-labelledby="studio-h">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal>
            <p className="eyebrow">Analytics Studio · AG Grid and AG Studio</p>
            <h2 id="studio-h" className="mt-4 text-title-1 text-ink">Ask the relief data <span className="text-ink-2">anything.</span></h2>
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
              Coordinators answer “can we pay everyone?” at a glance. Every payment lives in one AG Grid with its evidence a click away;
              Analytics Studio lets anyone filter, pivot and ask in plain English. Its AI can rearrange the board, never the money.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/console/studio" variant="glass">Open Analytics Studio</Button>
              <Button href="/console/payments" variant="ghost">See the payments grid</Button>
            </div>
          </div>
          <StudioPreview />
        </div>
      </section>

      {/* ── SAFETY ─────────────────────────────────────────── */}
      <section id="safety" className="scroll-mt-20 border-t border-line" aria-labelledby="safe">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl" data-reveal>
            <p className="eyebrow">Safety by design</p>
            <h2 id="safe" className="mt-4 text-title-1 text-ink">Code decides. AI advises. <span className="text-ink-2">People approve.</span></h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3" data-reveal>
            {[
              { icon: I.balance, t: "Rules decide money", b: "Eligibility and amounts come from a tested policy engine. The AI never sets either." },
              { icon: I.readOnly, t: "AI can’t move money", b: "The AI has no write tools. Payment code cannot even import an AI library, enforced in CI." },
              { icon: I.twoKeyApproval, t: "Two people, one exact plan", b: "Two different people approve the exact plan. Change one number and both must approve again." },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.t} className="bg-canvas p-8">
                  <Icon className="h-6 w-6 text-ink-2" />
                  <h3 className="mt-6 text-[19px] font-semibold text-ink">{c.t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{c.b}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ENTER ──────────────────────────────────────────── */}
      <section className="border-t border-line" aria-labelledby="enter">
        <div className="mx-auto max-w-7xl px-6 py-28 text-center" data-reveal>
          <h2 id="enter" className="mx-auto max-w-3xl text-title-1 text-ink">Every relief payment <span className="text-ink-2">deserves an answer.</span></h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
            Walk the whole product in a few minutes, or step inside as a coordinator, a finance director or a read-only judge.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button href="/signin" variant="signal" size="lg">Enter the console</Button>
            <Button variant="glass" size="lg" onClick={startTour}>Watch the guided tour</Button>
            <Button href="/r/enroll" variant="ghost" size="lg">I’m a resident</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Donation (PayPal Orders v2, sandbox) ──────────────── */

const TEST_CARDS = [
  { label: "Visa", number: "4012888888881881" },
  { label: "Mastercard", number: "5555555555554444" },
];

function SandboxHelp() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (n: string) =>
    navigator.clipboard?.writeText(n).then(() => {
      setCopied(n);
      window.setTimeout(() => setCopied(null), 1800);
    });
  return (
    <details className="mt-5 border-t border-line pt-4 text-[13px] text-ink-2">
      <summary className="cursor-pointer text-ink-2 hover:text-ink">Testing in the PayPal Sandbox</summary>
      <div className="mt-3 space-y-3">
        <p>
          This is PayPal’s Sandbox, so no real money moves. Sign in with a Sandbox buyer account, or choose <b className="text-ink">Debit or Credit Card</b> and use a PayPal test card:
        </p>
        <ul className="space-y-1.5">
          {TEST_CARDS.map((c) => (
            <li key={c.number} className="flex items-center justify-between gap-3 border border-line px-3 py-2">
              <span>
                <span className="text-ink">{c.label}</span> <span className="font-mono text-[12.5px] tabular">{c.number.replace(/(.{4})/g, "$1 ").trim()}</span>
              </span>
              <button type="button" onClick={() => copy(c.number)} className="text-[12.5px] text-accent-strong underline-offset-2 hover:underline">
                {copied === c.number ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-ink-3">Expiry any future date (for example 12/2030), security code 123, any United States billing address. Some Sandbox accounts decline test cards; if so, use a Sandbox buyer login from the PayPal developer dashboard.</p>
      </div>
    </details>
  );
}

function DonationCard() {
  const [mode, setMode] = useState<"once" | "monthly">("once");
  const [amount, setAmount] = useState("50.00");
  const [custom, setCustom] = useState("");
  const [done, setDone] = useState<{ title: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const presets = ["25.00", "50.00", "100.00", "250.00"];
  const value = custom ? (Number.isFinite(parseFloat(custom)) ? parseFloat(custom).toFixed(2) : "0.00") : amount;

  if (done) {
    return (
      <div className="glass-strong relative p-6 sm:p-7" data-reveal="scale" data-testid="donation-done">
        <div className="note" data-tone="delivered">
          <span className="note-label">{done.title}</span>
          {done.text}
        </div>
        <p className="mt-4 text-[13px] text-ink-3">This is a PayPal Sandbox payment (play money). It reaches the ledger when PayPal’s signed webhook arrives.</p>
        <button
          type="button"
          className="field-btn mt-5"
          onClick={() => {
            setDone(null);
            setError(null);
          }}
        >
          Give again
        </button>
      </div>
    );
  }

  return (
    <div className="glass-strong relative p-6 sm:p-7" data-reveal="scale">
      <div>
        <div className="font-serif text-[22px] leading-tight text-ink">Fund the next storm</div>
        <div className="mt-0.5 text-[13px] text-ink-3">Tampa Bay Relief Fund · PayPal Sandbox</div>
      </div>

      <div className="mt-5 flex border-b border-line" role="tablist" aria-label="Gift type">
        {(
          [
            ["once", "One time"],
            ["monthly", "Monthly sustainer"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => {
              setMode(k);
              setError(null);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${mode === k ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === "once" ? (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {presets.map((p) => {
              const on = amount === p && !custom;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setAmount(p);
                    setCustom("");
                  }}
                  aria-pressed={on}
                  className={`border py-3 text-[14px] font-semibold tabular transition-colors ${on ? "border-ink bg-ink/[0.08] text-ink" : "border-line-strong text-ink-2 hover:text-ink"}`}
                >
                  ${parseFloat(p).toFixed(0)}
                </button>
              );
            })}
          </div>
          <input type="number" step="0.01" min="1.00" placeholder="Other amount (USD)" value={custom} onChange={(e) => setCustom(e.target.value)} className="field-input mt-3 w-full py-2" aria-label="Custom donation amount in USD" />
          <p className="mt-5 flex justify-between text-[13px] text-ink-2">
            <span>Your gift</span>
            <span className="tabular text-ink">${value}</span>
          </p>
        </>
      ) : (
        <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">A steady $25 a month keeps the fund ready before the next warning. You approve it in PayPal’s own window and can cancel any time from your PayPal account.</p>
      )}
      <p className="mt-1 text-[12.5px] text-ink-3">A protected reserve is kept back, and money is paid out only after a warning and two approvals.</p>

      <div className="mt-5">
        {mode === "once" ? (
          <PayPalCheckout
            amount={value}
            fundId="fund_tbw_001"
            onApproved={(r) => {
              setError(null);
              setDone({ title: "Thank you", text: `PayPal approved your $${r.amount} gift and the fund’s server captured it. PayPal capture ${r.captureId ?? r.orderId}.` });
            }}
            onError={(m) => setError(m)}
            onCancel={() => setError("Checkout cancelled. Nothing was charged.")}
          />
        ) : (
          <PayPalSubscribe
            onApproved={(id) => {
              setError(null);
              setDone({ title: "Thank you", text: `PayPal approved your monthly $25 gift and the fund’s server confirmed the subscription with PayPal (${id}).` });
            }}
            onError={(m) => setError(m)}
            onCancel={() => setError("Subscription cancelled. Nothing was charged.")}
          />
        )}
      </div>

      {error && (
        <div className="note mt-4" data-tone="amber" role="status">
          <span className="note-label">Heads up</span>
          {error}
        </div>
      )}
      <SandboxHelp />
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
    <Link href="/console/studio" className="group relative block rounded-2xl border border-ink/10 bg-canvas/70 p-3 shadow-2xl transition-transform duration-500 hover:-translate-y-1">
      <div className="flex items-center gap-1.5 px-1 pb-3">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ink/10" />)}
        <span className="ml-2 text-[11px] text-ink-3">Relief board · AG Studio</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Households", String(CASE_SUMMARY.households), "text-ink"],
          ["Unresolved", `$${CASE_SUMMARY.unresolvedUsd.toLocaleString("en-US")}`, "text-ink"],
          ["Reserve", `$${TREASURY.reserve.toLocaleString("en-US")}`, "text-amber"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-ink/[0.06] bg-surface-2/70 p-3">
            <div className="text-[10.5px] text-ink-3">{k}</div>
            <div className={`mt-1 text-[20px] font-semibold tracking-[-0.03em] ${c}`}>{v}</div>
          </div>
        ))}
        <div className="col-span-2 rounded-xl border border-ink/[0.06] bg-surface-2/70 p-3">
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-ink/[0.06] bg-surface-2/70 p-3">
          <svg width="74" height="74" viewBox="0 0 74 74">
            <circle cx="37" cy="37" r="28" stroke="rgba(24,34,30,0.08)" strokeWidth="8" fill="none" />
            <circle cx="37" cy="37" r="28" stroke="#268C54" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="176 176" transform="rotate(-90 37 37)" />
            <text x="37" y="42" textAnchor="middle" fill="#18221E" fontSize="14" fontWeight="600">{coverage}×</text>
          </svg>
          <div className="mt-1 text-[10px] text-ink-3">Can we pay everyone?</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-ink/5 transition group-hover:ring-paypal/30" />
    </Link>
  );
}
