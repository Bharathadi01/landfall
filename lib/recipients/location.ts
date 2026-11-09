/**
 * DISPLACEMENT & LOCATION TRACKING (§4.4, §10)
 * Invariants:
 * 1. Displaced residents must NOT lose relief eligibility because they evacuated.
 * 2. Original landfall coordinates (home at storm time) are preserved permanently for hazard exposure assessment.
 * 3. Current temporary location is tracked in location history for communications / distribution.
 * 4. Coordinate resolution for Sentinel/exposure ALWAYS prioritizes the landfall home coordinates.
 */

import crypto from "crypto";
import type { LocationHistoryEntry } from "./types";

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Resolves the coordinates that should be used for storm hazard exposure calculations.
 * CRITICAL FAIRNESS INVARIANT: If a household is displaced, their original landfall home
 * coordinates are evaluated, NOT the temporary evacuation address.
 */
export function resolveExposureCoordinates({
  landfallLat,
  landfallLng,
  currentLat,
  currentLng,
  isDisplaced = false,
}: {
  landfallLat?: number | null;
  landfallLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
  isDisplaced?: boolean;
}): Coordinates | null {
  // If displaced, the primary hazard exposure point is strictly the landfall home
  if (isDisplaced && landfallLat != null && landfallLng != null) {
    return { lat: landfallLat, lng: landfallLng };
  }

  // Otherwise, use current location if available, falling back to landfall home
  if (currentLat != null && currentLng != null) {
    return { lat: currentLat, lng: currentLng };
  }

  if (landfallLat != null && landfallLng != null) {
    return { lat: landfallLat, lng: landfallLng };
  }

  return null;
}

/**
 * Creates an immutable location history record.
 */
export function createLocationHistoryEntry({
  householdId,
  address,
  lat,
  lng,
  isDisplaced,
  recordedBy,
  effectiveFrom = new Date(),
}: {
  householdId: string;
  address: string;
  lat: number;
  lng: number;
  isDisplaced: boolean;
  recordedBy: string;
  effectiveFrom?: Date;
}): LocationHistoryEntry {
  return {
    id: `loc_${crypto.randomBytes(8).toString("hex")}`,
    householdId,
    address,
    lat,
    lng,
    isDisplaced,
    recordedBy,
    effectiveFrom: effectiveFrom.toISOString(),
    createdAt: new Date().toISOString(),
  };
}
