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
 * Data origin: everything in THIS module is REPLAY (synthetic scenario modelled on the real
 * Hurricane Milton Oct 2024 timeline and PayPal Payouts v1 semantics). Live PayPal Sandbox cases
 * carry origin "SANDBOX_LIVE" and are built from stored provider records in live-cases.server.ts.
 *
 * The staging / evidence / priority logic lives in case-builder.ts, shared by both origins, so a status
 * can never mean two different things. Pure and client-safe: no Node-only imports, no I/O, no AI.
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
} from "@/lib/studio/landfall-studio-data";
import { buildCase, type CaseInput } from "./case-builder";
import { caseRefFor, STAGES, type AccessReport, type EvidenceRow, type ReliefCase, type StageKey } from "./case-types";

export * from "./case-types";
export { buildCase, CLAIM_WINDOW_DAYS } from "./case-builder";
export type { CaseInput } from "./case-builder";

/* ── Build (REPLAY) ────────────────────────────────────────── */

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
    const approved = obligation?.approval_status === "DUAL_APPROVED";
    const wh = webhooksByItem.get(item.item_id) ?? [];
    const batch = batchById.get(item.batch_id);
    const proof = proofByBatch.get(item.batch_id);

    const evidenceBase: EvidenceRow[] = [
      {
        key: "obligation",
        title: "Relief obligation",
        state: obligation ? "present" : "missing",
        provenance: "INTERNAL",
        ref: item.obligation_id,
        detail: obligation ? `${obligation.priority_tier} · $${obligation.grant_usd} approved under ${obligation.policy_version}` : "No obligation record found",
      },
      {
        key: "approval",
        title: "Two-person approval",
        state: approved && approvals.length >= 2 ? "present" : "missing",
        provenance: "INTERNAL",
        ref: approvals[0]?.plan_hash.slice(0, 22),
        detail: approved ? `${approvals.length} of 2 signatures recorded against the plan hash (demo passkeys — signatures not server-verified)` : "Not approved",
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
        key: "proof",
        title: "Recovery proof",
        state: proof ? "present" : "missing",
        provenance: "OPERATOR_ATTESTED",
        ref: proof?.merkle_root.slice(0, 20),
        detail: proof ? `${proof.signers} · ledger ${proof.ledger_balanced.toLowerCase().replace(/_/g, " ")}` : "No recovery proof generated for this batch",
      },
    ];

    const input: CaseInput = {
      origin: "REPLAY",
      caseRef,
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
      seededConfirmation: item.beneficiary_confirmed === "CONFIRMED", // synthetic replay flag
      reports: accessReports.filter((r) => r.caseRef === caseRef),
      evidenceBase,
      approved: !!approved,
    };
    return buildCase(input);
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
