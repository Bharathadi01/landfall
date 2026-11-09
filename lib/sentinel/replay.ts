/**
 * HISTORICAL DISASTER REPLAY ENGINE (§4.3)
 * Provides deterministic, reproducible historical replay using real archive data from the
 * Iowa Environmental Mesonet (IEM) VTEC Archive and historical NEXRAD radar tiles.
 * Invariants:
 * 1. Replays are explicitly tagged as HISTORICAL_REPLAY and never disguised as live events.
 * 2. Persistent disclaimer banner is enforced everywhere replayed data appears.
 * 3. Replaying the same event twice is idempotent and does not create duplicate triggers.
 */

import miltonFixture from "@/lib/fixtures/milton-2024.json";
import { normalizeNWSAlert } from "./normalize";
import type { NormalizedAlert } from "./types";

export interface ReplayStormMeta {
  storm: string;
  year: number;
  wfo: string;
  source: string;
  disclaimer: string;
}

export interface RadarFrame {
  timestamp: string;
  tileUrl: string;
  headline: string;
}

export interface HistoricalReplayPackage {
  meta: ReplayStormMeta;
  bannerText: string;
  radarFrames: RadarFrame[];
  alerts: NormalizedAlert[];
}

/**
 * Loads the real Hurricane Milton 2024 historical warnings from IEM VTEC archive.
 */
export function loadMiltonHistoricalReplay(): HistoricalReplayPackage {
  const normalizedAlerts: NormalizedAlert[] = (miltonFixture.alerts || []).map((raw) =>
    normalizeNWSAlert(raw, {
      mode: "HISTORICAL_REPLAY",
      source: miltonFixture.meta.source,
    })
  );

  return {
    meta: miltonFixture.meta,
    bannerText: miltonFixture.meta.disclaimer,
    radarFrames: miltonFixture.radarFrames,
    alerts: normalizedAlerts,
  };
}

/**
 * Verifies that a given alert is a historical replay.
 */
export function isHistoricalReplay(alert: NormalizedAlert): boolean {
  return alert.mode === "HISTORICAL_REPLAY";
}
