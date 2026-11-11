"use client";


import { PageTitle } from "@/components/ui/primitives";
import { I } from "@/components/icons";
import React, { useState, useEffect } from "react";

export default function WatchOfficerConsolePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [queryInput, setQueryInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<{ model: string | null; latencyMs: number | null; at: string | null } | null>(null);

  useEffect(() => {
    fetchInitialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchInitialStatus() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/watch-officer");
      const data = await res.json();
      // Opening this page never starts a run (runs call the model and write a record): show the last one, or wait for a click.
      if (data.latestRun?.analysis) {
        setAnalysisData(data.latestRun.analysis);
        setRunInfo({ model: data.latestRun.model ?? null, latencyMs: data.latestRun.latencyMs ?? null, at: data.latestRun.createdAt ?? null });
      }
      if (data.suggestedQuestions) {
        setSuggestedQuestions(data.suggestedQuestions);
      }
    } catch (err: any) {
      setErrorMessage("Failed to load Watch Officer briefing: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis(customQuery?: string) {
    setAnalyzing(true);
    setErrorMessage(null);
    try {
      const query = customQuery !== undefined ? customQuery : queryInput;
      const res = await fetch("/api/watch-officer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        setAnalysisData(data.analysis);
        setRunInfo({ model: data.modelUsed ?? null, latencyMs: data.latencyMs ?? null, at: new Date().toISOString() });
      } else {
        setErrorMessage(data.error || "Analysis failed");
      }
    } catch (err: any) {
      setErrorMessage("Network error running Watch Officer analysis: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleQuestionClick(q: string) {
    setQueryInput(q);
    runAnalysis(q);
  }

  const readiness = analysisData?.financialReadiness;
  const constraints = analysisData?.fundingConstraints;
  const event = analysisData?.eventContext;
  const exposure = analysisData?.exposureSummary;
  const isReplay = event?.mode === "HISTORICAL_REPLAY";

  return (
    <div className="space-y-6">
      {/* Historical Replay Mode Disclaimer Banner */}
      {isReplay && (
        <div className="field-paper p-4 border-amber bg-amber-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber/20 text-amber font-bold text-lg">
              ⚠️
            </span>
            <div>
              <p className="font-bold text-xs font-mono uppercase tracking-wider text-amber">
                Historical Replay Mode · Hurricane Milton (Oct 2024 Archive)
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
                Operating over real Hurricane Milton Oct 2024 archive from IEM. Demonstrates workflow under major storm conditions; zero real payments move.
              </p>
            </div>
          </div>
          <span className="field-badge-warning font-mono text-xs self-start sm:self-auto">
            IEM ARCHIVE
          </span>
        </div>
      )}

      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
        <PageTitle
          eyebrow="AI Watch Officer · read-only"
          icon={I.aiAdvisor}
          tone="ai"
          title="An AI that explains,"
          accent="never one that pays."
          description="A briefing that separates verified facts from guesses and unknowns, cites its evidence, and leaves every decision to people."
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => runAnalysis()}
            disabled={analyzing}
            className="field-btn field-btn-primary text-xs flex items-center gap-2"
          >
            <I.refresh className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
            <span>{analyzing ? "Synthesizing Briefing..." : "Refresh Intelligence"}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="field-paper p-4 border-storm bg-storm-soft flex items-center gap-3 text-sm text-storm">
          <I.warning className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Analysis Notice:</strong> {errorMessage}
          </div>
        </div>
      )}

      {!loading && !analysisData && (
        <div className="field-paper p-6 text-sm text-ink-2" data-testid="wo-empty">
          No briefing has been run yet. Opening this page doesn’t start one. <button type="button" className="ml-2 underline text-accent" onClick={() => runAnalysis("")} disabled={analyzing}>{analyzing ? "Running…" : "Run the Watch Officer"}</button>
        </div>
      )}
      {!loading && analysisData && runInfo && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono" data-testid="wo-answered-by">
          {runInfo.model && !/OFFLINE/i.test(runInfo.model)
            ? <span className="field-badge-evergreen">AI · {runInfo.model.replace(/^groq\//, "")}{runInfo.latencyMs ? ` · ${(runInfo.latencyMs / 1000).toFixed(1)} s` : ""}</span>
            : <span className="field-badge-warning" title="The model was unavailable or its answer failed validation; the deterministic template answered.">OFFLINE TEMPLATE (AI unavailable)</span>}
          {runInfo.at && <span className="text-ink-3">{new Date(runInfo.at).toLocaleString()}</span>}
        </div>
      )}

      {loading ? (
        <div className="field-paper py-24 text-center text-ink-3 flex flex-col items-center justify-center gap-3">
          <I.refresh className="w-8 h-8 animate-spin text-accent" />
          <p className="font-mono text-xs">Connecting to Sentinel, Treasury & Policy telemetry...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Operational Status Banner (4 Core Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Event Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-ink-3 font-mono uppercase tracking-wider">
                Disaster Context
              </div>
              <div className="mt-2 text-lg font-serif font-bold text-ink flex items-center gap-2">
                <I.hazard className="w-5 h-5 text-storm" />
                <span className="truncate">{event?.eventName || "No Active Alert"}</span>
              </div>
              <div className="mt-1 text-xs text-ink-2 font-mono">
                {event?.eventKey ? `${event.eventKey} · ${event.severity ?? "severity unknown"}` : "No alert key in the data"}
              </div>
            </div>

            {/* Financial Readiness Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-ink-3 font-mono uppercase tracking-wider">
                Financial Readiness
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`field-badge-${
                    readiness?.state === "READY"
                      ? "evergreen"
                      : readiness?.state === "CONSTRAINED"
                      ? "warning"
                      : "critical"
                  } uppercase font-mono text-xs`}
                >
                  {readiness?.state || "UNKNOWN"}
                </span>
                <span className="text-sm font-bold text-ink font-serif tabular-nums">
                  {readiness?.coveragePercentage ?? 0}% Coverage
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-2 line-clamp-1" title={readiness?.reason}>
                {readiness?.reason || "Telemetry loaded"}
              </div>
            </div>

            {/* Allocatable Cash Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-ink-3 font-mono uppercase tracking-wider">
                Allocatable Liquidity
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-accent tabular-nums">
                {constraints?.allocatableFormatted || "$0.00"}
              </div>
              <div className="mt-1 text-xs text-ink-2">
                Reserve: {constraints?.reserveProtectedFormatted ?? "unknown"} (protected)
              </div>
            </div>

            {/* Funding Requirement Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-ink-3 font-mono uppercase tracking-wider">
                Funding Requirement
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-ink tabular-nums">
                {constraints?.requiredFundingFormatted || "$0.00"}
              </div>
              <div className="mt-1 text-xs text-ink-2">
                Gap: <span className="text-amber font-semibold">{constraints?.fundingGapFormatted || "$0.00"}</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Callout */}
          <div className="field-paper p-6 bg-surface border border-line shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2 text-accent text-xs font-mono font-bold uppercase tracking-wider">
                <I.document className="w-4 h-4" />
                Executive Operational Brief
              </div>
              <span className="field-badge-neutral text-[10px] font-mono flex items-center gap-1">
                <I.locked className="w-3 h-3" />
                AI Output: Read-Only (Non-Authoritative)
              </span>
            </div>
            <p className="mt-4 text-ink text-sm md:text-base leading-relaxed">
              {analysisData?.summary || "No briefing yet. Press “Refresh Intelligence” to run one."}
            </p>
          </div>

          {/* 4-Quadrant Evidence Workspace */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
                4-Quadrant Evidence Workspace
              </h2>
              <span className="text-xs text-ink-3 font-mono">
                Rigorous operational distinction: Verified Facts vs Hypotheses vs Unknowns vs Actions
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quadrant 1: Verified Facts */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-accent">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <I.done className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-serif font-bold text-ink">
                      1. Verified Facts (Ground Truth)
                    </h3>
                  </div>
                  <span className="field-badge-evergreen font-mono text-[10px]">
                    {(() => {
                      const kfs: any[] = analysisData?.keyFindings ?? [];
                      const cited = kfs.filter((k) => Array.isArray(k.evidenceIds) ? k.evidenceIds.length > 0 : Boolean(k.evidenceId)).length;
                      return kfs.length ? `${cited} of ${kfs.length} CITED` : "NO FINDINGS YET";
                    })()}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.keyFindings?.map((kf: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-canvas border border-line flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="text-ink leading-relaxed font-medium">{kf.finding}</span>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-accent-soft text-accent font-semibold shrink-0">
                        {kf.evidenceId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadrant 2: Working Hypotheses */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-paypal">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <I.layers className="w-4 h-4 text-paypal" />
                    <h3 className="text-sm font-serif font-bold text-ink">
                      2. Working Hypotheses & Model Scenarios
                    </h3>
                  </div>
                  <span className="field-badge-neutral font-mono text-[10px]">
                    DETERMINISTIC SIMULATION
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.scenarioComparisons?.map((sc: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-canvas border border-line space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{sc.title}</span>
                        <span
                          className={`field-badge-${
                            sc.readinessState === "READY" ? "evergreen" : "warning"
                          } text-[10px] font-mono`}
                        >
                          {sc.readinessState} ({sc.coveragePercentage}%)
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-2">
                        Tradeoff: {sc.tradeoffSummary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadrant 3: Key Unknowns */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-amber">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <I.help className="w-4 h-4 text-amber" />
                    <h3 className="text-sm font-serif font-bold text-ink">
                      3. Key Unknowns & Uncertainties
                    </h3>
                  </div>
                  <span className="field-badge-warning font-mono text-[10px]">
                    FROM EVIDENCE STATUS
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  {(() => {
                    const unresolved: any[] = (analysisData?.evidenceReferences ?? []).filter((e: any) => e.status && e.status !== "VERIFIED");
                    const blockers: string[] = analysisData?.operationalBlockers ?? [];
                    if (!unresolved.length && !blockers.length) {
                      return <p className="text-ink-3">No unresolved inputs were reported for this run.</p>;
                    }
                    return (
                      <>
                        {unresolved.map((e: any, i: number) => (
                          <div key={`u${i}`} className="p-3 rounded-lg bg-canvas border border-line">
                            <div className="font-semibold text-ink">{e.source} · {e.status}</div>
                            <p className="text-ink-2 mt-1 text-[11px] leading-relaxed">{e.summary}</p>
                          </div>
                        ))}
                        {blockers.map((b, i) => (
                          <div key={`b${i}`} className="p-3 rounded-lg bg-canvas border border-line">
                            <div className="font-semibold text-ink">Blocker</div>
                            <p className="text-ink-2 mt-1 text-[11px] leading-relaxed">{b}</p>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Quadrant 4: Human Action Required */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-storm">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <I.people className="w-4 h-4 text-storm" />
                    <h3 className="text-sm font-serif font-bold text-ink">
                      4. Human Action Required
                    </h3>
                  </div>
                  <span className="field-badge-critical font-mono text-[10px]">
                    DECISION GATES
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.recommendedHumanActions?.map((act: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-canvas border border-line text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-paypal uppercase text-[11px]">
                          Role: {act.role}
                        </span>
                        <span
                          className={`field-badge-${
                            act.priority === "CRITICAL" ? "critical" : "neutral"
                          } text-[10px] font-mono`}
                        >
                          {act.priority}
                        </span>
                      </div>
                      <div className="font-semibold text-ink">{act.action}</div>
                      <div className="text-[11px] text-ink-2">{act.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Questioning & Provenance Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Ask the Watch Officer */}
            <div className="lg:col-span-7 field-paper p-6 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-ink-2 tracking-wider flex items-center gap-2">
                <I.aiAdvisor className="w-4 h-4 text-accent" />
                Ask the Watch Officer Copilot
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">
                Inquiries are answered strictly from authoritative server evidence. AI is barred from inventing financial amounts or overriding eligibility rules.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                  placeholder="Ask about readiness, funding gaps, or policy rules..."
                  className="flex-1 field-input text-xs py-2 px-3 bg-surface"
                />
                <button
                  onClick={() => runAnalysis()}
                  disabled={analyzing || !queryInput.trim()}
                  className="field-btn field-btn-primary text-xs px-4"
                >
                  Submit
                </button>
              </div>

              <div>
                <div className="text-[11px] font-mono font-semibold text-ink-3 uppercase tracking-wider mb-2">
                  Suggested Inquiries
                </div>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuestionClick(q)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-surface-2 text-xs text-ink-2 hover:text-ink transition flex items-center justify-between group border border-line/60 bg-surface"
                    >
                      <span className="line-clamp-1">{q}</span>
                      <I.chevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-accent shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence Provenance Registry */}
            <div className="lg:col-span-5 field-paper p-6 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-ink-2 tracking-wider flex items-center gap-2">
                <I.info className="w-4 h-4 text-accent" />
                Evidence Provenance Registry ({analysisData?.evidenceReferences?.length || 0})
              </div>
              <p className="text-xs text-ink-2">
                Each reference below names the source system, its verification status, and when it was read.
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {analysisData?.evidenceReferences?.map((ev: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-canvas border border-line text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-accent font-bold">{ev.evidenceId}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] bg-surface-2 text-ink-2 font-mono">
                        {ev.source}
                      </span>
                    </div>
                    <div className="text-ink-2 text-[11px] line-clamp-2 leading-relaxed">
                      {ev.summary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
