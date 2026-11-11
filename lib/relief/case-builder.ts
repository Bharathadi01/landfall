/**
 * PURE CASE BUILDER. One function turns a normalised set of facts into a ReliefCase — staging, evidence
 * (present / missing / not expected, never fabricated), the next permitted action, and an explainable priority.
 * The replay dataset and the live PayPal Sandbox records both feed this same function, so the two can never
 * disagree about what a status means.
 */
import { recoveryDecisionForStatus } from "@/lib/recovery/decision";
import {
  ACCESS_REASON_LABEL,
  STAGES,
  type AccessReport,
  type DataOrigin,
  type EvidenceRow,
  type PayPalItemStatus,
  type PriorityReason,
  type ReliefCase,
  type StageKey,
} from "./case-types";

export const CLAIM_WINDOW_DAYS = 30;

const PLAIN_ACTION: Record<string, string> = {
  WAIT_AND_MONITOR: "Wait and poll PayPal — don’t resubmit",
  CONTACT_RECIPIENT: "Help the resident claim it — don’t send again",
  ESCALATE_TO_PAYPAL_OR_OPERATOR: "Escalate to PayPal support — don’t resend",
  PREPARE_CORRECTED_RETRY: "Confirm the ledger, then prepare a new two-key plan",
  PREPARE_NEW_APPROVED_PAYOUT: "Fix the payout route, then a new two-key plan",
  CLOSE_AS_RESOLVED: "No payout action needed",
  HOLD_INSUFFICIENT_EVIDENCE: "Hold until PayPal evidence is available",
};

const STATUS_POINTS: Record<PayPalItemStatus, [number, string]> = {
  FAILED: [45, "Payout failed — money did not reach them"],
  ONHOLD: [40, "PayPal hold — needs investigation"],
  BLOCKED: [40, "Blocked by PayPal — needs investigation"],
  RETURNED: [35, "Returned to the fund — household has nothing"],
  UNCLAIMED: [30, "Unclaimed — resident can’t collect yet"],
  REVERSED: [35, "Reversed after settlement"],
  REFUNDED: [35, "Refunded after settlement"],
  PENDING: [10, "Still processing"],
  SUCCESS: [0, ""],
};

/** Everything the builder needs, already normalised. Callers supply real facts; the builder never invents any. */
export interface CaseInput {
  origin: DataOrigin;
  caseRef: string;
  itemId: string;
  batchId: string;
  obligationId: string;
  householdRef: string;
  resident: string;
  zone: string;
  tier: number;
  tierLabel: string;
  wallet: "PAYPAL" | "VENMO";
  amountUsd: number;
  status: PayPalItemStatus;
  ageHours: number;
  ageBand: ReliefCase["ageBand"];
  /** Replay only: a synthetic "already confirmed" flag that a later resident report can supersede. */
  seededConfirmation: boolean;
  reports: AccessReport[];
  /** Pre-built evidence rows for facts that differ by origin (obligation, approval, payout, webhook, ledger, proof). */
  evidenceBase: EvidenceRow[];
  /** Whether the obligation was approved by two people (drives stage 1). */
  approved: boolean;
}

export function buildCase(input: CaseInput): ReliefCase {
  const reports = [...input.reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = reports[reports.length - 1];
  const reportedReceived = latest?.kind === "RECEIVED";
  const barrier = latest?.kind === "CANT_ACCESS" ? latest.reason ?? "OTHER" : undefined;
  // A newer CANT_ACCESS report supersedes an older seeded confirmation.
  const confirmed = reportedReceived || (input.seededConfirmation && !barrier);

  const credited = input.status === "SUCCESS";
  const stagesReached: Record<StageKey, boolean> = {
    APPROVED: input.approved,
    SENT: true,
    CREDITED: credited,
    CONFIRMED: credited && confirmed,
    CLOSED: credited && confirmed,
  };
  const stage = [...STAGES].reverse().find((s) => stagesReached[s.key])?.key ?? "APPROVED";

  const decision = recoveryDecisionForStatus(input.status);
  const claimDaysLeft = input.status === "UNCLAIMED" ? Math.max(0, CLAIM_WINDOW_DAYS - Math.floor(input.ageHours / 24)) : null;
  const credUnconfirmed = credited && !confirmed;
  const nextAction = barrier
    ? {
        safeAction: "RESOLVE_ACCESS_BARRIER",
        plain: `Resident reported: ${ACCESS_REASON_LABEL[barrier]} — a person follows up`,
        needsPerson: true,
        reason: "A recipient-reported access barrier is open. Do not send a second payment.",
      }
    : credUnconfirmed
    ? {
        safeAction: "ASK_RECIPIENT_TO_CONFIRM",
        plain: "Credited by PayPal — ask the resident to confirm receipt",
        needsPerson: true,
        reason: "PayPal SUCCESS means credited to the account. It does not prove the household can access or use the money.",
      }
    : {
        safeAction: decision.safeAction,
        plain: confirmed && credited ? "Closed — credited and confirmed" : PLAIN_ACTION[decision.safeAction] ?? decision.safeAction,
        needsPerson: decision.requiresHumanApproval || false,
        reason: decision.reason,
      };

  /* Evidence rows: the origin-specific ones come from the caller; the resident row is computed here from the reports. */
  const recipientRow: EvidenceRow = {
    key: "recipient",
    title: "Resident confirmation",
    state: confirmed ? "present" : barrier ? "present" : credited ? "missing" : "not_expected",
    provenance: "RECIPIENT_REPORTED",
    ref: latest ? latest.createdAt : undefined,
    detail: reportedReceived
      ? "Resident reported they received it (self-reported)"
      : barrier
      ? `Resident reported a problem: ${ACCESS_REASON_LABEL[barrier]} (self-reported)`
      : input.seededConfirmation
      ? "Confirmation flag in replay data (synthetic)"
      : credited
      ? "Credited by PayPal, but the resident has not confirmed yet"
      : "Not expected until PayPal credits the payment",
  };
  const evidence: EvidenceRow[] = [];
  for (const e of input.evidenceBase) {
    evidence.push(e);
    if (e.key === "ledger") evidence.push(recipientRow);
  }
  if (!evidence.some((e) => e.key === "recipient")) evidence.push(recipientRow);

  const applicable = evidence.filter((e) => e.state !== "not_expected");
  const evidenceCount = { present: applicable.filter((e) => e.state === "present").length, applicable: applicable.length };

  /* Explainable priority — every point has a stated reason; a recommendation, never a decision. */
  const reasons: PriorityReason[] = [];
  const [sp, sl] = STATUS_POINTS[input.status];
  if (sp) reasons.push({ label: sl, points: sp });
  if (claimDaysLeft !== null && claimDaysLeft <= 10) reasons.push({ label: `Only ${claimDaysLeft} days left to claim`, points: 15 });
  else if (claimDaysLeft !== null && claimDaysLeft <= 20) reasons.push({ label: `${claimDaysLeft} days left to claim`, points: 8 });
  if (credUnconfirmed) reasons.push({ label: "Credited but not confirmed by the resident", points: 12 });
  if (barrier) reasons.push({ label: `Resident reported: ${ACCESS_REASON_LABEL[barrier]}`, points: 35 });
  const tierPts = ({ 1: 20, 2: 14, 3: 8, 4: 4 } as Record<number, number>)[input.tier] ?? 0;
  if (tierPts && sp + (credUnconfirmed ? 12 : 0) + (barrier ? 35 : 0) > 0) reasons.push({ label: input.tierLabel, points: tierPts });
  if (input.ageHours > 48 && input.status !== "SUCCESS") reasons.push({ label: `Open for ${Math.round(input.ageHours)} hours`, points: 10 });
  const gaps = evidence.filter((e) => e.state === "missing" && e.key !== "recipient").length;
  if (gaps > 0 && input.status !== "SUCCESS") reasons.push({ label: `${gaps} evidence gap${gaps > 1 ? "s" : ""}`, points: gaps * 5 });
  const score = reasons.reduce((t, r) => t + r.points, 0);

  return {
    caseRef: input.caseRef,
    origin: input.origin,
    itemId: input.itemId,
    batchId: input.batchId,
    obligationId: input.obligationId,
    householdRef: input.householdRef,
    resident: input.resident,
    zone: input.zone,
    tier: input.tier,
    tierLabel: input.tierLabel,
    wallet: input.wallet,
    amountUsd: input.amountUsd,
    status: input.status,
    ageHours: input.ageHours,
    ageBand: input.ageBand,
    claimDaysLeft,
    stagesReached,
    stage,
    evidence,
    evidenceCount,
    nextAction,
    barrier,
    priority: { score, reasons },
    openIssue: !(credited && confirmed),
  };
}
