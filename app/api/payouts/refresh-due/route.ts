import { NextRequest, NextResponse } from "next/server";
import { or, isNull, lt, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutBatchRecords } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/auth/cron";
import { refreshPayoutBatch } from "@/lib/payouts/refresh";
import { safeError } from "@/lib/http/safe-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STALE_MS = 10 * 60_000;

/**
 * POST /api/payouts/refresh-due — scheduler-only backstop for missed webhooks. Read-only GETs to PayPal for the
 * most recent batches not synced in the last 10 minutes. Fails closed without CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (process.env.PAYOUT_REFRESH_ENABLED === "false") return NextResponse.json({ error: "disabled" }, { status: 403 });
  const denied = verifyCronSecret(req);
  if (denied) return denied;
  try {
    const due = await db
      .select({ id: payoutBatchRecords.paypalBatchId })
      .from(payoutBatchRecords)
      .where(or(isNull(payoutBatchRecords.lastSyncedAt), lt(payoutBatchRecords.lastSyncedAt, new Date(Date.now() - STALE_MS))))
      .orderBy(desc(payoutBatchRecords.createdAt))
      .limit(5);
    const results = [];
    for (const b of due) results.push(await refreshPayoutBatch(b.id));
    return NextResponse.json({ due: due.length, refreshed: results.map((r) => ({ ok: r.ok, changed: (r as { changed?: number }).changed ?? null })) });
  } catch (err) {
    return safeError(err, "Refresh failed", 503);
  }
}
