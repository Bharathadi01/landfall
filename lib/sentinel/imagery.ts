/**
 * Server-side discovery of the latest real satellite and radar frames.
 *
 * - GIBS: the WMTS capabilities document says, per layer, the latest available time and its cadence.
 *   (It is ~6 MB, so it is fetched at most once per 30 minutes and only three layers are parsed out.)
 * - RainViewer: weather-maps.json lists the last ~2 hours of radar mosaics.
 *
 * Honesty: when an upstream fails we return state "error" with no frames — never invented timestamps.
 */

import { GIBS_LAYERS, type GibsLayerKey } from "./imagery-urls";

export interface LayerTimes {
  layer: string;
  /** Latest available observation, ISO-8601 UTC. */
  latest: string;
  /** Native cadence in minutes. */
  stepMinutes: number;
  /** Oldest → newest, spaced `loopMinutes` apart, ending at `latest`. */
  frames: string[];
}

export interface RadarFrame {
  time: number; // unix seconds
  path: string;
}

export interface ImageryPayload {
  state: "ok" | "partial" | "error";
  fetchedAt: string;
  gibs: Partial<Record<GibsLayerKey, LayerTimes>>;
  radar: { host: string; frames: RadarFrame[]; generated: number } | null;
  errors: string[];
}

const CAPABILITIES_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
const RADAR_URL = "https://api.rainviewer.com/public/weather-maps.json";
const LOOP_MINUTES = 30;
const LOOP_FRAMES = 5; // 2 hours at 30-minute spacing

const CAPS_TTL_MS = 30 * 60_000;
const RADAR_TTL_MS = 60_000;

let capsCache: { at: number; xml: string } | null = null;
let radarCache: { at: number; value: NonNullable<ImageryPayload["radar"]> } | null = null;

export function parseStepMinutes(period: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(period.trim());
  if (!m) return 10;
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) || 10;
}

/** Pull the latest time and cadence for one layer out of a WMTS capabilities document. */
export function parseLayerTimes(xml: string, layerId: string, loopMinutes = LOOP_MINUTES, loopFrames = LOOP_FRAMES): LayerTimes | null {
  const idAt = xml.indexOf(`<ows:Identifier>${layerId}</ows:Identifier>`);
  if (idAt < 0) return null;
  const start = xml.lastIndexOf("<Layer>", idAt);
  const end = xml.indexOf("</Layer>", idAt);
  if (start < 0 || end < 0) return null;
  const block = xml.slice(start, end);

  const def = /<Default>([^<]+)<\/Default>/.exec(block)?.[1];
  const values = [...block.matchAll(/<Value>([^<]+)<\/Value>/g)].map((m) => m[1]);
  if (!def || values.length === 0) return null;

  const last = values[values.length - 1].split("/");
  const stepMinutes = parseStepMinutes(last[2] ?? "PT10M");
  const latest = def;
  const latestMs = Date.parse(latest);
  if (Number.isNaN(latestMs)) return null;

  const frames: string[] = [];
  for (let k = loopFrames - 1; k >= 0; k--) {
    frames.push(new Date(latestMs - k * loopMinutes * 60_000).toISOString().replace(".000Z", "Z"));
  }
  return { layer: layerId, latest, stepMinutes, frames };
}

async function fetchText(url: string, ms = 20_000): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "User-Agent": "Landfall/1.0 (relief-fund weather desk)" } });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.text();
}

async function getCapabilities(): Promise<string> {
  if (capsCache && Date.now() - capsCache.at < CAPS_TTL_MS) return capsCache.xml;
  const xml = await fetchText(CAPABILITIES_URL, 30_000);
  capsCache = { at: Date.now(), xml };
  return xml;
}

export async function getRadarFrames(): Promise<NonNullable<ImageryPayload["radar"]>> {
  if (radarCache && Date.now() - radarCache.at < RADAR_TTL_MS) return radarCache.value;
  const json = JSON.parse(await fetchText(RADAR_URL, 10_000)) as {
    host?: string;
    generated?: number;
    radar?: { past?: RadarFrame[] };
  };
  const frames = (json.radar?.past ?? []).filter((f) => typeof f.time === "number" && typeof f.path === "string");
  if (!json.host || frames.length === 0) throw new Error("RainViewer returned no radar frames");
  const value = { host: json.host, frames, generated: json.generated ?? Math.floor(Date.now() / 1000) };
  radarCache = { at: Date.now(), value };
  return value;
}

export async function getImagery(): Promise<ImageryPayload> {
  const errors: string[] = [];
  const gibs: ImageryPayload["gibs"] = {};
  let radar: ImageryPayload["radar"] = null;

  const [capsRes, radarRes] = await Promise.allSettled([getCapabilities(), getRadarFrames()]);

  if (capsRes.status === "fulfilled") {
    for (const key of Object.keys(GIBS_LAYERS) as GibsLayerKey[]) {
      const t = parseLayerTimes(capsRes.value, GIBS_LAYERS[key]);
      if (t) gibs[key] = t;
      else errors.push(`GIBS layer ${GIBS_LAYERS[key]} not found`);
    }
  } else {
    errors.push(`NASA GIBS: ${capsRes.reason instanceof Error ? capsRes.reason.message : "unavailable"}`);
  }

  if (radarRes.status === "fulfilled") radar = radarRes.value;
  else errors.push(`RainViewer: ${radarRes.reason instanceof Error ? radarRes.reason.message : "unavailable"}`);

  const have = Object.keys(gibs).length + (radar ? 1 : 0);
  const state: ImageryPayload["state"] = have === 0 ? "error" : errors.length ? "partial" : "ok";
  return { state, fetchedAt: new Date().toISOString(), gibs, radar, errors };
}

/** Test hook. */
export function __resetImageryCaches() {
  capsCache = null;
  radarCache = null;
}
