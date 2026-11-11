/**
 * Signed session cookie (no external dependency).
 *
 * Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payload-part)).
 * Uses the Web Crypto API only, so the same code runs in Next.js edge middleware and in route handlers.
 * The payload is signed, not encrypted: it carries no secrets (a display name, a role, and for residents a household id).
 */
export type Role = "coordinator" | "finance" | "viewer" | "resident";

export interface Session {
  sid: string;
  sub: string;
  name: string;
  role: Role;
  /** Residents only: the single household this session may see. */
  hh?: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "lf_session";
export const SESSION_TTL_SEC = 8 * 60 * 60;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The signing secret. Required in production; a fixed dev value is used elsewhere so local dev and tests just work. */
export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not configured (min 16 chars)");
  return "dev-only-session-secret-not-for-production";
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

/** Constant-time comparison of two equal-purpose byte strings. */
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await hmacKey(secret, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export function newSid(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return b64url(b);
}

export async function signSession(
  input: Omit<Session, "iat" | "exp" | "sid"> & { sid?: string },
  opts: { secret?: string; now?: number; ttlSec?: number } = {}
): Promise<string> {
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const payload: Session = { ...input, sid: input.sid ?? newSid(), iat: now, exp: now + (opts.ttlSec ?? SESSION_TTL_SEC) };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmacSha256(opts.secret ?? getSessionSecret(), body);
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null, opts: { secret?: string; now?: number } = {}): Promise<Session | null> {
  if (!token || token.length > 2048) return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  let expected: Uint8Array;
  let given: Uint8Array;
  try {
    expected = await hmacSha256(opts.secret ?? getSessionSecret(), body);
    given = fromB64url(token.slice(dot + 1));
  } catch {
    return null;
  }
  if (!safeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(dec.decode(fromB64url(body))) as Session;
    const now = Math.floor((opts.now ?? Date.now()) / 1000);
    if (typeof p.exp !== "number" || p.exp <= now) return null;
    if (!["coordinator", "finance", "viewer", "resident"].includes(p.role)) return null;
    if (typeof p.sub !== "string" || typeof p.sid !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

export function sessionCookieAttributes(secure = process.env.NODE_ENV === "production") {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_SEC };
}

/** Operators may use the console; residents may only see their own household. */
export const OPERATOR_ROLES: Role[] = ["coordinator", "finance", "viewer"];
export const isOperator = (s: Session | null): s is Session => !!s && OPERATOR_ROLES.includes(s.role);
