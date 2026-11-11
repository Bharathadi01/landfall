import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { getProposal } from "@/lib/proposals/store";
import { beginApproval, personaHasPasskey } from "@/lib/security/webauthn";
import { demoKeyEnabled } from "@/lib/security/demo-key";

/** Start a passkey approval: a single-use challenge bound to THIS proposal's payload hash and the signed-in person. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAccess(req, "staff");
  if (g instanceof NextResponse) return g;
  const limited = limitRequest(req, "proposals-approve-options", { limit: 20 }, g.sid);
  if (limited) return limited;
  const { id } = await ctx.params;
  try {
    const p = /^[0-9a-f-]{36}$/i.test(id) ? await getProposal(id) : null;
    if (!p) return NextResponse.json({ error: "not_found", message: "Proposal not found." }, { status: 404 });
    if (p.status !== "PROPOSED") return NextResponse.json({ error: "not_open", message: "This proposal is no longer open for approval." }, { status: 409 });
    if (!(await personaHasPasskey(g.sub))) {
      return NextResponse.json({ error: "no_passkey", message: "No passkey is registered for you.", demoKeyAvailable: demoKeyEnabled() }, { status: 409 });
    }
    return NextResponse.json({ options: await beginApproval(g.sub, p.payloadHash), payloadHash: p.payloadHash });
  } catch (err) {
    return safeError(err, "Could not start the approval.", 500);
  }
}
