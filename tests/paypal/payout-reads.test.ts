import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const fetchSpy = vi.fn();
vi.mock("@/lib/paypal/client", () => ({
  paypalFetch: (...a: unknown[]) => fetchSpy(...a),
}));

import { getPayoutBatch, getPayoutItem, GetPayoutBatchResponseSchema } from "@/lib/paypal/payout-reads";

describe("read-only payout calls (D-9)", () => {
  beforeEach(() => fetchSpy.mockReset().mockResolvedValue({ data: {}, status: 200 }));

  it("asks PayPal for pages and totals, as GET only", async () => {
    await getPayoutBatch("VTJG3SR5BY56C", "t", { page: 2, pageSize: 100, totalRequired: true });
    const [method, url] = fetchSpy.mock.calls[0];
    expect(method).toBe("GET");
    expect(url).toBe("/v1/payments/payouts/VTJG3SR5BY56C?page=2&page_size=100&total_required=true");
  });

  it("sends no query string when no options are given", async () => {
    await getPayoutBatch("VTJG3SR5BY56C");
    expect(fetchSpy.mock.calls[0][1]).toBe("/v1/payments/payouts/VTJG3SR5BY56C");
  });

  it("refuses ids that could alter the request path", async () => {
    for (const bad of ["../x", "a/b", "VTJG3SR5BY56C?x=1", "ab", "a b c d e f g"]) {
      await expect(getPayoutBatch(bad), bad).rejects.toThrow(/Invalid payout batch id/);
      await expect(getPayoutItem(bad), bad).rejects.toThrow(/Invalid payout item id/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps total_items and total_pages instead of stripping them", () => {
    const parsed = GetPayoutBatchResponseSchema.parse({
      batch_header: { payout_batch_id: "B", batch_status: "SUCCESS", sender_batch_header: { sender_batch_id: "s" } },
      items: [],
      total_items: 2500,
      total_pages: 3,
    });
    expect(parsed.total_items).toBe(2500);
    expect(parsed.total_pages).toBe(3);
  });

  it("the read-only module contains no write method (the boundary that lets non-Treasurer code import it)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/paypal/payout-reads.ts"), "utf8");
    expect(src).not.toMatch(/"(POST|PUT|PATCH|DELETE)"/);
    expect(src).not.toMatch(/createPayoutBatch|cancelPayoutItem|\/cancel/);
  });

  it("only lib/treasurer may import the module that can create or cancel payouts (refresh uses the read-only one)", () => {
    const refreshSrc = fs.readFileSync(path.join(process.cwd(), "lib/payouts/refresh.ts"), "utf8");
    expect(refreshSrc).toContain("@/lib/paypal/payout-reads");
    expect(refreshSrc).not.toMatch(/@\/lib\/paypal\/payouts["']/);
  });
});
