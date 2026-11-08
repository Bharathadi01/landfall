/**
 * SENTINEL WEATHER ENGINE (§4.3)
 * Monitors NWS alerts, normalizes VTEC event chains, verifies point exposure,
 * and provides historical IEM replay fixtures.
 */

import { isPointInsideAlertGeometry, type GeoPoint, type NWSGeometry } from "@/lib/geo/resolver";
import miltonFixture from "@/lib/fixtures/milton-2024.json";

export interface NormalizedAlert {
  id: string;
  eventKey: string; // e.g. "TBW:HU.W:0009"
  vtec?: string;
  phenomena: string; // "HU", "SS", "FF", "EH"
  significance: string; // "W" (Warning), "A" (Watch), "Y" (Advisory)
  office: string;
  etn: string;
  event: string;
  headline: string;
  status: "Actual" | "Exercise" | "Test";
  messageType: "Alert" | "Update" | "Cancel";
  effective: string;
  expires: string;
  areaDesc: string;
  geometry: NWSGeometry | null;
  references?: Array<{ id: string; eventKey?: string }>;
  isTranche1Eligible: boolean;
}

export const TRANCHE_1_TRIGGER_PHENOMENA = new Set([
  "HU.W", // Hurricane Warning
  "SS.W", // Storm Surge Warning
  "FF.W", // Flash Flood Warning
  "EH.W", // Extreme Heat Warning
]);

/**
 * Normalizes an NWS alert object into an event key and verifies Tranche 1 trigger status.
 */
export function normalizeNWSAlert(raw: any): NormalizedAlert {
  const props = raw.properties || raw;
  const geometry = raw.geometry || null;

  // Extract VTEC: /O.NEW.KTBW.HU.W.0009.241009T1200Z-241010T1800Z/
  const vtec = Array.isArray(props.parameters?.VTEC)
    ? props.parameters.VTEC[0]
    : props.vtec || "";

  let phenomena = "UNKNOWN";
  let significance = "UNKNOWN";
  let office = props.senderName || "NWS";
  let etn = "0000";

  const vtecMatch = vtec.match(/\.([A-Z]{3,4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\./);
  if (vtecMatch) {
    office = vtecMatch[1].replace(/^K/, ""); // e.g. KTBW -> TBW
    phenomena = vtecMatch[2];
    significance = vtecMatch[3];
    etn = vtecMatch[4];
  } else if (props.phenomena && props.significance) {
    phenomena = props.phenomena;
    significance = props.significance;
    office = props.wfo || office;
    etn = props.etn || etn;
  }

  const phenSig = `${phenomena}.${significance}`;
  const eventKey = `${office}:${phenSig}:${etn}`;

  // Tranche 1 requires:
  // 1. Status is Actual
  // 2. MessageType is Alert or Update
  // 3. Significance is Warning ('W')
  // 4. Listed in approved phenomena
  const isActual = props.status === "Actual";
  const isAlertOrUpdate = props.messageType === "Alert" || props.messageType === "Update";
  const isTranche1Eligible = isActual && isAlertOrUpdate && TRANCHE_1_TRIGGER_PHENOMENA.has(phenSig);

  return {
    id: raw.id || props.id || eventKey,
    eventKey,
    vtec: vtec || undefined,
    phenomena,
    significance,
    office,
    etn,
    event: props.event || "Weather Alert",
    headline: props.headline || props.event || "",
    status: props.status || "Actual",
    messageType: props.messageType || "Alert",
    effective: props.effective || new Date().toISOString(),
    expires: props.expires || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    areaDesc: props.areaDesc || "",
    geometry,
    references: props.references,
    isTranche1Eligible,
  };
}

/**
 * Checks whether weather feed data is stale (> 10 minutes old).
 */
export function isWeatherFeedStale(lastSyncAt: Date, now: Date = new Date()): boolean {
  const diffMs = now.getTime() - lastSyncAt.getTime();
  const tenMinutesMs = 10 * 60 * 1000;
  return diffMs > tenMinutesMs;
}

/**
 * Confirms household exposure against active warning geometry with point-check cross-validation.
 */
export function confirmHouseholdExposure({
  householdPoint,
  alert,
  pointCheckAgrees = true,
}: {
  householdPoint: GeoPoint;
  alert: NormalizedAlert;
  pointCheckAgrees?: boolean;
}): {
  isExposed: boolean;
  hasDisagreement: boolean;
  status: "CONFIRMED" | "OUT_OF_AREA" | "NEEDS_REVIEW";
} {
  const insideGeometry = isPointInsideAlertGeometry(householdPoint, alert.geometry);

  // If local polygon check and NWS point API disagree, flag for human review (§4.3)
  if (insideGeometry !== pointCheckAgrees) {
    return {
      isExposed: insideGeometry || pointCheckAgrees,
      hasDisagreement: true,
      status: "NEEDS_REVIEW",
    };
  }

  if (insideGeometry && pointCheckAgrees) {
    return {
      isExposed: true,
      hasDisagreement: false,
      status: "CONFIRMED",
    };
  }

  return {
    isExposed: false,
    hasDisagreement: false,
    status: "OUT_OF_AREA",
  };
}

/**
 * Loads deterministic historical replay data from Iowa Environmental Mesonet (IEM) Milton 2024 archive.
 */
export function loadMiltonHistoricalReplay() {
  return {
    meta: miltonFixture.meta,
    radarFrames: miltonFixture.radarFrames,
    alerts: miltonFixture.alerts.map(normalizeNWSAlert),
    bannerText: miltonFixture.meta.disclaimer,
  };
}
