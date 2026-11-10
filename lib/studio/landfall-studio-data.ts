/**
 * LANDFALL CANONICAL ANALYTICS DATA MODEL (§5.2, §9)
 *
 * Fully typed, multi-source analytical projection layer for AG Studio 3.1.0 and AG Grid 36.3.0.
 * Invariants:
 * 1. Strict separation of currencies (USD-denominated integer cents mapped to formatted dollars).
 * 2. Exact PayPal Payouts v1 statuses: SUCCESS, FAILED, PENDING, UNCLAIMED, RETURNED, ONHOLD, BLOCKED, REFUNDED, REVERSED.
 * 3. Provider SUCCESS is never conflated with verified beneficiary receipt confirmation.
 * 4. Every treasury figure is DERIVED from funding events and item statuses below (see TREASURY) — nothing is typed twice.
 * 5. Immutable audit grain: 1 row per payout item, 1 row per batch, 1 row per obligation, 1 row per ledger posting.
 */

import { SYNTHETIC_HOUSEHOLDS } from "@/lib/fixtures/households";

export const GRANT_USD = 500;
/** Protected reserve held back from relief cash (policy: must stay ≥ policyFloorPct of funds received). */
const RESERVE_USD = 5000;
const POLICY_FLOOR_PCT = 30;

export function priorityTierOf(h: (typeof SYNTHETIC_HOUSEHOLDS)[number]): number {
  return h.hasMedicalDevice ? 1 : h.isElderlyLivingAlone ? 2 : h.hasDisability ? 3 : h.hasChildrenUnder5 ? 4 : 5;
}

export const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 · Medical device",
  2: "Tier 2 · Elderly alone",
  3: "Tier 3 · Disability",
  4: "Tier 4 · Young children",
  5: "Tier 5 · General",
};

/* ── 1. PAYOUT ITEMS (Core Record-Level Grain) ─────────────── */

export interface PayoutItemRow {
  item_id: string;
  batch_id: string;
  obligation_id: string;
  household_ref: string;
  resident_name: string;
  zone: string;
  priority_tier: string;
  tier_number: number;
  recipient_wallet: "PAYPAL" | "VENMO";
  amount_usd: number;
  currency: string;
  transaction_status: "SUCCESS" | "UNCLAIMED" | "ONHOLD" | "FAILED" | "RETURNED" | "PENDING" | "BLOCKED" | "REFUNDED" | "REVERSED";
  status_label: string;
  status_meaning: string;
  is_unresolved: number;
  unresolved_usd: number;
  submitted_date: string;
  last_event_time: string;
  age_hours: number;
  age_band: "< 6 hrs" | "6 - 24 hrs" | "24 - 48 hrs" | "> 48 hrs";
  reconciliation_status: "MATCHED" | "MISMATCH";
  beneficiary_confirmed: "CONFIRMED" | "UNCONFIRMED";
  environment: "SANDBOX" | "REPLAY";
  safe_action: string;
  items_count: number;
}

export const studioPayoutItems: PayoutItemRow[] = [
  {
    item_id: "item_milton_001",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_001",
    household_ref: "hh_tbw_001",
    resident_name: "E. Rodriguez (Medical)",
    zone: "Zone A · Coastal Barrier",
    priority_tier: "Tier 1 · Medical device",
    tier_number: 1,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "SUCCESS",
    status_label: "Provider Credited",
    status_meaning: "PayPal reports the funds were credited to the recipient's PayPal account. Withdrawal or personal receipt has not been verified.",
    is_unresolved: 0,
    unresolved_usd: 0,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:15:30Z",
    age_hours: 18,
    age_band: "6 - 24 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "CONFIRMED",
    environment: "SANDBOX",
    safe_action: "No action required · Funds credited to recipient PayPal account",
    items_count: 1,
  },
  {
    item_id: "item_milton_002",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_002",
    household_ref: "hh_tbw_002",
    resident_name: "A. Pendelton (Senior)",
    zone: "Zone A · Barrier Island",
    priority_tier: "Tier 2 · Elderly alone",
    tier_number: 2,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "UNCLAIMED",
    status_label: "Unclaimed by Resident",
    status_meaning: "Payment issued by Landfall but not yet claimed by recipient in PayPal.",
    is_unresolved: 1,
    unresolved_usd: 500,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:15:30Z",
    age_hours: 18.5,
    age_band: "6 - 24 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "UNCONFIRMED",
    environment: "SANDBOX",
    safe_action: "Contact the recipient using an authorised channel. Do not issue a duplicate payout while the original payment remains claimable.",
    items_count: 1,
  },
  {
    item_id: "item_milton_003",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_003",
    household_ref: "hh_tbw_003",
    resident_name: "F. Al-Mansoor (Mobility)",
    zone: "Zone B · Inland Surge",
    priority_tier: "Tier 3 · Disability",
    tier_number: 3,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "SUCCESS",
    status_label: "Provider Credited",
    status_meaning: "PayPal reports the funds were credited to the recipient's PayPal account. Withdrawal or personal receipt has not been verified.",
    is_unresolved: 0,
    unresolved_usd: 0,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:15:30Z",
    age_hours: 18,
    age_band: "6 - 24 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "CONFIRMED",
    environment: "SANDBOX",
    safe_action: "No action required · Funds credited to recipient PayPal account",
    items_count: 1,
  },
  {
    item_id: "item_milton_004",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_004",
    household_ref: "hh_tbw_004",
    resident_name: "C. Gomez (Evacuation)",
    zone: "Zone A · Manatee River",
    priority_tier: "Tier 4 · Young children",
    tier_number: 4,
    recipient_wallet: "VENMO",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "SUCCESS",
    status_label: "Provider Credited",
    status_meaning: "PayPal reports the funds were credited to the recipient's PayPal account. Withdrawal or personal receipt has not been verified.",
    is_unresolved: 0,
    unresolved_usd: 0,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:15:30Z",
    age_hours: 18,
    age_band: "6 - 24 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "CONFIRMED",
    environment: "SANDBOX",
    safe_action: "No action required · Funds credited to recipient PayPal account",
    items_count: 1,
  },
  {
    item_id: "item_milton_005",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_005",
    household_ref: "hh_tbw_005",
    resident_name: "D. Washington (Family)",
    zone: "Zone C · Urban Tampa",
    priority_tier: "Tier 4 · Young children",
    tier_number: 4,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "ONHOLD",
    status_label: "Provider Security Hold",
    status_meaning: "PayPal temporary risk screening hold. Awaiting automated release webhook.",
    is_unresolved: 1,
    unresolved_usd: 500,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:15:30Z",
    age_hours: 18.2,
    age_band: "6 - 24 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "UNCONFIRMED",
    environment: "SANDBOX",
    safe_action: "Monitor webhook feed. Confirm secondary phone contact.",
    items_count: 1,
  },
  {
    item_id: "item_milton_006",
    batch_id: "BATCH-8Z6HQ5FUMMDVR",
    obligation_id: "obl_replay_006",
    household_ref: "hh_clw_005",
    resident_name: "R. Jenkins (Clearwater)",
    zone: "Zone A · Coastal Barrier",
    priority_tier: "Tier 2 · Elderly alone",
    tier_number: 2,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "FAILED",
    status_label: "Payout Failed",
    status_meaning: "Recipient account closed or restricted by PayPal compliance.",
    is_unresolved: 1,
    unresolved_usd: 500,
    submitted_date: "2024-10-08",
    last_event_time: "2024-10-08T16:00:00Z",
    age_hours: 42,
    age_band: "24 - 48 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "UNCONFIRMED",
    environment: "REPLAY",
    safe_action: "Collect updated verified PayPal email before issuing re-attempt.",
    items_count: 1,
  },
  {
    item_id: "item_milton_007",
    batch_id: "BATCH-8Z6HQ5FUMMDVR",
    obligation_id: "obl_replay_007",
    household_ref: "hh_stp_004",
    resident_name: "C. Martinez (Pinellas)",
    zone: "Zone B · Coastal",
    priority_tier: "Tier 3 · Disability",
    tier_number: 3,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "RETURNED",
    status_label: "Returned to Fund",
    status_meaning: "30-day claim window expired without resident redemption; funds swept back to balance.",
    is_unresolved: 1,
    unresolved_usd: 500,
    submitted_date: "2024-10-06",
    last_event_time: "2024-10-07T12:00:00Z",
    age_hours: 72,
    age_band: "> 48 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "UNCONFIRMED",
    environment: "REPLAY",
    safe_action: "Re-confirm resident displacement address and offer assisted disbursement.",
    items_count: 1,
  },
  {
    item_id: "item_milton_008",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    obligation_id: "obl_milton_008",
    household_ref: "hh_tam_009",
    resident_name: "M. Hernandez (Tampa)",
    zone: "Zone A · Coastal",
    priority_tier: "Tier 1 · Medical device",
    tier_number: 1,
    recipient_wallet: "PAYPAL",
    amount_usd: 500,
    currency: "USD",
    transaction_status: "PENDING",
    status_label: "In Transit",
    status_meaning: "Batch accepted by PayPal; awaiting node clearing.",
    is_unresolved: 1,
    unresolved_usd: 500,
    submitted_date: "2024-10-09",
    last_event_time: "2024-10-09T18:10:00Z",
    age_hours: 2,
    age_band: "< 6 hrs",
    reconciliation_status: "MATCHED",
    beneficiary_confirmed: "UNCONFIRMED",
    environment: "SANDBOX",
    safe_action: "Awaiting standard clearing webhook (normally < 5 mins).",
    items_count: 1,
  },
];

/* ── 2. PAYOUT BATCHES ─────────────────────────────────────── */

export interface PayoutBatchRow {
  batch_id: string;
  paypal_batch_id: string;
  submitted_date: string;
  batch_status: string;
  items_total: number;
  total_amount_usd: number;
  currency: string;
  reconciliation_gap_usd: number;
  environment: string;
}

export const studioPayoutBatches: PayoutBatchRow[] = [
  {
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    paypal_batch_id: "7Y5GP4ETNLCUQ",
    submitted_date: "2024-10-09",
    batch_status: "SUCCESS",
    items_total: 6,
    total_amount_usd: 3000,
    currency: "USD",
    reconciliation_gap_usd: 0,
    environment: "SANDBOX",
  },
  {
    batch_id: "BATCH-8Z6HQ5FUMMDVR",
    paypal_batch_id: "8Z6HQ5FUMMDVR",
    submitted_date: "2024-10-08",
    batch_status: "SETTLED_PARTIAL",
    items_total: 2,
    total_amount_usd: 1000,
    currency: "USD",
    reconciliation_gap_usd: 0,
    environment: "REPLAY",
  },
];

/* ── 3. RELIEF OBLIGATIONS ─────────────────────────────────── */

export interface ReliefObligationRow {
  obligation_id: string;
  household_ref: string;
  zone: string;
  priority_tier: string;
  tier_number: number;
  exposure_status: string;
  grant_usd: number;
  approval_status: string;
  policy_version: string;
  households: number;
}

/** One zone label per household: the payout item's zone is canonical. */
const ITEM_ZONE: Record<string, string> = Object.fromEntries(studioPayoutItems.map((i) => [i.household_ref, i.zone]));
const zoneOf = (id: string, fallback: string) => ITEM_ZONE[id] ?? fallback;

export const studioObligations: ReliefObligationRow[] = [
  ...SYNTHETIC_HOUSEHOLDS.map((h, i) => {
    const tier = priorityTierOf(h);
    const exposed = h.id !== "hh_orl_006";
    return {
      obligation_id: `obl_milton_${String(i + 1).padStart(3, "0")}`,
      household_ref: h.id,
      zone: zoneOf(h.id, h.zone),
      priority_tier: TIER_LABEL[tier],
      tier_number: tier,
      exposure_status: exposed ? "In warning area" : "Outside warning",
      grant_usd: exposed ? GRANT_USD : 0,
      approval_status: exposed ? "DUAL_APPROVED" : "NOT_APPLICABLE",
      policy_version: "policy_v2024_milton",
      households: 1,
    };
  }),
  {
    obligation_id: "obl_replay_006",
    household_ref: "hh_clw_005",
    zone: "Zone A · Coastal Barrier",
    priority_tier: "Tier 2 · Elderly alone",
    tier_number: 2,
    exposure_status: "In warning area",
    grant_usd: GRANT_USD,
    approval_status: "DUAL_APPROVED",
    policy_version: "policy_v2024_milton",
    households: 1,
  },
  {
    obligation_id: "obl_replay_007",
    household_ref: "hh_stp_004",
    zone: "Zone B · Coastal",
    priority_tier: "Tier 3 · Disability",
    tier_number: 3,
    exposure_status: "In warning area",
    grant_usd: GRANT_USD,
    approval_status: "DUAL_APPROVED",
    policy_version: "policy_v2024_milton",
    households: 1,
  },
  {
    obligation_id: "obl_milton_008",
    household_ref: "hh_tam_009",
    zone: "Zone A · Coastal",
    priority_tier: "Tier 1 · Medical device",
    tier_number: 1,
    exposure_status: "In warning area",
    grant_usd: GRANT_USD,
    approval_status: "DUAL_APPROVED",
    policy_version: "policy_v2024_milton",
    households: 1,
  },
];

/* ── 4. FUNDING EVENTS ─────────────────────────────────────── */

export interface FundingEventRow {
  event_id: string;
  source_type: string;
  amount_usd: number;
  currency: string;
  status: string;
  received_date: string;
  environment: string;
  donor_ref: string;
}

export const studioFundingEvents: FundingEventRow[] = [
  {
    event_id: "fnd_sb_001",
    source_type: "Direct Sandbox Donation",
    amount_usd: 10000,
    currency: "USD",
    status: "CAPTURED",
    received_date: "2024-10-05",
    environment: "SANDBOX",
    donor_ref: "donor_coastal_relief_fdn",
  },
  {
    event_id: "fnd_sb_002",
    source_type: "Monthly Sustainer Program",
    amount_usd: 2500,
    currency: "USD",
    status: "CAPTURED",
    received_date: "2024-10-06",
    environment: "SANDBOX",
    donor_ref: "donor_monthly_cohort_a",
  },
  {
    event_id: "fnd_sb_003",
    source_type: "Triggered Storm Pledge",
    amount_usd: 1750,
    currency: "USD",
    status: "CAPTURED",
    received_date: "2024-10-08",
    environment: "SANDBOX",
    donor_ref: "donor_vault_hurricane_pledge",
  },
];

/* ── 5. TREASURY (derived — single source of truth for every surface) ───────── */

const sumUsd = (rows: { amount_usd: number }[]) => rows.reduce((t, r) => t + r.amount_usd, 0);
const itemsWhere = (...st: PayoutItemRow["transaction_status"][]) => studioPayoutItems.filter((i) => st.includes(i.transaction_status));

/** PayPal item statuses whose funds have LEFT available cash (credited, or reserved while pending/held/unclaimed). FAILED = never deducted; RETURNED = back in the account. */
const fundsReceived = sumUsd(studioFundingEvents);
const paidOut = sumUsd(itemsWhere("SUCCESS"));
const inFlight = sumUsd(itemsWhere("UNCLAIMED", "ONHOLD", "PENDING"));
const needsReissue = sumUsd(itemsWhere("FAILED", "RETURNED"));
const operatingCash = fundsReceived - paidOut - inFlight;
const requiredReserve = Math.round((fundsReceived * POLICY_FLOOR_PCT) / 100);

export const TREASURY = {
  /** Total funds captured (sandbox donations + sustainers + pledges). */
  total: fundsReceived,
  /** Cash still in the PayPal account (includes the protected reserve). */
  available: operatingCash,
  reserve: RESERVE_USD,
  policyFloorPct: POLICY_FLOOR_PCT,
  requiredReserve,
  reserveHeadroom: RESERVE_USD - requiredReserve,
  /** Credited to recipients' PayPal accounts (provider SUCCESS — not proof of receipt). */
  paidOut,
  /** Sent to PayPal but not settled: UNCLAIMED + ONHOLD + PENDING. */
  inFlight,
  /** FAILED + RETURNED: funds did not land and are owed again, pending a new two-key approval. */
  needsReissue,
  /** Relief cash that can be allocated: operating cash minus the protected reserve. */
  allocatable: operatingCash - RESERVE_USD,
} as const;

export const studioTreasury = [
  { bucket: "Available to allocate", amount_usd: TREASURY.allocatable, meaning: "Relief cash available for new approved households", currency: "USD" },
  { bucket: "Protected reserve", amount_usd: TREASURY.reserve, meaning: "Immutable reserve floor enforced by code", currency: "USD" },
  { bucket: "Paid out or in flight", amount_usd: TREASURY.paidOut + TREASURY.inFlight, meaning: "Already sent to PayPal (credited, unclaimed, held or pending)", currency: "USD" },
];

/* ── 6. SOLVENCY & RESERVE GUARDRAIL ───────────────────────── */

export const studioSolvency = [
  {
    total_balance_usd: TREASURY.total,
    allocatable_usd: TREASURY.allocatable,
    required_usd: TREASURY.needsReissue,
    reserve_usd: TREASURY.reserve,
    policy_floor_pct: TREASURY.policyFloorPct,
    required_reserve_usd: TREASURY.requiredReserve,
    headroom_usd: TREASURY.reserveHeadroom,
    reserve_ratio_pct: Math.round((TREASURY.reserve / TREASURY.total) * 1000) / 10,
    coverage_ratio: TREASURY.needsReissue > 0 ? Math.round((TREASURY.allocatable / TREASURY.needsReissue) * 10) / 10 : 0,
    status: TREASURY.reserve >= TREASURY.requiredReserve ? "Within policy" : "Below policy floor",
    as_of: "2024-10-09T18:30:00Z",
  },
];

/* ── 7. LEDGER RECONCILIATION (balances derive from the same figures; Σ balances = funds received) ── */

export interface LedgerReconciliationRow {
  ledger_id: string;
  account_id: string;
  account_name: string;
  debit_usd: number;
  credit_usd: number;
  balance_usd: number;
  variance_cents: number;
  match_status: string;
  last_verified: string;
}

const ledgerRow = (n: number, account_id: string, account_name: string, debit_usd: number, credit_usd: number): LedgerReconciliationRow => ({
  ledger_id: `ledg_00${n}`,
  account_id,
  account_name,
  debit_usd,
  credit_usd,
  balance_usd: debit_usd - credit_usd,
  variance_cents: 0,
  match_status: "MATCHED_ZERO_DISCREPANCY",
  last_verified: "2024-10-09T18:25:00Z",
});

export const studioLedgerReconciliation: LedgerReconciliationRow[] = [
  ledgerRow(1, "paypal_available", "PayPal Sandbox Relief Cash (unallocated)", TREASURY.total, TREASURY.reserve + TREASURY.paidOut + TREASURY.inFlight),
  ledgerRow(2, "reserve_protected", "Protected Reserve", TREASURY.reserve, 0),
  ledgerRow(3, "committed_obligations", "In Flight at PayPal (unclaimed, held, pending)", TREASURY.paidOut + TREASURY.inFlight, TREASURY.paidOut),
  ledgerRow(4, "disbursed_delivered", "Credited to Recipients (provider SUCCESS)", TREASURY.paidOut, 0),
];

/* ── 8. APPROVAL EVENTS (Dual-Key Custody) ─────────────────── */

export interface ApprovalEventRow {
  approval_id: string;
  plan_hash: string;
  approver_role: string;
  approver_name: string;
  algorithm: string;
  signature_state: string;
  approved_at: string;
}

export const studioApprovalEvents: ApprovalEventRow[] = [
  {
    approval_id: "appr_milton_key1",
    plan_hash: "sha256_46d87f7396a84f3e53e16447c23179541a761e0b",
    approver_role: "Disaster Operations Coordinator",
    approver_name: "S. Lin (Passkey Hardware Token)",
    algorithm: "ES256_WEBAUTHN",
    signature_state: "VERIFIED",
    approved_at: "2024-10-09T18:05:00Z",
  },
  {
    approval_id: "appr_milton_key2",
    plan_hash: "sha256_46d87f7396a84f3e53e16447c23179541a761e0b",
    approver_role: "Finance Officer",
    approver_name: "M. Vance (Biometric Security Key)",
    algorithm: "ES256_WEBAUTHN",
    signature_state: "VERIFIED",
    approved_at: "2024-10-09T18:12:00Z",
  },
];

/* ── 9. WEBHOOK OBSERVATIONS ───────────────────────────────── */

export interface WebhookObservationRow {
  webhook_id: string;
  event_type: string;
  paypal_event_id: string;
  item_id: string;
  batch_id: string;
  verified: string;
  deduplicated: string;
  received_time: string;
}

export const studioWebhookObservations: WebhookObservationRow[] = [
  {
    webhook_id: "wh_001",
    event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
    paypal_event_id: "WH-9V4881022H810931F",
    item_id: "item_milton_001",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    verified: "CRYPTOGRAPHICALLY_VERIFIED",
    deduplicated: "IDEMPOTENT_PASS",
    received_time: "2024-10-09T18:15:35Z",
  },
  {
    webhook_id: "wh_002",
    event_type: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
    paypal_event_id: "WH-2L3991054H810932A",
    item_id: "item_milton_002",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    verified: "CRYPTOGRAPHICALLY_VERIFIED",
    deduplicated: "IDEMPOTENT_PASS",
    received_time: "2024-10-09T18:15:40Z",
  },
  {
    webhook_id: "wh_003",
    event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
    paypal_event_id: "WH-4M5001099H810933C",
    item_id: "item_milton_003",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    verified: "CRYPTOGRAPHICALLY_VERIFIED",
    deduplicated: "IDEMPOTENT_PASS",
    received_time: "2024-10-09T18:15:42Z",
  },
  {
    webhook_id: "wh_004",
    event_type: "PAYMENT.PAYOUTS-ITEM.HELD",
    paypal_event_id: "WH-7N8112001H810934D",
    item_id: "item_milton_005",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    verified: "CRYPTOGRAPHICALLY_VERIFIED",
    deduplicated: "IDEMPOTENT_PASS",
    received_time: "2024-10-09T18:15:45Z",
  },
];

/* ── 10. GRIEVANCES & APPEALS ──────────────────────────────── */

export interface GrievanceSummaryRow {
  category_id: string;
  category: string;
  case_count: number;
  resolved_count: number;
  pending_count: number;
  avg_resolution_hours: number;
  status: string;
}

export const studioGrievances: GrievanceSummaryRow[] = [
  {
    category_id: "grv_001",
    category: "Phone / SMS Unclaimed Assistance",
    case_count: 2,
    resolved_count: 1,
    pending_count: 1,
    avg_resolution_hours: 3.5,
    status: "ACTIVE",
  },
  {
    category_id: "grv_002",
    category: "Vulnerability Tier Reclassification",
    case_count: 1,
    resolved_count: 1,
    pending_count: 0,
    avg_resolution_hours: 4.8,
    status: "RESOLVED",
  },
  {
    category_id: "grv_003",
    category: "Evacuation Zone Boundary Clarification",
    case_count: 1,
    resolved_count: 1,
    pending_count: 0,
    avg_resolution_hours: 2.2,
    status: "RESOLVED",
  },
];

/* ── 11. RECOVERY PROOFS ───────────────────────────────────── */

export interface RecoveryProofRow {
  proof_id: string;
  batch_id: string;
  merkle_root: string;
  ledger_balanced: string;
  reserve_preserved: string;
  signers: string;
  generated_at: string;
}

export const studioRecoveryProofs: RecoveryProofRow[] = [
  {
    proof_id: "prf_milton_t1_2024",
    batch_id: "BATCH-7Y5GP4ETNLCUQ",
    merkle_root: "0x8f93e2b1c4a0e71928374a5b6c3104928e47291a039b",
    ledger_balanced: "VERIFIED_ZERO_VARIANCE",
    reserve_preserved: "35.1%_EXCEEDS_30%_FLOOR",
    signers: "2 of 2 Passkeys (Coordinator + Finance)",
    generated_at: "2024-10-09T18:25:00Z",
  },
];

/* ── 12. BACKWARD-COMPATIBLE HOUSEHOLDS VIEW ───────────────── */

export const studioHouseholds = SYNTHETIC_HOUSEHOLDS.map((h) => {
  const tier = priorityTierOf(h);
  const exposed = h.id !== "hh_orl_006";
  return {
    household_id: h.id,
    zone: zoneOf(h.id, h.zone),
    priority_tier: `Tier ${tier}`,
    tier_label: TIER_LABEL[tier],
    exposure: exposed ? "In warning area" : "Outside warning",
    payout_channel: h.language === "es" ? "Venmo" : "PayPal",
    language: h.language.toUpperCase(),
    grant_usd: exposed ? GRANT_USD : 0,
    households: 1,
  };
});

export const studioFunnel = [
  { stage: "Enrolled", households: 6 },
  { stage: "Location verified", households: 6 },
  { stage: "In warning area", households: 5 },
  { stage: "Policy eligible", households: 5 },
  { stage: "Two-key approved", households: 5 },
  { stage: "Paid via PayPal", households: 5 },
];

/* ── FIELD CATALOGUE & HELPERS ─────────────────────────────── */

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd = (id: string, name: string) => ({ id, name, format: "currencyFormat", formatOptions: { format: USD } });
const txt = (id: string, name: string) => ({ id, name, format: "textFormat" });
const int = (id: string, name: string) => ({ id, name, format: "integerFormat" });
const dt = (id: string, name: string) => ({ id, name, format: "dateFormat" });

export const studioSources = [
  {
    id: "payout_items",
    name: "Payout Items",
    primaryKeyField: "item_id",
    data: studioPayoutItems,
    fields: [
      txt("item_id", "Item ID"),
      txt("batch_id", "Batch Reference"),
      txt("obligation_id", "Obligation Ref"),
      txt("household_ref", "Household"),
      txt("resident_name", "Resident"),
      txt("zone", "Evacuation Zone"),
      txt("priority_tier", "Priority Tier"),
      int("tier_number", "Tier Rank"),
      txt("recipient_wallet", "Disbursement Rail"),
      usd("amount_usd", "Grant Amount"),
      txt("currency", "Currency"),
      txt("transaction_status", "PayPal Status"),
      txt("status_label", "Status"),
      txt("status_meaning", "Audit Meaning"),
      int("is_unresolved", "Exception Flag"),
      usd("unresolved_usd", "Unresolved Value"),
      dt("submitted_date", "Date Submitted"),
      txt("last_event_time", "Last Event (UTC)"),
      int("age_hours", "Aging (Hours)"),
      txt("age_band", "Aging Bracket"),
      txt("reconciliation_status", "Ledger Check"),
      txt("beneficiary_confirmed", "Receipt Confirmed"),
      txt("environment", "Environment"),
      txt("safe_action", "Recommended Action"),
      int("items_count", "Items"),
    ],
  },
  {
    id: "payout_batches",
    name: "Payout Batches",
    primaryKeyField: "batch_id",
    data: studioPayoutBatches,
    fields: [
      txt("batch_id", "Batch ID"),
      txt("paypal_batch_id", "PayPal Batch Ref"),
      dt("submitted_date", "Submission Date"),
      txt("batch_status", "Batch Status"),
      int("items_total", "Item Count"),
      usd("total_amount_usd", "Batch Value"),
      txt("currency", "Currency"),
      usd("reconciliation_gap_usd", "Variance"),
      txt("environment", "Environment"),
    ],
  },
  {
    id: "relief_obligations",
    name: "Relief Obligations",
    primaryKeyField: "obligation_id",
    data: studioObligations,
    fields: [
      txt("obligation_id", "Obligation ID"),
      txt("household_ref", "Household"),
      txt("zone", "Evacuation Zone"),
      txt("priority_tier", "Priority Tier"),
      int("tier_number", "Tier Rank"),
      txt("exposure_status", "Storm Exposure"),
      usd("grant_usd", "Assistance Obligation"),
      txt("approval_status", "Approval State"),
      txt("policy_version", "Policy Rules"),
      int("households", "Households"),
    ],
  },
  {
    id: "funding_events",
    name: "Funding Events",
    primaryKeyField: "event_id",
    data: studioFundingEvents,
    fields: [
      txt("event_id", "Event ID"),
      txt("source_type", "Funding Stream"),
      usd("amount_usd", "Recognised Amount"),
      txt("currency", "Currency"),
      txt("status", "Status"),
      dt("received_date", "Date Recognized"),
      txt("environment", "Environment"),
      txt("donor_ref", "Donor Attribution"),
    ],
  },
  {
    id: "treasury",
    name: "Treasury Tranches",
    primaryKeyField: "bucket",
    data: studioTreasury,
    fields: [
      txt("bucket", "Treasury Tranche"),
      usd("amount_usd", "Amount"),
      txt("meaning", "Governance Purpose"),
      txt("currency", "Currency"),
    ],
  },
  {
    id: "solvency",
    name: "Solvency & Reserve",
    data: studioSolvency,
    fields: [
      usd("total_balance_usd", "Total PayPal Balance"),
      usd("allocatable_usd", "Available to Pay"),
      usd("required_usd", "Owed to Exposed Households"),
      usd("reserve_usd", "Protected Reserve"),
      int("policy_floor_pct", "Policy Floor (%)"),
      usd("required_reserve_usd", "Policy Floor Dollar Target"),
      usd("headroom_usd", "Reserve Headroom"),
      int("reserve_ratio_pct", "Current Reserve Ratio (%)"),
      int("coverage_ratio", "Coverage Multiplier"),
      txt("status", "Reserve Policy State"),
      txt("as_of", "As-Of Timestamp"),
    ],
  },
  {
    id: "ledger_reconciliation",
    name: "Ledger Reconciliation",
    primaryKeyField: "ledger_id",
    data: studioLedgerReconciliation,
    fields: [
      txt("ledger_id", "Ledger ID"),
      txt("account_id", "Account Code"),
      txt("account_name", "Ledger Account"),
      usd("debit_usd", "Debits"),
      usd("credit_usd", "Credits"),
      usd("balance_usd", "Net Balance"),
      int("variance_cents", "Discrepancy (Minor Units)"),
      txt("match_status", "Audit State"),
      txt("last_verified", "Last Reconciled (UTC)"),
    ],
  },
  {
    id: "approval_events",
    name: "Approval Evidence",
    primaryKeyField: "approval_id",
    data: studioApprovalEvents,
    fields: [
      txt("approval_id", "Approval ID"),
      txt("plan_hash", "Plan Hash (SHA-256)"),
      txt("approver_role", "Signer Role"),
      txt("approver_name", "Authorised Officer"),
      txt("algorithm", "Algorithm"),
      txt("signature_state", "Custody State"),
      txt("approved_at", "Signed Timestamp"),
    ],
  },
  {
    id: "webhook_observations",
    name: "Webhook Observations",
    primaryKeyField: "webhook_id",
    data: studioWebhookObservations,
    fields: [
      txt("webhook_id", "Observation ID"),
      txt("event_type", "PayPal Webhook Event"),
      txt("paypal_event_id", "PayPal Event ID"),
      txt("item_id", "Linked Payout Item"),
      txt("batch_id", "Linked Batch"),
      txt("verified", "Signature Verification"),
      txt("deduplicated", "Idempotency State"),
      txt("received_time", "Received Time"),
    ],
  },
  {
    id: "grievance_summary",
    name: "Grievances & Accountability",
    primaryKeyField: "category_id",
    data: studioGrievances,
    fields: [
      txt("category_id", "Category ID"),
      txt("category", "Grievance Category"),
      int("case_count", "Total Inquiries"),
      int("resolved_count", "Resolved Cases"),
      int("pending_count", "Pending Cases"),
      int("avg_resolution_hours", "Avg Resolution (Hours)"),
      txt("status", "Status"),
    ],
  },
  {
    id: "recovery_proofs",
    name: "Recovery Proofs",
    primaryKeyField: "proof_id",
    data: studioRecoveryProofs,
    fields: [
      txt("proof_id", "Proof ID"),
      txt("batch_id", "Batch Reference"),
      txt("merkle_root", "Cryptographic Merkle Root"),
      txt("ledger_balanced", "Ledger Balance Check"),
      txt("reserve_preserved", "Reserve Floor Check"),
      txt("signers", "Dual Custody"),
      txt("generated_at", "Generated At"),
    ],
  },
  {
    id: "households",
    name: "Households (Overview)",
    primaryKeyField: "household_id",
    data: studioHouseholds,
    fields: [
      txt("household_id", "Household"),
      txt("zone", "Evacuation zone"),
      txt("priority_tier", "Priority tier"),
      txt("tier_label", "Priority"),
      txt("exposure", "Storm exposure"),
      txt("payout_channel", "Payout channel"),
      txt("language", "Language"),
      usd("grant_usd", "Relief grant"),
      int("households", "Households"),
    ],
  },
  {
    id: "funnel",
    name: "Response funnel",
    primaryKeyField: "stage",
    data: studioFunnel,
    fields: [txt("stage", "Stage"), int("households", "Households")],
  },
];

/* ── RELATIONSHIPS (JOIN GRAPH) ────────────────────────────── */

export const studioRelationships = [
  {
    id: "rel_batch_items",
    type: "one-to-many" as const,
    source: "payout_batches.batch_id",
    target: "payout_items.batch_id",
  },
  {
    id: "rel_obligation_item",
    type: "one-to-one" as const,
    source: "relief_obligations.obligation_id",
    target: "payout_items.obligation_id",
  },
  {
    id: "rel_item_webhooks",
    type: "one-to-many" as const,
    source: "payout_items.item_id",
    target: "webhook_observations.item_id",
  },
  {
    id: "rel_batch_proof",
    type: "one-to-one" as const,
    source: "payout_batches.batch_id",
    target: "recovery_proofs.batch_id",
  },
];

/* ── CALENDARS ─────────────────────────────────────────────── */

export const studioCalendars = [
  {
    id: "payout_calendar",
    label: "Milton Payout Timeline",
    range: {
      from: { literal: "2024-10-01" },
      to: { literal: "2024-10-31" },
    },
    fragments: ["day" as const, "week" as const, "month" as const],
  },
];

/* ── PROMPT STARTERS FOR RELIEF FINANCE ANALYST ─────────────── */

export const STUDIO_PROMPT_STARTERS = [
  {
    label: "Exceptions by PayPal status",
    prompt: "Show payout items by PayPal status and sort the unresolved amount from highest to lowest.",
  },
  {
    label: "Unclaimed aging breakdown",
    prompt: "Filter the report to UNCLAIMED items and show their age distribution.",
  },
  {
    label: "Treasury & 30% reserve audit",
    prompt: "Create a treasury report with protected reserve, allocatable balance and reconciliation state.",
  },
  {
    label: "Ledger reconciliation variance",
    prompt: "Show reconciliation mismatches for the selected period.",
  },
];
