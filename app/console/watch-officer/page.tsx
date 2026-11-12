"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { I } from "@/components/icons";

/** The sources the Watch Officer is allowed to read (server side, read-only). Shown while it works, so waiting has meaning. */
const SOURCES = ["Storm warnings", "Enrolled households", "Treasury and reserve", "Relief policy", "PayPal payouts", "Reconciliation"];

/**
 * AI WATCH OFFICER — ask why, and get an answer that shows its evidence.
 * The layout follows how people read an answer under pressure: the question, the answer in plain words, what it rests on, what is still
 * unknown, and what a person has to decide. The evidence it was allowed to read sits beside it; every citation jumps to its source.
 * The answer is drawn as a DRAFT (dashed edge): it is advice for a person, never a decision.
 */
export default function WatchOfficerConsolePage() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<{ model: string | null; latencyMs: number | null; at: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const answerRef = useRef<HTMLElement | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await (await fetch("/api/watch-officer")).json();
        // Opening this page never starts a run (runs call the model and write a record): show the last one, or wait for a click.
        if (data.latestRun?.analysis) {
          setAnalysisData(data.latestRun.analysis);
          setRunInfo({ model: data.latestRun.model ?? null, latencyMs: data.latestRun.latencyMs ?? null, at: data.latestRun.createdAt ?? null });
        }
        if (data.suggestedQuestions) setSuggestedQuestions(data.suggestedQuestions);
      } catch (err: any) {
        setErrorMessage("Could not load the Watch Officer: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // while it works, step through the sources it reads
  useEffect(() => {
    if (!analyzing) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 700);
    return () => window.clearInterval(t);
  }, [analyzing]);

  // a new answer arrives: the draft surfaces, then its parts follow one by one
  useLayoutEffect(() => {
    const el = draftRef.current;
    if (!el || analyzing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tw = gsap.fromTo(el.querySelectorAll("[data-a]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.06, clearProps: "all" });
    return () => { tw.kill(); };
  }, [analysisData, analyzing]);

  async function runAnalysis(customQuery?: string) {
    setAnalyzing(true);
    setErrorMessage(null);
    try {
      const query = customQuery !== undefined ? customQuery : queryInput;
      setLastQuestion(query.trim());
      const res = await fetch("/api/watch-officer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisData(data.analysis);
        setRunInfo({ model: data.modelUsed ?? null, latencyMs: data.latencyMs ?? null, at: new Date().toISOString() });
      } else {
        setErrorMessage(data.error || "The Watch Officer could not answer.");
      }
    } catch (err: any) {
      setErrorMessage("Network error: " + err.message);
    } finally {
      setAnalyzing(false);
      window.setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  }

  const jumpTo = (id: string) => {
    const el = document.getElementById(`ev-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    gsap.fromTo(el, { boxShadow: "0 0 0 2px rgb(255 107 44 / 0.9)" }, { boxShadow: "0 0 0 0px rgb(255 107 44 / 0)", duration: 1.8, ease: "power2.out", delay: 0.3 });
  };

  const readiness = analysisData?.financialReadiness;
  const constraints = analysisData?.fundingConstraints;
  const event = analysisData?.eventContext;
  const isReplay = event?.mode === "HISTORICAL_REPLAY";
  const offline = !!runInfo && /OFFLINE/i.test(runInfo.model ?? "");
  const findings: any[] = analysisData?.keyFindings ?? [];
  const cited = findings.filter((k) => (Array.isArray(k.evidenceIds) ? k.evidenceIds.length > 0 : Boolean(k.evidenceId))).length;
  const unknowns: { title: string; body: string }[] = [
    ...((analysisData?.evidenceReferences ?? []) as any[]).filter((e) => e.status && e.status !== "VERIFIED").map((e) => ({ title: `${e.source} · ${String(e.status).toLowerCase().replace(/_/g, " ")}`, body: e.summary })),
    ...((analysisData?.operationalBlockers ?? []) as string[]).map((b) => ({ title: "Blocker", body: b })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Did it land? · AI Watch Officer · read-only"
        title="Ask why."
        accent="The AI explains, with its evidence. It can never pay."
        description="It reads the same records you can see, cites every fact, keeps what it knows apart from what it is guessing, and leaves every decision to people."
      />

      {isReplay && (
        <div className="note" data-tone="amber">
          <span className="note-label">Replay</span>
          This briefing runs over the archived Hurricane Milton data (Oct 2024). It shows the workflow under major-storm conditions; no real payment moves.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {/* ASK */}
          <section className="pane p-6" data-testid="wo-ask" aria-labelledby="ask-h">
            <h2 id="ask-h" className="text-title-2 text-ink">What do you want to know?</h2>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (queryInput.trim()) runAnalysis();
              }}
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Ask about readiness, funding gaps, stuck payments or policy rules…"
                aria-label="Ask about readiness, funding gaps or policy rules"
                className="field-input !min-h-[48px] flex-1 text-[15px]"
              />
              <Button type="submit" variant="signal" size="lg" disabled={analyzing || !queryInput.trim()} loading={analyzing} data-testid="wo-ask-btn">
                {analyzing ? "Reading…" : "Ask"}
              </Button>
            </form>
            {suggestedQuestions.length > 0 && (
              <div className="mt-4">
                <div className="text-[12.5px] text-ink-3">Or start from a common question</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setQueryInput(q); runAnalysis(q); }}
                      disabled={analyzing}
                      className="rounded-full border border-line-strong px-3.5 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:border-ink-3 hover:bg-ink/[0.04] hover:text-ink disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[12.5px] text-ink-3">
              <I.readOnly className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Answers come only from server evidence. The AI cannot invent amounts, change eligibility, or call anything that moves money.
            </p>
          </section>

          {errorMessage && (
            <div className="note" data-tone="danger" role="alert"><span className="note-label">The Watch Officer could not answer</span>{errorMessage}</div>
          )}

          {/* ANSWER */}
          <section ref={answerRef} data-testid="wo-answer" aria-label="Watch Officer answer" aria-live="polite" aria-busy={analyzing} className="scroll-mt-24">
            {loading ? (
              <div className="ai-draft space-y-3 p-6" role="status" aria-label="Loading">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-6 w-full" />
                <div className="skeleton h-6 w-4/5" />
              </div>
            ) : analyzing ? (
              <div className="ai-draft p-6" role="status" data-testid="wo-working">
                <div className="text-[13px] font-semibold text-ink">Reading the evidence it is allowed to see…</div>
                <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {SOURCES.map((s, i) => {
                    const on = i <= tick % (SOURCES.length + 1);
                    return (
                      <li key={s} className={`flex items-center gap-2 text-[13px] transition-colors duration-300 ${on ? "text-ink" : "text-ink-3"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${on ? "bg-accent" : "bg-line-strong"}`} />
                        {s}
                      </li>
                    );
                  })}
                </ul>
                {lastQuestion && <p className="mt-5 text-[13px] text-ink-3">You asked: <q className="text-ink-2">{lastQuestion}</q></p>}
              </div>
            ) : !analysisData ? (
              <div className="ai-draft p-6 text-[14px] text-ink-2" data-testid="wo-empty">
                No briefing yet. Opening this page doesn’t start one: ask a question above, or{" "}
                <button type="button" className="link font-semibold" onClick={() => runAnalysis("")}>run the standing briefing</button>.
              </div>
            ) : (
              <div ref={draftRef} className="space-y-6">
                <div className="ai-draft p-6 sm:p-7">
                  <div data-a className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2" data-testid="wo-answered-by">
                      {runInfo?.model && !offline ? (
                        <Tag tone="ai">Draft by AI · {runInfo.model.replace(/^groq\//, "")}{runInfo.latencyMs ? ` · ${(runInfo.latencyMs / 1000).toFixed(1)} s` : ""}</Tag>
                      ) : (
                        <Tag tone="amber" title="The model was unavailable or its answer failed validation; the deterministic template answered.">Offline template · AI unavailable</Tag>
                      )}
                      {runInfo?.at && <span className="text-[12px] text-ink-3">{new Date(runInfo.at).toLocaleString()}</span>}
                    </div>
                    <span className="text-[12.5px] text-ink-3" data-testid="wo-asked">{lastQuestion ? <>You asked: <q className="text-ink-2">{lastQuestion}</q></> : "Standing briefing"}</span>
                  </div>
                  {offline && (
                    <div data-a className="note mt-4" data-tone="amber" role="status" data-testid="wo-offline-note">
                      <span className="note-label">The AI did not answer this time</span>
                      {(((analysisData as { warnings?: string[] }).warnings ?? []).find((w) => w.startsWith("[OFFLINE_FALLBACK]")) ?? "The AI could not answer.").replace("[OFFLINE_FALLBACK] ", "")}{" "}
                      <button type="button" className="link font-semibold" onClick={() => runAnalysis(lastQuestion)}>Try the AI again</button>
                    </div>
                  )}
                  <p data-a className="mt-5 text-[19px] leading-[1.55] text-ink" style={{ textWrap: "pretty" }}>{analysisData.summary}</p>
                </div>

                {/* what it rests on */}
                <Block id="facts" title="What it found" note={findings.length ? `${cited} of ${findings.length} cited` : undefined}>
                  {findings.length === 0 && <p className="text-[13.5px] text-ink-3">No findings in this run.</p>}
                  <ul className="divide-y divide-line">
                    {findings.map((kf, i) => {
                      const ids: string[] = Array.isArray(kf.evidenceIds) && kf.evidenceIds.length ? kf.evidenceIds : kf.evidenceId ? [kf.evidenceId] : [];
                      return (
                        <li key={i} data-a className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink">{kf.finding}</span>
                          <span className="flex shrink-0 flex-wrap gap-1.5">
                            {ids.length ? ids.map((id) => (
                              <button key={id} type="button" onClick={() => jumpTo(id)} className="rounded-sm border border-line-strong px-1.5 py-0.5 font-code text-[11.5px] text-ink-2 transition-colors hover:border-accent hover:text-ink" title="Show this evidence">
                                {id}
                              </button>
                            )) : <Tag tone="amber">Uncited</Tag>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Block>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Block id="unknowns" title="Still unknown" note="from evidence status">
                    {unknowns.length === 0 ? (
                      <p className="text-[13.5px] text-ink-3">Nothing unresolved was reported for this run.</p>
                    ) : (
                      <ul className="space-y-3">
                        {unknowns.map((u, i) => (
                          <li key={i} data-a className="border-l-2 border-amber/60 pl-3">
                            <div className="text-[13.5px] font-semibold text-ink">{u.title}</div>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{u.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Block>
                  <Block id="decide" title="A person must decide" note="the AI cannot">
                    <ul className="space-y-3">
                      {(analysisData.recommendedHumanActions ?? []).map((act: any, i: number) => (
                        <li key={i} data-a className="border-l-2 border-accent/70 pl-3">
                          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                            <span className="font-semibold text-ink-2">{String(act.role).replace(/^both$/i, "Coordinator and Finance")}</span>
                            {act.priority && <Tag tone={act.priority === "CRITICAL" ? "danger" : act.priority === "HIGH" ? "amber" : "neutral"}>{String(act.priority).toLowerCase()} priority</Tag>}
                          </div>
                          <div className="mt-1 text-[14px] font-semibold text-ink">{act.action}</div>
                          <p className="mt-0.5 text-[13px] text-ink-2">{act.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </Block>
                </div>

                {(analysisData.scenarioComparisons ?? []).length > 0 && (
                  <Block id="scenarios" title="If the plan changed" note="computed by rules, not by the AI">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13.5px]">
                        <thead>
                          <tr className="border-b border-line text-[12px] text-ink-3">
                            <th className="py-2 pr-4 font-semibold">Scenario</th>
                            <th className="py-2 pr-4 font-semibold">Readiness</th>
                            <th className="py-2 font-semibold">Trade-off</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.scenarioComparisons.map((sc: any, i: number) => (
                            <tr key={i} data-a className="border-b border-line/70 last:border-0">
                              <td className="py-2.5 pr-4 font-semibold text-ink">{sc.title}</td>
                              <td className="whitespace-nowrap py-2.5 pr-4"><Tag tone={sc.readinessState === "READY" ? "delivered" : "amber"}>{String(sc.readinessState).toLowerCase().replace(/_/g, " ")} · {sc.coveragePercentage}%</Tag></td>
                              <td className="py-2.5 text-ink-2">{sc.tradeoffSummary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Block>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT RAIL: what it was allowed to read */}
        <aside className="space-y-6 xl:sticky xl:top-[84px]" aria-label="The evidence the AI read">
          <div className="pane p-5">
            <div className="text-[13px] font-semibold text-ink">The numbers it used</div>
            <dl className="mt-4 space-y-4">
              <Fact label="Storm" value={event?.eventName || "No active warning"} sub={event?.eventKey ? `${event.eventKey}${event.severity ? ` · ${event.severity}` : ""}` : "No alert in the data"} />
              <Fact
                label="Ready to pay?"
                value={readiness ? `${readiness.coveragePercentage ?? 0}% covered` : "Not run yet"}
                tone={readiness?.state === "READY" ? "delivered" : readiness ? "amber" : undefined}
                sub={readiness?.reason}
              />
              <Fact label="Free to send" value={constraints?.allocatableFormatted || "—"} sub={constraints ? `Reserve ${constraints.reserveProtectedFormatted} is protected` : undefined} />
              <Fact label="Needed" value={constraints?.requiredFundingFormatted || "—"} sub={constraints ? `Gap ${constraints.fundingGapFormatted}` : undefined} />
            </dl>
          </div>

          {analysisData && (
            <div className="pane p-5" data-testid="wo-registry">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[13px] font-semibold text-ink">Evidence it read</div>
                <span className="text-[12px] text-ink-3">{analysisData.evidenceReferences?.length || 0} sources</span>
              </div>
              <ul className="mt-3 space-y-2">
                {(analysisData.evidenceReferences ?? []).map((ev: any) => (
                  <li key={ev.evidenceId} id={`ev-${ev.evidenceId}`} className="rounded-md border border-line p-2.5 transition-shadow">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-[11.5px] text-ink">{ev.evidenceId}</span>
                      <span className="text-[11.5px] text-ink-3">{String(ev.source).toLowerCase()}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-2">{ev.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="pane p-5" aria-labelledby={`wo-${id}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <h3 id={`wo-${id}`} className="text-[16px] font-semibold text-ink">{title}</h3>
        {note && <span className="text-[12.5px] text-ink-3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "delivered" | "amber" }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
        {tone && <span className={`h-1.5 w-1.5 rounded-full ${tone === "delivered" ? "bg-delivered" : "bg-amber"}`} aria-hidden />}
        {label}
      </dt>
      <dd className="mt-0.5 text-[16px] font-semibold text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{sub}</dd>}
    </div>
  );
}
