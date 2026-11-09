/**
 * WATCH OFFICER STRUCTURED RESPONSE SCHEMA (§6, M6)
 * Strict Zod schema for validating Watch Officer operational intelligence output.
 */

import { z } from "zod";

export const FinancialReadinessStateSchema = z.enum([
  "READY",
  "CONSTRAINED",
  "INSUFFICIENT_FUNDS",
  "STALE_DATA",
  "RECONCILIATION_REQUIRED",
  "INSUFFICIENT_DATA",
]);

export const RecommendedActionSchema = z.object({
  role: z.enum(["coordinator", "finance", "both", "admin"]),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  action: z.string(),
  reason: z.string(),
  evidenceId: z.string().optional(),
});

export const KeyFindingSchema = z.object({
  finding: z.string(),
  evidenceId: z.string(),
  category: z.enum(["TREASURY", "SENTINEL", "RECIPIENTS", "POLICY", "PAYOUTS", "RECONCILIATION"]),
});

export const ScenarioSummarySchema = z.object({
  scenarioId: z.string(),
  title: z.string(),
  allocatableFormatted: z.string(),
  fundedHouseholdsCount: z.number(),
  coveragePercentage: z.number(),
  readinessState: z.string(),
  tradeoffSummary: z.string(),
});

export const WatchOfficerResponseSchema = z.object({
  summary: z.string().min(10).describe("Concise executive summary of current operational posture"),
  eventContext: z.object({
    hasActiveDisaster: z.boolean(),
    eventName: z.string(),
    eventKey: z.string().optional(),
    severity: z.string(),
    mode: z.enum(["LIVE", "HISTORICAL_REPLAY", "SYNTHETIC"]),
    isTranche1Eligible: z.boolean(),
    disclaimerBanner: z.string().optional(),
  }),
  financialReadiness: z.object({
    state: FinancialReadinessStateSchema,
    reason: z.string(),
    coveragePercentage: z.number().min(0).max(100),
    isFullyFunded: z.boolean(),
    isConstrained: z.boolean(),
    evidenceId: z.string(),
  }),
  fundingConstraints: z.object({
    currency: z.literal("USD"),
    allocatableFormatted: z.string(),
    requiredFundingFormatted: z.string(),
    fundingGapFormatted: z.string(),
    contingentPledgesFormatted: z.string(),
    reserveProtectedFormatted: z.string(),
    isConstrained: z.boolean(),
  }),
  exposureSummary: z.object({
    totalHouseholds: z.number(),
    confirmedExposureCount: z.number(),
    outOfAreaCount: z.number(),
    needsReviewCount: z.number(),
    displacedCount: z.number(),
  }),
  operationalBlockers: z.array(z.string()).describe("List of concrete blockers preventing safe disbursement approval"),
  keyFindings: z.array(KeyFindingSchema).min(1).describe("Core factual findings linked to verified server evidence"),
  scenarioComparisons: z.array(ScenarioSummarySchema).describe("Comparison of precomputed response scenarios"),
  recommendedHumanActions: z.array(RecommendedActionSchema).min(1).describe("Actionable instructions for Coordinator and Finance roles"),
  evidenceReferences: z.array(
    z.object({
      evidenceId: z.string(),
      source: z.string(),
      retrievedAt: z.string(),
      status: z.string(),
      summary: z.string(),
    })
  ),
  warnings: z.array(z.string()),
  dataFreshness: z.object({
    isStale: z.boolean(),
    lastSyncAt: z.string().nullable(),
    source: z.string(),
  }),
  generatedAt: z.string(),
});

export type WatchOfficerResponse = z.infer<typeof WatchOfficerResponseSchema>;

