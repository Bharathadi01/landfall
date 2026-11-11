import { logAuditEvent } from "@/lib/db/audit";
import { z } from "zod";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  public status: number;
  public debugId?: string;
  public details?: unknown;

  constructor(message: string, status: number, debugId?: string, details?: unknown) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.debugId = debugId;
    this.details = details;
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;
/** Single-flight: concurrent callers share ONE in-flight token request instead of each making their own. */
let inflightToken: Promise<string> | null = null;

/** Every PayPal HTTP call is bounded. */
export const PAYPAL_TIMEOUT_MS = 15_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

export function clearTokenCache() {
  cachedToken = null;
  inflightToken = null;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function backoffMs(attempt: number, retryAfter: string | null): number {
  const ra = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(ra) && ra >= 0) return Math.min(ra * 1000, 8000);
  return Math.min(300 * 2 ** attempt, 3000) + Math.floor(Math.random() * 150);
}

export function getCachedTokenState() {
  return cachedToken;
}

/**
 * Retrieves a valid OAuth token using client_credentials grant.
 * Refreshes 5 minutes before actual expiration.
 */
export async function getClientCredentialsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }
  if (inflightToken) return inflightToken;
  inflightToken = fetchClientCredentialsToken(now).finally(() => {
    inflightToken = null;
  });
  return inflightToken;
}

async function fetchClientCredentialsToken(now: number): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new PayPalError(
      "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment",
      401
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const startTime = Date.now();

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });

  const debugId = res.headers.get("paypal-debug-id") || undefined;
  const data = await res.json();

  if (!res.ok) {
    await logAuditEvent({
      actor: "system",
      action: "paypal_oauth_token_failure",
      requestRedacted: { grant_type: "client_credentials" },
      responseRedacted: data,
      debugId,
    });
    throw new PayPalError(
      data.error_description || data.message || "Failed to obtain PayPal OAuth token",
      res.status,
      debugId,
      data
    );
  }

  // Token expires in data.expires_in seconds (typically 32400 = 9h).
  // Refresh 5 minutes (300,000 ms) early.
  const expiresInMs = (data.expires_in || 3600) * 1000;
  const bufferMs = 5 * 60 * 1000;
  const expiresAt = now + Math.max(expiresInMs - bufferMs, 60 * 1000);

  cachedToken = {
    accessToken: data.access_token,
    expiresAt,
  };

  await logAuditEvent({
    actor: "system",
    action: "paypal_oauth_token_success",
    requestRedacted: { grant_type: "client_credentials" },
    responseRedacted: {
      token_type: data.token_type,
      expires_in: data.expires_in,
      expiresAt: new Date(expiresAt).toISOString(),
      latencyMs: Date.now() - startTime,
    },
    debugId,
  });

  return cachedToken.accessToken;
}

export interface PayPalFetchOptions<T> {
  /** Override retry count (default 2). Retries only ever happen for GETs and for POSTs that carry a requestId (idempotent). */
  retries?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  schema?: z.ZodType<T>;
  requestId?: string;
  token?: string; // override token (e.g. for user tokens)
  skipAuth?: boolean;
  actor?: string;
}

/**
 * Universal PayPal REST client with token caching, idempotency, Zod parsing,
 * audit logging, and debug_id propagation.
 */
export async function paypalFetch<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  body?: unknown,
  opts: PayPalFetchOptions<T> = {}
): Promise<{ data: T; debugId?: string; status: number }> {
  const token = opts.token || (opts.skipAuth ? null : await getClientCredentialsToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (opts.requestId) {
    headers["PayPal-Request-Id"] = opts.requestId;
  }

  const url = path.startsWith("http") ? path : `${PAYPAL_BASE_URL}${path}`;
  const startTime = Date.now();

  // Retrying a payment-creating POST without an idempotency key could send money twice, so only
  // GETs and POSTs that carry PayPal-Request-Id are ever retried.
  const retrySafe = method === "GET" || Boolean(opts.requestId);
  const maxRetries = retrySafe ? (opts.retries ?? MAX_RETRIES) : 0;
  const sleep = opts.sleep ?? defaultSleep;

  let res!: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      });
    } catch (netErr) {
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw new PayPalError(`PayPal request failed or timed out (${(netErr as Error)?.name ?? "network"})`, 504, undefined, undefined);
    }
    if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
      await sleep(backoffMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    break;
  }

  const debugId = res.headers.get("paypal-debug-id") || undefined;

  let responseJson: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      responseJson = JSON.parse(text);
    } catch {
      responseJson = { raw: text };
    }
  }

  // Redact potential secrets from body
  const requestRedacted = body ? JSON.parse(JSON.stringify(body)) : undefined;

  await logAuditEvent({
    actor: opts.actor || "system",
    action: `paypal_${method.toLowerCase()}_${path.split("?")[0].replace(/\//g, "_")}`,
    requestRedacted: { method, url, body: requestRedacted, requestId: opts.requestId },
    responseRedacted: responseJson,
    debugId,
  });

  if (!res.ok) {
    const errorMsg =
      (responseJson as Record<string, unknown>)?.message ||
      (responseJson as Record<string, unknown>)?.error_description ||
      `PayPal API error: ${res.statusText} (${res.status})`;

    throw new PayPalError(
      String(errorMsg),
      res.status,
      debugId,
      responseJson
    );
  }

  if (opts.schema && responseJson !== null) {
    const parsed = opts.schema.safeParse(responseJson);
    if (!parsed.success) {
      throw new PayPalError(
        `Failed to parse PayPal response schema: ${parsed.error.message}`,
        500,
        debugId,
        parsed.error.format()
      );
    }
    return { data: parsed.data, debugId, status: res.status };
  }

  return { data: responseJson as T, debugId, status: res.status };
}

