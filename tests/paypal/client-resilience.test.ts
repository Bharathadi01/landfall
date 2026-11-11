import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getClientCredentialsToken, clearTokenCache, paypalFetch, PayPalError } from "@/lib/paypal/client";

// audit_events writes are irrelevant here and must not touch a database
vi.mock("@/lib/db/audit", () => ({ logAuditEvent: vi.fn(async () => {}) }));

const tokenRes = () => new Response(JSON.stringify({ access_token: "tok", expires_in: 32400, token_type: "Bearer" }), { status: 200 });
const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const noSleep = async () => {};

describe("PayPal client resilience (audit: no timeout / retry / single-flight)", () => {
  beforeEach(() => {
    clearTokenCache();
    process.env.PAYPAL_CLIENT_ID = "id";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("concurrent callers share one OAuth request", async () => {
    const f = vi.fn(async () => tokenRes());
    vi.stubGlobal("fetch", f);
    const tokens = await Promise.all(Array.from({ length: 8 }, () => getClientCredentialsToken()));
    expect(new Set(tokens)).toEqual(new Set(["tok"]));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a GET on 503 then succeeds (bounded)", async () => {
    let n = 0;
    const f = vi.fn(async (url: string) => (String(url).includes("oauth2") ? tokenRes() : ++n < 3 ? json(503) : json(200, { ok: true })));
    vi.stubGlobal("fetch", f);
    const r = await paypalFetch("GET", "/v1/x", undefined, { sleep: noSleep });
    expect((r.data as any).ok).toBe(true);
    expect(f.mock.calls.filter((c) => !String(c[0]).includes("oauth2"))).toHaveLength(3);
  });

  it("gives up after the retry budget and throws a typed error", async () => {
    const f = vi.fn(async (url: string) => (String(url).includes("oauth2") ? tokenRes() : json(503)));
    vi.stubGlobal("fetch", f);
    await expect(paypalFetch("GET", "/v1/x", undefined, { sleep: noSleep })).rejects.toBeInstanceOf(PayPalError);
    expect(f.mock.calls.filter((c) => !String(c[0]).includes("oauth2"))).toHaveLength(3); // 1 + 2 retries
  });

  it("NEVER retries a payment-creating POST that has no idempotency key", async () => {
    const f = vi.fn(async (url: string) => (String(url).includes("oauth2") ? tokenRes() : json(503)));
    vi.stubGlobal("fetch", f);
    await expect(paypalFetch("POST", "/v1/payments/payouts", { a: 1 }, { sleep: noSleep })).rejects.toBeInstanceOf(PayPalError);
    expect(f.mock.calls.filter((c) => !String(c[0]).includes("oauth2"))).toHaveLength(1);
  });

  it("retries a POST only when it carries PayPal-Request-Id", async () => {
    let n = 0;
    const f = vi.fn(async (url: string) => (String(url).includes("oauth2") ? tokenRes() : ++n < 2 ? json(502) : json(201, { id: "A" })));
    vi.stubGlobal("fetch", f);
    const r = await paypalFetch("POST", "/v2/checkout/orders", { a: 1 }, { requestId: "req-1", sleep: noSleep });
    expect((r.data as any).id).toBe("A");
    expect(f.mock.calls.filter((c) => !String(c[0]).includes("oauth2"))).toHaveLength(2);
  });

  it("does not retry client errors (4xx other than 429)", async () => {
    const f = vi.fn(async (url: string) => (String(url).includes("oauth2") ? tokenRes() : json(400, { name: "VALIDATION_ERROR" })));
    vi.stubGlobal("fetch", f);
    await expect(paypalFetch("GET", "/v1/x", undefined, { sleep: noSleep })).rejects.toMatchObject({ status: 400 });
    expect(f.mock.calls.filter((c) => !String(c[0]).includes("oauth2"))).toHaveLength(1);
  });

  it("every request carries an abort signal (no unbounded waits)", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => (String(url).includes("oauth2") ? tokenRes() : json(200, {})));
    vi.stubGlobal("fetch", f);
    await paypalFetch("GET", "/v1/x", undefined, { sleep: noSleep });
    for (const c of f.mock.calls) expect((c[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("a network failure surfaces as a PayPalError after retries", async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2")) return tokenRes();
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", f);
    await expect(paypalFetch("GET", "/v1/x", undefined, { sleep: noSleep })).rejects.toMatchObject({ name: "PayPalError", status: 504 });
  });
});
