/**
 * GEOGRAPHIC EXPOSURE EVALUATION ENGINE (§4.3, §4.4)
 * Evaluates recipient household points against official warning alert geometries.
 * Invariants:
 * 1. Displaced residents preserve original landfall home coordinates for storm exposure.
 * 2. Missing or invalid coordinates NEVER silently produce CONFIRMED.
 * 3. Point-check disagreements flag NEEDS_REVIEW for human coordinator attention.
 * 4. Zero AI involvement in geometry or exposure calculation.
 */

import { isPointInsideAlertGeometry, isValidGeoPoint, type GeoPoint } from "@/lib/geo/resolver";
import { resolveExposureCoordinates } from "@/lib/recipients/location";
import type {
  NormalizedAlert,
  HouseholdExposureEvaluation,
  ExposureStatus,
  ExposureReasonCode,
} from "./types";

export interface ExposureEvaluationInput {
  householdId: string;
  landfallLat?: number | null;
  landfallLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
  isDisplaced?: boolean;
  alert: NormalizedAlert;
  pointCheckAgrees?: boolean | null; // null if point API check not yet executed
}

/**
 * Evaluates geographic exposure for a single household against an active alert.
 */
export function evaluateHouseholdExposure({
  householdId,
  landfallLat,
  landfallLng,
  currentLat,
  currentLng,
  isDisplaced = false,
  alert,
  pointCheckAgrees = true,
}: ExposureEvaluationInput): HouseholdExposureEvaluation {
  const evaluatedAt = new Date().toISOString();

  // 1. Check for cancelled or expired alert (historical replays bypass live expiration check)
  const isExpired = alert.mode !== "HISTORICAL_REPLAY" && new Date(alert.expires).getTime() <= Date.now();
  const isCancelled = alert.messageType === "Cancel";
  if (isCancelled || isExpired) {
    return {
      householdId,
      status: "OUT_OF_AREA",
      reasonCode: "ALERT_CANCELLED_OR_EXPIRED",
      details: isCancelled
        ? `Alert ${alert.eventKey} was cancelled by National Weather Service.`
        : `Alert ${alert.eventKey} expired at ${alert.expires}.`,
      evaluatedCoordinates: null,
      isDisplaced,
      alertId: alert.id,
      eventKey: alert.eventKey,
      evaluatedAt,
    };
  }

  // 2. Resolve coordinates using authoritative M4 contract
  const targetCoords = resolveExposureCoordinates({
    landfallLat,
    landfallLng,
    currentLat,
    currentLng,
    isDisplaced,
  });

  // Missing or invalid coordinates must NEVER silently produce CONFIRMED
  if (!targetCoords || !isValidGeoPoint(targetCoords)) {
    return {
      householdId,
      status: "NEEDS_REVIEW",
      reasonCode: "MISSING_COORDINATES",
      details: "Household is missing valid geographic coordinates for hazard evaluation.",
      evaluatedCoordinates: null,
      isDisplaced,
      alertId: alert.id,
      eventKey: alert.eventKey,
      evaluatedAt,
    };
  }

  // 3. Verify alert geometry existence
  if (!alert.geometry || !alert.geometry.coordinates || !alert.geometry.coordinates.length) {
    return {
      householdId,
      status: "NEEDS_REVIEW",
      reasonCode: "INVALID_GEOMETRY",
      details: `Alert ${alert.eventKey} lacks polygon geometry (county/zone alert requires zone resolution).`,
      evaluatedCoordinates: targetCoords,
      isDisplaced,
      alertId: alert.id,
      eventKey: alert.eventKey,
      evaluatedAt,
    };
  }

  // 4. Point-in-polygon geometry evaluation
  const isInside = isPointInsideAlertGeometry(targetCoords, alert.geometry);

  // 5. Point check cross-validation
  // If point check was supplied and disagrees with polygon result, route to NEEDS_REVIEW
  if (pointCheckAgrees !== null && pointCheckAgrees !== undefined && isInside !== pointCheckAgrees) {
    return {
      householdId,
      status: "NEEDS_REVIEW",
      reasonCode: "POINT_CHECK_DISAGREEMENT",
      details: `Point-in-polygon evaluated as ${isInside ? "INSIDE" : "OUTSIDE"}, but NWS point cross-validation disagreed. Flagged for human review.`,
      evaluatedCoordinates: targetCoords,
      isDisplaced,
      alertId: alert.id,
      eventKey: alert.eventKey,
      evaluatedAt,
    };
  }

  if (isInside) {
    const reasonCode: ExposureReasonCode = isDisplaced
      ? "DISPLACED_LANDFALL_PRESERVED"
      : "INSIDE_POLYGON";

    return {
      householdId,
      status: "CONFIRMED",
      reasonCode,
      details: isDisplaced
        ? `Household evacuated, but original landfall residence is inside ${alert.event}. Hazard exposure confirmed.`
        : `Household residence is inside active ${alert.event} warning boundary.`,
      evaluatedCoordinates: targetCoords,
      isDisplaced,
      alertId: alert.id,
      eventKey: alert.eventKey,
      evaluatedAt,
    };
  }

  return {
    householdId,
    status: "OUT_OF_AREA",
    reasonCode: "OUTSIDE_POLYGON",
    details: `Household residence (${targetCoords.lat}, ${targetCoords.lng}) is outside active ${alert.event} boundary.`,
    evaluatedCoordinates: targetCoords,
    isDisplaced,
    alertId: alert.id,
    eventKey: alert.eventKey,
    evaluatedAt,
  };
}

/**
 * Backward-compatibility wrapper for confirmHouseholdExposure (§4.3)
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
  const res = evaluateHouseholdExposure({
    householdId: "anon",
    landfallLat: householdPoint.lat,
    landfallLng: householdPoint.lng,
    alert,
    pointCheckAgrees,
  });

  return {
    isExposed: res.status === "CONFIRMED",
    hasDisagreement: res.reasonCode === "POINT_CHECK_DISAGREEMENT",
    status: res.status,
  };
}
