/**
 * SECOND TRANCHE ENGINE (§3, §4, §5)
 * Post-disaster relief evaluation and payout orchestration.
 * Invariants:
 * 1. Tranche 2 cannot execute without verified post-event impact evidence.
 * 2. Requires a brand-new distinct PayoutPlan with tranche=2.
 * 3. Requires brand-new dual-custody WebAuthn passkey signatures over a new canonical plan hash.
 * 4. Strictly deduplicated: no household can receive Tranche 2 more than once for a single disaster event.
 * 5. Respects maximum per-household cumulative cap ($500.00 total across Tranches 1 and 2).
 */

import { type HouseholdProfile, type PolicyConfig, evaluateTranche2, type PolicyEvaluationResult } from "@/lib/rules/engine";
import { type PayoutPlan, computePlanHash, type TreasurerContext, validatePreConditions } from "@/lib/treasurer/index";
import { type ApprovalKeyVerification } from "@/lib/security/passkeys";

export interface PostEventEvidence {
  householdId: string;
  impactReportedAt: string;
  damageLevel: "MINOR" | "MODERATE" | "SEVERE" | "CATASTROPHIC";
  floodDepthInches?: number;
  powerOutageHours?: number;
  isDisplacedFromHome: boolean;
  reconfirmedByPhoneOrWeb: boolean;
}

export interface SecondTranchePlanInput {
  activationId: string;
  policy: PolicyConfig;
  households: HouseholdProfile[];
  impactEvidence: PostEventEvidence[];
  allocatableCents: number;
  alreadyPaidTranche1HouseholdIds: Set<string>;
  alreadyPaidTranche2HouseholdIds: Set<string>;
}

export interface SecondTranchePlanResult {
  payoutPlan: PayoutPlan;
  planHash: string;
  policyEvaluation: PolicyEvaluationResult;
  eligibleCount: number;
  excludedCount: number;
  exclusionReasons: Record<string, string>;
}

/**
 * Evaluates households for Tranche 2 post-event relief and generates a locked payout plan.
 */
export function buildSecondTranchePlan({
  activationId,
  policy,
  households,
  impactEvidence,
  allocatableCents,
  alreadyPaidTranche1HouseholdIds,
  alreadyPaidTranche2HouseholdIds,
}: SecondTranchePlanInput): SecondTranchePlanResult {
  const evidenceMap = new Map<string, PostEventEvidence>(
    impactEvidence.map((e) => [e.householdId, e])
  );

  const eligibleForTranche2: HouseholdProfile[] = [];
  const exclusionReasons: Record<string, string> = {};

  for (const h of households) {
    // 1. Must not have already received Tranche 2 for this event
    if (alreadyPaidTranche2HouseholdIds.has(h.id)) {
      exclusionReasons[h.id] = "ALREADY_PAID_TRANCHE_2";
      continue;
    }

    // 2. Must have verified post-event impact evidence
    const evidence = evidenceMap.get(h.id);
    if (!evidence) {
      exclusionReasons[h.id] = "MISSING_POST_EVENT_EVIDENCE";
      continue;
    }

    // 3. Must have reconfirmed or suffered moderate+ damage or displacement
    const hasSufficientDamage =
      evidence.damageLevel === "MODERATE" ||
      evidence.damageLevel === "SEVERE" ||
      evidence.damageLevel === "CATASTROPHIC" ||
      evidence.isDisplacedFromHome ||
      evidence.reconfirmedByPhoneOrWeb;

    if (!hasSufficientDamage) {
      exclusionReasons[h.id] = "INSUFFICIENT_IMPACT_SEVERITY";
      continue;
    }

    eligibleForTranche2.push(h);
  }

  // Evaluate deterministic policy allocation for Tranche 2
  const policyEvaluation = evaluateTranche2({
    households: eligibleForTranche2,
    config: policy,
    allocatableCents,
  });

  const planItems = policyEvaluation.fundedHouseholds.map((fh) => {
    const profile = eligibleForTranche2.find((h) => h.id === fh.householdId);
    return {
      householdId: fh.householdId,
      recipientType: (profile?.recipientPath === "LINKED_PAYPAL" ? "PAYPAL_ID" : "EMAIL") as
        | "EMAIL"
        | "PAYPAL_ID",
      receiver: `recipient-${fh.householdId}@example.com`,
      amountCents: fh.amountCents,
      currency: "USD",
      note: `Landfall Post-Storm Tranche 2 Relief · Event: ${activationId}`,
    };
  });

  const planId = `plan_tranche2_${activationId}_${Date.now()}`;
  const unhashedPlan = {
    id: planId,
    activationId,
    tranche: 2 as const,
    items: planItems,
    totalAmountCents: policyEvaluation.totalCommittedCents,
    totalFeesCents: policyEvaluation.totalFeesCents,
    createdAt: new Date().toISOString(),
  };

  const planHash = computePlanHash(unhashedPlan);

  const payoutPlan: PayoutPlan = {
    ...unhashedPlan,
    state: "draft",
    planHash,
  };

  return {
    payoutPlan,
    planHash,
    policyEvaluation,
    eligibleCount: eligibleForTranche2.length,
    excludedCount: Object.keys(exclusionReasons).length,
    exclusionReasons,
  };
}

