/**
 * VERSIONED RESPONSE PROTOCOL ENGINE (§4, §10, Priority 1)
 * Immutable humanitarian response protocols governing anticipatory cash relief triggers,
 * reserve floor ratios, payout tranches, priority weighting, and false-alarm cancellations.
 *
 * Invariants:
 * - Protocols are versioned and immutable once published.
 * - False alarms allow graceful rollback: uncommitted funds return to allocatable treasury.
 * - Committed funds that were already submitted to PayPal cannot be retracted unilaterally;
 *   they follow PayPal's item unclaimed/returned lifecycle.
 */

export interface ProtocolHazardCriteria {
  supportedPhenomena: Array<"HU" | "SS" | "FF" | "TO">;
  minSeverity: "Moderate" | "Severe" | "Extreme";
  minSignificance: "W" | "A"; // Warning or Advisory
  maxForecastLeadTimeHours: number; // e.g. 72 hours
}

export interface ProtocolFinancialRules {
  reserveFloorRatio: number; // e.g. 0.30 (30% protected)
  feeReservePerDisbursementCents: number; // e.g. 250 ($2.50)
  tranche1BaselineAmountCents: number; // e.g. 10000 ($100)
  tranche2MaxAmountCents: number; // e.g. 40000 ($400)
}

export interface ProtocolTierWeights {
  tier1MedicalDevice: number;
  tier2ElderlyAlone: number;
  tier3DisabilityOrInfant: number;
  tier4FloodZoneEvac: number;
  tier5StandardExposed: number;
}

export interface ResponseProtocol {
  protocolId: string;
  name: string;
  version: string;
  geographicRegion: string;
  hazardCriteria: ProtocolHazardCriteria;
  financialRules: ProtocolFinancialRules;
  tierWeights: ProtocolTierWeights;
  isActive: boolean;
  publishedAt: string;
}

/**
 * Standard Florida Gulf Coast Hurricane & Surge Protocol (2024-2026).
 */
export const FLORIDA_HURRICANE_PROTOCOL_V1: ResponseProtocol = {
  protocolId: "proto_fl_tropical_v1",
  name: "Florida Gulf Coast Hurricane & Storm Surge Protocol",
  version: "1.2.0",
  geographicRegion: "FL_GULF_COAST",
  hazardCriteria: {
    supportedPhenomena: ["HU", "SS", "FF"],
    minSeverity: "Severe",
    minSignificance: "W", // Hurricane Warning or Storm Surge Warning
    maxForecastLeadTimeHours: 72,
  },
  financialRules: {
    reserveFloorRatio: 0.3, // 30% floor preserved for community continuity
    feeReservePerDisbursementCents: 250, // $2.50 reserve per disbursement
    tranche1BaselineAmountCents: 10000, // $100 anticipatory pre-landfall cash
    tranche2MaxAmountCents: 40000, // Up to $400 post-landfall relief
  },
  tierWeights: {
    tier1MedicalDevice: 100,
    tier2ElderlyAlone: 80,
    tier3DisabilityOrInfant: 60,
    tier4FloodZoneEvac: 40,
    tier5StandardExposed: 20,
  },
  isActive: true,
  publishedAt: "2024-06-01T00:00:00.000Z",
};

export interface FalseAlarmCancellationRequest {
  activationId: string;
  reason: "FORECAST_DOWNGRADE" | "TRACK_DIVERGENCE" | "NWS_CANCEL_ALERT" | "DRILL_COMPLETED";
  cancellationNote: string;
  canceledBy: {
    operatorId: string;
    role: "coordinator" | "finance" | "admin";
  };
  currentPlanState: "draft" | "approved_1" | "approved_2" | "submitted" | "executed";
  committedCents: number;
}

export interface FalseAlarmCancellationResult {
  success: boolean;
  activationId: string;
  actionTaken: "UNCOMMITTED_RESERVES_RELEASED" | "ALREADY_SUBMITTED_CANNOT_UNCOMMIT" | "INVALID_ROLE";
  releasedCents: number;
  message: string;
  auditRecord: {
    timestamp: string;
    operatorId: string;
    reason: string;
    releasedCents: number;
  };
}

/**
 * Evaluates whether an incoming alert matches a protocol's trigger criteria.
 */
export function evaluateProtocolMatch(
  protocol: ResponseProtocol,
  alert: { phenomena: string; significance: string; severity?: string }
): { isMatch: boolean; failureReasons: string[] } {
  const failureReasons: string[] = [];

  if (!protocol.hazardCriteria.supportedPhenomena.includes(alert.phenomena as any)) {
    failureReasons.push(
      `Phenomenon '${alert.phenomena}' not supported by protocol '${protocol.name}'. Supported: ${protocol.hazardCriteria.supportedPhenomena.join(", ")}`
    );
  }

  if (alert.significance !== protocol.hazardCriteria.minSignificance) {
    failureReasons.push(
      `Significance '${alert.significance}' does not meet required '${protocol.hazardCriteria.minSignificance}' (Warning).`
    );
  }

  return {
    isMatch: failureReasons.length === 0,
    failureReasons,
  };
}

/**
 * Executes a false-alarm cancellation and releases uncommitted reserves back to treasury.
 */
export function cancelAndReleaseAllocations(
  req: FalseAlarmCancellationRequest
): FalseAlarmCancellationResult {
  const timestamp = new Date().toISOString();

  // Role validation: only coordinator or admin can cancel activations
  if (req.canceledBy.role !== "coordinator" && req.canceledBy.role !== "admin") {
    return {
      success: false,
      activationId: req.activationId,
      actionTaken: "INVALID_ROLE",
      releasedCents: 0,
      message: "Only Incident Coordinators or Administrators can issue a false alarm cancellation.",
      auditRecord: {
        timestamp,
        operatorId: req.canceledBy.operatorId,
        reason: req.reason,
        releasedCents: 0,
      },
    };
  }

  // If the plan was already submitted or executed to PayPal, uncommitted reserves cannot be rolled back locally
  if (req.currentPlanState === "submitted" || req.currentPlanState === "executed") {
    return {
      success: false,
      activationId: req.activationId,
      actionTaken: "ALREADY_SUBMITTED_CANNOT_UNCOMMIT",
      releasedCents: 0,
      message: `Cannot cancel activation: payout plan is in state '${req.currentPlanState}' and has already been dispatched to PayPal. Unclaimed funds must follow webhook returns.`,
      auditRecord: {
        timestamp,
        operatorId: req.canceledBy.operatorId,
        reason: req.reason,
        releasedCents: 0,
      },
    };
  }

  // Success: funds were unsubmitted (draft or approved), release committed funds back
  const releasedCents = req.committedCents;

  return {
    success: true,
    activationId: req.activationId,
    actionTaken: "UNCOMMITTED_RESERVES_RELEASED",
    releasedCents,
    message: `False alarm confirmed. Released $${(releasedCents / 100).toFixed(2)} uncommitted reserves back to treasury pool.`,
    auditRecord: {
      timestamp,
      operatorId: req.canceledBy.operatorId,
      reason: req.reason,
      releasedCents,
    },
  };
}

