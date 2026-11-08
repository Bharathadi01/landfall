import { HouseholdProfile, EvaluatedHousehold } from "./engine";

export interface EquityCategoryBreakdown {
  key: string;
  totalEligible: number;
  funded: number;
  fundedRatePct: number;
  isDisparateImpact: boolean; // True if fundedRatePct < 0.8 * overallRatePct
}

export interface EquityReport {
  overallFundedRatePct: number;
  threshold80Pct: number;
  byLanguage: EquityCategoryBreakdown[];
  byRecipientPath: EquityCategoryBreakdown[];
  byZone: EquityCategoryBreakdown[];
  byEvidenceLevel: EquityCategoryBreakdown[];
  disparateImpactDetected: boolean;
  notes: string[];
}

export function generateEquityReport({
  households,
  fundedList,
  waitlistedList,
}: {
  households: HouseholdProfile[];
  fundedList: EvaluatedHousehold[];
  waitlistedList: EvaluatedHousehold[];
}): EquityReport {
  const eligibleIds = new Set([
    ...fundedList.map((f) => f.householdId),
    ...waitlistedList.map((w) => w.householdId),
  ]);
  const fundedIds = new Set(fundedList.map((f) => f.householdId));

  const eligibleProfiles = households.filter((h) => eligibleIds.has(h.id));
  const totalEligible = eligibleProfiles.length;
  const totalFunded = fundedList.length;

  const overallRate = totalEligible > 0 ? (totalFunded / totalEligible) * 100 : 0;
  const threshold80Pct = overallRate * 0.8;

  function computeBreakdown<T extends keyof HouseholdProfile>(field: T): EquityCategoryBreakdown[] {
    const groups: Record<string, { total: number; funded: number }> = {};

    for (const p of eligibleProfiles) {
      const val = String(p[field]);
      if (!groups[val]) {
        groups[val] = { total: 0, funded: 0 };
      }
      groups[val].total += 1;
      if (fundedIds.has(p.id)) {
        groups[val].funded += 1;
      }
    }

    return Object.entries(groups).map(([key, data]) => {
      const rate = (data.funded / data.total) * 100;
      return {
        key,
        totalEligible: data.total,
        funded: data.funded,
        fundedRatePct: Math.round(rate * 10) / 10,
        isDisparateImpact: rate < threshold80Pct && data.total >= 3, // require sample >= 3
      };
    });
  }

  const byLanguage = computeBreakdown("language");
  const byRecipientPath = computeBreakdown("recipientPath");
  const byZone = computeBreakdown("zone");
  const byEvidenceLevel = computeBreakdown("evidenceLevel");

  const notes: string[] = [];
  let disparateImpactDetected = false;

  const allBreakdowns = [...byLanguage, ...byRecipientPath, ...byZone, ...byEvidenceLevel];
  for (const b of allBreakdowns) {
    if (b.isDisparateImpact) {
      disparateImpactDetected = true;
      notes.push(
        `Disparate impact warning: Group '${b.key}' has funded rate of ${b.fundedRatePct}%, which is below 80% of overall rate (${Math.round(threshold80Pct * 10) / 10}% threshold).`
      );
    }
  }

  return {
    overallFundedRatePct: Math.round(overallRate * 10) / 10,
    threshold80Pct: Math.round(threshold80Pct * 10) / 10,
    byLanguage,
    byRecipientPath,
    byZone,
    byEvidenceLevel,
    disparateImpactDetected,
    notes,
  };
}
