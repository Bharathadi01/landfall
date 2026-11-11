import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth/guard";
import { MAX_ITEM_CENTS, MAX_TOTAL_CENTS } from "@/lib/proposals/policy";
import { hasReceiver } from "@/lib/proposals/receivers";

/**
 * Which households have a payout route configured on the server, and the caps. Never returns a receiver address.
 * Households come from SANDBOX_RECEIVERS keys; the UI shows "payout route: yes" and nothing else about the account.
 */
export async function GET(req: NextRequest) {
  const g = await requireAccess(req, "operator");
  if (g instanceof NextResponse) return g;
  let ids: string[] = [];
  try {
    ids = Object.keys(JSON.parse(process.env.SANDBOX_RECEIVERS ?? "{}") as Record<string, string>).filter((id) => hasReceiver(id)).sort();
  } catch {
    ids = [];
  }
  return NextResponse.json({ households: ids, maxItemCents: MAX_ITEM_CENTS, maxTotalCents: MAX_TOTAL_CENTS });
}
