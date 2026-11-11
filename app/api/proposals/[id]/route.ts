import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth/guard";
import { safeError } from "@/lib/http/safe-error";
import { getProposal } from "@/lib/proposals/store";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAccess(req, "operator");
  if (g instanceof NextResponse) return g;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found", message: "Proposal not found." }, { status: 404 });
  try {
    const proposal = await getProposal(id);
    if (!proposal) return NextResponse.json({ error: "not_found", message: "Proposal not found." }, { status: 404 });
    return NextResponse.json({ proposal });
  } catch (err) {
    return safeError(err, "Could not load the proposal.", 503);
  }
}
