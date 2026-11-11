import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { loadSnapshot, pickSource, SOURCE_COOKIE } from "@/lib/relief/case-source";
import { investigateCase } from "@/lib/ai/case-officer";
import { listStatusHistory } from "@/lib/payouts/store";
import { getPayoutItem } from "@/lib/paypal/payout-reads";
import { LIVE_CASE_PREFIX_CLIENT } from "@/lib/relief/live-ref";
import { lookupTransaction } from "@/lib/paypal/agent-toolkit";
import { db } from "@/lib/db/client";
import { payoutItemRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ language: z.enum(["en", "es", "vi", "ht"]).optional() });

/** POST /api/cases/:ref/investigate — read-only AI investigation of one payment. Never changes anything. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const g = await requireAccess(req, "operator");
  if (g instanceof NextResponse) return g;
  const limited = limitRequest(req, "case-investigate", { limit: 6 }, g.sid);
  if (limited) return limited;
  const { ref: rawRef } = await ctx.params;
  const caseRef = decodeURIComponent(rawRef);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return safeError(parsed.error, "Invalid request.");

  try {
    const source = await pickSource(req.cookies.get(SOURCE_COOKIE)?.value);
    const snap = await loadSnapshot(source);
    const c = snap.cases.find((x) => x.caseRef === caseRef);
    if (!c) return NextResponse.json({ error: "not_found", message: "Case not found in the current data source." }, { status: 404 });

    const senderItemId = c.origin === "SANDBOX_LIVE" && caseRef.startsWith(LIVE_CASE_PREFIX_CLIENT) ? caseRef.slice(LIVE_CASE_PREFIX_CLIENT.length) : null;
    const hasProviderItem = senderItemId && c.itemId && c.itemId !== senderItemId;
    const result = await investigateCase(
      c,
      {
        history: async () => (senderItemId ? (await listStatusHistory(senderItemId)).map((h) => ({ observedAt: new Date(h.observedAt).toISOString(), status: h.toStatus, source: h.source })) : []),
        transaction: senderItemId
          ? async () => {
              const [row] = await db.select({ tx: payoutItemRecords.transactionId }).from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, senderItemId)).limit(1);
              return row?.tx ? lookupTransaction(row.tx) : null;
            }
          : undefined,
        liveItem: hasProviderItem
          ? async () => {
              const r = await getPayoutItem(c.itemId, "case_officer");
              return { status: r.data.transaction_status, transactionId: r.data.transaction_id ?? null };
            }
          : undefined,
      },
      parsed.data.language ?? "en"
    );
    await logAuditEvent({ actor: g.sub, action: "case.investigated", requestRedacted: { caseRef, source }, responseRedacted: { answeredBy: result.answeredBy, model: result.model, tools: result.toolCalls.length, dropped: result.integrity.droppedFacts, action: result.recommendedAction, fallback: result.fallbackReason } });
    return NextResponse.json(result);
  } catch (err) {
    return safeError(err, "The investigation could not be completed.", 503);
  }
}
