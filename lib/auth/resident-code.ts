import { getSessionSecret, hmacSha256 } from "./session";

/**
 * Resident access codes.
 *
 * A resident proves they are the household by presenting a 6-digit code that a coordinator gives them
 * (in person, on the paper card, or via the judge test card for synthetic Sandbox cases). The code is
 * HMAC-SHA256(server secret, epoch + household id) reduced to 6 digits, so it needs no database, cannot be
 * derived without the server secret, and can be rotated for everyone by changing RESIDENT_CODE_EPOCH.
 * Guessing is throttled: 6 wrong codes for one household lock that household for 15 minutes.
 */
const MAX_FAILURES = 6;
const LOCK_MS = 15 * 60_000;

const failures = new Map<string, { n: number; first: number; lockedUntil: number }>();

/** `milton-2024:t1:hh_tbw_002`, `TBW:HU.W:0009:t1:hh_tbw_002`, `hh_tbw_002` → `hh_tbw_002` */
export function householdFromRef(ref: string): string | null {
  const m = ref.trim().match(/(hh_[a-z0-9_]+)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

export async function residentCode(householdId: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  const epoch = env.RESIDENT_CODE_EPOCH ?? "1";
  const mac = await hmacSha256(getSessionSecret(env), `resident-code:${epoch}:${householdId.toLowerCase()}`);
  const n = ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export type CodeCheck = { ok: true } | { ok: false; reason: "locked" | "wrong"; retryAfterSec?: number };

export async function verifyResidentCode(householdId: string, code: string, now = Date.now(), env: Record<string, string | undefined> = process.env): Promise<CodeCheck> {
  const key = householdId.toLowerCase();
  const f = failures.get(key);
  if (f && f.lockedUntil > now) return { ok: false, reason: "locked", retryAfterSec: Math.ceil((f.lockedUntil - now) / 1000) };

  const expected = await residentCode(key, env);
  const given = String(code ?? "").replace(/\s+/g, "");
  let diff = expected.length ^ given.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  if (diff === 0) {
    failures.delete(key);
    return { ok: true };
  }
  const cur = f && now - f.first < LOCK_MS ? f : { n: 0, first: now, lockedUntil: 0 };
  cur.n += 1;
  if (cur.n >= MAX_FAILURES) cur.lockedUntil = now + LOCK_MS;
  failures.set(key, cur);
  return { ok: false, reason: cur.lockedUntil > now ? "locked" : "wrong", retryAfterSec: cur.lockedUntil > now ? Math.ceil(LOCK_MS / 1000) : undefined };
}

export function _resetResidentLockoutsForTests() {
  failures.clear();
}
