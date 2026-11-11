/**
 * ACTION PROPOSALS — the ONLY way money moves after a plan exists.
 *
 *   propose  (coordinator)  →  approve ×2 (two DIFFERENT people, one Finance, server-verified)  →  execute (Treasurer only)
 *
 * No request body, no AI and no page can skip a step: the proposal row is the durable record, the Treasurer reads its
 * approvals from the database, and the payload that was approved is hashed so it cannot change afterwards.
 */
export type ProposalKind = "CANCEL_ITEM" | "NEW_PAYOUT" | "REISSUE";
export type ProposalStatus = "PROPOSED" | "APPROVED" | "EXECUTING" | "EXECUTED" | "FAILED" | "REJECTED";
export type ApprovalMethod = "WEBAUTHN" | "DEMO_KEY";

export interface CancelPayload {
  kind: "CANCEL_ITEM";
  senderItemId: string;
  paypalItemId: string;
  paypalBatchId: string;
  amountCents: number;
  currency: "USD";
  reason: string;
}

export interface PayoutPayloadItem {
  householdId: string;
  amountCents: number;
  currency: "USD";
  note: string;
}

export interface PayoutPayload {
  kind: "NEW_PAYOUT" | "REISSUE";
  /** Becomes the PayPal sender_batch_id / sender_item_id prefix: unique per proposal, so PayPal can never see a duplicate id. */
  activationId: string;
  tranche: 1 | 2;
  items: PayoutPayloadItem[];
  totalAmountCents: number;
  totalFeesCents: number;
  /** REISSUE only: the original sender_item_id this replaces (lineage). */
  parentSenderItemId?: string;
}

export type ProposalPayload = CancelPayload | PayoutPayload;

export interface ApprovalRecord {
  approverId: string;
  approverName: string;
  role: "coordinator" | "finance";
  method: ApprovalMethod;
  credentialId?: string | null;
  payloadHash: string;
  createdAt?: string;
}

export interface ProposalView {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: ProposalPayload;
  payloadHash: string;
  proposedBy: string;
  approvals: ApprovalRecord[];
  needs: string[];
  result?: unknown;
  createdAt: string;
  executedAt?: string | null;
}
