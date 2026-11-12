"use client";

import React, { useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/icons";
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
    <section className="space-y-4" aria-label="AI case officer" data-testid="case-officer">
      <div className="pane p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-title-2 text-ink">Investigate with AI</h2>
            <p className="mt-1 text-[13.5px] text-ink-2">It reads this payment’s evidence, asks PayPal for the live status and PayPal’s own transaction record, then checks what the recovery rules allow. It cannot change anything.</p>
          </div>
          <Button variant="signal" onClick={run} loading={busy} data-testid="investigate" leading={<I.aiAdvisor className="h-4 w-4" />}>
            {busy ? "Investigating…" : r ? "Run again" : "Investigate"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[12.5px] text-ink-3" id="co-lang-l">Write the resident’s message in</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="co-lang-l">
            {LANGS.map(([k, v]) => (
              <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => setLang(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${lang === k ? "border-accent bg-accent-soft text-accent-strong" : "border-line-strong text-ink-2 hover:border-ink-3"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div role="alert" className="note" data-tone="danger"><span className="note-label">The investigation stopped</span>{error}</div>}

      {busy && (
        <div className="ai-draft p-5" role="status">
          <div className="text-[13.5px] font-semibold text-ink">Reading the evidence and asking PayPal…</div>
          <div className="mt-3 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-1/2" /></div>
        </div>
      )}

      {r && !busy && (
        <div className="ai-draft space-y-5 p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {r.answeredBy === "ai" ? <Tag tone="ai">Draft by AI · {r.model} · {(r.latencyMs / 1000).toFixed(1)} s</Tag> : <Tag tone="amber" title={r.fallbackReason}>Offline rules (AI unavailable) · {(r.latencyMs / 1000).toFixed(1)} s</Tag>}
            {r.toolCalls.map((t, i) => <Tag key={i} tone={t.ok ? (t.name.toLowerCase().includes("paypal") ? "paypal" : "neutral") : "danger"} title={t.server ? "The server ran this read-only tool because the model skipped it" : "The model called this read-only tool"}>{t.server ? "server read" : "read"} · {t.name}</Tag>)}
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-ink">What the evidence shows</h3>
            <ul className="mt-2 divide-y divide-line">
              {r.facts.map((f, i) => (
                <li key={i} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <span className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink">{f.text}</span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {f.evidenceIds.map((id) => <span key={id} className="rounded-sm border border-line-strong px-1.5 py-0.5 font-code text-[11px] text-ink-2" title={evText(id)}>{id}</span>)}
                  </span>
                </li>
              ))}
              {r.facts.length === 0 && <li className="py-2 text-[13.5px] text-ink-3">No cited facts survived the evidence check.</li>}
            </ul>
            {r.integrity.droppedFacts > 0 && <p className="mt-2 text-[12.5px] text-amber">{r.integrity.droppedFacts} statement{r.integrity.droppedFacts === 1 ? "" : "s"} dropped because they had no evidence: {r.integrity.reasons[0]}</p>}
          </div>

          {(r.hypotheses.length > 0 || r.unknowns.length > 0) && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {r.hypotheses.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">Possible explanations <span className="font-normal text-ink-3">· not confirmed</span></h3>
                  <ul className="mt-2 space-y-1.5 text-[13.5px] text-ink-2">{r.hypotheses.map((h, i) => <li key={i} className="border-l-2 border-line-strong pl-3">{h.text}</li>)}</ul>
                </div>
              )}
              {r.unknowns.length > 0 && (
                <div>
                  <h3 className="text-[14px] font-semibold text-ink">Still unknown</h3>
                  <ul className="mt-2 space-y-1.5 text-[13.5px] text-ink-2">{r.unknowns.map((u, i) => <li key={i} className="border-l-2 border-amber/60 pl-3">{u}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-ink">Suggested: {ACTION_LABEL[r.recommendedAction] ?? r.recommendedAction}</span>
              <Tag tone="accent">A person decides</Tag>
            </div>
            <p className="mt-1 text-[13.5px] text-ink-2">{r.actionReason}</p>
            <p className="mt-2 text-[12.5px] text-ink-3">Allowed by the rules right now: {r.allowed.map((a) => ACTION_LABEL[a] ?? a).join(" · ")}</p>
          </div>

          <figure className="rounded-md border border-line bg-surface p-4">
            <figcaption className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold text-ink">Draft message to the resident</span>
              <span className="text-[12px] text-ink-3">Never sent automatically</span>
            </figcaption>
            <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-sun pl-4 text-[15px] leading-relaxed text-ink" lang={r.residentMessage.language}>{r.residentMessage.text}</blockquote>
            {r.residentMessage.language !== "en" && <p className="mt-2 pl-4 text-[12.5px] text-ink-3">In English: {r.residentMessage.englishGloss}</p>}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigator.clipboard?.writeText(r.residentMessage.text).then(() => toast({ tone: "success", title: "Message copied" }))}>Copy message</Button>
          </figure>
        </div>
      )}
    </section>
  );
}
