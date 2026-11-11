import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { clientIp } from "@/lib/security/client-ip";
import { checkRateLimit, limitRequest, _resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp (cannot be spoofed by writing the left of X-Forwarded-For)", () => {
  it("counts from the right, past trusted proxies", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 66.6.6.6" }), { TRUSTED_PROXY_HOPS: "1" })).toBe("66.6.6.6");
    expect(clientIp(h({ "x-forwarded-for": "evil, 9.9.9.9, 10.0.0.1" }), { TRUSTED_PROXY_HOPS: "2" })).toBe("9.9.9.9");
  });
  it("a caller prepending fake entries does not change the key", () => {
    const real = clientIp(h({ "x-forwarded-for": "203.0.113.5" }), {});
    const spoofed = clientIp(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.5" }), {});
    expect(spoofed).toBe(real);
  });
  it("prefers an explicitly trusted single header, falls back to x-real-ip and 'local'", () => {
    expect(clientIp(h({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }), { TRUSTED_IP_HEADER: "cf-connecting-ip" })).toBe("8.8.8.8");
    expect(clientIp(h({ "x-real-ip": "4.4.4.4" }), {})).toBe("4.4.4.4");
    expect(clientIp(h({}), {})).toBe("local");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then returns a retry-after", () => {
    _resetRateLimitsForTests();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit("k", { limit: 3, windowMs: 60_000 }, t + i).ok).toBe(true);
    const blocked = checkRateLimit("k", { limit: 3, windowMs: 60_000 }, t + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(checkRateLimit("k", { limit: 3, windowMs: 60_000 }, t + 61_000).ok).toBe(true);
  });
  it("separates buckets and clients; session id wins over IP", async () => {
    _resetRateLimitsForTests();
    const req = { headers: h({ "x-forwarded-for": "9.9.9.9" }) };
    expect(limitRequest(req, "a", { limit: 1 })).toBeNull();
    expect((await limitRequest(req, "a", { limit: 1 })!.json()).error).toBe("rate_limited");
    expect(limitRequest(req, "b", { limit: 1 })).toBeNull();
    expect(limitRequest(req, "a", { limit: 1 }, "sess-1")).toBeNull();
  });
  it("rotating X-Forwarded-For prefix does not escape the limit", () => {
    _resetRateLimitsForTests();
    let blocked = 0;
    for (let i = 0; i < 10; i++) if (limitRequest({ headers: h({ "x-forwarded-for": `10.0.${i}.1, 203.0.113.9` }) }, "ai", { limit: 3 })) blocked++;
    expect(blocked).toBe(7);
  });
});

describe("safeError", () => {
  it("never returns the underlying message, host or stack", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = safeError(new Error("connect ECONNREFUSED 10.1.2.3:5432 password=hunter2"), "Could not load data", 503);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.1\.2\.3|hunter2/);
    expect(body.message).toBe("Could not load data");
    expect(body.ref).toMatch(/^[0-9a-f]{8}$/);
    expect(spy.mock.calls[0][0]).toContain(body.ref);
    spy.mockRestore();
  });
  it("turns validation errors into a 400 that only describes the caller's input", async () => {
    const parsed = z.object({ amount: z.number() }).safeParse({ amount: "x" });
    const res = safeError((parsed as any).error, "x");
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].path).toBe("amount");
  });
});
