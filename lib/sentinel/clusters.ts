/**
 * PRIVACY-PRESERVING HOUSEHOLD EXPOSURE CLUSTERING (§6)
 * Invariants:
 * 1. Aggregates households into zone/cell clusters to protect private residential locations.
 * 2. Deterministic Turf.js polygon intersection only. AI never determines exposure.
 * 3. Never leaks recipient identity, exact lat/lng or street addresses to public dashboard.
 */

import { type SyntheticHousehold } from "@/lib/fixtures/households";
import { isPointInsideAlertGeometry, type GeoPoint } from "@/lib/geo/resolver";
import type { NormalizedAlert } from "./types";

export interface ExposureCluster {
  clusterId: string;
  clusterName: string;
  zone: string;
  centroid: GeoPoint;
  totalHouseholds: number;
  confirmedExposedCount: number;
  unexposedCount: number;
  needsReviewCount: number;
  medicalDeviceCount: number;
  elderlyLivingAloneCount: number;
  displacedCount: number;
  highestSeverity: "Extreme" | "Severe" | "Moderate" | "Minor" | "None";
  activePhenomena: string[];
}

export interface ClusterExposureSummary {
  totalHouseholds: number;
  totalExposed: number;
  totalUnexposed: number;
  totalNeedsReview: number;
  exposedByZone: Record<string, number>;
  exposedBySeverity: Record<string, number>;
  medicalDevicesExposed: number;
  clusters: ExposureCluster[];
  evaluatedAt: string;
}

/**
 * Deterministically evaluates exposure for synthetic households and clusters them for privacy-preserving visualization.
 */
export function buildPrivacyPreservingClusters(
  households: SyntheticHousehold[],
  activeAlerts: NormalizedAlert[]
): ClusterExposureSummary {
  const evaluatedAt = new Date().toISOString();
  const warningAlerts = activeAlerts.filter(
    (a) => a.significance === "W" || a.isTranche1Eligible
  );

  // Group households by zone for privacy preservation
  const zoneGroups = new Map<string, SyntheticHousehold[]>();
  for (const hh of households) {
    const key = hh.zone || "General Service Area";
    if (!zoneGroups.has(key)) {
      zoneGroups.set(key, []);
    }
    zoneGroups.get(key)!.push(hh);
  }

  const clusters: ExposureCluster[] = [];
  let totalExposed = 0;
  let totalUnexposed = 0;
  let totalNeedsReview = 0;
  let medicalDevicesExposed = 0;
  const exposedByZone: Record<string, number> = {};
  const exposedBySeverity: Record<string, number> = {
    Extreme: 0,
    Severe: 0,
    Moderate: 0,
    Minor: 0,
  };

  for (const [zone, group] of zoneGroups.entries()) {
    let groupExposed = 0;
    let groupUnexposed = 0;
    let groupNeedsReview = 0;
    let groupMedical = 0;
    let groupElderly = 0;
    let groupDisplaced = 0;
    let latSum = 0;
    let lngSum = 0;
    const phenomenaSet = new Set<string>();
    let highestSeverity: "Extreme" | "Severe" | "Moderate" | "Minor" | "None" = "None";

    for (const hh of group) {
      latSum += hh.lat;
      lngSum += hh.lng;

      if (hh.hasMedicalDevice) groupMedical++;
      if (hh.isElderlyLivingAlone) groupElderly++;

      // Evaluate against active warning alerts using Turf.js point-in-polygon
      const pt: GeoPoint = { lat: hh.lat, lng: hh.lng };
      let isInside = false;

      for (const alert of warningAlerts) {
        if (alert.geometry && isPointInsideAlertGeometry(pt, alert.geometry)) {
          isInside = true;
          phenomenaSet.add(alert.phenomena || alert.event);
          if (alert.severity === "Extreme") highestSeverity = "Extreme";
          else if (alert.severity === "Severe" && highestSeverity !== "Extreme") highestSeverity = "Severe";
          else if (alert.severity === "Moderate" && highestSeverity !== "Extreme" && highestSeverity !== "Severe") {
            highestSeverity = "Moderate";
          }
        }
      }

      if (warningAlerts.length === 0) {
        // No active warnings in effect
        groupUnexposed++;
        totalUnexposed++;
      } else if (isInside) {
        groupExposed++;
        totalExposed++;
        if (hh.hasMedicalDevice) medicalDevicesExposed++;
        exposedByZone[zone] = (exposedByZone[zone] || 0) + 1;
        if (highestSeverity !== "None") {
          exposedBySeverity[highestSeverity] = (exposedBySeverity[highestSeverity] || 0) + 1;
        }
      } else {
        groupUnexposed++;
        totalUnexposed++;
      }
    }

    const count = group.length;
    clusters.push({
      clusterId: `cluster_${zone.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      clusterName: `${zone} Cluster`,
      zone,
      centroid: {
        lat: Number((latSum / count).toFixed(4)),
        lng: Number((lngSum / count).toFixed(4)),
      },
      totalHouseholds: count,
      confirmedExposedCount: groupExposed,
      unexposedCount: groupUnexposed,
      needsReviewCount: groupNeedsReview,
      medicalDeviceCount: groupMedical,
      elderlyLivingAloneCount: groupElderly,
      displacedCount: groupDisplaced,
      highestSeverity,
      activePhenomena: Array.from(phenomenaSet),
    });
  }

  return {
    totalHouseholds: households.length,
    totalExposed,
    totalUnexposed,
    totalNeedsReview,
    exposedByZone,
    exposedBySeverity,
    medicalDevicesExposed,
    clusters,
    evaluatedAt,
  };
}

