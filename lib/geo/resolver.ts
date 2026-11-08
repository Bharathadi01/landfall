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
 * Resolves whether a geographic point (lat, lng) is inside an alert geometry.
 */
export function isPointInsideAlertGeometry(pt: GeoPoint, geometry: NWSGeometry | null | undefined): boolean {
  if (!geometry || !geometry.coordinates || !geometry.coordinates.length) {
    return false;
  }

  try {
    const turfPt = point([pt.lng, pt.lat]);

    if (geometry.type === "Polygon") {
      const poly = polygon(geometry.coordinates);
      return booleanPointInPolygon(turfPt, poly);
    }

    if (geometry.type === "MultiPolygon") {
      const mpoly = multiPolygon(geometry.coordinates);
      return booleanPointInPolygon(turfPt, mpoly);
    }

    return false;
  } catch (err) {
    console.error("[GEO_RESOLVER] Error evaluating point in polygon:", err);
    return false;
  }
}
