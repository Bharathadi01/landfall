import { describe, it, expect, vi, beforeEach } from "vitest";
import { getClientCredentialsToken, clearTokenCache, getCachedTokenState, paypalFetch, PayPalError } from "@/lib/paypal/client";

describe("PayPal Client Token Caching & Fetch Wrapper", () => {
  beforeEach(() => {
    clearTokenCache();
    vi.restoreAllMocks();
    process.env.PAYPAL_CLIENT_ID = "mock_client_id";
    process.env.PAYPAL_CLIENT_SECRET = "mock_client_secret";
  });

  it("caches the OAuth token and refreshes 5 minutes before expiration", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "paypal-debug-id": "mock-debug-id" }),
      json: async () => ({
        access_token: "A21AA_TEST_TOKEN",
        token_type: "Bearer",
        expires_in: 3600, // 1 hour
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const token1 = await getClientCredentialsToken();
    expect(token1).toBe("A21AA_TEST_TOKEN");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should hit the in-memory cache without calling fetch
    const token2 = await getClientCredentialsToken();
    expect(token2).toBe("A21AA_TEST_TOKEN");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const state = getCachedTokenState();
    expect(state).not.toBeNull();
    // Expiration timestamp should be approximately now + (3600 - 300) seconds
    expect(state!.expiresAt).toBeGreaterThan(Date.now() + 3200 * 1000);
  });

  it("throws typed PayPalError when API returns non-200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "paypal-debug-id": "debug-err-999" }),
      text: async () => JSON.stringify({ message: "Duplicate sender batch ID", name: "DUPLICATE_BATCH" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      paypalFetch("POST", "/v1/payments/payouts", {}, { skipAuth: true })
    ).rejects.toThrowError(PayPalError);
  });
});
