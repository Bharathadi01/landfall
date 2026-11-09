/**
 * PRE-DISASTER READINESS MONITOR ENGINE (§4, §10, Priority 1)
 * Evaluates operational readiness across four independent pillars:
 * 1. Financial Readiness (captured balance, reserve floor, fee buffer, shortfall)
 * 2. Recipient Readiness (enrollments, geo-verification, payment routes, reconfirmation)
 * 3. Operational Readiness (dual-custody keys, emergency stop status)
 * 4. Hazard Data Readiness (Sentinel feed freshness, polygon validity, trigger criteria)
 */

export interface FinancialReadinessPillar {
  totalCashCents: number;
  reserveFloorCents: number;
  feeBufferCents: number;
  allocatableCents: number;
  estimatedDemandCents: number;
  shortfallCents: number;
  isSolvent: boolean;
  score: number; // 0 - 100
  blockingReasons: string[];
}

export interface RecipientReadinessPillar {
  totalEnrolled: number;
  geoVerifiedCount: number;
  paymentRouteVerifiedCount: number;
  staleEnrollmentCount: number; // not reconfirmed in > 90 days
  readyForDisbursementCount: number;
  score: number; // 0 - 100
  blockingReasons: string[];
}

export interface OperationalReadinessPillar {
  isEmergencyStopActive: boolean;
  hasOperationsApprover: boolean;
  hasFinanceApprover: boolean;
  registeredPasskeysCount: number;
  isDualCustodyReady: boolean;
  score: number; // 0 - 100
  blockingReasons: string[];
}

export interface HazardReadinessPillar {
  isSentinelFeedFresh: boolean;
  lastPollTimestamp?: string;
  hasActiveDisasterAlert: boolean;
  isGeometryValid: boolean;
  polygonVertexCount: number;
  triggerPhenomenonMatched: boolean;
  matchedPhenomena?: string;
  score: number; // 0 - 100
  blockingReasons: string[];
}

export interface ReadinessEvaluationResult {
  overallScore: number; // 0 - 100
  status: "READY" | "DEGRADED" | "BLOCKED";
  evaluatedAt: string;
  financial: FinancialReadinessPillar;
  recipient: RecipientReadinessPillar;
  operational: OperationalReadinessPillar;
  hazard: HazardReadinessPillar;
  allBlockingReasons: string[];
  actionableChecklist: Array<{
    pillar: "FINANCIAL" | "RECIPIENT" | "OPERATIONAL" | "HAZARD";
    title: string;
    isSatisfied: boolean;
    detail: string;
  }>;
}

export interface ReadinessMonitorParams {
  treasury: {
    totalCashCents: number;
    reserveFloorPercentage?: number; // default 0.30 (30%)
    feeReservePerItemCents?: number; // default 250 cents ($2.50)
    committedCents?: number;
  };
  recipients: Array<{
    id: string;
    lat: number;
    lng: number;
    hasVerifiedEmailOrPayPal: boolean;
    lastReconfirmedAt?: string; // ISO date
  }>;
  operational: {
    emergencyStopActive: boolean;
    operators: Array<{
      id: string;
      role: "coordinator" | "finance" | "admin";
      hasPasskeyRegistered: boolean;
    }>;
  };
  hazard: {
    lastPollAgeMinutes: number; // minutes since last NWS poll
    activeAlert?: {
      eventKey: string;
      phenomena: string; // e.g. "HU", "SS", "FF"
      significance: string; // e.g. "W"
      polygonCoordinates?: number[][];
    };
  };
}

/**
 * Deterministically evaluates four-pillar operational readiness.
 */
export function evaluateReadiness(params: ReadinessMonitorParams): ReadinessEvaluationResult {
  const evaluatedAt = new Date().toISOString();
  const actionableChecklist: ReadinessEvaluationResult["actionableChecklist"] = [];
  const allBlockingReasons: string[] = [];

  // --- 1. FINANCIAL READINESS ---
  const { totalCashCents, committedCents = 0 } = params.treasury;
  const reserveFloorRatio = params.treasury.reserveFloorPercentage ?? 0.3;
  const feePerItem = params.treasury.feeReservePerItemCents ?? 250;

  const reserveFloorCents = Math.round(totalCashCents * reserveFloorRatio);
  const eligibleRecipientsCount = params.recipients.length;
  const estimatedDemandCents = eligibleRecipientsCount * 10000; // $100 per household baseline
  const feeBufferCents = eligibleRecipientsCount * feePerItem;

  const allocatableCents = Math.max(0, totalCashCents - reserveFloorCents - feeBufferCents - committedCents);
  const shortfallCents = Math.max(0, estimatedDemandCents - allocatableCents);
  const isSolvent = totalCashCents > 0 && allocatableCents > 0;

  const financialBlockingReasons: string[] = [];
  if (totalCashCents <= 0) {
    financialBlockingReasons.push("Treasury has zero available cash balance.");
  }
  if (shortfallCents > 0 && allocatableCents === 0) {
    financialBlockingReasons.push("Zero allocatable cash after reserve floor and fee buffer deductions.");
  }

  const financialScore = totalCashCents === 0
    ? 0
    : shortfallCents === 0
    ? 100
    : Math.max(10, Math.round((allocatableCents / (estimatedDemandCents || 1)) * 100));

  actionableChecklist.push({
    pillar: "FINANCIAL",
    title: "Treasury Solvency & Reserve Floor",
    isSatisfied: isSolvent && financialBlockingReasons.length === 0,
    detail: `$${(allocatableCents / 100).toFixed(2)} allocatable ($${(reserveFloorCents / 100).toFixed(2)} protected in reserve)`,
  });

  const financialPillar: FinancialReadinessPillar = {
    totalCashCents,
    reserveFloorCents,
    feeBufferCents,
    allocatableCents,
    estimatedDemandCents,
    shortfallCents,
    isSolvent,
    score: financialScore,
    blockingReasons: financialBlockingReasons,
  };

  // --- 2. RECIPIENT READINESS ---
  const recipientBlockingReasons: string[] = [];
  let geoVerifiedCount = 0;
  let paymentRouteVerifiedCount = 0;
  let staleEnrollmentCount = 0;
  const nowMs = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  for (const r of params.recipients) {
    // Geo check
    if (r.lat !== 0 && r.lng !== 0 && !isNaN(r.lat) && !isNaN(r.lng)) {
      geoVerifiedCount++;
    }
    // Payment route check
    if (r.hasVerifiedEmailOrPayPal) {
      paymentRouteVerifiedCount++;
    }
    // Stale check
    if (r.lastReconfirmedAt) {
      const reconfirmedMs = new Date(r.lastReconfirmedAt).getTime();
      if (nowMs - reconfirmedMs > ninetyDaysMs) {
        staleEnrollmentCount++;
      }
    }
  }

  const readyForDisbursementCount = params.recipients.filter(
    (r) => r.hasVerifiedEmailOrPayPal && r.lat !== 0 && r.lng !== 0
  ).length;

  if (params.recipients.length === 0) {
    recipientBlockingReasons.push("Zero enrolled households in active directory.");
  } else if (readyForDisbursementCount === 0) {
    recipientBlockingReasons.push("No enrolled households have both verified location and payment route.");
  }

  const recipientScore = params.recipients.length === 0
    ? 0
    : Math.round((readyForDisbursementCount / params.recipients.length) * 100);

  actionableChecklist.push({
    pillar: "RECIPIENT",
    title: "Household Enrollment & Verification",
    isSatisfied: readyForDisbursementCount > 0 && recipientBlockingReasons.length === 0,
    detail: `${readyForDisbursementCount} of ${params.recipients.length} recipients verified for instant disbursement`,
  });

  const recipientPillar: RecipientReadinessPillar = {
    totalEnrolled: params.recipients.length,
    geoVerifiedCount,
    paymentRouteVerifiedCount,
    staleEnrollmentCount,
    readyForDisbursementCount,
    score: recipientScore,
    blockingReasons: recipientBlockingReasons,
  };

  // --- 3. OPERATIONAL READINESS ---
  const operationalBlockingReasons: string[] = [];
  if (params.operational.emergencyStopActive) {
    operationalBlockingReasons.push("EMERGENCY STOP is active! All disbursements are globally locked.");
  }

  const opsApprovers = params.operational.operators.filter(
    (op) => (op.role === "coordinator" || op.role === "admin") && op.hasPasskeyRegistered
  );
  const finApprovers = params.operational.operators.filter(
    (op) => (op.role === "finance" || op.role === "admin") && op.hasPasskeyRegistered
  );

  const hasOperationsApprover = opsApprovers.length > 0;
  const hasFinanceApprover = finApprovers.length > 0;
  const registeredPasskeysCount = params.operational.operators.filter((op) => op.hasPasskeyRegistered).length;
  const isDualCustodyReady = hasOperationsApprover && hasFinanceApprover && !params.operational.emergencyStopActive;

  if (!hasOperationsApprover) {
    operationalBlockingReasons.push("Missing registered Operations Coordinator WebAuthn passkey.");
  }
  if (!hasFinanceApprover) {
    operationalBlockingReasons.push("Missing registered Finance/Fiduciary Officer WebAuthn passkey.");
  }

  let operationalScore = 100;
  if (params.operational.emergencyStopActive) operationalScore = 0;
  else if (!isDualCustodyReady) operationalScore = 30;

  actionableChecklist.push({
    pillar: "OPERATIONAL",
    title: "Dual-Custody Passkey Governance",
    isSatisfied: isDualCustodyReady,
    detail: isDualCustodyReady
      ? "Two-key passkey signatories registered (Ops Lead + Finance Officer)"
      : "Dual custody quorum incomplete or emergency stop engaged",
  });

  const operationalPillar: OperationalReadinessPillar = {
    isEmergencyStopActive: params.operational.emergencyStopActive,
    hasOperationsApprover,
    hasFinanceApprover,
    registeredPasskeysCount,
    isDualCustodyReady,
    score: operationalScore,
    blockingReasons: operationalBlockingReasons,
  };

  // --- 4. HAZARD DATA READINESS ---
  const hazardBlockingReasons: string[] = [];
  const isSentinelFeedFresh = params.hazard.lastPollAgeMinutes <= 60; // fresh within 1 hour
  if (!isSentinelFeedFresh) {
    hazardBlockingReasons.push(`Sentinel NWS feed is stale (last polled ${params.hazard.lastPollAgeMinutes} minutes ago).`);
  }

  const alert = params.hazard.activeAlert;
  const hasActiveDisasterAlert = Boolean(alert);
  const polygonCoords = alert?.polygonCoordinates || [];
  const isGeometryValid = polygonCoords.length >= 3;
  const supportedPhenomena = ["HU", "SS", "FF", "TO"];
  const triggerPhenomenonMatched = Boolean(alert && supportedPhenomena.includes(alert.phenomena));

  if (!hasActiveDisasterAlert) {
    hazardBlockingReasons.push("No active Sentinel disaster warning detected for monitored area.");
  } else {
    if (!isGeometryValid) {
      hazardBlockingReasons.push("Disaster warning geometry polygon is missing or has fewer than 3 vertices.");
    }
    if (!triggerPhenomenonMatched) {
      hazardBlockingReasons.push(`Warning phenomenon '${alert?.phenomena}' does not match anticipatory trigger list (${supportedPhenomena.join(", ")}).`);
    }
  }

  let hazardScore = 0;
  if (isSentinelFeedFresh) hazardScore += 40;
  if (hasActiveDisasterAlert) hazardScore += 20;
  if (isGeometryValid) hazardScore += 20;
  if (triggerPhenomenonMatched) hazardScore += 20;

  actionableChecklist.push({
    pillar: "HAZARD",
    title: "Sentinel Warning & Track Telemetry",
    isSatisfied: isSentinelFeedFresh && hasActiveDisasterAlert && isGeometryValid && triggerPhenomenonMatched,
    detail: hasActiveDisasterAlert
      ? `${alert?.phenomena}.${alert?.significance} Warning active with valid polygon (${polygonCoords.length} vertices)`
      : "Sentinel standing by for National Weather Service trigger alerts",
  });

  const hazardPillar: HazardReadinessPillar = {
    isSentinelFeedFresh,
    lastPollTimestamp: new Date(Date.now() - params.hazard.lastPollAgeMinutes * 60000).toISOString(),
    hasActiveDisasterAlert,
    isGeometryValid,
    polygonVertexCount: polygonCoords.length,
    triggerPhenomenonMatched,
    matchedPhenomena: alert?.phenomena,
    score: hazardScore,
    blockingReasons: hazardBlockingReasons,
  };

  // Overall Score is weighted average: Financial (30%), Operational (30%), Recipient (20%), Hazard (20%)
  const overallScore = Math.round(
    financialScore * 0.3 +
    operationalScore * 0.3 +
    recipientScore * 0.2 +
    hazardScore * 0.2
  );

  allBlockingReasons.push(
    ...financialBlockingReasons,
    ...recipientBlockingReasons,
    ...operationalBlockingReasons,
    ...hazardBlockingReasons
  );

  let status: ReadinessEvaluationResult["status"] = "READY";
  if (operationalPillar.isEmergencyStopActive || !isSolvent || !isDualCustodyReady) {
    status = "BLOCKED";
  } else if (overallScore < 70 || allBlockingReasons.length > 0) {
    status = "DEGRADED";
  }

  return {
    overallScore,
    status,
    evaluatedAt,
    financial: financialPillar,
    recipient: recipientPillar,
    operational: operationalPillar,
    hazard: hazardPillar,
    allBlockingReasons,
    actionableChecklist,
  };
}

