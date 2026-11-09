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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-sm">
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
            ? "bg-slate-900/90 border-emerald-600/60 text-slate-200"
            : state === "STALE"
            ? "bg-amber-950/70 border-amber-600 text-amber-200"
            : state === "REPLAY"
            ? "bg-amber-950/90 border-amber-500 text-amber-100"
            : "bg-red-950/80 border-red-600 text-red-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                state === "LIVE"
                  ? "bg-emerald-400 animate-pulse"
                  : state === "STALE"
                  ? "bg-amber-400"
                  : state === "REPLAY"
                  ? "bg-amber-300"
                  : "bg-red-500"
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
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-100 transition-colors flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>{loading ? "Polling..." : "Refresh Feeds"}</span>
            </button>
          )}

          {onTriggerReplay && state !== "REPLAY" && (
            <button
              onClick={onTriggerReplay}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
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
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Target Community Relief Fund (§6)
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
                      ? "bg-blue-900/60 border border-blue-500 text-white shadow"
                      : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span>{fund.name}</span>
                    <span className="text-[10px] text-slate-400 block font-normal">
                      WFO {fund.wfo} · {fund.counties.join(", ")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400">
                    [{fund.centerLat.toFixed(2)}, {fund.centerLng.toFixed(2)}]
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* NHC Atlantic Basin Honesty Indicator */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                National Hurricane Center (NHC) Atlantic Feed
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  hasActiveAtlanticCyclone
                    ? "bg-red-950 text-red-300 border border-red-800"
                    : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                }`}
              >
                {hasActiveAtlanticCyclone ? "CYCLONE ACTIVE" : "HONEST STATUS: QUIET"}
              </span>
            </div>

            <div className="mt-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
              <span className="text-xl">{hasActiveAtlanticCyclone ? "🌀" : "🛡️"}</span>
              <div>
                <p className="text-xs font-bold text-white tracking-wide">
                  {atlanticStatusMessage}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verified against official NOAA NHC CurrentStorms JSON. Zero simulated storms displayed as live.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-2 border-t border-slate-800">
            <div>
              <span className="text-slate-400 block">NWS Alerts</span>
              <span className="font-bold text-white">{nwsAlerts.length} Active</span>
            </div>
            <div>
              <span className="text-slate-400 block">Tranche 1 Triggers</span>
              <span className="font-bold text-emerald-400">{tranche1AlertsCount} Warnings</span>
            </div>
            <div>
              <span className="text-slate-400 block">NHC Monitored</span>
              <span className="font-bold text-blue-400">{nhcStorms.length} Systems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real Station Observations (KTPF / Nearest WFO Station) */}
      {stationObservation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Official Surface Observation Station
              </span>
              <h3 className="text-xs font-bold text-white mt-0.5">
                {stationObservation.stationName} ({stationObservation.stationId})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {new Date(stationObservation.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Condition</span>
              <span className="font-bold text-white mt-0.5 block truncate">
                {stationObservation.description}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Temperature</span>
              <span className="font-bold text-white mt-0.5 block">
                {stationObservation.temperatureC !== null
                  ? `${stationObservation.temperatureC.toFixed(1)}°C / ${(
                      (stationObservation.temperatureC * 9) / 5 +
                      32
                    ).toFixed(1)}°F`
                  : "N/A"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Wind Velocity</span>
              <span className="font-bold text-white mt-0.5 block">
                {stationObservation.windSpeedKmh !== null
                  ? `${stationObservation.windSpeedKmh.toFixed(0)} km/h`
                  : "Calm"}
                {stationObservation.windGustKmh ? ` (Gust ${stationObservation.windGustKmh.toFixed(0)})` : ""}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Barometric Pressure</span>
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            NWS Hourly Wind & Precipitation Outlook (Next 8 Hours)
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 overflow-x-auto pb-1">
            {forecastPeriods.slice(0, 8).map((period) => (
              <div
                key={period.number}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center shrink-0"
              >
                <span className="text-[10px] text-slate-400 block font-mono">
                  {new Date(period.startTime).toLocaleTimeString([], { hour: "numeric" })}
                </span>
                <span className="text-xs font-bold text-white block mt-1">
                  {period.temperature}°{period.temperatureUnit}
                </span>
                <span className="text-[10px] text-blue-400 block mt-0.5">
                  {period.windSpeed}
                </span>
                {period.probabilityOfPrecipitation !== null && (
                  <span className="text-[9px] text-emerald-400 block mt-0.5 font-semibold">
                    ☔ {period.probabilityOfPrecipitation}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authoritative Source Attribution & Integrity Footer */}
      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">Authoritative Sources:</span>
          <a
            href="https://www.weather.gov/documentation/services-web-api"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-400 underline decoration-slate-600"
          >
            NWS API (v1.12)
          </a>
          <a
            href="https://www.nhc.noaa.gov/gis/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-400 underline decoration-slate-600"
          >
            NHC GIS Feeds
          </a>
          <a
            href="https://nowcoast.noaa.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-400 underline decoration-slate-600"
          >
            NOAA nowCOAST WMS
          </a>
        </div>
        <span className="font-mono text-slate-500">
          Last Synced: {sourcePublicationTime ? new Date(sourcePublicationTime).toLocaleTimeString() : "Live"}
        </span>
      </div>
    </div>
  );
}

