import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { logAuditEvent } from "@/lib/db/audit";
import { addApproval, getProposal } from "@/lib/proposals/store";
import { executeProposal } from "@/lib/proposals/execute";
import { finishApproval } from "@/lib/security/webauthn";
import { demoKeyEnabled, demoKeySignature, pinMatches } from "@/lib/security/demo-key";

/**
 * Approve a proposal. WHO is approving comes from the signed session, WHAT is being approved comes from the stored
 * proposal row; the body only carries the proof (a passkey assertion or the demo PIN). The second valid approval
 * executes, through the Treasurer, exactly once.
 */
const Body = z.discriminatedUnion("method", [
  z.object({ method: z.literal("DEMO_KEY"), pin: z.string().min(4).max(32) }),
  z.object({ method: z.literal("WEBAUTHN"), response: z.record(z.string(), z.unknown()) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAccess(req, "staff");
  if (g instanceof NextResponse) return g;
  if (g.role !== "coordinator" && g.role !== "finance") return NextResponse.json({ error: "forbidden", message: "Your role can't approve." }, { status: 403 });
  // Wrong PINs are the brute-force surface: tight per-session AND per-IP limits.
  const limited = limitRequest(req, "proposals-approve", { limit: 8 }, g.sid) ?? limitRequest(req, "proposals-approve-ip", { limit: 30 });
  if (limited) return limited;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return safeError(parsed.error, "Invalid approval.");

  try {
    const proposal = /^[0-9a-f-]{36}$/i.test(id) ? await getProposal(id) : null;
    if (!proposal) return NextResponse.json({ error: "not_found", message: "Proposal not found." }, { status: 404 });
    if (proposal.status !== "PROPOSED") return NextResponse.json({ error: "not_open", message: "This proposal is no longer open for approval.", proposal }, { status: 409 });

    let credentialId: string | null = null;
    if (parsed.data.method === "DEMO_KEY") {
      if (!demoKeyEnabled()) return NextResponse.json({ error: "demo_key_disabled", message: "The demo key is disabled on this deployment. Use a passkey." }, { status: 403 });
      if (!pinMatches(parsed.data.pin)) {
        await logAuditEvent({ actor: g.sub, action: "proposal.approve.rejected", requestRedacted: { proposalId: id, method: "DEMO_KEY" } });
        return NextResponse.json({ error: "bad_credentials", message: "That approval PIN isn't right." }, { status: 401 });
      }
      credentialId = `demo:${(await demoKeySignature(g.sub, proposal.payloadHash)).slice(0, 16)}`;
    } else {
      const v = await finishApproval(g.sub, proposal.payloadHash, parsed.data.response as never);
      if (!v.ok) {
        await logAuditEvent({ actor: g.sub, action: "proposal.approve.rejected", requestRedacted: { proposalId: id, method: "WEBAUTHN", reason: v.reason } });
        return NextResponse.json({ error: "bad_credentials", message: v.reason }, { status: 401 });
      }
      credentialId = v.credentialId;
    }

    const added = await addApproval(id, {
      approverId: g.sub,
      approverName: g.name,
      role: g.role,
      method: parsed.data.method,
      credentialId,
      payloadHash: proposal.payloadHash,
    });
    if (!added.ok) return NextResponse.json({ error: added.error.toLowerCase(), message: "This proposal can no longer be approved." }, { status: 409 });
    await logAuditEvent({ actor: g.sub, action: "proposal.approved", requestRedacted: { proposalId: id, method: parsed.data.method, becameApproved: added.becameApproved, duplicate: added.duplicate } });

    if (!added.becameApproved) return NextResponse.json({ proposal: added.proposal, executed: false, duplicate: added.duplicate });

    const exec = await executeProposal(id);
    await logAuditEvent({ actor: "treasurer", action: "proposal.executed", responseRedacted: { proposalId: id, ran: exec.ran, ok: exec.ran ? exec.ok : false } });
    if (!exec.ran) return NextResponse.json({ proposal: exec.proposal ?? added.proposal, executed: false, reason: exec.reason });
    return NextResponse.json({ proposal: exec.proposal, executed: true, ok: exec.ok, message: exec.message }, { status: exec.ok ? 200 : 502 });
  } catch (err) {
    return safeError(err, "Could not record the approval.", 500);
  }
}
