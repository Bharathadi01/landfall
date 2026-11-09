/**
 * OFFICIAL NATIONAL WEATHER SERVICE (NWS) API CLIENT (§4.3)
 * Endpoints:
 * - https://api.weather.gov/alerts/active?area=FL (or custom area)
 * - https://api.weather.gov/alerts/active?point={lat},{lon}
 * Rules:
 * - Strict User-Agent header as required by NWS API policy.
 * - ETag and conditional caching to avoid unnecessary bandwidth.
 * - Timeouts and graceful error handling; never silently treats outage as safety.
 */

import type { ServiceHealth } from "./types";
import { normalizeNWSAlert } from "./normalize";
import type { NormalizedAlert } from "./types";

const NWS_BASE_URL = "https://api.weather.gov";
const DEFAULT_USER_AGENT = "Landfall mutual-aid hackathon app (contact: bharathadithya)";
const DEFAULT_TIMEOUT_MS = 8000;

interface CacheEntry {
  etag: string | null;
  lastModified: string | null;
  data: any;
  cachedAt: number;
}

const alertCache = new Map<string, CacheEntry>();

export function getNWSUserAgent(): string {
  return process.env.NWS_USER_AGENT || DEFAULT_USER_AGENT;
}

/**
 * Fetches active weather alerts from official NWS API for a given state area (default FL).
 */
export async function fetchLiveNWSAlerts(
  area: string = "FL",
  options: { timeoutMs?: number; skipCache?: boolean } = {}
): Promise<{
  alerts: NormalizedAlert[];
  isNotModified: boolean;
  etag?: string | null;
  rawFeatureCount: number;
}> {
  const url = `${NWS_BASE_URL}/alerts/active?area=${encodeURIComponent(area)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "User-Agent": getNWSUserAgent(),
    Accept: "application/geo+json",
  };

  const cached = alertCache.get(url);
  if (!options.skipCache && cached) {
    if (cached.etag) headers["If-None-Match"] = cached.etag;
    if (cached.lastModified) headers["If-Modified-Since"] = cached.lastModified;
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 304 Not Modified
    if (res.status === 304 && cached) {
      return {
        alerts: (cached.data.features || []).map((f: any) => normalizeNWSAlert(f, { mode: "LIVE" })),
        isNotModified: true,
        etag: cached.etag,
        rawFeatureCount: cached.data.features?.length || 0,
      };
    }

    if (!res.ok) {
      throw new Error(`NWS API responded with status ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    // Cache the response
    alertCache.set(url, {
      etag,
      lastModified,
      data,
      cachedAt: Date.now(),
    });

    const features = Array.isArray(data.features) ? data.features : [];
    const normalized = features.map((f: any) => normalizeNWSAlert(f, { mode: "LIVE" }));

    return {
      alerts: normalized,
      isNotModified: false,
      etag,
      rawFeatureCount: features.length,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`NWS API timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Verifies whether a specific point (lat, lon) has active warnings according to NWS Point API.
 */
export async function verifyPointActiveAlerts(
  lat: number,
  lon: number,
  options: { timeoutMs?: number } = {}
): Promise<{
  hasActiveWarning: boolean;
  activePhenomena: string[];
}> {
  const url = `${NWS_BASE_URL}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getNWSUserAgent(),
        Accept: "application/geo+json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // Non-200 is treated cautiously as unconfirmed
      return { hasActiveWarning: false, activePhenomena: [] };
    }

    const data = await res.json();
    const features = Array.isArray(data.features) ? data.features : [];

    const activePhenomena: string[] = [];
    let hasWarning = false;

    for (const f of features) {
      const normalized = normalizeNWSAlert(f);
      if (normalized.isTranche1Eligible) {
        hasWarning = true;
        activePhenomena.push(normalized.eventKey);
      }
    }

    return {
      hasActiveWarning: hasWarning,
      activePhenomena,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("[NWS_POINT_API] Failed to query point:", err);
    return { hasActiveWarning: false, activePhenomena: [] };
  }
}

/**
 * Checks the operational health and latency of the official NWS API.
 */
export async function checkNWSHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const res = await fetch(`${NWS_BASE_URL}/alerts/active/count`, {
      headers: {
        "User-Agent": getNWSUserAgent(),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      return {
        service: "NWS",
        status: "HEALTHY",
        lastSyncAt: new Date().toISOString(),
        latencyMs,
      };
    }

    return {
      service: "NWS",
      status: "DEGRADED",
      lastSyncAt: new Date().toISOString(),
      latencyMs,
      error: `Status ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      service: "NWS",
      status: "OUTAGE",
      lastSyncAt: null,
      latencyMs: Date.now() - startTime,
      error: err.message || "Failed to reach NWS API",
    };
  }
}
