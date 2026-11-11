import { NextRequest, NextResponse } from "next/server";
import { runTreasuryReconciliation } from "@/lib/treasury/reconciler";
import { z } from "zod";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

const ReconcileRequestSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  forceFallback: z.boolean().optional(),
  actor: z.string().default("finance_reconciler"),
});

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "treasury-reconcile-post", { limit: 6 });
  if (limited) return limited;

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Allow empty POST body for default on-demand reconciliation
    }

    const input = ReconcileRequestSchema.parse(body);
    const report = await runTreasuryReconciliation(input);

    return NextResponse.json(report);
  } catch (err: unknown) {
    return safeError(err, "Request failed", 400);
  }
}

export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "treasury-reconcile-get", { limit: 6 });
  if (limited) return limited;

  try {
    const report = await runTreasuryReconciliation({ actor: "war_room_viewer" });
    return NextResponse.json(report);
  } catch (err: unknown) {
    return safeError(err, "Request failed", 500);
  }
}

