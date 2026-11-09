/**
 * SEASONAL RECONFIRMATION ("STILL HERE?") (§4.4)
 * Invariants:
 * 1. Tranche 1 anticipatory payouts require active confirmation within the past 12 months (365 days).
 * 2. Overdue reconfirmations hold the household for review; they NEVER lower priority tier or delete records.
 * 3. Grace period (30 days) allows automated notification before holding payment.
 */

export const RECONFIRMATION_MAX_AGE_DAYS = 365;
export const RECONFIRMATION_GRACE_PERIOD_DAYS = 30;

export interface ReconfirmationStatus {
  isValid: boolean;
  isOverdue: boolean;
  isInGracePeriod: boolean;
  daysSinceLastReconfirmed: number;
  daysRemaining: number;
  recommendation: "ELIGIBLE" | "REMINDER_REQUIRED" | "HOLD_FOR_REVIEW";
}

/**
 * Evaluates whether a household's reconfirmation is still valid for Tranche 1 payouts.
 */
export function evaluateReconfirmation(
  lastReconfirmedAt: string | Date | null | undefined,
  now: Date = new Date()
): ReconfirmationStatus {
  if (!lastReconfirmedAt) {
    return {
      isValid: false,
      isOverdue: true,
      isInGracePeriod: false,
      daysSinceLastReconfirmed: Infinity,
      daysRemaining: 0,
      recommendation: "HOLD_FOR_REVIEW",
    };
  }

  const reconfirmedDate =
    typeof lastReconfirmedAt === "string" ? new Date(lastReconfirmedAt) : lastReconfirmedAt;
  const diffMs = now.getTime() - reconfirmedDate.getTime();
  const daysSince = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const daysRemaining = RECONFIRMATION_MAX_AGE_DAYS - daysSince;

  if (daysSince < 0) {
    // Clock skew protection: future timestamp treated as current
    return {
      isValid: true,
      isOverdue: false,
      isInGracePeriod: false,
      daysSinceLastReconfirmed: 0,
      daysRemaining: RECONFIRMATION_MAX_AGE_DAYS,
      recommendation: "ELIGIBLE",
    };
  }

  if (daysSince <= RECONFIRMATION_MAX_AGE_DAYS - RECONFIRMATION_GRACE_PERIOD_DAYS) {
    return {
      isValid: true,
      isOverdue: false,
      isInGracePeriod: false,
      daysSinceLastReconfirmed: daysSince,
      daysRemaining,
      recommendation: "ELIGIBLE",
    };
  }

  if (daysSince <= RECONFIRMATION_MAX_AGE_DAYS) {
    return {
      isValid: true,
      isOverdue: false,
      isInGracePeriod: true,
      daysSinceLastReconfirmed: daysSince,
      daysRemaining,
      recommendation: "REMINDER_REQUIRED",
    };
  }

  return {
    isValid: false,
    isOverdue: true,
    isInGracePeriod: false,
    daysSinceLastReconfirmed: daysSince,
    daysRemaining: 0,
    recommendation: "HOLD_FOR_REVIEW",
  };
}

/**
 * Simple boolean check: valid if within 365 days.
 */
export function isReconfirmationValid(
  lastReconfirmedAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  return evaluateReconfirmation(lastReconfirmedAt, now).isValid;
}
