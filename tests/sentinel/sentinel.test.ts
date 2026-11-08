import { describe, it, expect } from "vitest";
import {
  normalizeNWSAlert,
  confirmHouseholdExposure,
  isWeatherFeedStale,
  loadMiltonHistoricalReplay,
} from "@/lib/sentinel/index";
import { isPointInsideAlertGeometry } from "@/lib/geo/resolver";

describe("Sentinel Weather Engine & Replay (§4.3)", () => {
  const sampleWarningAlert = {
    id: "alert_milton_hu_w",
    properties: {
      event: "Hurricane Warning",
      headline: "Hurricane Warning issued for Tampa Bay",
      status: "Actual",
      messageType: "Alert",
      vtec: "/O.NEW.KTBW.HU.W.0009.241009T1200Z-241010T1800Z/",
      effective: "2024-10-09T12:00:00Z",
      expires: "2024-10-10T18:00:00Z",
      areaDesc: "Tampa Bay coastal areas",
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [-82.85, 27.65],
          [-82.35, 27.65],
          [-82.35, 28.15],
          [-82.85, 28.15],
          [-82.85, 27.65],
        ],
      ],
    },
  };

  describe("VTEC Normalization & Tranche 1 Triggers", () => {
    it("normalizes VTEC into a canonical eventKey", () => {
      const normalized = normalizeNWSAlert(sampleWarningAlert);
      expect(normalized.eventKey).toBe("TBW:HU.W:0009");
      expect(normalized.phenomena).toBe("HU");
      expect(normalized.significance).toBe("W");
      expect(normalized.isTranche1Eligible).toBe(true);
    });

    it("rejects Watches and Advisories from triggering Tranche 1", () => {
      const watchAlert = {
        ...sampleWarningAlert,
        properties: {
          ...sampleWarningAlert.properties,
          event: "Hurricane Watch",
          vtec: "/O.NEW.KTBW.HU.A.0009.241008T1200Z-241009T1200Z/",
        },
      };

      const normalized = normalizeNWSAlert(watchAlert);
      expect(normalized.significance).toBe("A");
      expect(normalized.isTranche1Eligible).toBe(false); // Watches are informational only!
    });

    it("rejects test and exercise alerts from triggering Tranche 1", () => {
      const testAlert = {
        ...sampleWarningAlert,
        properties: {
          ...sampleWarningAlert.properties,
          status: "Test",
        },
      };

      const normalized = normalizeNWSAlert(testAlert);
      expect(normalized.isTranche1Eligible).toBe(false);
    });
  });

  describe("Geographic Point Resolution", () => {
    it("detects when a household is inside the warning polygon", () => {
      // Point in Downtown Tampa: lat 27.95, lng -82.45 (inside bounding box)
      const insidePoint = { lat: 27.95, lng: -82.45 };
      const isInside = isPointInsideAlertGeometry(insidePoint, sampleWarningAlert.geometry);
      expect(isInside).toBe(true);
    });

    it("detects when a household is outside the warning polygon", () => {
      // Point in Orlando: lat 28.53, lng -81.37 (outside bounding box)
      const outsidePoint = { lat: 28.53, lng: -81.37 };
      const isInside = isPointInsideAlertGeometry(outsidePoint, sampleWarningAlert.geometry);
      expect(isInside).toBe(false);
    });
  });

  describe("Exposure Cross-Validation (§4.3)", () => {
    const alert = normalizeNWSAlert(sampleWarningAlert);

    it("confirms exposure when polygon and point API agree", () => {
      const household = { lat: 27.95, lng: -82.45 };
      const res = confirmHouseholdExposure({ householdPoint: household, alert, pointCheckAgrees: true });

      expect(res.isExposed).toBe(true);
      expect(res.hasDisagreement).toBe(false);
      expect(res.status).toBe("CONFIRMED");
    });

    it("flags NEEDS_REVIEW when polygon check and point API disagree", () => {
      const household = { lat: 27.95, lng: -82.45 };
      // Polygon says inside, but point API disagrees
      const res = confirmHouseholdExposure({ householdPoint: household, alert, pointCheckAgrees: false });

      expect(res.hasDisagreement).toBe(true);
      expect(res.status).toBe("NEEDS_REVIEW");
    });
  });

  describe("Feed Staleness Check", () => {
    it("flags stale feed if last sync was > 10 minutes ago", () => {
      const now = new Date("2026-11-09T12:00:00Z");
      const staleTime = new Date("2026-11-09T11:45:00Z"); // 15 min ago
      expect(isWeatherFeedStale(staleTime, now)).toBe(true);

      const freshTime = new Date("2026-11-09T11:55:00Z"); // 5 min ago
      expect(isWeatherFeedStale(freshTime, now)).toBe(false);
    });
  });

  describe("Historical IEM Milton 2024 Replay", () => {
    it("loads real historical alerts and radar frames with disclaimer", () => {
      const replay = loadMiltonHistoricalReplay();
      expect(replay.meta.storm).toBe("Hurricane Milton");
      expect(replay.bannerText).toContain("HISTORICAL REPLAY");
      expect(replay.radarFrames.length).toBeGreaterThanOrEqual(3);
      expect(replay.alerts.length).toBeGreaterThanOrEqual(2);
      expect(replay.alerts[0].eventKey).toBe("TBW:HU.W:0009");
    });
  });
});
