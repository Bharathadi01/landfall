/**
 * SENTINEL DISASTER INTELLIGENCE TYPES (§4.3)
 * Invariants:
 * 1. Explicit data mode separation: LIVE | HISTORICAL_REPLAY | SYNTHETIC.
 * 2. Exposure results strictly compatible with M4 Four-Checks: CONFIRMED | OUT_OF_AREA | NEEDS_REVIEW.
 * 3. Sentinel determines disaster intelligence and geographic exposure ONLY.
 *    It must NEVER decide recipient eligibility, priority, payout amounts or execute money.
 */

import type { GeoPoint, NWSGeometry } from "@/lib/geo/resolver";

export type DataMode = "LIVE" | "HISTORICAL_REPLAY" | "SYNTHETIC";

export type ExposureStatus = "CONFIRMED" | "OUT_OF_AREA" | "NEEDS_REVIEW";

export type ExposureReasonCode =
  | "INSIDE_POLYGON"
  | "OUTSIDE_POLYGON"
  | "POINT_CHECK_AGREEMENT"
  | "POINT_CHECK_DISAGREEMENT"
  | "MISSING_COORDINATES"
  | "INVALID_GEOMETRY"
  | "DISPLACED_LANDFALL_PRESERVED"
  | "ALERT_CANCELLED_OR_EXPIRED";

export interface NormalizedAlert {
  id: string;
  nwsId: string;
  eventKey: string; // e.g. "TBW:HU.W:0009"
  vtec?: string;
  phenomena: string; // "HU", "SS", "FF", "EH"
  significance: string; // "W" (Warning), "A" (Watch), "Y" (Advisory)
  office: string;
  etn: string;
  event: string;
  headline: string;
  status: "Actual" | "Exercise" | "Test" | "Draft";
  messageType: "Alert" | "Update" | "Cancel";
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  urgency: "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
  certainty: "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
  effective: string;
  onset?: string;
  expires: string;
  areaDesc: string;
  geometry: NWSGeometry | null;
  references?: Array<{ id: string; eventKey?: string }>;
  isTranche1Eligible: boolean;
  mode: DataMode;
  source: string;
  rawJson?: any;
  ingestedAt: string;
}

export interface HouseholdExposureEvaluation {
  householdId: string;
  status: ExposureStatus;
  reasonCode: ExposureReasonCode;
  details: string;
  evaluatedCoordinates: GeoPoint | null;
  isDisplaced: boolean;
  alertId: string;
  eventKey: string;
  evaluatedAt: string;
}

export interface ServiceHealth {
  service: "NWS" | "IEM";
  status: "HEALTHY" | "DEGRADED" | "OUTAGE" | "STALE";
  lastSyncAt: string | null;
  latencyMs?: number;
  error?: string;
}

export interface EventActivationRecord {
  id: string;
  fundId: string;
  alertId: string;
  eventKey: string;
  status: "open" | "planned" | "audited" | "approved" | "paid" | "closed" | "voided";
  mode: DataMode;
  candidateHouseholdCount: number;
  confirmedExposureCount: number;
  policyVersion: string;
  createdAt: string;
}
