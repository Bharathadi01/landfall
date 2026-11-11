/**
 * Pure URL builders for real-time satellite and radar imagery. No I/O — shared by server routes and the browser.
 *
 * Sources (all public, CORS-enabled, no API key):
 *  - NASA GIBS WMS: GOES-East / GOES-West / Himawari infrared + GeoColor, IMERG precipitation
 *  - RainViewer: global radar mosaic tiles (free tier: zoom ≤ 7)
 */

export const GIBS_LAYERS = {
  goesEastIR: "GOES-East_ABI_Band13_Clean_Infrared",
  goesWestIR: "GOES-West_ABI_Band13_Clean_Infrared",
  himawariIR: "Himawari_AHI_Band13_Clean_Infrared",
  goesEastGeoColor: "GOES-East_ABI_GeoColor",
  imerg: "IMERG_Precipitation_Rate_30min",
} as const;

export type GibsLayerKey = keyof typeof GIBS_LAYERS;

/** Which geostationary satellite covers which longitudes (for attribution and labels). */
export const SATELLITE_FOOTPRINT: Record<"goesEastIR" | "goesWestIR" | "himawariIR", { label: string; lngRange: [number, number] }> = {
  goesWestIR: { label: "GOES-West", lngRange: [-165, -105] },
  goesEastIR: { label: "GOES-East", lngRange: [-140, -20] },
  himawariIR: { label: "Himawari", lngRange: [80, 200] },
};

export interface WmsOptions {
  layer: string;
  /** ISO-8601 UTC, e.g. 2026-11-10T22:50:00Z */
  time?: string;
  width?: number;
  height?: number;
  /** [west, south, east, north] in degrees */
  bbox?: [number, number, number, number];
}

/** GetMap URL in plate-carrée (EPSG:4326) — maps linearly to equirectangular texture coordinates. */
export function gibsWmsUrl({ layer, time, width = 2048, height = 1024, bbox = [-180, -90, 180, 90] }: WmsOptions): string {
  const q = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.1.1",
    LAYERS: layer,
    STYLES: "",
    FORMAT: "image/png",
    TRANSPARENT: "TRUE",
    SRS: "EPSG:4326",
    BBOX: bbox.join(","),
    WIDTH: String(width),
    HEIGHT: String(height),
  });
  if (time) q.set("TIME", time);
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q.toString()}`;
}

/** WMTS (Web-Mercator) tile template for MapLibre raster sources. */
export function gibsTileTemplate(layer: string, time: string, level: 6 | 7 = 6): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`;
}

/**
 * RainViewer tile template.
 * color 2 = "Universal Blue"; options "1_1" = smooth + snow.
 */
export function radarTileTemplate(host: string, path: string, color = 2): string {
  return `${host}${path}/256/{z}/{x}/{y}/${color}/1_1.png`;
}

export const RADAR_MAX_ZOOM = 7;
export const GIBS_IR_MAX_ZOOM = 6;
