import { NextResponse } from "next/server";
import { clientIp } from "./client-ip";

/**
 * In-memory sliding-window rate limiter (one instance; Render starter runs a single process).
 * Keyed by session id when there is one, else by the trusted client IP — never by a raw, caller-written header.
 */
interface Hit { t: number[] }
const buckets = new Map<string, Hit>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, h] of buckets) {
    if (!h.t.length || now - h.t[h.t.length - 1] > 10 * 60_000) buckets.delete(k);
  }
}

export interface LimitOptions { limit: number; windowMs?: number }

export function checkRateLimit(key: string, opts: LimitOptions, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  sweep(now);
  const windowMs = opts.windowMs ?? 60_000;
  const h = buckets.get(key) ?? { t: [] };
  h.t = h.t.filter((x) => now - x < windowMs);
  if (h.t.length >= opts.limit) {
    buckets.set(key, h);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((h.t[0] + windowMs - now) / 1000)) };
  }
  h.t.push(now);
  buckets.set(key, h);
  return { ok: true, retryAfterSec: 0 };
}

/** Returns a 429 response when over the limit, else null. */
export function limitRequest(req: { headers: Headers }, bucket: string, opts: LimitOptions, sessionId?: string | null): NextResponse | null {
  const who = sessionId ? `s:${sessionId}` : `ip:${clientIp(req.headers)}`;
  const r = checkRateLimit(`${bucket}|${who}`, opts);
  if (r.ok) return null;
  return NextResponse.json({ error: "rate_limited", message: "Too many requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
}

export function _resetRateLimitsForTests() { buckets.clear(); }
