import { NextResponse, NextRequest } from "next/server";
import { listBatchRecords, listItemRecords } from "@/lib/payouts/store";
import { limitRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/payouts — what Landfall has durably recorded about payout batches and items.
 * Read-only. Contains ids, statuses, amounts and sync times; never recipient addresses
 * (they are not stored in these tables).
 */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "payouts-get", { limit: 30 });
  if (limited) return limited;

  try {
    const batches = await listBatchRecords(10);
    const out = [];
    for (const b of batches) {
      const items = await listItemRecords(b.paypalBatchId);
      out.push({
        paypalBatchId: b.paypalBatchId,
        senderBatchId: b.senderBatchId,
        status: b.status,
        amountCents: b.amountCents,
        feeCents: b.feeCents,
        currency: b.currency,
        lastSyncedAt: b.lastSyncedAt,
        lastSyncSource: b.lastSyncSource,
        lastSyncError: b.lastSyncError,
        items: items.map((i) => ({
          senderItemId: i.senderItemId,
          paypalItemId: i.paypalItemId,
          transactionId: i.transactionId,
          status: i.status,
          amountCents: i.amountCents,
          currency: i.currency,
          feeCents: i.feeCents,
          lastObservedAt: i.lastObservedAt,
        })),
      });
    }
    return NextResponse.json({ batches: out });
  } catch {
    return NextResponse.json({ error: "Payout records are unavailable" }, { status: 503 });
  }
}
