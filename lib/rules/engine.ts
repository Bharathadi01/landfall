/**
 * LANDFALL DETERMINISTIC POLICY ENGINE
 * Golden Rule #1: Rules decide the money. AI never sets eligibility, priority, or amounts.
 * Pure deterministic code — ZERO AI imports.
 */

export type RecipientPath = "LINKED_PAYPAL" | "EMAIL_CLAIM" | "ASSISTED" | "MANUAL_CHANNEL";
export type EvidenceLevel = "SELF_DECLARED" | "ATTESTED" | "DOCUMENT";

export interface HouseholdProfile {
  id: string;
  address: string;
  zone: string;
  language: string; // e.g. "en", "es", "vi", "ht"
  recipientPath: RecipientPath;
  evidenceLevel: EvidenceLevel;
  enrolledAt: string; // ISO date
  hasMedicalDevice: boolean;
  isElderlyLivingAlone: boolean;
  hasDisability: boolean;
  hasNoVehicleInSurgeZone: boolean;
  hasChildrenUnder5: boolean;
  numMembers: number;
  hasMissingDocs: boolean;
  isExposureConfirmed: boolean;
}

export interface PolicyConfig {
  version: string;
  tranche1AmountCents: number; // e.g. 10000 = $100.00
  tranche2BaseAmountCents: number; // e.g. 25000 = $250.00
  tranche2PerPersonCents: number; // e.g. 5000 = $50.00
  tranche2VulnerabilityAddOnCents: number; // e.g. 5000 = $50.00
  maxPerHouseholdPerEventCents: number; // e.g. 50000 = $500.00
  maxHouseholdsPerAddress: number; // e.g. 2
  feePerItemCents: number; // e.g. 25 = $0.25 flat + 2%
  feePercentage: number; // e.g. 0.02
}

export type PriorityCode =
  | "P1_MEDICAL_DEVICE"
  | "P2_ELDERLY_ALONE"
  | "P3_DISABILITY"
  | "P4_NO_VEHICLE_SURGE"
  | "P5_CHILDREN_UNDER_5"
  | "P6_GENERAL";

export type ReasonCode =
  | PriorityCode
  | "INELIGIBLE_OUT_OF_AREA"
  | "CAP_REACHED_ADDRESS_LIMIT"
  | "WAITLISTED_BUDGET"
  | "NEEDS_REVIEW_MISSING_DOCS";

export interface EvaluatedHousehold {
  householdId: string;
  eligible: boolean;
  priorityTier: number; // 1 to 6 (1 is highest priority)
  priorityCode: PriorityCode;
  amountCents: number;
  feeCents: number;
  reasonCodes: ReasonCode[];
  needsReview: boolean;
}

export interface PolicyEvaluationResult {
  policyVersion: string;
  tranche: 1 | 2;
  totalAllocatableCents: number;
  totalCommittedCents: number;
  totalFeesCents: number;
  fundedHouseholds: EvaluatedHousehold[];
  waitlistedHouseholds: EvaluatedHousehold[];
  ineligibleHouseholds: EvaluatedHousehold[];
}

/**
 * Assigns lexicographic priority tier according to Section 4.7.
 * Golden Rule #4: Missing paperwork never lowers priority rank; it marks needsReview.
 */
export function assignPriority(h: HouseholdProfile): { tier: number; code: PriorityCode } {
  if (h.hasMedicalDevice) {
    return { tier: 1, code: "P1_MEDICAL_DEVICE" };
  }
  if (h.isElderlyLivingAlone) {
    return { tier: 2, code: "P2_ELDERLY_ALONE" };
  }
  if (h.hasDisability) {
    return { tier: 3, code: "P3_DISABILITY" };
  }
  if (h.hasNoVehicleInSurgeZone) {
    return { tier: 4, code: "P4_NO_VEHICLE_SURGE" };
  }
  if (h.hasChildrenUnder5) {
    return { tier: 5, code: "P5_CHILDREN_UNDER_5" };
  }
  return { tier: 6, code: "P6_GENERAL" };
}

/**
 * Computes Tranche 1 or Tranche 2 payout amount based on published policy formula.
 */
export function calculatePayoutAmount(
  h: HouseholdProfile,
  policy: PolicyConfig,
  tranche: 1 | 2
): number {
  if (tranche === 1) {
    return policy.tranche1AmountCents;
  }

  // Tranche 2 needs-based formula:
  // Base + (numMembers - 1) * perPerson + (hasVulnerability ? addOn : 0)
  let amount = policy.tranche2BaseAmountCents;
  if (h.numMembers > 1) {
    amount += (h.numMembers - 1) * policy.tranche2PerPersonCents;
  }
  const hasVulnerability =
    h.hasMedicalDevice ||
    h.isElderlyLivingAlone ||
    h.hasDisability ||
    h.hasNoVehicleInSurgeZone ||
    h.hasChildrenUnder5;

  if (hasVulnerability) {
    amount += policy.tranche2VulnerabilityAddOnCents;
  }

  return Math.min(amount, policy.maxPerHouseholdPerEventCents);
}

/**
 * Computes item transaction fee for PayPal disbursement reservation.
 */
export function calculateItemFee(amountCents: number, policy: PolicyConfig): number {
  return policy.feePerItemCents + Math.round(amountCents * policy.feePercentage);
}

/**
 * Evaluates full policy over candidate households.
 * Deterministic sorting:
 * 1. Priority tier (ascending 1 to 6)
 * 2. Enrollment timestamp (earliest first)
 * 3. Household ID (stable tie-breaker)
 */
export function evaluatePolicy({
  households,
  policy,
  allocatableCents,
  tranche = 1,
}: {
  households: HouseholdProfile[];
  policy: PolicyConfig;
  allocatableCents: number;
  tranche?: 1 | 2;
}): PolicyEvaluationResult {
  const exposedCandidates: { profile: HouseholdProfile; tier: number; code: PriorityCode }[] = [];
  const ineligible: EvaluatedHousehold[] = [];

  for (const h of households) {
    // 1. Exposure check
    if (!h.isExposureConfirmed) {
      ineligible.push({
        householdId: h.id,
        eligible: false,
        priorityTier: 99,
        priorityCode: "P6_GENERAL",
        amountCents: 0,
        feeCents: 0,
        reasonCodes: ["INELIGIBLE_OUT_OF_AREA"],
        needsReview: false,
      });
      continue;
    }

    // Assign priority rank
    const priority = assignPriority(h);
    exposedCandidates.push({ profile: h, tier: priority.tier, code: priority.code });
  }

  // Lexicographic sort: Tier (1-6) -> Enrollment time -> ID
  exposedCandidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const dateComp = new Date(a.profile.enrolledAt).getTime() - new Date(b.profile.enrolledAt).getTime();
    if (dateComp !== 0) return dateComp;
    return a.profile.id.localeCompare(b.profile.id);
  });

  // Now enforce address limit in priority order so higher-need households at same address get priority
  const addressCounts: Record<string, number> = {};
  const eligibleCandidates: { profile: HouseholdProfile; tier: number; code: PriorityCode }[] = [];

  for (const candidate of exposedCandidates) {
    const currentAtAddress = addressCounts[candidate.profile.address] || 0;
    if (currentAtAddress >= policy.maxHouseholdsPerAddress) {
      ineligible.push({
        householdId: candidate.profile.id,
        eligible: false,
        priorityTier: candidate.tier,
        priorityCode: candidate.code,
        amountCents: 0,
        feeCents: 0,
        reasonCodes: ["CAP_REACHED_ADDRESS_LIMIT"],
        needsReview: false,
      });
      continue;
    }
    addressCounts[candidate.profile.address] = currentAtAddress + 1;
    eligibleCandidates.push(candidate);
  }

  // Allocation with budget constraint
  let remainingBudget = allocatableCents;
  let totalCommitted = 0;
  let totalFees = 0;
  const funded: EvaluatedHousehold[] = [];
  const waitlisted: EvaluatedHousehold[] = [];

  for (const candidate of eligibleCandidates) {
    const amount = calculatePayoutAmount(candidate.profile, policy, tranche);
    const fee = calculateItemFee(amount, policy);
    const totalCost = amount + fee;

    const reasons: ReasonCode[] = [candidate.code];
    let needsReview = false;

    // Golden Rule #4: Missing documentation flags review but does NOT lower priority tier
    if (candidate.profile.hasMissingDocs) {
      reasons.push("NEEDS_REVIEW_MISSING_DOCS");
      needsReview = true;
    }

    if (remainingBudget >= totalCost) {
      funded.push({
        householdId: candidate.profile.id,
        eligible: true,
        priorityTier: candidate.tier,
        priorityCode: candidate.code,
        amountCents: amount,
        feeCents: fee,
        reasonCodes: reasons,
        needsReview,
      });
      remainingBudget -= totalCost;
      totalCommitted += amount;
      totalFees += fee;
    } else {
      reasons.push("WAITLISTED_BUDGET");
      waitlisted.push({
        householdId: candidate.profile.id,
        eligible: true,
        priorityTier: candidate.tier,
        priorityCode: candidate.code,
        amountCents: amount,
        feeCents: fee,
        reasonCodes: reasons,
        needsReview,
      });
    }
  }

  return {
    policyVersion: policy.version,
    tranche,
    totalAllocatableCents: allocatableCents,
    totalCommittedCents: totalCommitted,
    totalFeesCents: totalFees,
    fundedHouseholds: funded,
    waitlistedHouseholds: waitlisted,
    ineligibleHouseholds: ineligible,
  };
}

export function evaluateTranche1({
  households,
  allocatableCents,
  config,
}: {
  households: HouseholdProfile[];
  allocatableCents: number;
  config: PolicyConfig;
}): PolicyEvaluationResult {
  return evaluatePolicy({
    households,
    policy: config,
    allocatableCents,
    tranche: 1,
  });
}

export function evaluateTranche2({
  households,
  allocatableCents,
  config,
}: {
  households: HouseholdProfile[];
  allocatableCents: number;
  config: PolicyConfig;
}): PolicyEvaluationResult {
  return evaluatePolicy({
    households,
    policy: config,
    allocatableCents,
    tranche: 2,
  });
}
