/**
 * HUMANITARIAN APPEALS & COMMUNITY ACCOUNTABILITY SYSTEM (§11, Priority 3)
 * Handles complaints, exclusion disputes, payment routing changes, and vulnerability appeals.
 *
 * Invariant: Material Change Plan Invalidation
 * If an appeal is resolved and alters household eligibility, tier, or payout routing,
 * any unsubmitted plan referencing this household is immediately invalidated and
 * requires a fresh evaluation and dual-custody re-signature.
 */

export type ComplaintCategory =
  | "EXCLUSION_DISPUTE"
  | "PAYMENT_METHOD_CHANGE"
  | "VULNERABILITY_UPDATE"
  | "UNCLAIMED_ASSISTANCE"
  | "GENERAL_INQUIRY";

export type ComplaintStatus =
  | "RECEIVED"
  | "ACKNOWLEDGED"
  | "UNDER_REVIEW"
  | "ACTION_REQUIRED"
  | "RESOLVED"
  | "REJECTED";

export interface RecipientComplaint {
  complaintId: string;
  householdId: string;
  category: ComplaintCategory;
  description: string;
  submittedAt: string;
  updatedAt: string;
  status: ComplaintStatus;
  contactEmail: string;
  resolutionDetails?: {
    resolvedBy: string;
    resolvedAt: string;
    actionTaken: string;
    isMaterialChange: boolean;
    tierAdjustment?: number;
    newReceiverAddress?: string;
  };
}

export interface PlanInvalidationCheck {
  shouldInvalidatePlan: boolean;
  reason?: string;
  affectedHouseholdId?: string;
}

/**
 * Checks whether resolving an appeal materially alters the pending payout plan,
 * requiring plan invalidation and fresh dual-custody approval.
 */
export function checkPlanInvalidation(
  complaint: RecipientComplaint,
  planHouseholdIds: string[]
): PlanInvalidationCheck {
  if (complaint.status !== "RESOLVED" || !complaint.resolutionDetails) {
    return { shouldInvalidatePlan: false };
  }

  const { isMaterialChange } = complaint.resolutionDetails;
  const isHouseholdInPlan = planHouseholdIds.includes(complaint.householdId);

  // If the appeal resolved with a material change (tier adjustment or payment method)
  // and the household is part of the pending plan, or if an excluded household was restored
  if (isMaterialChange) {
    return {
      shouldInvalidatePlan: true,
      reason: `Material change from resolved appeal ${complaint.complaintId} (Category: ${complaint.category}) alters plan allocation for household ${complaint.householdId}.`,
      affectedHouseholdId: complaint.householdId,
    };
  }

  return { shouldInvalidatePlan: false };
}

/**
 * Creates and logs a new recipient appeal or complaint.
 */
export function registerComplaint(params: {
  householdId: string;
  category: ComplaintCategory;
  description: string;
  contactEmail: string;
}): RecipientComplaint {
  const now = new Date().toISOString();
  return {
    complaintId: `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    householdId: params.householdId,
    category: params.category,
    description: params.description,
    submittedAt: now,
    updatedAt: now,
    status: "RECEIVED",
    contactEmail: params.contactEmail,
  };
}

/**
 * Resolves an appeal and indicates if it represents a material change to beneficiary status.
 */
export function resolveComplaint(
  complaint: RecipientComplaint,
  resolution: {
    resolvedBy: string;
    actionTaken: string;
    isMaterialChange: boolean;
    tierAdjustment?: number;
    newReceiverAddress?: string;
  }
): RecipientComplaint {
  const now = new Date().toISOString();
  return {
    ...complaint,
    status: "RESOLVED",
    updatedAt: now,
    resolutionDetails: {
      ...resolution,
      resolvedAt: now,
    },
  };
}

