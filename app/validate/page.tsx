"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Tag } from "@/components/ui/Tag";

const ROLES = [
  ["fund_coordinator", "I coordinate a relief or mutual-aid fund"],
  ["finance_or_treasurer", "I handle the money (finance / treasurer)"],
  ["emergency_manager", "I work in emergency management"],
  ["nonprofit_staff", "I work at a nonprofit or foundation"],
  ["resident_or_recipient", "I have received disaster aid"],
  ["other", "Something else"],
] as const;
const ORGS = [
  ["community_foundation", "Community foundation"],
  ["mutual_aid_fund", "Mutual-aid fund"],
  ["local_government", "Local government"],
  ["relief_nonprofit", "Relief nonprofit"],
  ["faith_or_neighbourhood_group", "Faith or neighbourhood group"],
  ["other", "Other"],
] as const;

const field = "mt-1 block w-full rounded-lg border border-ink/10 bg-ink/[0.04] px-3 py-2.5 text-[14px] text-ink";

/** Stakeholder feedback form. Nothing is shown publicly except how many real people have answered. */
export default function ValidatePage() {
  const [count, setCount] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    fetch("/api/validate").then((r) => r.json()).then((j) => setCount(j.responses)).catch(() => setCount(null));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const wouldUse = f.get("wouldUse") ? Number(f.get("wouldUse")) : undefined;
    const body = { role: f.get("role"), orgType: f.get("orgType"), problemToday: f.get("problemToday"), wouldUse, comments: f.get("comments") || undefined, contact: f.get("contact") || undefined, consent };
    setState("sending");
    try {
      const res = await fetch("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(res.status === 429 ? "Too many submissions from this device. Please try again later." : j.message ?? "Something was missing or invalid.");
        return;
      }
      setState("done");
      setCount((c) => (c === null ? c : c + 1));
    } catch {
      setState("error");
      setMessage("Couldn’t reach the server. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:pt-28">
      <Tag tone="amber" solid>FEEDBACK</Tag>
      <h1 className="mt-4 text-title-1 text-ink">Would this help your fund?</h1>
      <p className="mt-3 text-body-base text-ink-2">
        Landfall is a hackathon prototype on the PayPal Sandbox. We’re asking people who run relief funds whether the problem is real for them. Please be blunt: “no, because…” is the most useful answer.
      </p>
      <p className="mt-2 text-[13px] text-ink-3" data-testid="validate-count">
        {count === null ? "" : count === 0 ? "No responses yet — you would be the first. We only ever report real responses." : `${count} real response${count === 1 ? "" : "s"} so far.`}
      </p>

      {state === "done" ? (
        <div role="status" className="mt-8 rounded-2xl border border-accent/30 bg-accent/[0.07] p-5 text-[14px] text-ink">
          Thank you. Your answer was saved. <Link href="/" className="text-accent-strong underline underline-offset-2">Back to the site</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
          <label className="block text-[13px] text-ink-2">
            Your role
            <select name="role" required defaultValue="" className={field}>
              <option value="" disabled>Choose one</option>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block text-[13px] text-ink-2">
            Type of organisation
            <select name="orgType" required defaultValue="" className={field}>
              <option value="" disabled>Choose one</option>
              {ORGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block text-[13px] text-ink-2">
            How do you confirm today that disaster-relief payments reached the people they were meant for?
            <textarea name="problemToday" required minLength={10} maxLength={1000} rows={4} className={field} />
          </label>
          <label className="block text-[13px] text-ink-2">
            Would a tool that tracks each payment from the payment provider to the household’s own answer help? (1 = no, 5 = very much)
            <select name="wouldUse" defaultValue="" className={field}>
              <option value="">No answer</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block text-[13px] text-ink-2">
            Anything else? What would stop you using it?
            <textarea name="comments" maxLength={1000} rows={3} className={field} />
          </label>
          <label className="block text-[13px] text-ink-2">
            Email, only if you’re happy for us to follow up (optional)
            <input name="contact" type="email" autoComplete="email" maxLength={200} className={field} />
          </label>
          <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" required />
            <span>I agree that Landfall may store my answers for this project’s validation. Nothing is published with my name, and I can ask for deletion.</span>
          </label>
          {state === "error" && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">{message}</p>}
          <button type="submit" disabled={!consent || state === "sending"} className="field-btn field-btn-primary" data-testid="validate-submit">
            {state === "sending" ? "Sending…" : "Send my answer"}
          </button>
        </form>
      )}
    </div>
  );
}
