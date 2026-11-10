/**
 * RELIEF DELIVERY CASES — the single source of truth for "where is each household's relief?"
 *
 * One case = one approved obligation followed through to a real-world outcome. A case is
 * built by JOINING existing records (obligation → payout item → webhook observation →
 * ledger → recipient reports → recovery proof); it is not a new parallel store.
 *
 * Core idea (Relief Delivery Assurance): these are DIFFERENT facts and are never collapsed:
 *   1 APPROVED   — an obligation exists and two people approved the plan      (internal)
 *   2 SENT       — the item is in a PayPal Payouts batch                       (internal)
 *   3 CREDITED   — PayPal item status SUCCESS = "credited to the recipient's
 *                  account" — NOT proof the household can use the money        (provider)
 *   4 CONFIRMED  — the household itself says they received/can use it          (recipient-reported)
 *   5 CLOSED     — credited AND confirmed, no open issue                       (derived)
 * Recipient-reported evidence is always labelled as such and never upgraded to provider-verified.
 * Missing evidence is shown as Missing, never fabricated.
 *
 * Data origin: everything in this module is REPLAY (synthetic scenario modelled on the real
 * Hurricane Milton Oct 2024 timeline and PayPal Payouts v1 semantics). Live sandbox cases, when
 * present, carry origin "SANDBOX_LIVE" and join the same list.
 *
 * Pure and client-safe: no Node-only imports, no I/O, no AI.
 */

import {
  studioPayoutItems,
  studioPayoutBatches,
  studioObligations,
  studioWebhookObservations,
  studioApprovalEvents,
  studioLedgerReconciliation,
  studioRecoveryProofs,
  TREASURY,
  type PayoutItemRow,
} from "@/lib/studio/landfall-studio-data";
import { recoveryDecisionForStatus } from "@/lib/recovery/decision";

/* ── Types ─────────────────────────────────────────────────── */

export type Provenance = "PROVIDER" | "INTERNAL" | "RECIPIENT_REPORTED" | "OPERATOR_ATTESTED";
export type DataOrigin = "REPLAY" | "SANDBOX_LIVE";
export type PayPalItemStatus = PayoutItemRow["transaction_status"];

export const STAGES = [
  { key: "APPROVED", label: "Approved", provenance: "INTERNAL" as Provenance, help: "Obligation approved by two people" },
  { key: "SENT", label: "Sent to PayPal", provenance: "INTERNAL" as Provenance, help: "Item is in a PayPal Payouts batch" },
  { key: "CREDITED", label: "Credited by PayPal", provenance: "PROVIDER" as Provenance, help: "PayPal says SUCCESS — credited to the account, not proof of access" },
  { key: "CONFIRMED", label: "Resident confirmed", provenance: "RECIPIENT_REPORTED" as Provenance, help: "The household says they have the money" },
  { key: "CLOSED", label: "Closed", provenance: "OPERATOR_ATTESTED" as Provenance, help: "Credited, confirmed, nothing open" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

/** A report a household (or its caseworker) submits through the resident portal. */
export interface AccessReport {
  caseRef: string;
  kind: "RECEIVED" | "CANT_ACCESS";
  reason?: "NO_PAYPAL_ACCOUNT" | "CANT_SIGN_IN" | "NO_PHONE" | "LANGUAGE" | "OTHER";
  createdAt: string;
}

export const ACCESS_REASON_LABEL: Record<NonNullable<AccessReport["reason"]>, string> = {
  NO_PAYPAL_ACCOUNT: "No PayPal account",
  CANT_SIGN_IN: "Can’t sign in",
  NO_PHONE: "No phone access",
  LANGUAGE: "Needs help in my language",
  OTHER: "Another problem",
};

export interface EvidenceRow {
  key: string;
  title: string;
  state: "present" | "missing" | "not_expected";
  provenance: Provenance;
  ref?: string;
  detail: string;
}

export interface PriorityReason {
  label: string;
  points: number;
}

export interface ReliefCase {
  caseRef: string;
  origin: DataOrigin;
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
  ageBand: PayoutItemRow["age_band"];
  /** Days left in PayPal's 30-day claim window (UNCLAIMED only). */
  claimDaysLeft: number | null;
  stagesReached: Record<StageKey, boolean>;
  /** Furthest stage reached. */
  stage: StageKey;
  evidence: EvidenceRow[];
  evidenceCount: { present: number; applicable: number };
  nextAction: { safeAction: string; plain: string; needsPerson: boolean; reason: string };
  barrier?: NonNullable<AccessReport["reason"]>;
  priority: { score: number; reasons: PriorityReason[] };
  openIssue: boolean;
}

/* ── Helpers ───────────────────────────────────────────────── */

const ACTIVATION = "milton-2024";
export const caseRefFor = (householdRef: string, tranche = 1) => `${ACTIVATION}:t${tranche}:${householdRef}`;

const CLAIM_WINDOW_DAYS = 30;

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

/* ── Build ─────────────────────────────────────────────────── */

export function buildReliefCases(accessReports: AccessReport[] = []): ReliefCase[] {
  const obligationById = new Map(studioObligations.map((o) => [o.obligation_id, o]));
  const webhooksByItem = new Map<string, (typeof studioWebhookObservations)[number][]>();
  for (const w of studioWebhookObservations) webhooksByItem.set(w.item_id, [...(webhooksByItem.get(w.item_id) ?? []), w]);
  const batchById = new Map(studioPayoutBatches.map((b) => [b.batch_id, b]));
  const proofByBatch = new Map(studioRecoveryProofs.map((p) => [p.batch_id, p]));
  const ledgerBalanced = studioLedgerReconciliation.every((l) => l.variance_cents === 0);
  const approvals = studioApprovalEvents;

  return studioPayoutItems.map((item) => {
    const obligation = obligationById.get(item.obligation_id);
    const caseRef = caseRefFor(item.household_ref);
    const reports = accessReports.filter((r) => r.caseRef === caseRef).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = reports[reports.length - 1];

    const seededConfirmation = item.beneficiary_confirmed === "CONFIRMED"; // synthetic replay flag
    const reportedReceived = latest?.kind === "RECEIVED";
    const barrier = latest?.kind === "CANT_ACCESS" ? latest.reason ?? "OTHER" : undefined;
    // A newer CANT_ACCESS report supersedes an older seeded confirmation.
    const confirmed = reportedReceived || (seededConfirmation && !barrier);

    const approved = obligation?.approval_status === "DUAL_APPROVED";
    const credited = item.transaction_status === "SUCCESS";
    const stagesReached: Record<StageKey, boolean> = {
      APPROVED: !!approved,
      SENT: true,
      CREDITED: credited,
      CONFIRMED: credited && confirmed,
      CLOSED: credited && confirmed,
    };
    const stage = [...STAGES].reverse().find((s) => stagesReached[s.key])?.key ?? "APPROVED";

    const decision = recoveryDecisionForStatus(item.transaction_status);
    const claimDaysLeft =
      item.transaction_status === "UNCLAIMED" ? Math.max(0, CLAIM_WINDOW_DAYS - Math.floor(item.age_hours / 24)) : null;
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

    /* Evidence — present, missing, or genuinely not expected; never fabricated. */
    const wh = webhooksByItem.get(item.item_id) ?? [];
    const batch = batchById.get(item.batch_id);
    const proof = proofByBatch.get(item.batch_id);
    const evidence: EvidenceRow[] = [
      {
        key: "obligation",
        title: "Relief obligation",
        state: obligation ? "present" : "missing",
        provenance: "INTERNAL",
        ref: item.obligation_id,
        detail: obligation
          ? `${obligation.priority_tier} · $${obligation.grant_usd} approved under ${obligation.policy_version}`
          : "No obligation record found",
      },
      {
        key: "approval",
        title: "Two-person approval",
        state: approved && approvals.length >= 2 ? "present" : "missing",
        provenance: "INTERNAL",
        ref: approvals[0]?.plan_hash.slice(0, 22),
        detail: approved
          ? `${approvals.length} of 2 signatures recorded against the plan hash (demo passkeys — signatures not server-verified)`
          : "Not approved",
      },
      {
        key: "payout",
        title: "PayPal batch & item",
        state: "present",
        provenance: "PROVIDER",
        ref: `${item.batch_id} · ${item.item_id}`,
        detail: `${item.recipient_wallet} · $${item.amount_usd}.00 · status ${item.transaction_status}${batch ? ` · batch ${batch.batch_status}` : ""} (replay data)`,
      },
      {
        key: "webhook",
        title: "Provider webhook",
        state: wh.length > 0 ? "present" : item.transaction_status === "PENDING" ? "not_expected" : "missing",
        provenance: "PROVIDER",
        ref: wh[0]?.paypal_event_id,
        detail:
          wh.length > 0
            ? `${wh[0].event_type} · replay observation`
            : item.transaction_status === "PENDING"
            ? "PayPal sends no item webhook for PENDING — poll the item instead"
            : "No webhook observation recorded for this item",
      },
      {
        key: "ledger",
        title: "Ledger reconciliation",
        state: ledgerBalanced ? "present" : "missing",
        provenance: "INTERNAL",
        ref: batch ? item.batch_id : undefined,
        detail: ledgerBalanced ? "Ledger balances; 0¢ variance across all accounts" : "Ledger variance detected — investigate",
      },
      {
        key: "recipient",
        title: "Resident confirmation",
        state: confirmed ? "present" : barrier ? "present" : credited ? "missing" : "not_expected",
        provenance: "RECIPIENT_REPORTED",
        ref: latest ? latest.createdAt : undefined,
        detail: reportedReceived
          ? "Resident reported they received it (self-reported)"
          : barrier
          ? `Resident reported a problem: ${ACCESS_REASON_LABEL[barrier]} (self-reported)`
          : seededConfirmation
          ? "Confirmation flag in replay data (synthetic)"
          : credited
          ? "Credited by PayPal, but the resident has not confirmed yet"
          : "Not expected until PayPal credits the payment",
      },
      {
        key: "proof",
        title: "Recovery proof",
        state: proof ? "present" : "missing",
        provenance: "OPERATOR_ATTESTED",
        ref: proof?.merkle_root.slice(0, 20),
        detail: proof ? `${proof.signers} · ledger ${proof.ledger_balanced.toLowerCase().replace(/_/g, " ")}` : "No recovery proof generated for this batch",
      },
    ];
    const applicable = evidence.filter((e) => e.state !== "not_expected");
    const evidenceCount = { present: applicable.filter((e) => e.state === "present").length, applicable: applicable.length };

    /* Explainable priority — every point has a stated reason; a recommendation, never a decision. */
    const reasons: PriorityReason[] = [];
    const [sp, sl] = STATUS_POINTS[item.transaction_status];
    if (sp) reasons.push({ label: sl, points: sp });
    if (claimDaysLeft !== null && claimDaysLeft <= 10) reasons.push({ label: `Only ${claimDaysLeft} days left to claim`, points: 15 });
    else if (claimDaysLeft !== null && claimDaysLeft <= 20) reasons.push({ label: `${claimDaysLeft} days left to claim`, points: 8 });
    if (credUnconfirmed) reasons.push({ label: "Credited but not confirmed by the resident", points: 12 });
    if (barrier) reasons.push({ label: `Resident reported: ${ACCESS_REASON_LABEL[barrier]}`, points: 35 });
    const tierPts = { 1: 20, 2: 14, 3: 8, 4: 4 }[item.tier_number as 1 | 2 | 3 | 4] ?? 0;
    if (tierPts && sp + (credUnconfirmed ? 12 : 0) + (barrier ? 35 : 0) > 0) reasons.push({ label: item.priority_tier, points: tierPts });
    if (item.age_hours > 48 && item.transaction_status !== "SUCCESS") reasons.push({ label: `Open for ${Math.round(item.age_hours)} hours`, points: 10 });
    const gaps = evidence.filter((e) => e.state === "missing" && e.key !== "recipient").length;
    if (gaps > 0 && item.transaction_status !== "SUCCESS") reasons.push({ label: `${gaps} evidence gap${gaps > 1 ? "s" : ""}`, points: gaps * 5 });
    const score = reasons.reduce((t, r) => t + r.points, 0);

    return {
      caseRef,
      origin: "REPLAY" as DataOrigin,
      itemId: item.item_id,
      batchId: item.batch_id,
      obligationId: item.obligation_id,
      householdRef: item.household_ref,
      resident: item.resident_name,
      zone: item.zone,
      tier: item.tier_number,
      tierLabel: item.priority_tier,
      wallet: item.recipient_wallet,
      amountUsd: item.amount_usd,
      status: item.transaction_status,
      ageHours: item.age_hours,
      ageBand: item.age_band,
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
  });
}

/** The default case list (no resident reports applied). */
export const RELIEF_CASES: ReliefCase[] = buildReliefCases();

/* ── Aggregates every surface reads (so numbers can never disagree) ─────────── */

export function summarizeCases(cases: ReliefCase[] = RELIEF_CASES) {
  const sum = (rows: ReliefCase[]) => rows.reduce((t, c) => t + c.amountUsd, 0);
  const reached = (k: StageKey) => cases.filter((c) => c.stagesReached[k]);
  const credited = reached("CREDITED");
  const confirmed = reached("CONFIRMED");
  const needPerson = cases.filter((c) => c.nextAction.needsPerson && c.openIssue);
  const stageCounts = STAGES.map((s) => ({ ...s, count: reached(s.key).length, valueUsd: sum(reached(s.key)) }));
  return {
    households: cases.length,
    approvedUsd: sum(cases),
    creditedCount: credited.length,
    creditedUsd: sum(credited),
    confirmedCount: confirmed.length,
    /** Credited by PayPal but not (yet) confirmed by the household: the gap this product exists to close. */
    creditedUnconfirmedCount: credited.length - confirmed.length,
    needPersonCount: needPerson.length,
    needPersonUsd: sum(needPerson),
    pendingCount: cases.filter((c) => c.status === "PENDING").length,
    unresolvedCount: cases.filter((c) => c.status !== "SUCCESS").length,
    unresolvedUsd: sum(cases.filter((c) => c.status !== "SUCCESS")),
    stageCounts,
    treasury: TREASURY,
  };
}

export const CASE_SUMMARY = summarizeCases();

/** Cases ranked for human attention, each with its stated reasons. */
export function attentionQueue(cases: ReliefCase[] = RELIEF_CASES, limit = 5): ReliefCase[] {
  return [...cases]
    .filter((c) => c.priority.score > 0 && c.openIssue)
    .sort((a, b) => b.priority.score - a.priority.score)
    .slice(0, limit);
}
