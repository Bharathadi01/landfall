/**
 * Relief case TYPES and CONSTANTS (pure, client-safe). Shared by the replay builder and the live Sandbox adapter
 * so both produce exactly the same ReliefCase shape. See lib/relief/cases.ts for the model's rationale.
 */
import type { PayoutItemRow } from "@/lib/studio/landfall-studio-data";

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
  /** "voice" reports keep the resident's own words (transcript) and an English translation for the coordinator. */
  channel?: "web" | "voice";
  language?: string;
  transcript?: string;
  translation?: string;
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

export const ACTIVATION = "milton-2024";
export const caseRefFor = (householdRef: string, tranche = 1) => `${ACTIVATION}:t${tranche}:${householdRef}`;

