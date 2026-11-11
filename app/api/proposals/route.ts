import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { buildProposal, CreateProposalInput } from "@/lib/proposals/create";
import { createProposal, listProposals } from "@/lib/proposals/store";
import { loadLiveCasesWithReports } from "@/lib/relief/case-source";
import { householdsWithActivePayments } from "@/lib/treasurer/recovery";
import { logAuditEvent } from "@/lib/db/audit";

/** GET: recent proposals (any signed-in console user).  POST: propose a payment or recovery action (coordinator or finance). */
export async function GET(req: NextRequest) {
  const g = await requireAccess(req, "operator");
  if (g instanceof NextResponse) return g;
  try {
    return NextResponse.json({ proposals: await listProposals(25) });
  } catch (err) {
    return safeError(err, "Could not load proposals.", 503);
  }
}

export async function POST(req: NextRequest) {
  const g = await requireAccess(req, "staff");
  if (g instanceof NextResponse) return g;
  const limited = limitRequest(req, "proposals-create", { limit: 10 }, g.sid);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = CreateProposalInput.safeParse(body);
  if (!parsed.success) return safeError(parsed.error, "Invalid proposal.");

  try {
    const built = await buildProposal(parsed.data, {
      loadLiveCases: loadLiveCasesWithReports,
      activeHouseholds: householdsWithActivePayments,
    });
    if (!built.ok) return NextResponse.json({ error: built.error, message: built.message }, { status: built.status });

    const { proposal, created } = await createProposal({
      kind: built.kind,
      payload: built.payload,
      payloadHash: built.payloadHash,
      targetSenderItemId: built.targetSenderItemId,
      parentSenderItemId: built.parentSenderItemId,
      proposedBy: g.sub,
      idempotencyKey: built.idempotencyKey,
    });
    if (created) {
      await logAuditEvent({ actor: g.sub, action: "proposal.created", requestRedacted: { proposalId: proposal.id, kind: proposal.kind, payloadHash: proposal.payloadHash } });
    }
    return NextResponse.json({ proposal, created }, { status: created ? 201 : 200 });
  } catch (err) {
    return safeError(err, "Could not create the proposal.", 500);
  }
}
