import { describe, it, expect, vi } from "vitest";
import { createWithRateLimitRetry, retryDelayMs } from "@/lib/ai/watch-officer/groq-client";

const rateLimited = (headers: Record<string, string> = {}) => Object.assign(new Error("429 rate limit"), { status: 429, headers });
const client = (fn: () => Promise<unknown>) => ({ chat: { completions: { create: fn } } }) as never;

describe("Groq 429 retry", () => {
  it("retries a 429 after the provider's reset and returns the real answer", async () => {
    const create = vi.fn().mockRejectedValueOnce(rateLimited({ "x-ratelimit-reset-tokens": "1.2s" })).mockResolvedValueOnce({ ok: true });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(createWithRateLimitRetry(client(create), {}, sleep)).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it("gives up after the bounded attempts so the caller can label the offline fallback", async () => {
    const create = vi.fn().mockRejectedValue(rateLimited());
    await expect(createWithRateLimitRetry(client(create), {}, async () => {})).rejects.toMatchObject({ status: 429 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("never retries other errors", async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await expect(createWithRateLimitRetry(client(create), {}, async () => {})).rejects.toMatchObject({ status: 500 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("caps the wait and understands retry-after and minute-second reset formats", () => {
    expect(retryDelayMs(rateLimited({ "retry-after": "3" }), 0)).toBe(3000);
    expect(retryDelayMs(rateLimited({ "retry-after": "120" }), 0)).toBe(8000);
    expect(retryDelayMs(rateLimited({ "x-ratelimit-reset-tokens": "1m26.4s" }), 0)).toBe(8000);
    expect(retryDelayMs(rateLimited({ "x-ratelimit-reset-tokens": "727ms" }), 0)).toBe(1027);
    expect(retryDelayMs(rateLimited(), 0)).toBe(1500);
  });
});
