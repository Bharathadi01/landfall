"use client";

import React, { useState, useEffect } from "react";
import type { NormalizedAlert, ServiceHealth, DataMode } from "@/lib/sentinel/types";

export default function StormIntelligenceConsolePage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Health and Feed status
  const [nwsHealth, setNwsHealth] = useState<ServiceHealth | null>(null);
  const [feedStatus, setFeedStatus] = useState<any>(null);

  // Mode filter
  const [activeMode, setActiveMode] = useState<"ALL" | "LIVE" | "HISTORICAL_REPLAY">("ALL");

  // Selected alert for detailed inspection
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);

  // Replay state
  const [replaying, setReplaying] = useState(false);
  const [replayPackage, setReplayPackage] = useState<any | null>(null);
  const [selectedRadarIndex, setSelectedRadarIndex] = useState(0);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const modeParam = activeMode !== "ALL" ? `?mode=${activeMode}` : "";
      const res = await fetch(`/api/alerts${modeParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load alerts");
      setAlerts(data.alerts || []);
      setNwsHealth(data.nwsHealth || null);
      setFeedStatus(data.feedStatus || null);

      if (data.alerts?.length > 0 && !selectedAlert) {
        setSelectedAlert(data.alerts[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReplay = async () => {
    setReplaying(true);
    try {
      const res = await fetch("/api/alerts/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoActivate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger historical replay");
      setReplayPackage(data);
      await fetchAlerts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReplaying(false);
    }
  };

  const handlePollLive = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts/poll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to poll NWS");
      await fetchAlerts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [activeMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 space-y-8">
      {/* Replay Banner if historical replay is active */}
      {(replayPackage || selectedAlert?.mode === "HISTORICAL_REPLAY") && (
        <div className="bg-amber-950/80 border-2 border-amber-600 rounded-xl p-4 text-amber-200 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-amber-300">
                HISTORICAL REPLAY · Hurricane Milton (Oct 2024)
              </p>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Source: NWS via IEM VTEC Archive & NEXRAD radar tiles. Deterministic replay to demonstrate anticipatory workflow. Not a live warning.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded bg-amber-900 text-amber-200 text-xs font-bold border border-amber-700 uppercase">
            HISTORICAL REPLAY
          </span>
        </div>
      )}

      {/* Feed Staleness Warning Banner */}
      {feedStatus?.isStale && (
        <div className="bg-red-950/80 border border-red-700 rounded-xl p-3 text-red-200 text-xs flex items-center justify-between">
          <span>⚠️ {feedStatus.stalenessNotice}</span>
          <button
            onClick={handlePollLive}
            className="px-2.5 py-1 bg-red-800 hover:bg-red-700 rounded text-white text-xs font-semibold"
          >
            Poll NWS Now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Sentinel Disaster Intelligence Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
              §4.3 Official Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Official NWS alert ingestion, VTEC normalization, turf point-in-polygon exposure, and Iowa Environmental Mesonet (IEM) replay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePollLive}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-colors flex items-center gap-2"
          >
            <span>🔄</span>
            <span>{loading ? "Polling..." : "Poll Live NWS"}</span>
          </button>

          <button
            onClick={handleTriggerReplay}
            disabled={replaying}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold text-white shadow-lg transition-colors flex items-center gap-2"
          >
            <span>▶</span>
            <span>{replaying ? "Replaying..." : "Replay Milton 2024 (IEM)"}</span>
          </button>
        </div>
      </div>

      {/* Service Health & Invariant Indicator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* NWS Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Upstream NWS API</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  nwsHealth?.status === "HEALTHY"
                    ? "bg-emerald-400"
                    : nwsHealth?.status === "DEGRADED"
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
              />
              <span className="text-sm font-bold text-white">
                {nwsHealth?.status || "HEALTHY"}
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {nwsHealth?.latencyMs ? `${nwsHealth.latencyMs}ms` : "Live"}
          </span>
        </div>

        {/* Tranche 1 Trigger Policy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Tranche 1 Trigger Policy</span>
          <p className="text-xs text-emerald-400 font-semibold mt-1">
            Warnings Only (HU.W, SS.W, FF.W, EH.W)
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Watches & advisories are strictly informational.
          </span>
        </div>

        {/* Financial Separation Guard */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium">Financial Safety Invariant</span>
          <p className="text-xs text-blue-400 font-semibold mt-1">
            Disaster Intelligence Only
          </p>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            Sentinel NEVER moves money or sets payout amounts.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Main Two-Column View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active Alert Feed */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Active Alerts Feed ({alerts.length})
            </h2>

            {/* Mode Filter Selector */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveMode("ALL")}
                className={`px-2 py-0.5 rounded ${
                  activeMode === "ALL" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveMode("LIVE")}
                className={`px-2 py-0.5 rounded ${
                  activeMode === "LIVE" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setActiveMode("HISTORICAL_REPLAY")}
                className={`px-2 py-0.5 rounded ${
                  activeMode === "HISTORICAL_REPLAY" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                }`}
              >
                Replay
              </button>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
              No active warnings found. Click "Replay Milton 2024" above to demonstrate historical hurricane warnings.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                const isWarning = alert.significance === "W";
                const isReplay = alert.mode === "HISTORICAL_REPLAY";

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-slate-850 border-blue-500 shadow-md ring-1 ring-blue-500"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isReplay
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            }`}
                          >
                            {alert.mode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isWarning
                                ? "bg-red-950 text-red-300 border border-red-800"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {alert.event}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mt-1.5">{alert.headline}</h3>
                      </div>
                      {alert.isTranche1Eligible && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-950 text-blue-300 border border-blue-800 uppercase tracking-wider">
                          Tranche 1 Trigger
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800">
                      <span className="font-mono">Key: {alert.eventKey}</span>
                      <span>Expires: {new Date(alert.expires).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Geographic Alert Detail & Replay Radar */}
        <div className="lg:col-span-7 space-y-6">
          {selectedAlert ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              {/* Alert Title & Key */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                      {selectedAlert.eventKey}
                    </span>
                    <span className="text-xs text-slate-400">Office: {selectedAlert.office}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-200">
                    {selectedAlert.status} / {selectedAlert.messageType}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-2">{selectedAlert.headline}</h2>
                <p className="text-xs text-slate-400 mt-1">{selectedAlert.areaDesc}</p>
              </div>

              {/* Geographic Warning Geometry Detail */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Geographic Warning Polygon (§4.3)
                </h3>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Geometry Type:</span>
                    <span className="font-mono text-slate-200">
                      {selectedAlert.geometry?.type || "None (County/Zone Alert)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Polygon Coordinate Rings:</span>
                    <span className="font-mono text-slate-200">
                      {selectedAlert.geometry?.coordinates?.length || 0} ring(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Evaluated with Turf.js point-in-polygon. Displaced residents preserve original landfall coordinates for hazard checks.
                  </p>
                </div>
              </div>

              {/* Historical NEXRAD Radar Frame Player (if replay) */}
              {selectedAlert.mode === "HISTORICAL_REPLAY" && replayPackage?.radarFrames && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Historical NEXRAD Radar Playback (IEM Tampa Bay TBW-N0Q)
                  </h3>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-amber-300">
                        {replayPackage.radarFrames[selectedRadarIndex]?.headline}
                      </span>
                      <span className="font-mono text-slate-400">
                        {new Date(replayPackage.radarFrames[selectedRadarIndex]?.timestamp).toUTCString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      {replayPackage.radarFrames.map((frame: any, idx: number) => (
                        <button
                          key={frame.timestamp}
                          onClick={() => setSelectedRadarIndex(idx)}
                          className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-colors ${
                            selectedRadarIndex === idx
                              ? "bg-blue-600 text-white"
                              : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                          }`}
                        >
                          Frame {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Downstream Activation Traceability */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Downstream Relief Workflow Traceability (§6)
                </h3>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Downstream Signal:</span>
                    <span className="text-emerald-400 font-semibold">
                      {selectedAlert.isTranche1Eligible ? "✓ Eligible for Policy Evaluation" : "Informational Only"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Two-Person Passkey Approval:</span>
                    <span className="text-slate-300 font-medium">Mandatory before any payout</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Treasurer Execution:</span>
                    <span className="text-slate-300 font-medium">Code only; isolated from AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
              Select an alert from the feed to view geographic geometry and downstream traceability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
