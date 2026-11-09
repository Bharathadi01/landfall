import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon, multiPolygon } from "@turf/helpers";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface NWSGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: any;
}

/**
 * Validates that latitude and longitude are valid numeric geographic coordinates.
 */
export function isValidGeoPoint(pt: GeoPoint | null | undefined): boolean {
  if (!pt) return false;
  if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return false;
  if (isNaN(pt.lat) || isNaN(pt.lng)) return false;
  if (pt.lat < -90 || pt.lat > 90) return false;
  if (pt.lng < -180 || pt.lng > 180) return false;
  return true;
}

/**
 * Ensures that a polygon linear ring is closed (first coord === last coord).
 */
function ensureClosedRing(ring: number[][]): number[][] {
  if (!ring || ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, [first[0], first[1]]];
  }
  return ring;
}

/**
 * Resolves whether a geographic point (lat, lng) is inside an alert geometry.
 * HARDENING:
 * 1. Checks coordinate bounds.
 * 2. Normalizes non-closed linear rings.
 * 3. Handles Polygon and MultiPolygon GeoJSON.
 * 4. Catches turf exceptions gracefully, returning false on malformed geometry.
 */
export function isPointInsideAlertGeometry(
  pt: GeoPoint | null | undefined,
  geometry: NWSGeometry | null | undefined
): boolean {
  if (!isValidGeoPoint(pt)) {
    return false;
  }
  if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
    return false;
  }

  try {
    // GeoJSON point format is [longitude, latitude]
    const turfPt = point([pt!.lng, pt!.lat]);

    if (geometry.type === "Polygon") {
      const normalizedCoords = geometry.coordinates.map((ring: number[][]) => ensureClosedRing(ring));
      const poly = polygon(normalizedCoords);
      return booleanPointInPolygon(turfPt, poly, { ignoreBoundary: false });
    }

    if (geometry.type === "MultiPolygon") {
      const normalizedCoords = geometry.coordinates.map((polyCoords: number[][][]) =>
        polyCoords.map((ring: number[][]) => ensureClosedRing(ring))
      );
      const mpoly = multiPolygon(normalizedCoords);
      return booleanPointInPolygon(turfPt, mpoly, { ignoreBoundary: false });
    }

    return false;
  } catch (err) {
    console.error("[GEO_RESOLVER] Error evaluating point in polygon:", err);
    return false;
  }
}
