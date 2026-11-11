"use client";

import React from "react";
import type { UnifiedWeatherIntelligence, CommunityFundGeoScope } from "@/lib/sentinel/weather-client";
import { COMMUNITY_FUNDS_GEO } from "@/lib/sentinel/weather-client";
import type { NormalizedAlert } from "@/lib/sentinel/types";

export interface WeatherIntelligencePanelProps {
  weather: UnifiedWeatherIntelligence | null;
  selectedFund: CommunityFundGeoScope;
  onSelectFund: (fund: CommunityFundGeoScope) => void;
  onSelectAlert?: (alert: NormalizedAlert) => void;
  onTriggerReplay?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function WeatherIntelligencePanel({
  weather,
  selectedFund,
  onSelectFund,
  onSelectAlert,
  onTriggerReplay,
  onRefresh,
  loading = false,
}: WeatherIntelligencePanelProps) {
  if (!weather) {
    return (
      <div className="bg-surface-2 border border-line rounded-2xl p-6 text-center text-ink-2 text-sm">
        Loading authoritative weather intelligence...
      </div>
    );
  }

  const {
    state,
    stateNotice,
    feedAgeSeconds,
    sourcePublicationTime,
    nwsAlerts,
    tranche1AlertsCount,
    hasActiveAtlanticCyclone,
    atlanticStatusMessage,
    nhcStorms,
    stationObservation,
    forecastPeriods,
    health,
  } = weather;

  return (
    <div className="space-y-6">
      {/* Top Banner: Visible System State & Freshness */}
      <div
        className={`rounded-2xl p-4 border shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
          state === "LIVE"
            ? "bg-surface-2/90 border-delivered/60 text-ink"
            : state === "STALE"
            ? "bg-amber-soft/70 border-amber text-amber"
            : state === "REPLAY"
            ? "bg-amber-soft/90 border-amber0 text-amber"
            : "bg-danger-soft/80 border-danger text-danger"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                state === "LIVE"
                  ? "bg-delivered animate-pulse"
                  : state === "STALE"
                  ? "bg-amber"
                  : state === "REPLAY"
                  ? "bg-amber"
                  : "bg-danger0"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm uppercase tracking-wider">
                {state} SYSTEM STATE
              </span>
              <span className="text-xs opacity-75 font-mono">
                {state === "LIVE"
                  ? `(Feed age: ${feedAgeSeconds}s)`
                  : state === "STALE"
                  ? `(Age: ${Math.floor(feedAgeSeconds / 60)}m — Retained)`
                  : `(Source: IEM Archive)`}
              </span>
            </div>
            <p className="text-xs mt-1 leading-relaxed opacity-90">{stateNotice}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-3 border border-line text-xs font-semibold text-ink transition-colors flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>{loading ? "Polling..." : "Refresh Feeds"}</span>
            </button>
          )}

          {onTriggerReplay && state !== "REPLAY" && (
            <button
              onClick={onTriggerReplay}
              className="px-3.5 py-1.5 rounded-lg bg-amber hover:bg-amber0 text-[#17141a] text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>▶</span>
              <span>Replay Milton 2024</span>
            </button>
          )}
        </div>
      </div>

      {/* Community Fund Selector & Official NHC Atlantic Status */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Fund Selector */}
        <div className="md:col-span-5 bg-surface-2 border border-line rounded-xl p-4 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
            Target Community Relief Fund
          </span>
          <div className="flex flex-col gap-1.5">
            {COMMUNITY_FUNDS_GEO.map((fund) => {
              const isSelected = fund.id === selectedFund.id;
              return (
                <button
                  key={fund.id}
                  onClick={() => onSelectFund(fund)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-paypal-soft/60 border border-paypal0 text-white shadow"
                      : "bg-surface border border-line text-ink-2 hover:border-line"
                  }`}
                >
                  <div>
                    <span>{fund.name}</span>
                    <span className="text-[10px] text-ink-2 block font-normal">
                      WFO {fund.wfo} · {fund.counties.join(", ")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-paypal">
                    [{fund.centerLat.toFixed(2)}, {fund.centerLng.toFixed(2)}]
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* NHC Atlantic Basin Honesty Indicator */}
        <div className="md:col-span-7 bg-surface-2 border border-line rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
                National Hurricane Center (NHC) Atlantic Feed
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  hasActiveAtlanticCyclone
                    ? "bg-danger-soft text-danger border border-danger-line"
                    : "bg-delivered-soft text-delivered border border-delivered-line"
                }`}
              >
                {hasActiveAtlanticCyclone ? "CYCLONE ACTIVE" : "HONEST STATUS: QUIET"}
              </span>
            </div>

            <div className="mt-2.5 p-3 rounded-lg bg-surface border border-line flex items-center gap-3">
              <span className="text-xl">{hasActiveAtlanticCyclone ? "🌀" : "🛡️"}</span>
              <div>
                <p className="text-xs font-bold text-white tracking-wide">
                  {atlanticStatusMessage}
                </p>
                <p className="text-[11px] text-ink-2 mt-0.5">
                  Verified against official NOAA NHC CurrentStorms JSON. Zero simulated storms displayed as live.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-2 border-t border-line">
            <div>
              <span className="text-ink-2 block">NWS Alerts</span>
              <span className="font-bold text-white">{nwsAlerts.length} Active</span>
            </div>
            <div>
              <span className="text-ink-2 block">Tranche 1 Triggers</span>
              <span className="font-bold text-delivered">{tranche1AlertsCount} Warnings</span>
            </div>
            <div>
              <span className="text-ink-2 block">NHC Monitored</span>
              <span className="font-bold text-paypal">{nhcStorms.length} Systems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real Station Observations (KTPF / Nearest WFO Station) */}
      {stationObservation && (
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
                Official Surface Observation Station
              </span>
              <h2 className="text-xs font-bold text-white mt-0.5">
                {stationObservation.stationName} ({stationObservation.stationId})
              </h2>
            </div>
            <span className="text-[10px] font-mono text-ink-2">
              {new Date(stationObservation.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-line">
              <span className="text-ink-2 text-[11px] block">Condition</span>
              <span className="font-bold text-white mt-0.5 block truncate">
                {stationObservation.description}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line">
              <span className="text-ink-2 text-[11px] block">Temperature</span>
              <span className="font-bold text-white mt-0.5 block">
                {stationObservation.temperatureC !== null
                  ? `${stationObservation.temperatureC.toFixed(1)}°C / ${(
                      (stationObservation.temperatureC * 9) / 5 +
                      32
                    ).toFixed(1)}°F`
                  : "N/A"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line">
              <span className="text-ink-2 text-[11px] block">Wind Velocity</span>
              <span className="font-bold text-white mt-0.5 block">
                {stationObservation.windSpeedKmh !== null
                  ? `${stationObservation.windSpeedKmh.toFixed(0)} km/h`
                  : "Calm"}
                {stationObservation.windGustKmh ? ` (Gust ${stationObservation.windGustKmh.toFixed(0)})` : ""}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-line">
              <span className="text-ink-2 text-[11px] block">Barometric Pressure</span>
              <span className="font-bold text-white mt-0.5 block">
                {stationObservation.barometricPressurePa !== null
                  ? `${(stationObservation.barometricPressurePa / 100).toFixed(1)} hPa`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hourly Forecast Strip (NWS gridpoints) */}
      {forecastPeriods.length > 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
            NWS Hourly Wind & Precipitation Outlook (Next 8 Hours)
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 overflow-x-auto pb-1">
            {forecastPeriods.slice(0, 8).map((period) => (
              <div
                key={period.number}
                className="p-2 rounded-lg bg-surface border border-line text-center shrink-0"
              >
                <span className="text-[10px] text-ink-2 block font-mono">
                  {new Date(period.startTime).toLocaleTimeString([], { hour: "numeric" })}
                </span>
                <span className="text-xs font-bold text-white block mt-1">
                  {period.temperature}°{period.temperatureUnit}
                </span>
                <span className="text-[10px] text-paypal block mt-0.5">
                  {period.windSpeed}
                </span>
                {period.probabilityOfPrecipitation !== null && (
                  <span className="text-[9px] text-delivered block mt-0.5 font-semibold">
                    ☔ {period.probabilityOfPrecipitation}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authoritative Source Attribution & Integrity Footer */}
      <div className="p-3 bg-surface border border-line rounded-xl flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-2">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-ink-2">Authoritative Sources:</span>
          <a
            href="https://www.weather.gov/documentation/services-web-api"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-paypal underline decoration-ink-3"
          >
            NWS API (v1.12)
          </a>
          <a
            href="https://www.nhc.noaa.gov/gis/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-paypal underline decoration-ink-3"
          >
            NHC GIS Feeds
          </a>
          <a
            href="https://nowcoast.noaa.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-paypal underline decoration-ink-3"
          >
            NOAA nowCOAST WMS
          </a>
        </div>
        <span className="font-mono text-ink0">
          Last Synced: {sourcePublicationTime ? new Date(sourcePublicationTime).toLocaleTimeString() : "Live"}
        </span>
      </div>
    </div>
  );
}

