/**
 * PROPOSAL STORE (database). All state transitions are conditional UPDATEs / row locks, so concurrent requests
 * (two approvers tapping at once, a double-click on execute) cannot double-approve or double-execute.
 */
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { actionApprovals, actionProposals } from "@/lib/db/schema";
import { evaluateApprovals } from "./approvals";
import type { ApprovalMethod, ApprovalRecord, ProposalKind, ProposalPayload, ProposalStatus, ProposalView } from "./types";

type Row = typeof actionProposals.$inferSelect;
type ApprovalRow = typeof actionApprovals.$inferSelect;

const toApproval = (a: ApprovalRow): ApprovalRecord => ({
  approverId: a.approverId,
  approverName: a.approverName,
  role: a.role,
  method: a.method,
  credentialId: a.credentialId,
  payloadHash: a.payloadHash,
  createdAt: a.createdAt.toISOString(),
});

function toView(p: Row, approvals: ApprovalRecord[]): ProposalView {
  const ev = evaluateApprovals(approvals, p.payloadHash);
  return {
    id: p.id,
    kind: p.kind,
    status: p.status,
    payload: p.payloadJson as ProposalPayload,
    payloadHash: p.payloadHash,
    proposedBy: p.proposedBy,
    approvals,
    needs: p.status === "PROPOSED" ? ev.needs : [],
    result: p.resultJson ?? undefined,
    createdAt: p.createdAt.toISOString(),
    executedAt: p.executedAt?.toISOString() ?? null,
  };
}

export interface NewProposal {
  kind: ProposalKind;
  payload: ProposalPayload;
  payloadHash: string;
  targetSenderItemId?: string;
  parentSenderItemId?: string;
  proposedBy: string;
  idempotencyKey: string;
}

/** Idempotent: proposing the same thing twice returns the existing proposal. */
export async function createProposal(n: NewProposal): Promise<{ proposal: ProposalView; created: boolean }> {
  const [inserted] = await db
    .insert(actionProposals)
    .values({
      kind: n.kind,
      payloadJson: n.payload,
      payloadHash: n.payloadHash,
      targetSenderItemId: n.targetSenderItemId ?? null,
      parentSenderItemId: n.parentSenderItemId ?? null,
      proposedBy: n.proposedBy,
      idempotencyKey: n.idempotencyKey,
    })
    .onConflictDoNothing({ target: actionProposals.idempotencyKey })
    .returning();
  if (inserted) return { proposal: toView(inserted, []), created: true };
  const [existing] = await db.select().from(actionProposals).where(eq(actionProposals.idempotencyKey, n.idempotencyKey)).limit(1);
  // A proposal that FAILED or was REJECTED must not block asking again (e.g. after fixing the cause). Anything still open or
  // already executed is returned as-is, which is what makes proposing idempotent and prevents duplicates.
  if (existing.status === "FAILED" || existing.status === "REJECTED") {
    const [retry] = await db
      .insert(actionProposals)
      .values({
        kind: n.kind,
        payloadJson: n.payload,
        payloadHash: n.payloadHash,
        targetSenderItemId: n.targetSenderItemId ?? null,
        parentSenderItemId: n.parentSenderItemId ?? null,
        proposedBy: n.proposedBy,
        idempotencyKey: `${n.idempotencyKey}#retry-${Date.now()}`,
      })
      .returning();
    return { proposal: toView(retry, []), created: true };
  }
  return { proposal: (await getProposal(existing.id))!, created: false };
}

export async function getProposal(id: string): Promise<ProposalView | null> {
  const [p] = await db.select().from(actionProposals).where(eq(actionProposals.id, id)).limit(1);
  if (!p) return null;
  const approvals = await db.select().from(actionApprovals).where(eq(actionApprovals.proposalId, id));
  return toView(p, approvals.map(toApproval));
}

export async function listProposals(limit = 25): Promise<ProposalView[]> {
  const rows = await db.select().from(actionProposals).orderBy(desc(actionProposals.createdAt)).limit(limit);
  const out: ProposalView[] = [];
  for (const p of rows) {
    const approvals = await db.select().from(actionApprovals).where(eq(actionApprovals.proposalId, p.id));
    out.push(toView(p, approvals.map(toApproval)));
  }
  return out;
}

export async function listProposalsForItem(senderItemId: string): Promise<ProposalView[]> {
  const rows = await db.select().from(actionProposals).where(eq(actionProposals.targetSenderItemId, senderItemId)).orderBy(desc(actionProposals.createdAt));
  const out: ProposalView[] = [];
  for (const p of rows) {
    const approvals = await db.select().from(actionApprovals).where(eq(actionApprovals.proposalId, p.id));
    out.push(toView(p, approvals.map(toApproval)));
  }
  return out;
}

export type AddApprovalResult =
  | { ok: true; proposal: ProposalView; becameApproved: boolean; duplicate: boolean }
  | { ok: false; error: "NOT_FOUND" | "NOT_OPEN" | "PAYLOAD_MISMATCH" };

/**
 * Record one person's approval. Under a row lock: refuses if the proposal is no longer open or the payload hash
 * differs, inserts at most one approval per person (database unique constraint), and flips PROPOSED → APPROVED
 * exactly when the two-person rule becomes satisfied.
 */
export async function addApproval(
  proposalId: string,
  a: { approverId: string; approverName: string; role: "coordinator" | "finance"; method: ApprovalMethod; credentialId?: string | null; payloadHash: string }
): Promise<AddApprovalResult> {
  return await db.transaction(async (tx) => {
    const [p] = await tx.select().from(actionProposals).where(eq(actionProposals.id, proposalId)).for("update").limit(1);
    if (!p) return { ok: false as const, error: "NOT_FOUND" as const };
    if (p.status !== "PROPOSED") return { ok: false as const, error: "NOT_OPEN" as const };
    if (a.payloadHash !== p.payloadHash) return { ok: false as const, error: "PAYLOAD_MISMATCH" as const };

    const ins = await tx
      .insert(actionApprovals)
      .values({ proposalId, approverId: a.approverId, approverName: a.approverName, role: a.role, method: a.method, credentialId: a.credentialId ?? null, payloadHash: a.payloadHash })
      .onConflictDoNothing()
      .returning({ id: actionApprovals.id });

    const rows = await tx.select().from(actionApprovals).where(eq(actionApprovals.proposalId, proposalId));
    const approvals = rows.map(toApproval);
    const ev = evaluateApprovals(approvals, p.payloadHash);
    let status: ProposalStatus = p.status;
    if (ev.satisfied) {
      await tx.update(actionProposals).set({ status: "APPROVED" }).where(and(eq(actionProposals.id, proposalId), eq(actionProposals.status, "PROPOSED")));
      status = "APPROVED";
    }
    return { ok: true as const, proposal: toView({ ...p, status }, approvals), becameApproved: ev.satisfied, duplicate: ins.length === 0 };
  });
}

/** Single-flight: only ONE caller can move APPROVED → EXECUTING. Everyone else gets null. */
export async function claimForExecution(id: string): Promise<ProposalView | null> {
  const [row] = await db.update(actionProposals).set({ status: "EXECUTING" }).where(and(eq(actionProposals.id, id), eq(actionProposals.status, "APPROVED"))).returning();
  return row ? await getProposal(row.id) : null;
}

export async function markResult(id: string, status: "EXECUTED" | "FAILED", result: unknown): Promise<void> {
  await db.update(actionProposals).set({ status, resultJson: result as never, executedAt: new Date() }).where(eq(actionProposals.id, id));
}

export async function rejectProposal(id: string): Promise<boolean> {
  const r = await db.update(actionProposals).set({ status: "REJECTED" }).where(and(eq(actionProposals.id, id), eq(actionProposals.status, "PROPOSED"))).returning({ id: actionProposals.id });
  return r.length > 0;
}
