/**
 * Builds one global equirectangular RGBA image from the three real geostationary IR views
 * (GOES-West, GOES-East, Himawari) that NASA GIBS serves.
 *
 * Each satellite sees a disc; pixels near the disc's edge are heavily stretched, so we fade each
 * satellite out between 58° and 74° from its sub-satellite point and blend overlaps by weight.
 * Pixels no satellite covers keep alpha 0 — they are "no data", never filled in.
 */
import { gibsWmsUrl, GIBS_LAYERS } from "@/lib/sentinel/imagery-urls";

/** 1024×512 (~0.35 km/px at the equator is not needed for a cloud layer): 4× fewer bytes and 4× less main-thread blending than 2048×1024. */
export const COMPOSITE_W = 1024;
export const COMPOSITE_H = 512;

const SATS = [
  { key: "himawariIR" as const, subLng: 140.7, label: "Himawari" },
  { key: "goesWestIR" as const, subLng: -137.2, label: "GOES-West" },
  { key: "goesEastIR" as const, subLng: -75.2, label: "GOES-East" },
];

export interface CompositeFrame {
  time: string;
  w: number;
  h: number;
  /** RGBA, row 0 = 90°N. */
  data: Uint8Array;
  /** Which satellites contributed. */
  sources: string[];
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let weightCache: Float32Array[] | null = null;
function weights(): Float32Array[] {
  if (weightCache) return weightCache;
  const W = COMPOSITE_W, H = COMPOSITE_H;
  weightCache = SATS.map((s) => {
    const w = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const lat = (90 - ((y + 0.5) / H) * 180) * (Math.PI / 180);
      const cl = Math.cos(lat);
      for (let x = 0; x < W; x++) {
        const lng = (-180 + ((x + 0.5) / W) * 360 - s.subLng) * (Math.PI / 180);
        const ang = Math.acos(Math.max(-1, Math.min(1, cl * Math.cos(lng)))) * (180 / Math.PI);
        w[y * W + x] = 1 - smoothstep(58, 74, ang);
      }
    }
    return w;
  });
  return weightCache;
}

function loadImageOnce(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const abort = () => {
      img.src = ""; // stop the download
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${new URL(url).searchParams.get("LAYERS")}`));
    img.src = url;
  });
}

/** GIBS occasionally answers slowly or with a transient error; try up to three times with a short back-off. */
async function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await loadImageOnce(url, signal);
    } catch (e) {
      last = e;
      if (signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw last;
}

function pixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = COMPOSITE_W;
  c.height = COMPOSITE_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, COMPOSITE_W, COMPOSITE_H);
  return ctx.getImageData(0, 0, COMPOSITE_W, COMPOSITE_H).data;
}

/** Fetch + blend one observation time. `fetchScale` < 1 fetches a smaller image (older loop frames) and upsamples it. */
export async function compositeFrame(time: string, fetchScale = 1, signal?: AbortSignal): Promise<CompositeFrame | null> {
  const fw = Math.round(COMPOSITE_W * fetchScale);
  const fh = Math.round(COMPOSITE_H * fetchScale);
  const results = await Promise.allSettled(
    SATS.map((s) => loadImage(gibsWmsUrl({ layer: GIBS_LAYERS[s.key], time, width: fw, height: fh }), signal))
  );
  if (signal?.aborted) return null;

  const W = COMPOSITE_W, H = COMPOSITE_H;
  const wts = weights();
  const accR = new Float32Array(W * H), accG = new Float32Array(W * H), accB = new Float32Array(W * H);
  const accW = new Float32Array(W * H), cov = new Float32Array(W * H);
  const sources: string[] = [];

  results.forEach((r, si) => {
    if (r.status !== "fulfilled") return;
    const px = pixels(r.value);
    const w = wts[si];
    let used = 0;
    for (let i = 0, p = 0; i < W * H; i++, p += 4) {
      const wi = w[i];
      if (wi <= 0.001) continue;
      const a = px[p + 3];
      if (a < 8 || (px[p] + px[p + 1] + px[p + 2] === 0)) continue; // outside the disc / no data
      const ww = wi * (a / 255);
      accR[i] += px[p] * ww;
      accG[i] += px[p + 1] * ww;
      accB[i] += px[p + 2] * ww;
      accW[i] += ww;
      if (ww > cov[i]) cov[i] = ww;
      used++;
    }
    if (used > 1000) sources.push(SATS[si].label);
  });

  if (sources.length === 0) return null;

  const data = new Uint8Array(W * H * 4);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const ww = accW[i];
    if (ww <= 0) continue;
    data[p] = accR[i] / ww;
    data[p + 1] = accG[i] / ww;
    data[p + 2] = accB[i] / ww;
    data[p + 3] = Math.min(255, cov[i] * 255);
  }
  return { time, w: W, h: H, data, sources };
}
