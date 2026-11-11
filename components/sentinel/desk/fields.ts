/**
 * Scalar / vector fields the effect layers sample.
 *  - GridField: a coarse model grid (Open-Meteo), bilinear-sampled.
 *  - RadarField: the real RainViewer radar mosaic at low zoom, decoded from tile alpha.
 */
import { radarTileTemplate } from "@/lib/sentinel/imagery-urls";
import type { ForecastGrid } from "@/lib/sentinel/forecast-grid";

export interface PrecipSampler {
  /** 0..1 precipitation intensity at lng/lat (0 outside coverage). */
  sample(lng: number, lat: number): number;
}

export class GridField {
  constructor(
    readonly bbox: [number, number, number, number],
    readonly nx: number,
    readonly ny: number,
    readonly values: Float32Array
  ) {}

  /** Bilinear sample; rows run north→south. Returns null outside the grid. */
  at(lng: number, lat: number): number | null {
    const [w, s, e, n] = this.bbox;
    if (lng < w || lng > e || lat < s || lat > n) return null;
    const fx = ((lng - w) / (e - w)) * (this.nx - 1);
    const fy = ((n - lat) / (n - s)) * (this.ny - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(this.nx - 1, x0 + 1), y1 = Math.min(this.ny - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const v = this.values;
    const a = v[y0 * this.nx + x0], b = v[y0 * this.nx + x1], c = v[y1 * this.nx + x0], d = v[y1 * this.nx + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
}

/** Linear blend of two hourly arrays (used to scrub smoothly between model hours). */
export function blendHours(a: number[], b: number[], t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}

export interface WindField {
  u: GridField;
  v: GridField;
  speed: GridField;
}

export function windFieldAt(grid: ForecastGrid, hourFloat: number): WindField | null {
  if (grid.state !== "ok" || grid.hours.length === 0) return null;
  const h = Math.max(0, Math.min(grid.hours.length - 1, hourFloat));
  const h0 = Math.floor(h), h1 = Math.min(grid.hours.length - 1, h0 + 1), t = h - h0;
  const mk = (arr: number[][]) => new GridField(grid.bbox, grid.nx, grid.ny, blendHours(arr[h0], arr[h1], t));
  return { u: mk(grid.u), v: mk(grid.v), speed: mk(grid.speedKt) };
}

export function forecastPrecipSampler(grid: ForecastGrid, hourFloat: number): PrecipSampler | null {
  if (grid.state !== "ok" || grid.hours.length === 0) return null;
  const h = Math.max(0, Math.min(grid.hours.length - 1, hourFloat));
  const h0 = Math.floor(h), h1 = Math.min(grid.hours.length - 1, h0 + 1), t = h - h0;
  const f = new GridField(grid.bbox, grid.nx, grid.ny, blendHours(grid.precipMm[h0], grid.precipMm[h1], t));
  return { sample: (lng, lat) => Math.min(1, (f.at(lng, lat) ?? 0) / 1.5) };
}

const RADAR_Z = 2;
const radarCache = new Map<string, RadarField>();

export class RadarField implements PrecipSampler {
  private size = 256 * 2 ** RADAR_Z;
  constructor(private alpha: Uint8ClampedArray) {}

  sample(lng: number, lat: number): number {
    const la = Math.max(-85, Math.min(85, lat));
    const x = ((lng + 180) / 360) * this.size;
    const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360)) / (2 * Math.PI)) * this.size;
    const ix = Math.max(0, Math.min(this.size - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(this.size - 1, Math.floor(y)));
    return this.alpha[iy * this.size + ix] / 255;
  }

  /** Decode a RainViewer frame (16 tiles at z2) into a sampler. Cached per frame path. */
  static async load(host: string, path: string): Promise<RadarField | null> {
    const key = host + path;
    const hit = radarCache.get(key);
    if (hit) return hit;
    const n = 2 ** RADAR_Z;
    const size = 256 * n;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const tpl = radarTileTemplate(host, path);
    const jobs: Promise<void>[] = [];
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const url = tpl.replace("{z}", String(RADAR_Z)).replace("{x}", String(x)).replace("{y}", String(y));
        jobs.push(
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => { ctx.drawImage(img, x * 256, y * 256); resolve(); };
            img.onerror = () => resolve();
            img.src = url;
          })
        );
      }
    }
    await Promise.all(jobs);
    const data = ctx.getImageData(0, 0, size, size).data;
    const a = new Uint8ClampedArray(size * size);
    let any = 0;
    for (let i = 0; i < a.length; i++) { a[i] = data[i * 4 + 3]; if (a[i] > 20) any++; }
    if (any === 0) return null;
    const f = new RadarField(a);
    if (radarCache.size > 20) radarCache.delete(radarCache.keys().next().value as string);
    radarCache.set(key, f);
    return f;
  }
}
