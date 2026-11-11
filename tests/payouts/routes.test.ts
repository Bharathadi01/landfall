import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Route-level behaviour of the payout status endpoints, with the PayPal-facing service mocked (no network, no DB). */
const refresh = vi.fn();
const listBatches = vi.fn();
vi.mock("@/lib/payouts/refresh", () => ({ refreshPayoutBatch: (...a: unknown[]) => refresh(...a) }));
vi.mock("@/lib/payouts/store", () => ({
  listBatchRecords: (...a: unknown[]) => listBatches(...a),
  listItemRecords: vi.fn(async () => []),
}));

import { POST, GET } from "@/app/api/payouts/refresh/route";
import { GET as LIST } from "@/app/api/payouts/route";

const req = (body?: unknown, ip = "9.9.9.9") =>
  new NextRequest("http://localhost/api/payouts/refresh", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("POST /api/payouts/refresh", () => {
  beforeEach(() => {
    refresh.mockReset();
    listBatches.mockReset();
    delete process.env.PAYOUT_REFRESH_ENABLED;
  });

  it("is POST-only", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("rejects malformed batch ids before anything else happens", async () => {
    for (const bad of ["../../etc", "a b", "x", "VTJG3SR5BY56C/../x", "<script>"]) {
      const res = await POST(req({ paypalBatchId: bad }, `ip-${bad}`));
      expect(res.status, bad).toBe(400);
    }
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body instead of treating it as 'refresh everything'", async () => {
    const bad = new NextRequest("http://localhost/api/payouts/refresh", {
      method: "POST",
      headers: { "x-forwarded-for": "ip-badjson", "content-type": "application/json" },
      body: '{\\"paypalBatchId\\": oops',
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect(refresh).not.toHaveBeenCalled();
    expect(listBatches).not.toHaveBeenCalled();
  });

  it("refreshes exactly the batch asked for", async () => {
    refresh.mockResolvedValue({ ok: true, paypalBatchId: "VTJG3SR5BY56C", pagesFetched: 1, itemsSeen: 5, complete: true, changes: [], flags: [] });
    const res = await POST(req({ paypalBatchId: "VTJG3SR5BY56C" }, "ip-a"));
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("VTJG3SR5BY56C");
    expect(listBatches).not.toHaveBeenCalled();
  });

  it("with no body refreshes the most recent recorded batches only", async () => {
    listBatches.mockResolvedValue([{ paypalBatchId: "AAAAAA1" }, { paypalBatchId: "BBBBBB2" }]);
    refresh.mockResolvedValue({ ok: true, pagesFetched: 1, itemsSeen: 0, complete: true, changes: [], flags: [] });
    const res = await POST(req(undefined, "ip-b"));
    expect(res.status).toBe(200);
    expect(refresh.mock.calls.map((c) => c[0])).toEqual(["AAAAAA1", "BBBBBB2"]);
    expect(listBatches).toHaveBeenCalledWith(5);
  });

  it("returns 404 for a batch that was never recorded and 502 when PayPal fails", async () => {
    refresh.mockResolvedValueOnce({ ok: false, error: "UNKNOWN_BATCH: only batches Landfall has recorded can be refreshed", pagesFetched: 0, itemsSeen: 0, complete: false, changes: [], flags: [] });
    expect((await POST(req({ paypalBatchId: "UNKNOWN123" }, "ip-c"))).status).toBe(404);
    refresh.mockResolvedValueOnce({ ok: false, error: "PayPal API error (503)", pagesFetched: 0, itemsSeen: 0, complete: false, changes: [], flags: [] });
    expect((await POST(req({ paypalBatchId: "SOMEBATCH1" }, "ip-c"))).status).toBe(502);
  });

  it("can be switched off, and rate limits a noisy client", async () => {
    process.env.PAYOUT_REFRESH_ENABLED = "false";
    expect((await POST(req({}, "ip-d"))).status).toBe(403);
    delete process.env.PAYOUT_REFRESH_ENABLED;

    listBatches.mockResolvedValue([]);
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await POST(req({}, "ip-flood"))).status);
    expect(codes.slice(0, 6).every((c) => c === 200)).toBe(true);
    expect(codes.slice(6)).toEqual([429, 429]);
  });
});

describe("GET /api/payouts", () => {
  it("returns recorded batches without any recipient field", async () => {
    listBatches.mockResolvedValue([{ paypalBatchId: "VTJG3SR5BY56C", senderBatchId: "batch_x_t1", status: "SUCCESS", amountCents: 50000, feeCents: 300, currency: "USD", lastSyncedAt: null, lastSyncSource: "refresh", lastSyncError: null }]);
    const res = await LIST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.batches[0].paypalBatchId).toBe("VTJG3SR5BY56C");
    expect(JSON.stringify(body)).not.toMatch(/receiver|email|@/i);
  });

  it("fails closed with 503 and no internals when the store is unavailable", async () => {
    listBatches.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const res = await LIST();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5");
  });
});
