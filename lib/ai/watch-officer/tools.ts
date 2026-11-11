/**
 * WATCH OFFICER READ-ONLY TOOL REGISTRY (§4, M6)
 * Strict read-only tools that access verified server-side domain data.
 * Zero PII exposure. Zero write capability. Zero money movement.
 */

import { db } from "@/lib/db/client";
import {
  alerts,
  households,
  funds,
  policies,
  payoutPlans,
  approvals,
  payoutBatchRecords,
  payoutItemRecords,
  stormPledges,
  donations,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getTreasuryWaterfall } from "@/lib/ledger/index";
import { computeTreasuryWaterfall } from "@/lib/treasury/waterfall";
import { evaluateFinancialReadiness } from "@/lib/treasury/readiness";
import { runTreasuryReconciliation } from "@/lib/treasury/reconciler";
import { evaluateTranche1, type HouseholdProfile, type PolicyConfig } from "@/lib/rules/engine";
import { simulateResponseScenarios } from "@/lib/rules/simulator";
import { isWeatherFeedStale } from "@/lib/sentinel/normalize";
import type {
  WatchOfficerContext,
  DisasterContextToolResult,
  ExposureSummaryToolResult,
  TreasurySnapshotToolResult,
  PolicyEvaluationToolResult,
  PayoutStatusToolResult,
  ReconciliationStatusToolResult,
  ScenarioComparisonToolResult,
  AllToolEvidence,
  EvidenceItem,
} from "./types";

/**
 * Tool 1: get_disaster_context
 */
export async function getDisasterContext(ctx: WatchOfficerContext): Promise<{
  result: DisasterContextToolResult;
  evidence: EvidenceItem;
}> {
  const [latestAlert] = await db
    .select()
    .from(alerts)
    .orderBy(desc(alerts.lastSyncedAt))
    .limit(1);

  const evidenceId = `ev_disaster_${Date.now()}`;
  const now = new Date();

  if (!latestAlert) {
    const res: DisasterContextToolResult = {
      hasActiveDisaster: false,
      event: "No active disaster",
      severity: "None",
      mode: "LIVE",
      isTranche1Eligible: false,
      isStale: false,
      evidenceId,
    };
    return {
      result: res,
      evidence: {
        id: evidenceId,
        source: "SENTINEL",
        timestamp: now.toISOString(),
        status: "VERIFIED",
        summary: "No storm alerts currently active in Sentinel registry.",
        verifiedData: { ...res },
      },
    };
  }

  const isStale = isWeatherFeedStale(latestAlert.lastSyncedAt);

  const res: DisasterContextToolResult = {
    hasActiveDisaster: true,
    alertId: latestAlert.id,
    nwsId: latestAlert.nwsId,
    eventKey: latestAlert.eventKey || undefined,
    event: latestAlert.event,
    headline: latestAlert.headline || undefined,
    severity: latestAlert.severity,
    urgency: latestAlert.urgency || undefined,
    certainty: latestAlert.certainty || undefined,
    mode: latestAlert.mode as any,
    isTranche1Eligible: latestAlert.isTranche1Eligible,
    areaDesc: latestAlert.areaDesc || undefined,
    effective: latestAlert.effective?.toISOString(),
    expires: latestAlert.expires?.toISOString(),
    isStale,
    lastSyncedAt: latestAlert.lastSyncedAt.toISOString(),
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "SENTINEL",
      timestamp: now.toISOString(),
      status: isStale ? "STALE" : "VERIFIED",
      summary: `${res.event} (${res.eventKey || res.nwsId}) [${res.mode}]. Severity: ${res.severity}. Tranche 1 Trigger: ${res.isTranche1Eligible ? "YES" : "NO"}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 2: get_exposure_summary
 * Aggregated metrics only. ZERO decrypted recipient PII.
 */
export async function getExposureSummary(ctx: WatchOfficerContext): Promise<{
  result: ExposureSummaryToolResult;
  evidence: EvidenceItem;
}> {
  const fundHouseholds = await db
    .select()
    .from(households)
    .where(eq(households.fundId, ctx.fundId));

  const evidenceId = `ev_exposure_${Date.now()}`;
  const now = new Date();

  let displacedCount = 0;
  let needsReviewCount = 0;
  let t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0;

  for (const h of fundHouseholds) {
    if (h.isDisplaced) displacedCount++;
    if (h.status === "needs_review") needsReviewCount++;

    const caseData = (h.caseJson || {}) as any;
    if (caseData.hasMedicalDevice) t1++;
    else if (caseData.isElderlyLivingAlone) t2++;
    else if (caseData.hasDisability) t3++;
    else if (caseData.hasNoVehicleInSurgeZone) t4++;
    else if (caseData.hasChildrenUnder5) t5++;
    else t6++;
  }

  // Confirmed exposure count: households with valid coordinates
  const confirmedExposureCount = fundHouseholds.filter(
    (h) => h.lat != null && h.lng != null && h.status !== "rejected"
  ).length;
  const outOfAreaCount = fundHouseholds.filter((h) => h.status === "rejected").length;

  const res: ExposureSummaryToolResult = {
    totalHouseholds: fundHouseholds.length,
    confirmedExposureCount,
    outOfAreaCount,
    needsReviewCount,
    displacedHouseholdCount: displacedCount,
    priorityDistribution: {
      tier1MedicalCount: t1,
      tier2ElderlyAloneCount: t2,
      tier3DisabilityCount: t3,
      tier4NoVehicleCount: t4,
      tier5ChildrenCount: t5,
      tier6GeneralCount: t6,
    },
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "RECIPIENTS",
      timestamp: now.toISOString(),
      status: "VERIFIED",
      summary: `Total enrolled: ${res.totalHouseholds}. Confirmed: ${res.confirmedExposureCount}. Needs Review: ${res.needsReviewCount}. Displaced: ${res.displacedHouseholdCount}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 3: get_treasury_snapshot
 */
export async function getTreasurySnapshot(ctx: WatchOfficerContext): Promise<{
  result: TreasurySnapshotToolResult;
  evidence: EvidenceItem;
}> {
  const evidenceId = `ev_treasury_${Date.now()}`;
  const now = new Date();

  // Ledger Balances
  const ledgerWaterfall = await getTreasuryWaterfall();
  const paypalAvailableCents = ledgerWaterfall.paypalAvailableCents;
  const reserveProtectedCents = ledgerWaterfall.reserveProtectedCents;
  const feesReservedCents = ledgerWaterfall.feesReservedCents;
  const committedCents = ledgerWaterfall.committedCents;

  // Active Pledges
  const activePledges = await db
    .select()
    .from(stormPledges)
    .where(eq(stormPledges.status, "ACTIVE"));

  const contingentPledgesCents = activePledges.reduce(
    (acc, p) => acc + Math.round(Number(p.amountPerEvent) * 100),
    0
  );

  // Confirmed Donations
  const allDonations = await db.select().from(donations).where(eq(donations.status, "COMPLETED"));
  const confirmedDonationsCents = allDonations.reduce(
    (acc, d) => acc + Math.round(Number(d.amount) * 100),
    0
  );

  const waterfall = computeTreasuryWaterfall({
    paypalAvailableCents,
    reserveProtectedCents,
    feesReservedCents,
    committedCents,
    contingentPledgesCents,
    activePledgesCount: activePledges.length,
  });

  const res: TreasurySnapshotToolResult = {
    currency: "USD",
    paypalAvailableFormatted: `$${(paypalAvailableCents / 100).toFixed(2)}`,
    paypalAvailableCents,
    reserveProtectedFormatted: `$${(reserveProtectedCents / 100).toFixed(2)}`,
    reserveProtectedCents,
    committedFormatted: `$${(committedCents / 100).toFixed(2)}`,
    committedCents,
    allocatableFormatted: `$${(waterfall.allocatableCents / 100).toFixed(2)}`,
    allocatableCents: waterfall.allocatableCents,
    contingentPledgesFormatted: `$${(contingentPledgesCents / 100).toFixed(2)}`,
    contingentPledgesCents,
    activePledgesCount: activePledges.length,
    confirmedDonationsFormatted: `$${(confirmedDonationsCents / 100).toFixed(2)}`,
    confirmedDonationsCount: allDonations.length,
    isStale: false,
    lastSyncedAt: now.toISOString(),
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "TREASURY",
      timestamp: now.toISOString(),
      status: "VERIFIED",
      summary: `Allocatable: ${res.allocatableFormatted} (Available: ${res.paypalAvailableFormatted}, Reserve: ${res.reserveProtectedFormatted}, Committed: ${res.committedFormatted}). Contingent Pledges: ${res.contingentPledgesFormatted}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 4: get_policy_evaluation
 */
export async function getPolicyEvaluation(
  ctx: WatchOfficerContext,
  allocatableCents: number
): Promise<{
  result: PolicyEvaluationToolResult;
  evidence: EvidenceItem;
}> {
  const evidenceId = `ev_policy_${Date.now()}`;
  const now = new Date();

  // Load published policy config or use default
  const [publishedPolicy] = await db
    .select()
    .from(policies)
    .where(eq(policies.fundId, ctx.fundId))
    .orderBy(desc(policies.confirmedAt))
    .limit(1);

  const config: PolicyConfig = (publishedPolicy?.rulesJson as any) || {
    version: "1.0.0",
    tranche1AmountCents: 10000, // $100.00
    tranche2BaseAmountCents: 25000,
    tranche2PerPersonCents: 5000,
    tranche2VulnerabilityAddOnCents: 5000,
    maxPerHouseholdPerEventCents: 50000,
    maxHouseholdsPerAddress: 2,
    feePerItemCents: 25,
    feePercentage: 0.02,
  };

  const fundHouseholds = await db
    .select()
    .from(households)
    .where(eq(households.fundId, ctx.fundId));

  const profiles: HouseholdProfile[] = fundHouseholds.map((h) => {
    const caseData = (h.caseJson || {}) as any;
    return {
      id: h.id,
      address: `masked_${h.id.slice(0, 8)}`,
      zone: "TBW_A",
      language: h.language,
      recipientPath: h.recipientPath as any,
      evidenceLevel: (caseData.evidenceLevel || "SELF_DECLARED") as any,
      enrolledAt: h.createdAt.toISOString(),
      hasMedicalDevice: !!caseData.hasMedicalDevice,
      isElderlyLivingAlone: !!caseData.isElderlyLivingAlone,
      hasDisability: !!caseData.hasDisability,
      hasNoVehicleInSurgeZone: !!caseData.hasNoVehicleInSurgeZone,
      hasChildrenUnder5: !!caseData.hasChildrenUnder5,
      numMembers: caseData.numMembers || 1,
      hasMissingDocs: h.status === "needs_review",
      isExposureConfirmed: h.status !== "rejected",
    };
  });

  const evaluation = evaluateTranche1({
    households: profiles,
    allocatableCents,
    config,
  });

  const costPerHh = config.tranche1AmountCents + 225; // with fee
  const totalRequiredFundingCents = profiles.length * costPerHh;
  const fundingGapCents = Math.max(0, totalRequiredFundingCents - allocatableCents);

  const res: PolicyEvaluationToolResult = {
    policyVersion: config.version,
    tranche1PayoutPerHouseholdFormatted: `$${(config.tranche1AmountCents / 100).toFixed(2)}`,
    tranche1PayoutPerHouseholdCents: config.tranche1AmountCents,
    totalEligibleHouseholds: profiles.length,
    totalRequiredFundingFormatted: `$${(totalRequiredFundingCents / 100).toFixed(2)}`,
    totalRequiredFundingCents,
    fundedHouseholdsCount: evaluation.fundedHouseholds.length,
    waitlistedHouseholdsCount: evaluation.waitlistedHouseholds.length,
    fundingGapFormatted: `$${(fundingGapCents / 100).toFixed(2)}`,
    fundingGapCents,
    equitySummary: `Funded ${evaluation.fundedHouseholds.length} of ${profiles.length} households by deterministic priority rules. Waitlisted: ${evaluation.waitlistedHouseholds.length}.`,
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "POLICY",
      timestamp: now.toISOString(),
      status: "VERIFIED",
      summary: `Policy ${config.version}. Requirement: ${res.totalRequiredFundingFormatted} for ${profiles.length} households. Funded: ${res.fundedHouseholdsCount}. Gap: ${res.fundingGapFormatted}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 5: get_payout_status
 */
/** Counts from the durable records of what PayPal reported (payout_item_records). */
async function summarizeProviderRecords() {
  const [batch] = await db.select().from(payoutBatchRecords).orderBy(desc(payoutBatchRecords.createdAt)).limit(1);
  const summary = { totalItems: 0, successCount: 0, unclaimedCount: 0, pendingCount: 0, failedCount: 0 };
  if (!batch) return { batch: undefined, summary };
  const items = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.paypalBatchId, batch.paypalBatchId));
  summary.totalItems = items.length;
  summary.successCount = items.filter((i) => i.status === "SUCCESS").length;
  summary.unclaimedCount = items.filter((i) => i.status === "UNCLAIMED").length;
  // SUBMITTED = sent, PayPal has not told us anything about the item yet: still unresolved, not success.
  summary.pendingCount = items.filter((i) => ["PENDING", "PROCESSING", "SUBMITTED", "ONHOLD", "BLOCKED"].includes(i.status)).length;
  summary.failedCount = items.filter((i) => ["FAILED", "RETURNED", "REFUNDED", "REVERSED", "DENIED"].includes(i.status)).length;
  return { batch, summary };
}

export async function getPayoutStatus(ctx: WatchOfficerContext): Promise<{
  result: PayoutStatusToolResult;
  evidence: EvidenceItem;
}> {
  const evidenceId = `ev_payouts_${Date.now()}`;
  const now = new Date();

  // Find most recent payout plan
  const [latestPlan] = await db
    .select()
    .from(payoutPlans)
    .orderBy(desc(payoutPlans.id))
    .limit(1);

  if (!latestPlan) {
    const provider = await summarizeProviderRecords();
    const res: PayoutStatusToolResult = {
      hasActivePlan: false,
      batchStatus: provider.batch?.status,
      paypalBatchId: provider.batch?.paypalBatchId,
      provenance: provider.batch ? "PROVIDER_RECORDS" : "NONE",
      lastProviderSyncAt: provider.batch?.lastSyncedAt?.toISOString(),
      approvalStatus: {
        hasCoordinatorApproval: false,
        hasFinanceApproval: false,
        isFullyApproved: false,
        remainingApprovalsRequired: 2,
      },
      itemsSummary: provider.summary,
      evidenceId,
    };
    return {
      result: res,
      evidence: {
        id: evidenceId,
        source: "PAYOUTS",
        timestamp: now.toISOString(),
        status: "VERIFIED",
        summary: "No payout plans currently exist in the database.",
        verifiedData: { ...res },
      },
    };
  }

  // Query approvals
  const planApprovals = await db
    .select()
    .from(approvals)
    .where(eq(approvals.planId, latestPlan.id));

  const hasCoordinator = planApprovals.some((a) => a.approverRole === "coordinator");
  const hasFinance = planApprovals.some((a) => a.approverRole === "finance");
  const isFullyApproved = hasCoordinator && hasFinance;
  const remainingApprovals = (hasCoordinator ? 0 : 1) + (hasFinance ? 0 : 1);

  // Provider-reported batch + item records (not the legacy, never-written payout_batches tables)
  const { batch, summary: itemsSummary } = await summarizeProviderRecords();

  const res: PayoutStatusToolResult = {
    hasActivePlan: true,
    planId: latestPlan.id,
    planHash: latestPlan.planHash,
    status: latestPlan.status,
    approvalStatus: {
      hasCoordinatorApproval: hasCoordinator,
      hasFinanceApproval: hasFinance,
      isFullyApproved,
      remainingApprovalsRequired: remainingApprovals,
    },
    batchStatus: batch?.status,
    paypalBatchId: batch?.paypalBatchId || undefined,
    provenance: batch ? "PROVIDER_RECORDS" : "NONE",
    lastProviderSyncAt: batch?.lastSyncedAt?.toISOString(),
    itemsSummary,
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "PAYOUTS",
      timestamp: now.toISOString(),
      status: "VERIFIED",
      summary: `Plan ${latestPlan.id.slice(0, 8)} (${latestPlan.status}). Approvals: ${isFullyApproved ? "2/2 COMPLETE" : `${2 - remainingApprovals}/2 PENDING`}. Batch: ${batch?.status || "None"}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 6: get_reconciliation_status
 */
export async function getReconciliationStatus(ctx: WatchOfficerContext): Promise<{
  result: ReconciliationStatusToolResult;
  evidence: EvidenceItem;
}> {
  const evidenceId = `ev_reconciliation_${Date.now()}`;
  const now = new Date();

  // Run or retrieve deterministic reconciliation pass
  // Live, read-only comparison with PayPal. If PayPal cannot be reached the report says UNVERIFIED
  // (it no longer substitutes a ledger-only "match").
  const report = await runTreasuryReconciliation({ actor: "watch_officer_audit" });

  const res: ReconciliationStatusToolResult = {
    status: report.status,
    isMatched: report.isMatched,
    ledgerBalanceFormatted: `$${(report.ledgerBalanceCents / 100).toFixed(2)}`,
    paypalBalanceFormatted: `$${(report.paypalBalanceCents / 100).toFixed(2)}`,
    discrepancyFormatted: `$${(report.discrepancyCents / 100).toFixed(2)}`,
    discrepancyCents: report.discrepancyCents,
    unmatchedCount: report.unmatchedItems?.length || 0,
    lastReconciledAt: report.reconciledAt,
    reconciliationNotes: report.notes,
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "RECONCILIATION",
      timestamp: now.toISOString(),
      // Only a genuine IN_SYNC comparison is VERIFIED; UNVERIFIED / FALLBACK / mismatches are not.
      status: report.isMatched && report.status === "IN_SYNC" ? "VERIFIED" : "PENDING",
      summary: `Reconciliation: ${res.status}. Discrepancy: ${res.discrepancyFormatted}. Unmatched: ${res.unmatchedCount}.`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Tool 7: compare_response_scenarios
 */
export async function compareResponseScenariosTool(
  ctx: WatchOfficerContext,
  treasury: TreasurySnapshotToolResult,
  policy: PolicyEvaluationToolResult
): Promise<{
  result: ScenarioComparisonToolResult;
  evidence: EvidenceItem;
}> {
  const evidenceId = `ev_scenarios_${Date.now()}`;
  const now = new Date();

  const fundHouseholds = await db
    .select()
    .from(households)
    .where(eq(households.fundId, ctx.fundId));

  const profiles: HouseholdProfile[] = fundHouseholds.map((h) => {
    const caseData = (h.caseJson || {}) as any;
    return {
      id: h.id,
      address: `masked_${h.id.slice(0, 8)}`,
      zone: "TBW_A",
      language: h.language,
      recipientPath: h.recipientPath as any,
      evidenceLevel: (caseData.evidenceLevel || "SELF_DECLARED") as any,
      enrolledAt: h.createdAt.toISOString(),
      hasMedicalDevice: !!caseData.hasMedicalDevice,
      isElderlyLivingAlone: !!caseData.isElderlyLivingAlone,
      hasDisability: !!caseData.hasDisability,
      hasNoVehicleInSurgeZone: !!caseData.hasNoVehicleInSurgeZone,
      hasChildrenUnder5: !!caseData.hasChildrenUnder5,
      numMembers: caseData.numMembers || 1,
      hasMissingDocs: h.status === "needs_review",
      isExposureConfirmed: h.status !== "rejected",
    };
  });

  const baseConfig: PolicyConfig = {
    version: policy.policyVersion,
    tranche1AmountCents: policy.tranche1PayoutPerHouseholdCents,
    tranche2BaseAmountCents: 25000,
    tranche2PerPersonCents: 5000,
    tranche2VulnerabilityAddOnCents: 5000,
    maxPerHouseholdPerEventCents: 50000,
    maxHouseholdsPerAddress: 2,
    feePerItemCents: 25,
    feePercentage: 0.02,
  };

  const simulated = simulateResponseScenarios({
    paypalAvailableCents: treasury.paypalAvailableCents,
    baseReserveProtectedCents: treasury.reserveProtectedCents,
    feesReservedCents: 2500,
    committedCents: treasury.committedCents,
    contingentPledgesCents: treasury.contingentPledgesCents,
    households: profiles,
    baseConfig,
  });

  const res: ScenarioComparisonToolResult = {
    scenarios: simulated,
    evidenceId,
  };

  return {
    result: res,
    evidence: {
      id: evidenceId,
      source: "POLICY",
      timestamp: now.toISOString(),
      status: "VERIFIED",
      summary: `Computed 3 deterministic response scenarios (Baseline, Reduced Reserve, Priority Tiers Only).`,
      verifiedData: { ...res },
    },
  };
}

/**
 * Executes all 7 read-only tools and packages unified evidence for the Watch Officer.
 */
export async function collectAllToolEvidence(
  ctx: WatchOfficerContext
): Promise<AllToolEvidence> {
  const items: EvidenceItem[] = [];

  const disaster = await getDisasterContext(ctx);
  items.push(disaster.evidence);

  const exposure = await getExposureSummary(ctx);
  items.push(exposure.evidence);

  const treasury = await getTreasurySnapshot(ctx);
  items.push(treasury.evidence);

  const policy = await getPolicyEvaluation(ctx, treasury.result.allocatableCents);
  items.push(policy.evidence);

  const payouts = await getPayoutStatus(ctx);
  items.push(payouts.evidence);

  const reconciliation = await getReconciliationStatus(ctx);
  items.push(reconciliation.evidence);

  const scenarios = await compareResponseScenariosTool(ctx, treasury.result, policy.result);
  items.push(scenarios.evidence);

  return {
    disaster: disaster.result,
    exposure: exposure.result,
    treasury: treasury.result,
    policy: policy.result,
    payouts: payouts.result,
    reconciliation: reconciliation.result,
    scenarios: scenarios.result,
    items,
  };
}
