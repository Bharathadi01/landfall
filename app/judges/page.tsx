import Link from "next/link";
import { I } from "@/components/icons";
import { Button, GlassPane, Tag } from "@/components/ui";
import { PERSONAS } from "@/lib/auth/personas";
import { residentCode } from "@/lib/auth/resident-code";
import { RELIEF_CASES } from "@/lib/relief/cases";
import { getLiveSnapshot } from "@/lib/relief/live-cases.server";
import { demoKeyEnabled, demoPin } from "@/lib/security/demo-key";

export const metadata = { title: "Judge test card · Landfall" };
export const dynamic = "force-dynamic";

/**
 * Everything a judge needs to try Landfall in a few minutes, with no setup.
 * Codes shown here belong to SYNTHETIC test households only (fictional people, PayPal Sandbox money).
 * In a real deployment this page is switched off (JUDGE_MODE_ENABLED=false) and codes are handed to residents by a coordinator.
 */
const FEATURED = [
  { hh: "hh_tbw_003", why: "UNCLAIMED — PayPal says sent, the resident hasn't claimed it. Try “I can’t get to it” (no PayPal account), then, as the coordinator, propose cancelling it." },
  { hh: "hh_tbw_001", why: "SUCCESS — PayPal credited the money. Try “I received it”: the coordinator sees it as resident-reported." },
  { hh: "hh_tbw_004", why: "UNCLAIMED — a second waiting payment. Use it to compare what the resident sees with what the coordinator sees." },
];

export default async function JudgesPage() {
  if (process.env.JUDGE_MODE_ENABLED === "false") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-ink-2">
        <h1 className="text-title-1 text-ink">Judge test card</h1>
        <p className="mt-3">This deployment has demo access switched off.</p>
      </div>
    );
  }
  // Statuses come from the real stored PayPal records when they exist (Live Sandbox); otherwise the replay data, labelled.
  let live: Awaited<ReturnType<typeof getLiveSnapshot>> | null = null;
  try {
    const snap = await getLiveSnapshot();
    live = snap.hasData ? snap : null;
  } catch {
    live = null;
  }
  const featured = await Promise.all(
    FEATURED.map(async (f) => {
      const c = (live?.cases ?? RELIEF_CASES).find((x) => x.householdRef === f.hh);
      return { ...f, caseRef: c?.caseRef ?? f.hh, name: c?.resident ?? f.hh, status: c ? `${c.status} · ${live ? "live PayPal Sandbox" : "replay data"}` : "", code: await residentCode(f.hh) };
    })
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-24 sm:pt-28">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="amber" solid>JUDGE TEST CARD</Tag>
        <Tag tone="paypal">PayPal Sandbox</Tag>
        <Tag tone="neutral">Synthetic people</Tag>
      </div>
      <h1 className="mt-4 text-title-1 text-ink">
        Try Landfall in five minutes. <span className="font-accent italic font-normal text-ink-2">No setup.</span>
      </h1>
      <p className="mt-3 max-w-3xl text-body-base text-ink-2">
        Landfall tracks a relief payment <em>past</em> PayPal’s “SUCCESS” — to the household’s own answer. Everything below is free to use. All people are fictional and all money is PayPal Sandbox play money.
      </p>

      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { n: "1", t: "Sign in as a demo persona", d: "One click. Roles are enforced by the server on every request.", href: "/signin", cta: "Open sign-in" },
          { n: "2", t: "Open a case", d: "Command Center → Cases. Open the unclaimed payment and press “Investigate with AI”.", href: "/console/war-room", cta: "Open Command Center" },
          { n: "3", t: "Be the resident", d: "Use a reference and code below on the resident page. Your answer appears to the coordinator.", href: "/r/enroll?tab=status", cta: "Open resident page" },
        ].map((s) => (
          <li key={s.n} className="list-none"><GlassPane level={2}>
            <div className="font-mono text-[11px] text-ink-3">STEP {s.n}</div>
            <div className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-ink">{s.t}</div>
            <p className="mt-1 text-[13px] text-ink-2">{s.d}</p>
            <div className="mt-4">
              <Button href={s.href} variant="glass" size="sm" trailing={<I.arrowRight />}>{s.cta}</Button>
            </div>
          </GlassPane></li>
        ))}
      </ol>

      <h2 className="mt-12 text-title-3 text-ink">Resident test households</h2>
      <p className="mt-1 text-[13px] text-ink-3">Reference + 6-digit code. The code proves you are that household; the server returns only that household’s record.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08]" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="bg-white/[0.03] text-ink-3">
            <tr><th className="p-3 font-medium">Household</th><th className="p-3 font-medium">Reference</th><th className="p-3 font-medium">Code</th><th className="p-3 font-medium">What to try</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {featured.map((f) => (
              <tr key={f.hh}>
                <td className="p-3 text-ink">{f.name}<div className="text-[11px] text-ink-3">{f.status}</div></td>
                <td className="p-3 font-mono text-[12px] text-ink-2">{f.hh}</td>
                <td className="p-3 font-mono text-[15px] tracking-[0.2em] text-accent-strong">{f.code}</td>
                <td className="p-3 text-ink-2">{f.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-title-3 text-ink">Demo personas</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PERSONAS.map((p) => (
          <GlassPane key={p.id}>
            <div className="text-[15px] font-semibold text-ink">{p.name}</div>
            <div className="text-[12px] text-ink-3">{p.title}</div>
            <p className="mt-2 text-[12.5px] text-ink-2">{p.can[0]}</p>
          </GlassPane>
        ))}
      </div>

      {demoKeyEnabled() && (
        <section className="mt-12" aria-label="Approval PIN">
          <h2 className="text-title-3 text-ink">Approving a payment (two people)</h2>
          <p className="mt-2 text-[14px] text-ink-2">
            Sign in as <b>Dana Ortiz</b> (coordinator), propose an action from a live case, approve it, then sign in as <b>Sam Patel</b> (finance) and approve it too.
            Each approval is a passkey if your device has one, otherwise the labelled <b>demo approval PIN</b>:{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px]" data-testid="demo-pin-value">{demoPin()}</code>. The server records which one was used.
          </p>
        </section>
      )}

      <h2 className="mt-12 text-title-3 text-ink">What is real, and what is not</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08]" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <tbody className="divide-y divide-white/[0.06] text-ink-2">
            {[
              ["REAL", "PayPal Sandbox payouts, statuses, transaction ids, fees (batch VTJG3SR5BY56C: $500 sent; 1 credited, 3 still unclaimed, and 1 cancelled through the two-person flow and returned by PayPal — see docs/LIVE_PROOF.md)."],
              ["REAL", "Groq model calls for the AI case officer, Watch Officer and Studio agent (the answer says which model, or that a labelled offline fallback answered)."],
              ["REAL", "Live weather: NHC storms, NASA GIBS satellite, RainViewer radar, Open-Meteo forecast."],
              ["SANDBOX", "No real money moves. Sandbox accounts are play accounts."],
              ["SYNTHETIC", "The people (names, zones, households) are fictional. The “Milton replay” dataset is synthetic."],
              ["DEMO", "Personas are fictional. Approvals use real passkeys when your device has one, otherwise a labelled demo key."],
            ].map(([k, v]) => (
              <tr key={k + v}><td className="w-28 p-3 align-top"><Tag tone={k === "REAL" ? "delivered" : k === "SANDBOX" ? "paypal" : k === "SYNTHETIC" ? "amber" : "neutral"}>{k}</Tag></td><td className="p-3">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-[12px] text-ink-3">
        Tip: the server may take ~30 s to wake on the first visit. <Link className="text-accent-strong underline underline-offset-2" href="/">Back to the site</Link>.
      </p>
    </div>
  );
}
