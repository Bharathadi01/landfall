import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshPayoutBatch } from "@/lib/payouts/refresh";
import { listBatchRecords } from "@/lib/payouts/store";

/**
 * POST /api/payouts/refresh — ask PayPal (read-only GET) for the latest status of payout batches
 * Landfall itself recorded, and store what it says. It cannot create, retry or cancel a payout.
 *
 * Body: {} (refresh the most recent batches) or { "paypalBatchId": "..." } (must already be recorded).
 */
const BodySchema = z.object({ paypalBatchId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/).optional() });

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function GET() {
  return NextResponse.json({ error: "Use POST to refresh" }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: NextRequest) {
  if (process.env.PAYOUT_REFRESH_ENABLED === "false") {
    return NextResponse.json({ error: "Payout refresh is disabled on this deployment" }, { status: 403 });
  }
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(client)) {
    return NextResponse.json({ error: "Too many refreshes; try again in a minute" }, { status: 429 });
  }

  // An empty body means "refresh the most recent batches". A body that is present but is not valid JSON is an
  // error: silently treating it as empty would turn a typo into a refresh of everything.
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim() !== "") {
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
  }
  const parsed = BodySchema.safeParse(raw ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid payout batch id" }, { status: 400 });

  try {
    const ids = parsed.data.paypalBatchId ? [parsed.data.paypalBatchId] : (await listBatchRecords(5)).map((b) => b.paypalBatchId);
    const results = [];
    for (const id of ids) results.push(await refreshPayoutBatch(id));
    const anyError = results.some((r) => !r.ok);
    const unknown = results.length === 1 && results[0].error?.startsWith("UNKNOWN_BATCH");
    return NextResponse.json({ refreshed: results }, { status: unknown ? 404 : anyError ? 502 : 200 });
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 503 });
  }
}
