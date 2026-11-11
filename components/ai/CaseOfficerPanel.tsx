"use client";

import React, { useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import type { Investigation } from "@/lib/ai/case-officer";

const ACTION_LABEL: Record<string, string> = {
  CANCEL_ITEM: "Cancel and return the funds",
  REISSUE: "Send a replacement payment",
  SEND_REMINDER: "Send a reminder",
  WAIT: "Wait",
  ESCALATE_TO_PERSON: "A person should decide",
};
const LANGS = [["en", "English"], ["es", "Español"], ["vi", "Tiếng Việt"], ["ht", "Kreyòl"]] as const;

/**
 * Runs the AI Case Officer on one payment. It only reads; the card says who answered (the model or the offline rules),
 * shows every tool it called, and cites the evidence behind each fact. The drafted message is never sent automatically.
 */
export function CaseOfficerPanel({ caseRef }: { caseRef: string }) {
  const toast = useToast();
  const [lang, setLang] = useState<(typeof LANGS)[number][0]>("en");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseRef)}/investigate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: lang }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "The investigation could not be completed.");
      setR(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The investigation could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const evText = (id: string) => r?.evidence.find((e) => e.id === id)?.text ?? id;

  return (
    <section className="glass space-y-4 p-4" aria-label="AI case officer" data-testid="case-officer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Investigate with AI</h3>
          <p className="text-[12.5px] text-ink-3">Reads this payment’s stored evidence, asks PayPal for its live status, and runs the recovery rules. It cannot change anything.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="co-lang">Message language</label>
          <select id="co-lang" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-[13px] text-ink">
            {LANGS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={run} disabled={busy} className="field-btn field-btn-primary" data-testid="investigate">{busy ? "Investigating…" : r ? "Run again" : "Investigate"}</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-[12.5px] text-danger">{error}</p>}

      {r && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {r.answeredBy === "ai" ? <Tag tone="paypal">AI · {r.model} · {(r.latencyMs / 1000).toFixed(1)} s</Tag> : <Tag tone="amber" title={r.fallbackReason}>Offline rules (AI unavailable) · {(r.latencyMs / 1000).toFixed(1)} s</Tag>}
            {r.toolCalls.map((t, i) => <Tag key={i} tone={t.ok ? "neutral" : "danger"} title={t.server ? "The server ran this read-only tool because the model skipped it" : "The model called this read-only tool"}>{t.server ? "server" : "tool"}: {t.name}</Tag>)}
          </div>

          <div>
            <h4 className="text-[13px] font-medium text-ink-2">What the evidence shows</h4>
            <ul className="mt-2 space-y-1.5">
              {r.facts.map((f, i) => (
                <li key={i} className="text-[13.5px] text-ink">
                  {f.text}
                  <span className="ml-2 text-[11px] text-ink-3" title={f.evidenceIds.map(evText).join("\n")}>[{f.evidenceIds.join(", ")}]</span>
                </li>
              ))}
              {r.facts.length === 0 && <li className="text-[13px] text-ink-3">No cited facts survived the evidence check.</li>}
            </ul>
            {r.integrity.droppedFacts > 0 && <p className="mt-2 text-[12px] text-amber">{r.integrity.droppedFacts} statement{r.integrity.droppedFacts === 1 ? "" : "s"} dropped: {r.integrity.reasons[0]}</p>}
          </div>

          {r.hypotheses.length > 0 && (
            <div>
              <h4 className="text-[13px] font-medium text-ink-2">Possible explanations (not confirmed)</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">{r.hypotheses.map((h, i) => <li key={i}>{h.text}</li>)}</ul>
            </div>
          )}
          {r.unknowns.length > 0 && (
            <div>
              <h4 className="text-[13px] font-medium text-ink-2">What we don’t know</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">{r.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-medium text-ink">Suggested next step: {ACTION_LABEL[r.recommendedAction] ?? r.recommendedAction}</span>
              <Tag tone="neutral">A person decides</Tag>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-3">{r.actionReason}</p>
            <p className="mt-1 text-[11.5px] text-ink-3">Allowed by the rules now: {r.allowed.map((a) => ACTION_LABEL[a] ?? a).join(" · ")}</p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
            <h4 className="text-[13px] font-medium text-ink-2">Draft message to the resident (never sent automatically)</h4>
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-ink" lang={r.residentMessage.language}>{r.residentMessage.text}</p>
            {r.residentMessage.language !== "en" && <p className="mt-2 text-[12px] text-ink-3">English: {r.residentMessage.englishGloss}</p>}
            <button type="button" className="mt-2 text-[12.5px] text-accent-strong underline-offset-2 hover:underline" onClick={() => navigator.clipboard?.writeText(r.residentMessage.text).then(() => toast({ tone: "success", title: "Message copied" }))}>Copy message</button>
          </div>
        </div>
      )}
    </section>
  );
}
