"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Layers,
  HelpCircle,
  FileText,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  Lock,
  Sparkles,
} from "lucide-react";

export default function WatchOfficerConsolePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [queryInput, setQueryInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialStatus();
  }, []);

  async function fetchInitialStatus() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/watch-officer");
      const data = await res.json();
      if (data.latestRun?.analysis) {
        setAnalysisData(data.latestRun.analysis);
      } else {
        await runAnalysis();
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
        <div className="field-paper p-4 border-[#D99B43] bg-[#FDF8EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[#D99B43]/20 text-[#D99B43] font-bold text-lg">
              ⚠️
            </span>
            <div>
              <p className="font-bold text-xs font-mono uppercase tracking-wider text-[#D99B43]">
                Historical Replay Mode · Hurricane Milton (Oct 2024 Archive)
              </p>
              <p className="text-xs text-[#58665F] mt-0.5">
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="field-badge-evergreen">Field Atlas Watch Officer</span>
            <span className="field-badge-neutral font-mono text-[11px]">Read-Only AI Copilot</span>
            <span className="field-badge-warning font-mono text-[11px]">Ground Truth Bound</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#192A24] tracking-tight">
            Evidence Workspace & Operational Briefing
          </h1>
          <p className="text-sm text-[#58665F] mt-1.5 max-w-2xl leading-relaxed">
            Read-only financial intelligence, constraint reasoning, deterministic scenario analysis,
            and auditable human decision support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => runAnalysis()}
            disabled={analyzing}
            className="field-btn field-btn-primary text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
            <span>{analyzing ? "Synthesizing Briefing..." : "Refresh Intelligence"}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="field-paper p-4 border-[#D76E4B] bg-[#FDF4F0] flex items-center gap-3 text-sm text-[#D76E4B]">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Analysis Notice:</strong> {errorMessage}
          </div>
        </div>
      )}

      {loading ? (
        <div className="field-paper py-24 text-center text-[#7B847D] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#175B47]" />
          <p className="font-mono text-xs">Connecting to Sentinel, Treasury & Policy telemetry...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Operational Status Banner (4 Core Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Event Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-[#7B847D] font-mono uppercase tracking-wider">
                Disaster Context
              </div>
              <div className="mt-2 text-lg font-serif font-bold text-[#192A24] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#D76E4B]" />
                <span className="truncate">{event?.eventName || "No Active Alert"}</span>
              </div>
              <div className="mt-1 text-xs text-[#58665F] font-mono">
                {event?.eventKey || "TBW:HU.W:0009"} · {event?.severity || "Extreme"}
              </div>
            </div>

            {/* Financial Readiness Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-[#7B847D] font-mono uppercase tracking-wider">
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
                <span className="text-sm font-bold text-[#192A24] font-serif tabular-nums">
                  {readiness?.coveragePercentage ?? 0}% Coverage
                </span>
              </div>
              <div className="mt-1 text-xs text-[#58665F] line-clamp-1" title={readiness?.reason}>
                {readiness?.reason || "Telemetry loaded"}
              </div>
            </div>

            {/* Allocatable Cash Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-[#7B847D] font-mono uppercase tracking-wider">
                Allocatable Liquidity
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#175B47] tabular-nums">
                {constraints?.allocatableFormatted || "$0.00"}
              </div>
              <div className="mt-1 text-xs text-[#58665F]">
                30% Reserve: {constraints?.reserveProtectedFormatted || "$0.00"} (Protected)
              </div>
            </div>

            {/* Funding Requirement Card */}
            <div className="field-paper p-5">
              <div className="text-[11px] text-[#7B847D] font-mono uppercase tracking-wider">
                Funding Requirement
              </div>
              <div className="mt-2 text-2xl font-serif font-bold text-[#192A24] tabular-nums">
                {constraints?.requiredFundingFormatted || "$0.00"}
              </div>
              <div className="mt-1 text-xs text-[#58665F]">
                Gap: <span className="text-[#D99B43] font-semibold">{constraints?.fundingGapFormatted || "$0.00"}</span>
              </div>
            </div>
          </div>

          {/* Executive Summary Callout */}
          <div className="field-paper p-6 bg-[#FFFEFA] border border-[#DEDCD3] shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEDCD3]">
              <div className="flex items-center gap-2 text-[#175B47] text-xs font-mono font-bold uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                Executive Operational Brief
              </div>
              <span className="field-badge-neutral text-[10px] font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" />
                AI Output: Read-Only (Non-Authoritative)
              </span>
            </div>
            <p className="mt-4 text-[#192A24] text-sm md:text-base leading-relaxed">
              {analysisData?.summary || "Watch Officer synthesizing operational telemetry across Pinellas County..."}
            </p>
          </div>

          {/* 4-Quadrant Evidence Workspace */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
                4-Quadrant Evidence Workspace
              </h2>
              <span className="text-xs text-[#7B847D] font-mono">
                Rigorous operational distinction: Verified Facts vs Hypotheses vs Unknowns vs Actions
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quadrant 1: Verified Facts */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-[#175B47]">
                <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#175B47]" />
                    <h3 className="text-sm font-serif font-bold text-[#192A24]">
                      1. Verified Facts (Ground Truth)
                    </h3>
                  </div>
                  <span className="field-badge-evergreen font-mono text-[10px]">
                    100% CITED
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.keyFindings?.map((kf: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3] flex items-start justify-between gap-3 text-xs"
                    >
                      <span className="text-[#192A24] leading-relaxed font-medium">{kf.finding}</span>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-[#E0EEE7] text-[#175B47] font-semibold shrink-0">
                        {kf.evidenceId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadrant 2: Working Hypotheses */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-[#316B9B]">
                <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#316B9B]" />
                    <h3 className="text-sm font-serif font-bold text-[#192A24]">
                      2. Working Hypotheses & Model Scenarios
                    </h3>
                  </div>
                  <span className="field-badge-neutral font-mono text-[10px]">
                    DETERMINISTIC SIMULATION
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.scenarioComparisons?.map((sc: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#192A24]">{sc.title}</span>
                        <span
                          className={`field-badge-${
                            sc.readinessState === "READY" ? "evergreen" : "warning"
                          } text-[10px] font-mono`}
                        >
                          {sc.readinessState} ({sc.coveragePercentage}%)
                        </span>
                      </div>
                      <div className="text-[11px] text-[#58665F]">
                        Tradeoff: {sc.tradeoffSummary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadrant 3: Key Unknowns */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-[#D99B43]">
                <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2.5">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#D99B43]" />
                    <h3 className="text-sm font-serif font-bold text-[#192A24]">
                      3. Key Unknowns & Uncertainties
                    </h3>
                  </div>
                  <span className="field-badge-warning font-mono text-[10px]">
                    MONITORED PARAMETERS
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                    <div className="font-semibold text-[#192A24]">Inland Storm Surge Extent</div>
                    <p className="text-[#58665F] mt-1 text-[11px] leading-relaxed">
                      Actual water level rise dependent on tidal timing at Tampa Bay entrance during Category 4 eyewall passage.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                    <div className="font-semibold text-[#192A24]">Late-Enrollee Intake Volume</div>
                    <p className="text-[#58665F] mt-1 text-[11px] leading-relaxed">
                      Estimated 15-25 additional vulnerable households may submit evidence prior to grid power disruption.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3]">
                    <div className="font-semibold text-[#192A24]">Standby Pledge Conversion Rate</div>
                    <p className="text-[#58665F] mt-1 text-[11px] leading-relaxed">
                      $15,000 contingent donor pledges awaiting manual credit card settlement confirmation from institutional funders.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quadrant 4: Human Action Required */}
              <div className="field-paper p-5 space-y-3 border-t-4 border-t-[#D76E4B]">
                <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D76E4B]" />
                    <h3 className="text-sm font-serif font-bold text-[#192A24]">
                      4. Human Action Required
                    </h3>
                  </div>
                  <span className="field-badge-critical font-mono text-[10px]">
                    DECISION GATES
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysisData?.recommendedHumanActions?.map((act: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#316B9B] uppercase text-[11px]">
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
                      <div className="font-semibold text-[#192A24]">{act.action}</div>
                      <div className="text-[11px] text-[#58665F]">{act.reason}</div>
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
              <div className="text-xs font-mono font-bold uppercase text-[#58665F] tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#175B47]" />
                Ask the Watch Officer Copilot
              </div>
              <p className="text-xs text-[#58665F] leading-relaxed">
                Inquiries are answered strictly from authoritative server evidence. AI is barred from inventing financial amounts or overriding eligibility rules.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                  placeholder="Ask about readiness, funding gaps, or policy rules..."
                  className="flex-1 field-input text-xs py-2 px-3 bg-[#FFFEFA]"
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
                <div className="text-[11px] font-mono font-semibold text-[#7B847D] uppercase tracking-wider mb-2">
                  Suggested Inquiries
                </div>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuestionClick(q)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-[#ECEAE2] text-xs text-[#58665F] hover:text-[#192A24] transition flex items-center justify-between group border border-[#DEDCD3]/60 bg-[#FFFEFA]"
                    >
                      <span className="line-clamp-1">{q}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#7B847D] group-hover:text-[#175B47] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Evidence Provenance Registry */}
            <div className="lg:col-span-5 field-paper p-6 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-[#58665F] tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-[#175B47]" />
                Evidence Provenance Registry ({analysisData?.evidenceReferences?.length || 0})
              </div>
              <p className="text-xs text-[#58665F]">
                Inspect exact source systems and cryptographic verification references.
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {analysisData?.evidenceReferences?.map((ev: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[#F4F2EC] border border-[#DEDCD3] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#175B47] font-bold">{ev.evidenceId}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] bg-[#ECEAE2] text-[#58665F] font-mono">
                        {ev.source}
                      </span>
                    </div>
                    <div className="text-[#58665F] text-[11px] line-clamp-2 leading-relaxed">
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
