/**
 * Coarse model-forecast grid over the Gulf / Florida / western Atlantic from Open-Meteo (free, no key).
 * Drives the wind-flow particles and the "forecast" half of the timeline (+48 h).
 *
 * Wind is converted from meteorological (direction it blows FROM) to u/v components (east/north, knots).
 * On upstream failure we return state "error" — never a made-up field.
 */

export interface ForecastGrid {
  state: "ok" | "error";
  source: "Open-Meteo";
  fetchedAt: string;
  error?: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  nx: number;
  ny: number;
  /** ISO hour timestamps, UTC. */
  hours: string[];
  /** Per hour, row-major from the NORTH row down; length nx*ny. */
  u: number[][];
  v: number[][];
  speedKt: number[][];
  gustKt: number[][];
  precipMm: number[][];
  cloudPct: number[][];
}

export const GRID_BBOX: [number, number, number, number] = [-100, 16, -64, 36];
export const GRID_STEP_DEG = 2;
/** Window: 3 hours of recent past (model analysis) + the current hour + 48 hours ahead. */
export const GRID_PAST_HOURS = 3;
export const GRID_AHEAD_HOURS = 48;
export const GRID_HOURS = GRID_PAST_HOURS + 1 + GRID_AHEAD_HOURS;

const TTL_MS = 30 * 60_000;
let cache: { at: number; value: ForecastGrid } | null = null;

export function gridAxes(bbox = GRID_BBOX, step = GRID_STEP_DEG) {
  const [w, s, e, n] = bbox;
  const lngs: number[] = [];
  const lats: number[] = [];
  for (let x = w; x <= e + 1e-6; x += step) lngs.push(round(x));
  for (let y = n; y >= s - 1e-6; y -= step) lats.push(round(y)); // north → south
  return { lngs, lats };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Meteorological wind (speed, direction wind blows FROM, degrees) → u (east), v (north). */
export function windToUV(speed: number, dirFromDeg: number): { u: number; v: number } {
  const rad = (dirFromDeg * Math.PI) / 180;
  return { u: round(-speed * Math.sin(rad)), v: round(-speed * Math.cos(rad)) };
}

interface OpenMeteoPoint {
  hourly: {
    time: string[];
    precipitation: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
  };
}

/** Assemble a ForecastGrid from per-point Open-Meteo responses (ordered like gridAxes: rows north→south, columns west→east). */
export function assembleGrid(points: OpenMeteoPoint[], lngs: number[], lats: number[], bbox = GRID_BBOX, hoursWanted = GRID_HOURS, start = 0): ForecastGrid {
  const nx = lngs.length;
  const ny = lats.length;
  if (points.length !== nx * ny) throw new Error(`expected ${nx * ny} grid points, got ${points.length}`);

  const hours = points[0].hourly.time.slice(start, start + hoursWanted).map((t) => (t.endsWith("Z") ? t : `${t}:00Z`.replace(/:00:00Z$/, ":00Z")));
  const H = hours.length;
  const blank = () => Array.from({ length: H }, () => new Array<number>(nx * ny).fill(0));
  const u = blank(), v = blank(), speedKt = blank(), gustKt = blank(), precipMm = blank(), cloudPct = blank();

  points.forEach((p, i) => {
    for (let h = 0; h < H; h++) {
      const hi = h + start;
      const sp = p.hourly.wind_speed_10m[hi] ?? 0;
      const wind = windToUV(sp, p.hourly.wind_direction_10m[hi] ?? 0);
      u[h][i] = wind.u;
      v[h][i] = wind.v;
      speedKt[h][i] = round(sp);
      gustKt[h][i] = round(p.hourly.wind_gusts_10m[hi] ?? sp);
      precipMm[h][i] = round(p.hourly.precipitation[hi] ?? 0);
      cloudPct[h][i] = Math.round(p.hourly.cloud_cover[hi] ?? 0);
    }
  });

  return { state: "ok", source: "Open-Meteo", fetchedAt: new Date().toISOString(), bbox, nx, ny, hours, u, v, speedKt, gustKt, precipMm, cloudPct };
}

export async function getForecastGrid(): Promise<ForecastGrid> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { lngs, lats } = gridAxes();
  const latitude: number[] = [];
  const longitude: number[] = [];
  for (const la of lats) for (const lo of lngs) { latitude.push(la); longitude.push(lo); }

  const q = new URLSearchParams({
    latitude: latitude.join(","),
    longitude: longitude.join(","),
    hourly: "precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "kn",
    forecast_days: "3",
    timezone: "GMT",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q.toString()}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Landfall/1.0 (relief-fund weather desk)" },
    });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const json = (await res.json()) as OpenMeteoPoint | OpenMeteoPoint[];
    const points = Array.isArray(json) ? json : [json];
    const firstMs = Date.parse(`${points[0].hourly.time[0]}Z`);
    const start = Math.max(0, Math.floor((Date.now() - firstMs) / 3_600_000) - GRID_PAST_HOURS);
    const value = assembleGrid(points, lngs, lats, GRID_BBOX, GRID_HOURS, start);
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Open-Meteo unavailable";
    return {
      state: "error",
      source: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
      error: message,
      bbox: GRID_BBOX,
      nx: lngs.length,
      ny: lats.length,
      hours: [],
      u: [], v: [], speedKt: [], gustKt: [], precipMm: [], cloudPct: [],
    };
  }
}

export function __resetForecastGridCache() {
  cache = null;
}
