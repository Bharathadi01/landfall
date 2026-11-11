"use client";


import { PageTitle } from "@/components/ui/primitives";
import { I } from "@/components/icons";
import React, { useState, useEffect, useCallback } from "react";
import type { NormalizedAlert, ServiceHealth } from "@/lib/sentinel/types";
import { StormDesk } from "@/components/sentinel/desk/StormDesk";
import { WeatherIntelligencePanel } from "@/components/sentinel/WeatherIntelligencePanel";
import {
  COMMUNITY_FUNDS_GEO,
  type CommunityFundGeoScope,
  type UnifiedWeatherIntelligence,
} from "@/lib/sentinel/weather-client";
import type { ClusterExposureSummary, ExposureCluster } from "@/lib/sentinel/clusters";

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

  const fetchUnifiedWeather = useCallback(async (modeOverride?: "LIVE" | "HISTORICAL_REPLAY") => {
    setLoading(true);
    setError(null);
    try {
      const targetMode = modeOverride || (activeMode === "HISTORICAL_REPLAY" ? "HISTORICAL_REPLAY" : "LIVE");
      const res = await fetch(`/api/sentinel/live?fundId=${selectedFund.id}&mode=${targetMode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load live weather intelligence");

      setWeatherData(data.weather || null);
      setClusterData(data.clusters || null);

      if (data.weather?.nwsAlerts?.length > 0) {
        setSelectedAlert((prev: any) => prev ?? data.weather.nwsAlerts[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeMode, selectedFund.id]);

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
  }, [fetchUnifiedWeather]);

  const displayedAlerts = weatherData?.nwsAlerts || [];
  const mapMode =
    activeMode === "HISTORICAL_REPLAY" || replayPackage
      ? "REPLAY"
      : weatherData?.state || "LIVE";

  return (
    <div className="space-y-6">
      {/* Historical Replay Banner */}
      {(replayPackage || activeMode === "HISTORICAL_REPLAY") && (
        <div className="field-paper p-4 border-amber bg-amber-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber/20 text-amber font-bold text-lg">
              ⚠️
            </span>
            <div>
              <p className="font-bold text-xs font-mono uppercase tracking-wider text-amber">
                Historical Replay · Hurricane Milton (Oct 2024 Archive)
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
        <PageTitle
          eyebrow="Storm Map · NOAA & NWS"
          icon={I.forecastCone}
          tone="storm"
          title="Who is in the storm’s path?"
          accent="Answered by official data."
          description="Live radar, the forecast cone and official warning areas, laid over enrolled households. Homes are clustered so no one’s exact address is shown."
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handlePollLive}
            disabled={loading}
            className="field-btn field-btn-secondary text-xs flex items-center gap-1.5"
          >
            <I.refresh className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Polling..." : "Poll Live NWS"}</span>
          </button>

          <button
            onClick={handleTriggerReplay}
            disabled={replaying}
            className="field-btn field-btn-primary text-xs flex items-center gap-1.5"
          >
            <I.play className="w-3.5 h-3.5 fill-current" />
            <span>{replaying ? "Replaying..." : "Replay Milton 2024"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="field-paper p-4 border-storm bg-storm-soft flex items-center gap-3 text-sm text-storm">
          <I.warning className="w-5 h-5 flex-shrink-0" />
          <div>
            <strong className="font-semibold">Weather Engine Error:</strong> {error}
          </div>
        </div>
      )}

      {/* The live weather globe */}
      <StormDesk
        fund={selectedFund}
        alerts={displayedAlerts}
        clusters={clusterData}
        nhcStorms={weatherData?.nhcStorms || []}
        mode={mapMode}
        onSelectCluster={(c) => setSelectedCluster(c)}
        onSelectAlert={(a) => setSelectedAlert(a)}
      />

      {/* Weather Intelligence Telemetry Bar */}
      <div className="field-paper p-4 md:p-6 shadow-sm border border-line">
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
            <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
              Active Official Alerts ({displayedAlerts.length})
            </h2>

            <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-line text-xs font-mono">
              <button
                onClick={() => setActiveMode("ALL")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "ALL"
                    ? "bg-surface text-ink font-semibold shadow-xs"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveMode("LIVE")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "LIVE"
                    ? "bg-surface text-ink font-semibold shadow-xs"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setActiveMode("HISTORICAL_REPLAY")}
                className={`px-2.5 py-0.5 rounded transition ${
                  activeMode === "HISTORICAL_REPLAY"
                    ? "bg-surface text-ink font-semibold shadow-xs"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                Replay
              </button>
            </div>
          </div>

          {displayedAlerts.length === 0 ? (
            <div className="field-paper p-8 text-center text-xs text-ink-3">
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
                        ? "border-accent ring-2 ring-accent/20 shadow-md"
                        : "hover:border-ink-3/50"
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
                        <h3 className="text-sm font-semibold text-ink mt-2 leading-snug">
                          {alert.headline}
                        </h3>
                      </div>
                      {alert.isTranche1Eligible && (
                        <span className="field-badge-evergreen text-[10px] font-mono shrink-0">
                          Tranche 1 Trigger
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink-3 mt-3 pt-2 border-t border-line font-mono">
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
              <div className="border-b border-line pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="field-badge-evergreen font-mono text-xs">
                      {selectedAlert.eventKey}
                    </span>
                    <span className="text-xs text-ink-3 font-mono">Office: {selectedAlert.office}</span>
                  </div>
                  <span className="field-badge-neutral font-mono text-xs">
                    {selectedAlert.status} / {selectedAlert.messageType}
                  </span>
                </div>
                <h2 className="text-xl font-serif font-bold text-ink mt-2.5">
                  {selectedAlert.headline}
                </h2>
                <p className="text-xs text-ink-2 mt-1">{selectedAlert.areaDesc}</p>
              </div>

              {/* Geographic Warning Geometry Detail */}
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink mb-2">
                  Geographic Warning Polygon Geometry
                </h3>
                <div className="p-4 rounded-xl bg-canvas border border-line space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-2">Geometry Type:</span>
                    <span className="font-mono font-semibold text-ink">
                      {selectedAlert.geometry?.type || "None (County/Zone Alert)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-2">Polygon Coordinate Rings:</span>
                    <span className="font-mono font-semibold text-ink">
                      {selectedAlert.geometry?.coordinates?.length || 0} ring(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-3 italic pt-1 border-t border-line">
                    Evaluated with Turf.js point-in-polygon. AI is strictly barred from determining spatial exposure.
                  </p>
                </div>
              </div>

              {/* Historical NEXRAD Radar Frame Player (if replay) */}
              {selectedAlert.mode === "HISTORICAL_REPLAY" && replayPackage?.radarFrames && (
                <div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink mb-2">
                    Historical NEXRAD Radar Playback (IEM Tampa Bay TBW-N0Q)
                  </h3>
                  <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-amber">
                        {replayPackage.radarFrames[selectedRadarIndex]?.headline}
                      </span>
                      <span className="font-mono text-ink-3">
                        {new Date(replayPackage.radarFrames[selectedRadarIndex]?.timestamp).toUTCString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line">
                      {replayPackage.radarFrames.map((frame: any, idx: number) => (
                        <button
                          key={frame.timestamp}
                          onClick={() => setSelectedRadarIndex(idx)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono transition-colors ${
                            selectedRadarIndex === idx
                              ? "bg-accent text-white font-semibold"
                              : "bg-surface text-ink-2 hover:bg-surface-2 border border-line"
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
                <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink mb-2">
                  Downstream Relief Workflow Traceability
                </h3>
                <div className="p-4 rounded-xl bg-canvas border border-line text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-2">Downstream Signal:</span>
                    <span className="field-badge-evergreen font-mono text-[11px]">
                      {selectedAlert.isTranche1Eligible ? "✓ Eligible for Policy Evaluation" : "Informational Only"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-2">Two-Person Passkey Approval:</span>
                    <span className="text-ink font-medium">Mandatory before any payout</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-2">Treasurer Execution:</span>
                    <span className="text-ink font-medium">Code only; isolated from AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="field-paper p-12 text-center text-ink-3 text-sm">
              Select an alert from the feed to view geographic geometry and downstream traceability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
