import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The webhook gate rejects before any database access, so these run without a database.
 * Money must never move on an event PayPal has not verified.
 */
const verify = vi.fn();
vi.mock("@/lib/paypal/webhooks", async (orig) => ({
  ...(await orig<typeof import("@/lib/paypal/webhooks")>()),
  verifyWebhookSignature: (...a: unknown[]) => verify(...a),
}));
vi.mock("@/lib/db/client", () => ({
  db: new Proxy({}, { get: () => { throw new Error("DB must not be touched for rejected events"); } }),
}));

import { POST } from "@/app/api/paypal/webhook/route";

const SALE = {
  id: "WH-FORGED-1",
  event_type: "PAYMENT.SALE.COMPLETED",
  resource: { id: "S1", amount: { total: "999.00", currency: "USD" } },
};
const HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/C",
  "paypal-transmission-id": "t",
  "paypal-transmission-sig": "s",
  "paypal-transmission-time": "2026-11-11T00:00:00Z",
};
const req = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/paypal/webhook", { method: "POST", headers, body: JSON.stringify(SALE) });

describe("PayPal webhook gate (D1)", () => {
  beforeEach(() => {
    verify.mockReset();
    process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
  });

  it("rejects an unsigned event with 401 and touches nothing", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects an event whose signature PayPal reports as FAILURE", async () => {
    verify.mockResolvedValue(false);
    const res = await POST(req(HEADERS));
    expect(res.status).toBe(401);
    expect(verify).toHaveBeenCalledOnce();
  });

  it("refuses to process anything when the receiver has no webhook id configured", async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const res = await POST(req(HEADERS));
    expect(res.status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
});
