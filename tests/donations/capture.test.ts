import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { donations } from "@/lib/db/schema";
import { _resetRateLimitsForTests } from "@/lib/security/rate-limit";

const captureMock = vi.fn();
vi.mock("@/lib/paypal/orders", () => ({ captureOrder: (...a: unknown[]) => captureMock(...a), createOrder: vi.fn() }));

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const post = async (orderId: string) => {
  const { POST } = await import("@/app/api/donations/capture/route");
  return POST(new NextRequest("http://localhost/api/donations/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }));
};
const completed = (id: string) => ({ data: { id, status: "COMPLETED", payer: { email_address: "buyer@example.com" }, purchase_units: [{ payments: { captures: [{ id: `CAP-${id}`, amount: { value: "25.00", currency_code: "USD" } }] } }] }, debugId: "d1" });

beforeEach(() => {
  captureMock.mockReset();
  _resetRateLimitsForTests();
});

run("donation capture (after PayPal's approval window)", () => {
  it("records a completed capture, returns the capture id, and never stores the buyer's email", async () => {
    const id = `ORD${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    captureMock.mockResolvedValue(completed(id));
    const r = await post(id);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ orderId: id, status: "COMPLETED", amount: "25.00", captureId: `CAP-${id}` });
    const [row] = await db.select().from(donations).where(eq(donations.paypalOrderId, id));
    expect(row.status).toBe("COMPLETED");
    expect(JSON.stringify(row)).not.toContain("buyer@example.com");
  });

  it("does not record a payment PayPal did not complete", async () => {
    const id = `ORD${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    captureMock.mockResolvedValue({ data: { id, status: "PAYER_ACTION_REQUIRED", purchase_units: [] }, debugId: "d2" });
    const r = await post(id);
    expect(r.status).toBe(409);
    expect(await db.select().from(donations).where(eq(donations.paypalOrderId, id))).toHaveLength(0);
  });
});
