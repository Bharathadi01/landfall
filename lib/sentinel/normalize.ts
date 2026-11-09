/**
 * SENTINEL ALERT NORMALIZATION ENGINE (§4.3)
 * Normalizes raw NWS API alerts into canonical event representations.
 * Handles VTEC decoding, event key generation, and Tranche 1 trigger qualification.
 */

import { z } from "zod";
import type { NormalizedAlert, DataMode } from "./types";
import type { NWSGeometry } from "@/lib/geo/resolver";

export const TRANCHE_1_TRIGGER_PHENOMENA = new Set([
  "HU.W", // Hurricane Warning
  "SS.W", // Storm Surge Warning
  "FF.W", // Flash Flood Warning
  "EH.W", // Extreme Heat Warning
]);

// Zod schema for NWS API Feature / Alert properties validation
export const NWSPropertiesSchema = z.object({
  id: z.string().optional(),
  event: z.string().default("Weather Alert"),
  headline: z.string().optional(),
  status: z.enum(["Actual", "Exercise", "Test", "Draft"]).default("Actual"),
  messageType: z.enum(["Alert", "Update", "Cancel"]).default("Alert"),
  severity: z.enum(["Extreme", "Severe", "Moderate", "Minor", "Unknown"]).default("Unknown"),
  urgency: z.enum(["Immediate", "Expected", "Future", "Past", "Unknown"]).default("Unknown"),
  certainty: z.enum(["Observed", "Likely", "Possible", "Unlikely", "Unknown"]).default("Unknown"),
  vtec: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  senderName: z.string().optional(),
  wfo: z.string().optional(),
  phenomena: z.string().optional(),
  significance: z.string().optional(),
  etn: z.string().optional(),
  effective: z.string().optional(),
  onset: z.string().optional(),
  expires: z.string().optional(),
  areaDesc: z.string().default(""),
  references: z
    .array(
      z.object({
        id: z.string(),
        wfo: z.string().optional(),
        datetime: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Normalizes an official NWS alert object into a canonical NormalizedAlert.
 */
export function normalizeNWSAlert(
  raw: any,
  options: { mode?: DataMode; source?: string } = {}
): NormalizedAlert {
  const props = raw?.properties || raw || {};
  const geometry: NWSGeometry | null = raw?.geometry || null;

  // Extract VTEC: e.g. /O.NEW.KTBW.HU.W.0009.241009T1200Z-241010T1800Z/
  let vtec = "";
  if (Array.isArray(props.parameters?.VTEC) && props.parameters.VTEC.length > 0) {
    vtec = String(props.parameters.VTEC[0]);
  } else if (typeof props.vtec === "string") {
    vtec = props.vtec;
  }

  let phenomena = "UNKNOWN";
  let significance = "UNKNOWN";
  let office = props.senderName || props.wfo || "NWS";
  let etn = "0000";

  const vtecMatch = vtec.match(/\.([A-Z]{3,4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\./);
  if (vtecMatch) {
    office = vtecMatch[1].replace(/^K/, ""); // e.g. KTBW -> TBW
    phenomena = vtecMatch[2];
    significance = vtecMatch[3];
    etn = vtecMatch[4];
  } else if (props.phenomena && props.significance) {
    phenomena = String(props.phenomena);
    significance = String(props.significance);
    office = String(props.wfo || office);
    etn = String(props.etn || etn);
  }

  const phenSig = `${phenomena}.${significance}`;
  const eventKey = `${office}:${phenSig}:${etn}`;

  // Tranche 1 requires:
  // 1. Status is Actual
  // 2. MessageType is Alert or Update (NOT Cancel)
  // 3. Significance is Warning ('W')
  // 4. Listed in approved trigger phenomena
  // 5. Not expired
  const isActual = props.status === "Actual";
  const isAlertOrUpdate = props.messageType === "Alert" || props.messageType === "Update";
  const isWarning = significance === "W";
  const isApprovedPhenomena = TRANCHE_1_TRIGGER_PHENOMENA.has(phenSig);

  const mode = options.mode || (raw?.mode as DataMode) || "LIVE";
  const source = options.source || (mode === "HISTORICAL_REPLAY" ? "NWS via IEM archive" : "National Weather Service (api.weather.gov)");

  const expiresTime = props.expires ? new Date(props.expires).getTime() : Date.now() + 86400000;
  const isNotExpired = mode === "HISTORICAL_REPLAY" || expiresTime > Date.now();

  const isTranche1Eligible = isActual && isAlertOrUpdate && isWarning && isApprovedPhenomena && isNotExpired;

  const nwsId = String(raw?.id || props.id || eventKey);

  return {
    id: nwsId,
    nwsId,
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
    severity: props.severity || "Unknown",
    urgency: props.urgency || "Unknown",
    certainty: props.certainty || "Unknown",
    effective: props.effective || new Date().toISOString(),
    onset: props.onset,
    expires: props.expires || new Date(Date.now() + 86400000).toISOString(),
    areaDesc: props.areaDesc || "",
    geometry,
    references: props.references,
    isTranche1Eligible,
    mode,
    source,
    rawJson: raw,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Checks whether weather feed data is stale (> 10 minutes old).
 */
export function isWeatherFeedStale(lastSyncAt: Date | string, now: Date = new Date()): boolean {
  const syncDate = typeof lastSyncAt === "string" ? new Date(lastSyncAt) : lastSyncAt;
  const diffMs = now.getTime() - syncDate.getTime();
  const tenMinutesMs = 10 * 60 * 1000;
  return diffMs > tenMinutesMs;
}
