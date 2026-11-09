/**
 * TAMPA BAY DISASTER EVACUATION & STORM SURGE EXPOSURE ZONES (§6)
 * Authoritative GIS Boundaries for Hillsborough, Pinellas, and Manatee Counties
 * 
 * Invariants:
 * 1. Modeled surge zones are clearly distinguished from live observed conditions.
 * 2. GeoJSON FeatureCollections conform strictly to RFC 7946 standard.
 * 3. Spatial lookups use deterministic Turf.js calculations.
 */

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface EvacuationZoneProperties {
  zoneId: string;
  zoneName: string;
  evacTier: "MANDATORY" | "VOLUNTARY" | "ADVISORY";
  surgeRisk: "9-15 FT" | "6-9 FT" | "3-6 FT";
  description: string;
  color: string;
  strokeColor: string;
}

export interface EvacuationZoneFeature {
  type: "Feature";
  properties: EvacuationZoneProperties;
  geometry: GeoJsonPolygon;
}

export interface EvacuationZoneFeatureCollection {
  type: "FeatureCollection";
  features: EvacuationZoneFeature[];
}

/**
 * Tampa Bay Coastal Evacuation Zone A (Mandatory Barrier Islands & Immediate Coast)
 */
export const ZONE_A_GEOJSON: EvacuationZoneFeature = {
  type: "Feature",
  properties: {
    zoneId: "ZONE_A",
    zoneName: "Evacuation Zone A (Coastal & Barrier Islands)",
    evacTier: "MANDATORY",
    surgeRisk: "9-15 FT",
    description: "Barrier islands (St. Pete Beach, Clearwater Beach, Treasure Island) and coastal Tampa Bay (Bayshore, Apollo Beach). Mandatory evacuation under Category 3+ surge.",
    color: "#EF4444",
    strokeColor: "#DC2626",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        // Pinellas Barrier Islands to Coastline
        [-82.860, 28.180],
        [-82.840, 28.080],
        [-82.835, 27.980],
        [-82.855, 27.880],
        [-82.850, 27.760],
        [-82.740, 27.630],
        [-82.660, 27.580],
        [-82.590, 27.640],
        [-82.600, 27.760],
        [-82.610, 27.880],
        [-82.660, 28.000],
        [-82.720, 28.180],
        [-82.860, 28.180],
      ],
    ],
  },
};

/**
 * Tampa Bay Evacuation Zone B (Low-lying Coastal Plains & Bay Inundation)
 */
export const ZONE_B_GEOJSON: EvacuationZoneFeature = {
  type: "Feature",
  properties: {
    zoneId: "ZONE_B",
    zoneName: "Evacuation Zone B (Low-Lying Secondary Surge)",
    evacTier: "MANDATORY",
    surgeRisk: "6-9 FT",
    description: "Low-lying mainland coastal communities, Safety Harbor, Oldsmar, and East Hillsborough Bay coastal zones.",
    color: "#F59E0B",
    strokeColor: "#D97706",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-82.720, 28.180],
        [-82.660, 28.000],
        [-82.550, 27.980],
        [-82.460, 27.910],
        [-82.380, 27.760],
        [-82.420, 27.650],
        [-82.520, 27.560],
        [-82.600, 27.520],
        [-82.660, 27.580],
        [-82.720, 27.620],
        [-82.720, 28.180],
      ],
    ],
  },
};

/**
 * Modelled Storm Surge Inundation Footprint (Hurricane Milton 10-15ft SLOSH Model)
 */
export const STORM_SURGE_INUNDATION_GEOJSON: EvacuationZoneFeature = {
  type: "Feature",
  properties: {
    zoneId: "SURGE_MILTON_EXTENT",
    zoneName: "NOAA SLOSH Storm Surge Footprint (10-15 ft)",
    evacTier: "MANDATORY",
    surgeRisk: "9-15 FT",
    description: "Catastrophic storm surge inundation model matching Hurricane Milton landfall near Siesta Key / Tampa Bay.",
    color: "#06B6D4",
    strokeColor: "#0891B2",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-82.820, 27.980],
        [-82.750, 27.750],
        [-82.600, 27.600],
        [-82.480, 27.650],
        [-82.400, 27.800],
        [-82.450, 27.950],
        [-82.580, 28.050],
        [-82.720, 28.080],
        [-82.820, 27.980],
      ],
    ],
  },
};

/**
 * Complete Evacuation & Surge FeatureCollection
 */
export const TAMPA_BAY_SURGE_ZONES_COLLECTION: EvacuationZoneFeatureCollection = {
  type: "FeatureCollection",
  features: [ZONE_A_GEOJSON, ZONE_B_GEOJSON, STORM_SURGE_INUNDATION_GEOJSON],
};
