/**
 * WATCH OFFICER DOMAIN TYPES (§4, §5, §6, M6)
 * Strict TypeScript types for server-side tool execution, evidence items, and structured outputs.
 */

import { z } from "zod";
import type { FinancialReadinessState } from "@/lib/treasury/readiness";

export type Role = "coordinator" | "finance" | "admin" | "auditor";

export interface EvidenceItem {
  id: string; // e.g. "ev_sentinel_001", "ev_treasury_002"
  source: "SENTINEL" | "TREASURY" | "POLICY" | "PAYOUTS" | "RECONCILIATION" | "RECIPIENTS";
  timestamp: string; // ISO timestamp
  status: "VERIFIED" | "STALE" | "PENDING" | "UNAVAILABLE";
  summary: string;
  verifiedData: Record<string, unknown>;
}

export interface WatchOfficerContext {
  fundId: string;
  fundName: string;
  actorId: string;
  actorRole: Role;
  query?: string;
  alertId?: string;
  scenarioId?: string;
}

export interface DisasterContextToolResult {
  hasActiveDisaster: boolean;
  alertId?: string;
  nwsId?: string;
  eventKey?: string;
  event: string;
  headline?: string;
  severity: string;
  urgency?: string;
  certainty?: string;
  mode: "LIVE" | "HISTORICAL_REPLAY" | "SYNTHETIC";
  isTranche1Eligible: boolean;
  areaDesc?: string;
  effective?: string;
  expires?: string;
  isStale: boolean;
  lastSyncedAt?: string;
  evidenceId: string;
}

export interface ExposureSummaryToolResult {
  totalHouseholds: number;
  confirmedExposureCount: number;
  outOfAreaCount: number;
  needsReviewCount: number;
  displacedHouseholdCount: number;
  priorityDistribution: {
    tier1MedicalCount: number;
    tier2ElderlyAloneCount: number;
    tier3DisabilityCount: number;
    tier4NoVehicleCount: number;
    tier5ChildrenCount: number;
    tier6GeneralCount: number;
  };
  evidenceId: string;
}

export interface TreasurySnapshotToolResult {
  currency: string;
  paypalAvailableFormatted: string;
  paypalAvailableCents: number;
  reserveProtectedFormatted: string;
  reserveProtectedCents: number;
  committedFormatted: string;
  committedCents: number;
  allocatableFormatted: string;
  allocatableCents: number;
  contingentPledgesFormatted: string;
  contingentPledgesCents: number;
  activePledgesCount: number;
  confirmedDonationsFormatted: string;
  confirmedDonationsCount: number;
  lastPaymentAt?: string;
  isStale: boolean;
  lastSyncedAt?: string;
  evidenceId: string;
}

export interface PolicyEvaluationToolResult {
  policyVersion: string;
  tranche1PayoutPerHouseholdFormatted: string;
  tranche1PayoutPerHouseholdCents: number;
  totalEligibleHouseholds: number;
  totalRequiredFundingFormatted: string;
  totalRequiredFundingCents: number;
  fundedHouseholdsCount: number;
  waitlistedHouseholdsCount: number;
  fundingGapFormatted: string;
  fundingGapCents: number;
  equitySummary: string;
  evidenceId: string;
}

export interface PayoutStatusToolResult {
  hasActivePlan: boolean;
  planId?: string;
  planHash?: string;
  status?: string;
  approvalStatus: {
    hasCoordinatorApproval: boolean;
    hasFinanceApproval: boolean;
    isFullyApproved: boolean;
    remainingApprovalsRequired: number;
  };
  batchStatus?: string;
  paypalBatchId?: string;
  itemsSummary: {
    totalItems: number;
    successCount: number;
    unclaimedCount: number;
    pendingCount: number;
    failedCount: number;
  };
  evidenceId: string;
}

export interface ReconciliationStatusToolResult {
  status: "IN_SYNC" | "TIMING_DIFFERENCE" | "MISMATCH_ALERT" | "FALLBACK_LEDGER_ONLY";
  isMatched: boolean;
  ledgerBalanceFormatted: string;
  paypalBalanceFormatted: string;
  discrepancyFormatted: string;
  discrepancyCents: number;
  unmatchedCount: number;
  lastReconciledAt?: string;
  reconciliationNotes: string;
  evidenceId: string;
}

export interface ScenarioComparisonToolResult {
  scenarios: Array<{
    scenarioId: string;
    title: string;
    description: string;
    payoutPerHouseholdFormatted: string;
    reserveProtectedFormatted: string;
    allocatableFormatted: string;
    requiredFundingFormatted: string;
    fundingGapFormatted: string;
    fundedHouseholdsCount: number;
    waitlistedHouseholdsCount: number;
    coveragePercentage: number;
    readinessState: string;
    isFullyFunded: boolean;
    notes: string;
  }>;
  evidenceId: string;
}

export interface AllToolEvidence {
  disaster: DisasterContextToolResult;
  exposure: ExposureSummaryToolResult;
  treasury: TreasurySnapshotToolResult;
  policy: PolicyEvaluationToolResult;
  payouts: PayoutStatusToolResult;
  reconciliation: ReconciliationStatusToolResult;
  scenarios: ScenarioComparisonToolResult;
  items: EvidenceItem[];
}

