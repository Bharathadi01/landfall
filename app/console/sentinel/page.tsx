"use client";


import { PageHeader } from "@/components/ui/primitives";
import { Tag } from "@/components/ui/Tag";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { I } from "@/components/icons";
import React, { useState, useEffect, useCallback } from "react";
import type { NormalizedAlert, ServiceHealth } from "@/lib/sentinel/types";
import { StormDesk } from "@/components/sentinel/desk/StormDesk";
import { Button } from "@/components/ui/Button";
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

  const replayOn = !!replayPackage || activeMode === "HISTORICAL_REPLAY";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Before landfall · NOAA, NWS, NASA and RainViewer feeds"
        title="Who is in the storm’s path?"
        accent="Answered by official data."
        description="Live satellite clouds, radar and model winds, with official warnings laid over the homes enrolled for relief. Homes are clustered, so no one’s exact address is shown."
        actions={
          <>
            <Button variant="glass" onClick={handlePollLive} loading={loading} leading={<I.refresh className="h-4 w-4" />}>
              {loading ? "Checking…" : "Refresh warnings"}
            </Button>
            <Button variant="signal" onClick={handleTriggerReplay} loading={replaying} leading={<I.play className="h-4 w-4" />}>
              {replaying ? "Loading replay…" : "Replay Hurricane Milton"}
            </Button>
          </>
        }
      />

      {replayOn && (
        <div className="note flex flex-wrap items-center justify-between gap-3" data-tone="amber">
          <span>
            <span className="note-label">Replay · Hurricane Milton, October 2024</span>
            Archived official warnings from the Iowa Environmental Mesonet. Everything from the replay is labelled; no payment moves.
          </span>
          <Button
            variant="glass"
            size="sm"
            onClick={() => {
              setReplayPackage(null);
              setActiveMode("LIVE");
              fetchUnifiedWeather("LIVE");
            }}
          >
            Back to live
          </Button>
        </div>
      )}

      {error && (
        <div className="note" data-tone="danger" role="alert"><span className="note-label">We couldn’t load the weather feed</span>{error}</div>
      )}

      {/* the live weather globe */}
      <StormDesk
        fund={selectedFund}
        alerts={displayedAlerts}
        clusters={clusterData}
        nhcStorms={weatherData?.nhcStorms || []}
        mode={mapMode}
        onSelectCluster={(c) => setSelectedCluster(c)}
        onSelectAlert={(a) => setSelectedAlert(a)}
      />

      {/* official warnings: a list, and what the selected one would trigger */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12" aria-labelledby="alerts-h">
        <div className="space-y-4 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="alerts-h" className="text-title-2 text-ink">
              Active Official Alerts <span className="text-ink-3">· {displayedAlerts.length}</span>
            </h2>
            <SegmentedTabs<"ALL" | "LIVE" | "HISTORICAL_REPLAY">
              ariaLabel="Which alerts"
              size="sm"
              value={(activeMode as any) ?? "ALL"}
              onChange={(k) => setActiveMode(k as any)}
              tabs={[{ id: "ALL", label: "All" }, { id: "LIVE", label: "Live" }, { id: "HISTORICAL_REPLAY", label: "Replay" }]}
            />
          </div>

          {displayedAlerts.length === 0 ? (
            <div className="pane p-8 text-center text-[14px] text-ink-2">
              No active warnings for {selectedFund.name}. That is the usual state. Press <span className="font-semibold text-ink">Replay Hurricane Milton</span> to see a real past storm.
            </div>
          ) : (
            <ul className="max-h-[560px] space-y-2.5 overflow-y-auto pr-1" tabIndex={0} aria-label="Active official alerts">
              {displayedAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                const isWarning = alert.significance === "W";
                const isReplay = alert.mode === "HISTORICAL_REPLAY";
                return (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedAlert(alert)}
                      aria-pressed={isSelected}
                      className={`pane w-full p-4 text-left transition-colors ${isSelected ? "!border-accent ring-2 ring-accent/15" : "hover:!border-line-strong"}`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Tag tone={isReplay ? "amber" : "delivered"}>{isReplay ? "Replay" : "Live"}</Tag>
                        <Tag tone={isWarning ? "danger" : "neutral"}>{alert.event}</Tag>
                        {alert.isTranche1Eligible && <Tag tone="accent">Can trigger relief</Tag>}
                      </div>
                      <h3 className="mt-2.5 text-[14.5px] font-semibold leading-snug text-ink">{alert.headline}</h3>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[12px] text-ink-3">
                        <span className="font-code">{alert.eventKey}</span>
                        <span>Expires {new Date(alert.expires).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-7">
          {selectedAlert ? (
            <div className="pane space-y-6 p-6 lg:sticky lg:top-[84px]">
              <div className="border-b border-line pb-4">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                  <span className="font-code text-ink-2">{selectedAlert.eventKey}</span>
                  <span>· Office {selectedAlert.office}</span>
                  <span>· {String(selectedAlert.status).toLowerCase()} / {String(selectedAlert.messageType).toLowerCase()}</span>
                </div>
                <h2 className="mt-2 text-title-2 text-ink">{selectedAlert.headline}</h2>
                <p className="mt-1.5 text-[13.5px] text-ink-2">{selectedAlert.areaDesc}</p>
              </div>

              <dl className="divide-y divide-line">
                <Row label="Where it applies" value={`${selectedAlert.geometry?.type || "County or zone"} · ${selectedAlert.geometry?.coordinates?.length || 0} ring(s)`} note="Homes are tested against this shape with a point-in-polygon check in code. The AI never decides who is exposed." />
                <Row label="What it triggers" value={selectedAlert.isTranche1Eligible ? "Eligible for the relief policy" : "Information only"} note={selectedAlert.isTranche1Eligible ? "The fixed policy can now decide who is paid and how much." : "This kind of alert does not start a payment."} />
                <Row label="Before any payout" value="Two different people approve" note="Then the Treasurer, which is code and not AI, sends it once." />
              </dl>

              {selectedAlert.mode === "HISTORICAL_REPLAY" && replayPackage?.radarFrames && (
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">Radar at the time</h3>
                  <p className="mt-1 text-[13px] text-ink-3">{replayPackage.radarFrames[selectedRadarIndex]?.headline} · {new Date(replayPackage.radarFrames[selectedRadarIndex]?.timestamp).toUTCString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {replayPackage.radarFrames.map((frame: any, idx: number) => (
                      <Button key={frame.timestamp} size="sm" variant={selectedRadarIndex === idx ? "signal" : "glass"} onClick={() => setSelectedRadarIndex(idx)}>
                        Frame {idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pane flex h-full min-h-[220px] items-center justify-center p-10 text-center text-[14px] text-ink-3">
              Choose an alert to see where it applies and what it would set in motion.
            </div>
          )}
        </div>
      </section>

      {/* conditions on the ground, for the fund chosen */}
      <section aria-labelledby="ground-h" className="space-y-4">
        <h2 id="ground-h" className="text-title-2 text-ink">Conditions at the fund</h2>
        <div className="pane p-5 md:p-6">
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
      </section>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd>
        <div className="text-[14.5px] font-semibold text-ink">{value}</div>
        <div className="mt-0.5 text-[13px] text-ink-2">{note}</div>
      </dd>
    </div>
  );
}
