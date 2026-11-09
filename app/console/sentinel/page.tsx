"use client";

import React, { useState, useEffect } from "react";
import type { NormalizedAlert, ServiceHealth } from "@/lib/sentinel/types";
import { WeatherMap } from "@/components/sentinel/WeatherMap";
import { WeatherIntelligencePanel } from "@/components/sentinel/WeatherIntelligencePanel";
import {
  COMMUNITY_FUNDS_GEO,
  type CommunityFundGeoScope,
  type UnifiedWeatherIntelligence,
} from "@/lib/sentinel/weather-client";
import type { ClusterExposureSummary, ExposureCluster } from "@/lib/sentinel/clusters";
import {
  RotateCcw,
  RefreshCw,
  Play,
  AlertTriangle,
  Radio,
  MapPin,
  Shield,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function StormIntelligenceConsolePage() {
  const [selectedFund, setSelectedFund] = useState<CommunityFundGeoScope>(COMMUNITY_FUNDS_GEO[0]);
  const [weatherData, setWeatherData] = useState<UnifiedWeatherIntelligence | null>(null);
  const [clusterData, setClusterData] = useState<ClusterExposureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active mode filter
  const [activeMode, setActiveMode] = useState<"ALL" | "LIVE" | "HISTORICAL_REPLAY">("ALL");

  // Selected alert for detailed inspection
  const [selectedAlert, setSelectedAlert] = useState<NormalizedAlert | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ExposureCluster | null>(null);

  // Replay state
  const [replaying, setReplaying] = useState(false);
  const [replayPackage, setReplayPackage] = useState<any | null>(null);
  const [selectedRadarIndex, setSelectedRadarIndex] = useState(0);

  const fetchUnifiedWeather = async (modeOverride?: "LIVE" | "HISTORICAL_REPLAY") => {
    setLoading(true);
    setError(null);
    try {
      const targetMode = modeOverride || (activeMode === "HISTORICAL_REPLAY" ? "HISTORICAL_REPLAY" : "LIVE");
      const res = await fetch(`/api/sentinel/live?fundId=${selectedFund.id}&mode=${targetMode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load live weather intelligence");

      setWeatherData(data.weather || null);
      setClusterData(data.clusters || null);

      if (data.weather?.nwsAlerts?.length > 0 && !selectedAlert) {
        setSelectedAlert(data.weather.nwsAlerts[0]);
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
      setActiveMode("HISTORICAL_REPLAY");
      await fetchUnifiedWeather("HISTORICAL_REPLAY");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReplaying(false);
    }
  };

  const handlePollLive = async () => {
    setLoading(true);
    try {
      await fetch("/api/alerts/poll", { method: "POST" });
      setActiveMode("LIVE");
      await fetchUnifiedWeather("LIVE");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnifiedWeather();
  }, [selectedFund.id, activeMode]);

  const displayedAlerts = weatherData?.nwsAlerts || [];
  const mapMode =
    activeMode === "HISTORICAL_REPLAY" || replayPackage
      ? "REPLAY"
      : weatherData?.state || "LIVE";

  return (
    <div className="space-y-6">
      {/* Historical Replay Banner */}
      {(replayPackage || activeMode === "HISTORICAL_REPLAY") && (
        <div className="field-paper p-4 border-[#D99B43] bg-[#FDF8EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[#D99B43]/20 text-[#D99B43] font-bold text-lg">
              ⚠️
            </span>
            <div>
              <p className="font-bold text-xs font-mono uppercase tracking-wider text-[#D99B43]">
                Historical Replay · Hurricane Milton (Oct 2024 Archive)
              </p>
              <p className="text-xs text-[#58665F] mt-0.5">
                Iowa Environmental Mesonet (IEM) VTEC official archive feed. Replay telemetry is tagged; zero live disbursements executed.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setReplayPackage(null);
              setActiveMode("LIVE");
              fetchUnifiedWeather("LIVE");
            }}
            className="field-btn field-btn-secondary text-xs self-start sm:self-auto font-medium"
          >
            Exit Replay Mode
          </button>
        </div>
      )}

      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="field-badge-evergreen">Sentinel Geospatial Engine</span>
            <span className="field-badge-neutral font-mono text-[11px]">NWS & NOAA nowCOAST WMS</span>
            <span className="field-badge-warning font-mono text-[11px]">Turf.js Point-in-Polygon</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#192A24] tracking-tight">
            Disaster Intelligence & Hazard Map
          </h1>
          <p className="text-sm text-[#58665F] mt-1.5 max-w-2xl leading-relaxed">
            Real-time US meteorological telemetry, storm trajectory predictions, and deterministic household
            exposure mapping for immediate anticipatory capital release.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePollLive}
            disabled={loading}
            className="field-btn field-btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Polling..." : "Poll Live NWS"}</span>
          </button>

          <button
            onClick={handleTriggerReplay}
            disabled={replaying}
            className="field-btn field-btn-primary text-xs flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{replaying ? "Replaying..." : "Replay Milton 2024"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="field-paper p-4 border-[#D76E4B] bg-[#FDF4F0] flex items-center gap-3 text-sm text-[#D76E4B]">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Weather Engine Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Signature Feature: Interactive Storm Atlas Weather & Exposure Map */}
      <div className="field-paper p-3 md:p-4 shadow-sm border border-[#DEDCD3] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#175B47] animate-pulse"></span>
            <h2 className="text-base font-serif font-bold text-[#192A24]">
              Storm Atlas 3D Weather & Exposure View
            </h2>
            <span className="text-xs text-[#7B847D] font-mono">
              (NOAA nowCOAST Radar · MapLibre GL)
            </span>
          </div>
          <span className="text-xs text-[#7B847D] font-mono">
            {clusterData?.totalHouseholds || 0} enrolled households mapped into differential-privacy clusters
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#DEDCD3]">
          <WeatherMap
            fund={selectedFund}
            alerts={displayedAlerts}
            clusters={clusterData}
            nhcStorms={weatherData?.nhcStorms || []}
            mode={mapMode}
            onSelectCluster={(c) => setSelectedCluster(c)}
            onSelectAlert={(a) => setSelectedAlert(a)}
          />
        </div>
      </div>

      {/* Weather Intelligence Telemetry Bar */}
      <div className="field-paper p-4 md:p-6 shadow-sm border border-[#DEDCD3]">
        <WeatherIntelligencePanel
          weather={weatherData}
          selectedFund={selectedFund}
          onSelectFund={(fund) => setSelectedFund(fund)}
          onSelectAlert={(a) => setSelectedAlert(a)}
          onTriggerReplay={handleTriggerReplay}
          onRefresh={handlePollLive}
          loading={loading}
        />
      </div>

      {/* Active Alert Feed & Geometric Inspection Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Alerts Feed List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F]">
              Active Official Alerts ({displayedAlerts.length})
            </h2>

            <div className="flex items-center gap-1 bg-[#ECEAE2] p-1 rounded-lg border border-[#DEDCD3] text-xs font-mono">
              <button
                onClick={() => setActiveMode("ALL")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "ALL"
                    ? "bg-[#FFFEFA] text-[#192A24] font-semibold shadow-xs"
                    : "text-[#7B847D] hover:text-[#192A24]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveMode("LIVE")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "LIVE"
                    ? "bg-[#FFFEFA] text-[#192A24] font-semibold shadow-xs"
                    : "text-[#7B847D] hover:text-[#192A24]"
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setActiveMode("HISTORICAL_REPLAY")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "HISTORICAL_REPLAY"
                    ? "bg-[#FFFEFA] text-[#192A24] font-semibold shadow-xs"
                    : "text-[#7B847D] hover:text-[#192A24]"
                }`}
              >
                Replay
              </button>
            </div>
          </div>

          {displayedAlerts.length === 0 ? (
            <div className="field-paper p-8 text-center text-xs text-[#7B847D]">
              No active warnings detected for {selectedFund.name}. Click &quot;Replay Milton 2024&quot; above to simulate historical hurricane alerts.
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {displayedAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                const isWarning = alert.significance === "W";
                const isReplay = alert.mode === "HISTORICAL_REPLAY";

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`field-paper p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#175B47] ring-2 ring-[#175B47]/20 shadow-md"
                        : "hover:border-[#7B847D]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              isReplay ? "field-badge-warning font-mono text-[10px]" : "field-badge-evergreen font-mono text-[10px]"
                            }
                          >
                            {alert.mode}
                          </span>
                          <span
                            className={
                              isWarning ? "field-badge-critical font-mono text-[10px]" : "field-badge-neutral font-mono text-[10px]"
                            }
                          >
                            {alert.event}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[#192A24] mt-2 leading-snug">
                          {alert.headline}
                        </h3>
                      </div>
                      {alert.isTranche1Eligible && (
                        <span className="field-badge-evergreen text-[10px] font-mono shrink-0">
                          Tranche 1 Trigger
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#7B847D] mt-3 pt-2 border-t border-[#DEDCD3] font-mono">
                      <span>VTEC: {alert.eventKey}</span>
                      <span>Expires: {new Date(alert.expires).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Geometry Details & Replay Radar Player */}
        <div className="lg:col-span-7 space-y-4">
          {selectedAlert ? (
            <div className="field-paper p-6 space-y-6">
              {/* Alert Title & Key */}
              <div className="border-b border-[#DEDCD3] pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="field-badge-evergreen font-mono text-xs">
                      {selectedAlert.eventKey}
                    </span>
                    <span className="text-xs text-[#7B847D] font-mono">Office: {selectedAlert.office}</span>
                  </div>
                  <span className="field-badge-neutral font-mono text-xs">
                    {selectedAlert.status} / {selectedAlert.messageType}
                  </span>
                </div>
                <h2 className="text-xl font-serif font-bold text-[#192A24] mt-2.5">
                  {selectedAlert.headline}
                </h2>
                <p className="text-xs text-[#58665F] mt-1">{selectedAlert.areaDesc}</p>
              </div>

              {/* Geographic Warning Geometry Detail */}
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F] mb-2">
                  Geographic Warning Polygon Geometry (§6)
                </h3>
                <div className="p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#58665F]">Geometry Type:</span>
                    <span className="font-mono font-semibold text-[#192A24]">
                      {selectedAlert.geometry?.type || "None (County/Zone Alert)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#58665F]">Polygon Coordinate Rings:</span>
                    <span className="font-mono font-semibold text-[#192A24]">
                      {selectedAlert.geometry?.coordinates?.length || 0} ring(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7B847D] italic pt-1 border-t border-[#DEDCD3]">
                    Evaluated with Turf.js point-in-polygon. AI is strictly barred from determining spatial exposure.
                  </p>
                </div>
              </div>

              {/* Historical NEXRAD Radar Frame Player (if replay) */}
              {selectedAlert.mode === "HISTORICAL_REPLAY" && replayPackage?.radarFrames && (
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F] mb-2">
                    Historical NEXRAD Radar Playback (IEM Tampa Bay TBW-N0Q)
                  </h3>
                  <div className="p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#D99B43]">
                        {replayPackage.radarFrames[selectedRadarIndex]?.headline}
                      </span>
                      <span className="font-mono text-[#7B847D]">
                        {new Date(replayPackage.radarFrames[selectedRadarIndex]?.timestamp).toUTCString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#DEDCD3]">
                      {replayPackage.radarFrames.map((frame: any, idx: number) => (
                        <button
                          key={frame.timestamp}
                          onClick={() => setSelectedRadarIndex(idx)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono transition-colors ${
                            selectedRadarIndex === idx
                              ? "bg-[#175B47] text-white font-semibold"
                              : "bg-[#FFFEFA] text-[#58665F] hover:bg-[#ECEAE2] border border-[#DEDCD3]"
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
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#58665F] mb-2">
                  Downstream Relief Workflow Traceability (§6)
                </h3>
                <div className="p-4 rounded-xl bg-[#F4F2EC] border border-[#DEDCD3] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#58665F]">Downstream Signal:</span>
                    <span className="field-badge-evergreen font-mono text-[11px]">
                      {selectedAlert.isTranche1Eligible ? "✓ Eligible for Policy Evaluation" : "Informational Only"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#58665F]">Two-Person Passkey Approval:</span>
                    <span className="text-[#192A24] font-medium">Mandatory before any payout</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#58665F]">Treasurer Execution:</span>
                    <span className="text-[#192A24] font-medium">Code only; isolated from AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="field-paper p-12 text-center text-[#7B847D] text-sm">
              Select an alert from the feed to view geographic geometry and downstream traceability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
