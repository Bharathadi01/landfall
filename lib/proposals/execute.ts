/**
 * Execute an APPROVED proposal. Called only after the two-person rule is satisfied (see store.addApproval).
 * Single-flight: the APPROVED → EXECUTING claim is atomic, so a double-click or two simultaneous second-approvals
 * result in exactly one execution.
 */
import { claimForExecution, getProposal, markResult } from "./store";
import { evaluateApprovals } from "./approvals";
import type { CancelPayload, PayoutPayload, ProposalView } from "./types";
import { cancelUnclaimedItem, executeApprovedPayout, type CancelDeps, type PayoutDeps } from "@/lib/treasurer/recovery";

export interface ExecuteDeps {
  cancel?: CancelDeps;
  payout?: PayoutDeps;
}

export type ExecutionReport =
  | { ran: true; ok: boolean; proposal: ProposalView; message: string }
  | { ran: false; reason: "NOT_APPROVED" | "ALREADY_CLAIMED" | "NOT_FOUND"; proposal: ProposalView | null };

export async function executeProposal(id: string, deps: ExecuteDeps = {}): Promise<ExecutionReport> {
  const before = await getProposal(id);
  if (!before) return { ran: false, reason: "NOT_FOUND", proposal: null };
  if (before.status !== "APPROVED") return { ran: false, reason: before.status === "EXECUTING" || before.status === "EXECUTED" ? "ALREADY_CLAIMED" : "NOT_APPROVED", proposal: before };

  // Defence in depth: re-check the rule from the database immediately before acting.
  if (!evaluateApprovals(before.approvals, before.payloadHash).satisfied) return { ran: false, reason: "NOT_APPROVED", proposal: before };

  const claimed = await claimForExecution(id);
  if (!claimed) return { ran: false, reason: "ALREADY_CLAIMED", proposal: await getProposal(id) };

  try {
    if (claimed.kind === "CANCEL_ITEM") {
      const r = await cancelUnclaimedItem(claimed.payload as CancelPayload, deps.cancel);
      if (r.ok) {
        await markResult(id, "EXECUTED", { outcome: r.outcome, providerStatus: r.providerStatus, ledger: r.observation.ledgerTransactionIds });
        return { ran: true, ok: true, proposal: (await getProposal(id))!, message: r.outcome === "CANCELLED" ? "PayPal cancelled the payment and the funds returned to the fund." : "PayPal had already returned this payment; the record is up to date." };
      }
      await markResult(id, "FAILED", { error: r.error, message: r.message, providerStatus: r.providerStatus });
      return { ran: true, ok: false, proposal: (await getProposal(id))!, message: r.message };
    }

    const r = await executeApprovedPayout(id, claimed.payload as PayoutPayload, claimed.payloadHash, claimed.approvals, deps.payout);
    if (r.ok) {
      await markResult(id, "EXECUTED", { paypalBatchId: r.paypalBatchId, senderBatchId: r.senderBatchId, items: r.items, totalCents: r.totalCents, persisted: r.persisted });
      return { ran: true, ok: true, proposal: (await getProposal(id))!, message: `Sent to PayPal as batch ${r.paypalBatchId}. Each payment now appears as a case; PayPal’s statuses arrive by webhook or refresh.` };
    }
    await markResult(id, "FAILED", { error: r.error });
    return { ran: true, ok: false, proposal: (await getProposal(id))!, message: r.error };
  } catch (err) {
    // Unknown outcome: never leave the proposal "EXECUTING" forever, and never retry a send on our own.
    await markResult(id, "FAILED", { error: "UNEXPECTED", message: err instanceof Error ? err.message.slice(0, 200) : "unexpected error" });
    return { ran: true, ok: false, proposal: (await getProposal(id))!, message: "Something went wrong while executing. Check PayPal’s status before trying again — do not resend." };
  }
}
