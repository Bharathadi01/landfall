/**
 * WATCH OFFICER NUMBER INTEGRITY & EVIDENCE BINDING ENGINE (§6, M6)
 * Invariants:
 * 1. AI cannot invent authoritative financial figures.
 * 2. Deterministic services supply all authoritative numbers.
 * 3. Server enforces that model claims are strictly bound to verified evidence IDs.
 * 4. Hallucinated numbers are intercepted, replaced, or flagged with warnings.
 */

import type { WatchOfficerResponse } from "./schema";
import type { AllToolEvidence, EvidenceItem } from "./types";
import { evaluateFinancialReadiness } from "@/lib/treasury/readiness";

export interface IntegrityVerificationResult {
  verifiedResponse: WatchOfficerResponse;
  discrepanciesDetected: string[];
  numberIntegrityPass: boolean;
}

export function enforceNumberIntegrity(
  modelResponse: WatchOfficerResponse,
  evidence: AllToolEvidence
): IntegrityVerificationResult {
  const discrepancies: string[] = [];
  const validEvidenceIds = new Set(evidence.items.map((i) => i.id));

  // Compute authoritative readiness from verified data
  const deterministicReadiness = evaluateFinancialReadiness({
    paypalAvailableCents: evidence.treasury.paypalAvailableCents,
    reserveProtectedCents: evidence.treasury.reserveProtectedCents,
    feesReservedCents: 2500,
    committedCents: evidence.treasury.committedCents,
    contingentPledgesCents: evidence.treasury.contingentPledgesCents,
    activePledgesCount: evidence.treasury.activePledgesCount,
    eligibleHouseholdsCount: evidence.exposure.totalHouseholds,
    costPerHouseholdCents: evidence.policy.tranche1PayoutPerHouseholdCents + 225,
    hasUnreconciledDiscrepancy: evidence.reconciliation.discrepancyCents !== 0,
    weatherLastSyncedAt: evidence.disaster.lastSyncedAt,
    treasuryLastSyncedAt: evidence.treasury.lastSyncedAt,
  });

  // Clone response for safe mutation
  const verified: WatchOfficerResponse = { ...modelResponse };

  // 1. Authoritative Financial Readiness Override
  if (verified.financialReadiness.state !== deterministicReadiness.state) {
    discrepancies.push(
      `Model claimed readiness state '${verified.financialReadiness.state}', overridden to deterministic '${deterministicReadiness.state}'`
    );
    verified.financialReadiness.state = deterministicReadiness.state;
  }
  verified.financialReadiness.coveragePercentage = deterministicReadiness.coveragePercentage;
  verified.financialReadiness.isFullyFunded = deterministicReadiness.isFullyFunded;
  verified.financialReadiness.isConstrained = deterministicReadiness.isConstrained;
  verified.financialReadiness.evidenceId = deterministicReadiness.evidenceId;

  // 2. Authoritative Funding Constraints Enforcement
  verified.fundingConstraints = {
    currency: "USD",
    allocatableFormatted: evidence.treasury.allocatableFormatted,
    requiredFundingFormatted: evidence.policy.totalRequiredFundingFormatted,
    fundingGapFormatted: evidence.policy.fundingGapFormatted,
    contingentPledgesFormatted: evidence.treasury.contingentPledgesFormatted,
    reserveProtectedFormatted: evidence.treasury.reserveProtectedFormatted,
    isConstrained: deterministicReadiness.isConstrained,
  };

  // 3. Authoritative Exposure Summary Enforcement
  verified.exposureSummary = {
    totalHouseholds: evidence.exposure.totalHouseholds,
    confirmedExposureCount: evidence.exposure.confirmedExposureCount,
    outOfAreaCount: evidence.exposure.outOfAreaCount,
    needsReviewCount: evidence.exposure.needsReviewCount,
    displacedCount: evidence.exposure.displacedHouseholdCount,
  };

  // 3b. Authoritative Event Context Enforcement
  verified.eventContext = {
    ...verified.eventContext,
    hasActiveDisaster: evidence.disaster.hasActiveDisaster,
    eventName: evidence.disaster.event,
    eventKey: evidence.disaster.eventKey,
    severity: evidence.disaster.severity,
    mode: evidence.disaster.mode,
    isTranche1Eligible: evidence.disaster.isTranche1Eligible,
  };

  if (evidence.disaster.hasActiveDisaster && !evidence.disaster.isTranche1Eligible) {
    const ineligibleBlocker = `Disaster alert (${evidence.disaster.event}) does not qualify for automated Tranche 1 release (must be Hurricane, Storm Surge, Flash Flood, or Extreme Heat Warning).`;
    if (!verified.operationalBlockers.includes(ineligibleBlocker)) {
      verified.operationalBlockers.unshift(ineligibleBlocker);
    }
  }

  // 4. Evidence ID Binding for Key Findings
  verified.keyFindings = verified.keyFindings.map((kf, idx) => {
    if (!validEvidenceIds.has(kf.evidenceId)) {
      discrepancies.push(`Finding ${idx + 1} referenced invalid evidenceId '${kf.evidenceId}', rebound to authoritative source.`);
      return {
        ...kf,
        evidenceId: evidence.treasury.evidenceId,
      };
    }
    return kf;
  });

  // 4b. Money binding. A dollar figure the model writes must exist in the evidence it cites; a claim about the treasury must match the
  // treasury's actual figures. Otherwise the finding is restated from the authoritative numbers (and the change is reported).
  const t = evidence.treasury;
  const amountsIn = (text: string): number[] => (text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? []).map((a) => Number(a.replace(/[$,\s]/g, "")));
  const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
  const evidenceAmounts = (id: string) => amountsIn(evidence.items.find((i) => i.id === id)?.summary ?? "");
  const allEvidenceAmounts = evidence.items.flatMap((i) => amountsIn(i.summary));
  const treasuryLine = `${t.allocatableFormatted} is free to send (${t.paypalAvailableFormatted} at PayPal, ${t.reserveProtectedFormatted} protected reserve, ${t.committedFormatted} committed).`;
  const treasuryClaim = (text: string) => /\b(treasury|balance|cash|available|allocatable|liquidity|funds?)\b/i.test(text) && !/\b(gap|required|requirement|need(ed)?|reserve|pledge|committed)\b/i.test(text);
  const treasuryFigures = [t.allocatableCents, t.paypalAvailableCents].map((c) => c / 100);
  verified.keyFindings = verified.keyFindings.map((kf, idx) => {
    const amounts = amountsIn(kf.finding);
    if (!amounts.length) return kf;
    if (treasuryClaim(kf.finding) && !amounts.every((a) => treasuryFigures.some((f) => same(a, f)))) {
      discrepancies.push(`Finding ${idx + 1} stated a treasury figure (${kf.finding}) that does not match the ledger; restated from the treasury snapshot.`);
      return { ...kf, finding: `Treasury: ${treasuryLine}`, evidenceId: t.evidenceId };
    }
    if (amounts.every((a) => evidenceAmounts(kf.evidenceId).some((e) => same(a, e)))) return kf;
    const home = evidence.items.find((i) => amounts.every((a) => amountsIn(i.summary).some((e) => same(a, e))));
    if (home) {
      discrepancies.push(`Finding ${idx + 1} cited '${kf.evidenceId}' for figures that come from '${home.id}'; citation corrected.`);
      return { ...kf, evidenceId: home.id };
    }
    discrepancies.push(`Finding ${idx + 1} stated figures found in no evidence (${kf.finding}); removed.`);
    return null as unknown as typeof kf;
  }).filter(Boolean);

  // 4c. Summary guard: a summary that states an amount found in no evidence, or misstates the treasury, is replaced by a deterministic one.
  const summaryAmounts = amountsIn(verified.summary ?? "");
  const summaryBad =
    summaryAmounts.some((a) => !allEvidenceAmounts.some((e) => same(a, e))) ||
    (t.allocatableCents > 0 && /\b(treasury|balance|cash|funds?)\b[^.;]*(\$\s?0(?:\.00)?\b|\bzero\b|\bempty\b|\bno (?:cash|funds|money)\b)/i.test(verified.summary ?? ""));
  if (summaryBad) {
    discrepancies.push("The summary stated figures that the evidence does not support; replaced with a summary computed from the evidence.");
    const storm = evidence.disaster.hasActiveDisaster ? `${evidence.disaster.event} is active.` : "No storm warning is active.";
    verified.summary = `${storm} ${treasuryLine} Funding needed: ${evidence.policy.totalRequiredFundingFormatted}; gap: ${evidence.policy.fundingGapFormatted}.`;
  }

  // 5. Append Verified Evidence References
  verified.evidenceReferences = evidence.items.map((i) => ({
    evidenceId: i.id,
    source: i.source,
    retrievedAt: i.timestamp,
    status: i.status,
    summary: i.summary,
  }));

  // 6. Data Freshness Enforcement
  verified.dataFreshness = {
    isStale: evidence.disaster.isStale || evidence.treasury.isStale,
    lastSyncAt: evidence.disaster.lastSyncedAt || evidence.treasury.lastSyncedAt || null,
    source: evidence.disaster.mode === "HISTORICAL_REPLAY" ? "IEM_ARCHIVE" : "NWS_LIVE",
  };

  // 7. Inject Discrepancy Warnings if Model Deviated
  if (discrepancies.length > 0) {
    verified.warnings = [
      ...(verified.warnings || []),
      ...discrepancies.map((d) => `[NUMBER_INTEGRITY] ${d}`),
    ];
  }

  // Inject Historical Replay Warning if applicable
  if (evidence.disaster.mode === "HISTORICAL_REPLAY") {
    const replayNotice = "HISTORICAL REPLAY MODE · Operating over archived Milton 2024 warning data · No real payments will be executed.";
    if (!verified.warnings.includes(replayNotice)) {
      verified.warnings.unshift(replayNotice);
    }
    verified.eventContext.disclaimerBanner = replayNotice;
  }

  return {
    verifiedResponse: verified,
    discrepanciesDetected: discrepancies,
    numberIntegrityPass: discrepancies.length === 0,
  };
}
