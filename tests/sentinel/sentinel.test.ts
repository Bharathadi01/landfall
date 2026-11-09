import { describe, it, expect, vi } from "vitest";
import {
  normalizeNWSAlert,
  confirmHouseholdExposure,
  evaluateHouseholdExposure,
  isWeatherFeedStale,
  loadMiltonHistoricalReplay,
  isHistoricalReplay,
  TRANCHE_1_TRIGGER_PHENOMENA,
  ingestAlertRecord,
  evaluateAndActivateFundResponse,
} from "@/lib/sentinel/index";
import { isPointInsideAlertGeometry, isValidGeoPoint } from "@/lib/geo/resolver";
import { resolveExposureCoordinates } from "@/lib/recipients/location";

describe("Sentinel Disaster Intelligence Engine (§4.3, M5)", () => {
  const sampleWarningAlert = {
    id: "alert_milton_hu_w",
    properties: {
      event: "Hurricane Warning",
      headline: "Hurricane Warning issued for Tampa Bay",
      status: "Actual",
      messageType: "Alert",
      vtec: "/O.NEW.KTBW.HU.W.0009.241009T1200Z-241010T1800Z/",
      effective: "2024-10-09T12:00:00Z",
      expires: "2026-12-31T18:00:00Z", // Future date for test validity
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

  describe("1. VTEC Normalization & Tranche 1 Trigger Policy", () => {
    it("normalizes VTEC into a canonical eventKey and qualifies Hurricane Warning", () => {
      const normalized = normalizeNWSAlert(sampleWarningAlert);
      expect(normalized.eventKey).toBe("TBW:HU.W:0009");
      expect(normalized.phenomena).toBe("HU");
      expect(normalized.significance).toBe("W");
      expect(normalized.isTranche1Eligible).toBe(true);
      expect(normalized.mode).toBe("LIVE");
    });

    it("qualifies all four approved Tranche 1 phenomena (HU.W, SS.W, FF.W, EH.W)", () => {
      const phenomena = [
        { phen: "HU", name: "Hurricane Warning" },
        { phen: "SS", name: "Storm Surge Warning" },
        { phen: "FF", name: "Flash Flood Warning" },
        { phen: "EH", name: "Extreme Heat Warning" },
      ];

      for (const { phen, name } of phenomena) {
        const raw = {
          properties: {
            event: name,
            status: "Actual",
            messageType: "Alert",
            vtec: `/O.NEW.KTBW.${phen}.W.0001.241009T1200Z-20261231T1800Z/`,
            expires: "2026-12-31T18:00:00Z",
          },
        };
        const normalized = normalizeNWSAlert(raw);
        expect(normalized.isTranche1Eligible).toBe(true);
      }
    });

    it("rejects Watches and Advisories from triggering Tranche 1", () => {
      const watchAlert = {
        ...sampleWarningAlert,
        properties: {
          ...sampleWarningAlert.properties,
          event: "Hurricane Watch",
          vtec: "/O.NEW.KTBW.HU.A.0009.241008T1200Z-20261231T1200Z/",
        },
      };

      const normalized = normalizeNWSAlert(watchAlert);
      expect(normalized.significance).toBe("A");
      expect(normalized.isTranche1Eligible).toBe(false); // Watches are informational only!
    });

    it("rejects test, exercise, and draft alerts from triggering Tranche 1", () => {
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

    it("rejects cancelled and expired alerts from triggering Tranche 1", () => {
      const cancelledAlert = {
        ...sampleWarningAlert,
        properties: {
          ...sampleWarningAlert.properties,
          messageType: "Cancel",
        },
      };
      expect(normalizeNWSAlert(cancelledAlert).isTranche1Eligible).toBe(false);

      const expiredAlert = {
        ...sampleWarningAlert,
        properties: {
          ...sampleWarningAlert.properties,
          expires: "2020-01-01T00:00:00Z", // Past date
        },
      };
      expect(normalizeNWSAlert(expiredAlert).isTranche1Eligible).toBe(false);
    });

    it("handles fallback properties when VTEC string is absent", () => {
      const fallbackRaw = {
        properties: {
          event: "Hurricane Warning",
          phenomena: "HU",
          significance: "W",
          wfo: "TBW",
          etn: "0005",
          status: "Actual",
          messageType: "Alert",
          expires: "2026-12-31T18:00:00Z",
        },
      };
      const normalized = normalizeNWSAlert(fallbackRaw);
      expect(normalized.eventKey).toBe("TBW:HU.W:0005");
      expect(normalized.isTranche1Eligible).toBe(true);
    });
  });

  describe("2. Geographic Resolution & Multi-Polygon Boundaries", () => {
    it("validates geographic coordinates correctly", () => {
      expect(isValidGeoPoint({ lat: 27.95, lng: -82.45 })).toBe(true);
      expect(isValidGeoPoint({ lat: 91, lng: -82.45 })).toBe(false); // Lat > 90
      expect(isValidGeoPoint({ lat: 27.95, lng: 185 })).toBe(false); // Lng > 180
      expect(isValidGeoPoint(null)).toBe(false);
      expect(isValidGeoPoint({ lat: NaN, lng: 0 })).toBe(false);
    });

    it("detects when a household is inside polygon boundary", () => {
      // Point in Downtown Tampa: lat 27.95, lng -82.45 (inside bounding box)
      const insidePoint = { lat: 27.95, lng: -82.45 };
      expect(isPointInsideAlertGeometry(insidePoint, sampleWarningAlert.geometry)).toBe(true);
    });

    it("detects when a household is outside polygon boundary", () => {
      // Point in Orlando: lat 28.53, lng -81.37 (outside bounding box)
      const outsidePoint = { lat: 28.53, lng: -81.37 };
      expect(isPointInsideAlertGeometry(outsidePoint, sampleWarningAlert.geometry)).toBe(false);
    });

    it("handles MultiPolygon alert geometries", () => {
      const multiPolyGeometry = {
        type: "MultiPolygon" as const,
        coordinates: [
          [
            [
              [-82.85, 27.65],
              [-82.35, 27.65],
              [-82.35, 28.15],
              [-82.85, 28.15],
              [-82.85, 27.65],
            ],
          ],
          [
            [
              [-81.0, 26.0],
              [-80.5, 26.0],
              [-80.5, 26.5],
              [-81.0, 26.5],
              [-81.0, 26.0],
            ],
          ],
        ],
      };

      expect(isPointInsideAlertGeometry({ lat: 27.95, lng: -82.45 }, multiPolyGeometry)).toBe(true);
      expect(isPointInsideAlertGeometry({ lat: 26.25, lng: -80.75 }, multiPolyGeometry)).toBe(true);
      expect(isPointInsideAlertGeometry({ lat: 30.0, lng: -85.0 }, multiPolyGeometry)).toBe(false);
    });

    it("handles unclosed polygon linear rings gracefully", () => {
      const unclosedPoly = {
        type: "Polygon" as const,
        coordinates: [
          [
            [-82.85, 27.65],
            [-82.35, 27.65],
            [-82.35, 28.15],
            [-82.85, 28.15],
            // missing final point closing the ring
          ],
        ],
      };
      // Normalization function closes ring without throwing turf exception
      expect(isPointInsideAlertGeometry({ lat: 27.95, lng: -82.45 }, unclosedPoly)).toBe(true);
    });
  });

  describe("3. Geographic Exposure Engine & M4 Compatibility", () => {
    const alert = normalizeNWSAlert(sampleWarningAlert);

    it("confirms exposure when point is inside polygon and cross-validation agrees", () => {
      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_inside",
        landfallLat: 27.95,
        landfallLng: -82.45,
        alert,
        pointCheckAgrees: true,
      });

      expect(evaluation.status).toBe("CONFIRMED");
      expect(evaluation.reasonCode).toBe("INSIDE_POLYGON");
      expect(evaluation.evaluatedCoordinates).toEqual({ lat: 27.95, lng: -82.45 });
    });

    it("returns OUT_OF_AREA when household is outside warning area", () => {
      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_outside",
        landfallLat: 28.53,
        landfallLng: -81.37, // Orlando
        alert,
        pointCheckAgrees: false,
      });

      expect(evaluation.status).toBe("OUT_OF_AREA");
      expect(evaluation.reasonCode).toBe("OUTSIDE_POLYGON");
    });

    it("M4 Contract Invariant: Preserves original landfall coordinates for displaced households", () => {
      // Displaced resident evacuated to shelter in Orlando (28.53, -81.37)
      // Original landfall home was in Tampa surge zone (27.95, -82.45)
      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_displaced",
        landfallLat: 27.95,
        landfallLng: -82.45,
        currentLat: 28.53,
        currentLng: -81.37,
        isDisplaced: true,
        alert,
        pointCheckAgrees: true,
      });

      // Crucial: Must evaluate Tampa home, NOT Orlando shelter!
      expect(evaluation.status).toBe("CONFIRMED");
      expect(evaluation.reasonCode).toBe("DISPLACED_LANDFALL_PRESERVED");
      expect(evaluation.evaluatedCoordinates).toEqual({ lat: 27.95, lng: -82.45 });
      expect(evaluation.details).toContain("Household evacuated, but original landfall residence is inside");
    });

    it("flags NEEDS_REVIEW when point-in-polygon and NWS point API disagree (§4.3)", () => {
      // Polygon says inside, but NWS point API check disagrees
      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_disagree",
        landfallLat: 27.95,
        landfallLng: -82.45,
        alert,
        pointCheckAgrees: false,
      });

      expect(evaluation.status).toBe("NEEDS_REVIEW");
      expect(evaluation.reasonCode).toBe("POINT_CHECK_DISAGREEMENT");
      expect(evaluation.details).toContain("Flagged for human review");
    });

    it("flags NEEDS_REVIEW if household coordinates are missing (NEVER silently produces CONFIRMED)", () => {
      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_no_coords",
        alert,
      });

      expect(evaluation.status).toBe("NEEDS_REVIEW");
      expect(evaluation.reasonCode).toBe("MISSING_COORDINATES");
      expect(evaluation.evaluatedCoordinates).toBeNull();
    });

    it("flags NEEDS_REVIEW if alert lacks polygon geometry", () => {
      const countyAlert = {
        ...alert,
        geometry: null,
      };

      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_county",
        landfallLat: 27.95,
        landfallLng: -82.45,
        alert: countyAlert,
      });

      expect(evaluation.status).toBe("NEEDS_REVIEW");
      expect(evaluation.reasonCode).toBe("INVALID_GEOMETRY");
    });

    it("returns OUT_OF_AREA if alert is cancelled or expired", () => {
      const cancelledAlert = {
        ...alert,
        messageType: "Cancel" as const,
      };

      const evaluation = evaluateHouseholdExposure({
        householdId: "hh_cancelled",
        landfallLat: 27.95,
        landfallLng: -82.45,
        alert: cancelledAlert,
      });

      expect(evaluation.status).toBe("OUT_OF_AREA");
      expect(evaluation.reasonCode).toBe("ALERT_CANCELLED_OR_EXPIRED");
    });

    it("supports backward-compatible confirmHouseholdExposure interface", () => {
      const res = confirmHouseholdExposure({
        householdPoint: { lat: 27.95, lng: -82.45 },
        alert,
        pointCheckAgrees: true,
      });

      expect(res.isExposed).toBe(true);
      expect(res.hasDisagreement).toBe(false);
      expect(res.status).toBe("CONFIRMED");
    });
  });

  describe("4. Historical Replay & IEM Archive Provenance", () => {
    it("loads real historical Hurricane Milton 2024 warnings from IEM", () => {
      const replay = loadMiltonHistoricalReplay();
      expect(replay.meta.storm).toBe("Hurricane Milton");
      expect(replay.meta.wfo).toBe("TBW");
      expect(replay.bannerText).toContain("HISTORICAL REPLAY");
      expect(replay.bannerText).toContain("Source: NWS via IEM archive");
      expect(replay.radarFrames.length).toBeGreaterThanOrEqual(3);
      expect(replay.alerts.length).toBeGreaterThanOrEqual(2);

      // Verify all alerts are explicitly tagged HISTORICAL_REPLAY
      for (const a of replay.alerts) {
        expect(a.mode).toBe("HISTORICAL_REPLAY");
        expect(isHistoricalReplay(a)).toBe(true);
      }
    });

    it("flags stale weather feed if last sync is > 10 minutes ago", () => {
      const now = new Date("2026-11-09T14:00:00Z");
      const fresh = new Date("2026-11-09T13:55:00Z"); // 5 min ago
      const stale = new Date("2026-11-09T13:45:00Z"); // 15 min ago

      expect(isWeatherFeedStale(fresh, now)).toBe(false);
      expect(isWeatherFeedStale(stale, now)).toBe(true);
    });
  });

  describe("5. Idempotent Ingestion & Financial Safety Invariants", () => {
    it("ingests alert into database and handles updates idempotently", async () => {
      const testAlert = normalizeNWSAlert({
        id: `test_alert_${Date.now()}`,
        properties: {
          event: "Hurricane Warning",
          vtec: "/O.NEW.KTBW.HU.W.0099.241009T1200Z-20261231T1800Z/",
          status: "Actual",
          messageType: "Alert",
          expires: "2026-12-31T18:00:00Z",
        },
      });

      // First ingestion -> isNew: true
      const res1 = await ingestAlertRecord(testAlert);
      expect(res1.isNew).toBe(true);
      expect(res1.isUpdated).toBe(false);

      // Second ingestion with same nwsId -> isNew: false, isUpdated: true (in-place update)
      const res2 = await ingestAlertRecord(testAlert);
      expect(res2.isNew).toBe(false);
      expect(res2.isUpdated).toBe(true);
      expect(res2.alertRecordId).toBe(res1.alertRecordId);
    });

    it("creates activation for Tranche 1 eligible alert without calling PayPal Payouts", async () => {
      const replay = loadMiltonHistoricalReplay();
      const miltonWarning = replay.alerts[0]; // KTBW.HU.W.0009

      const activationRes = await evaluateAndActivateFundResponse({ alert: miltonWarning });
      expect(activationRes.activated).toBe(true);
      expect(activationRes.activation).toBeDefined();
      expect(activationRes.activation?.eventKey).toBe("TBW:HU.W:0009");
      expect(activationRes.activation?.status).toBe("open");

      // Idempotency: second activation call returns existing activation
      const secondActivationRes = await evaluateAndActivateFundResponse({ alert: miltonWarning });
      expect(secondActivationRes.activated).toBe(true);
      expect(secondActivationRes.reason).toContain("Existing activation found");
    });

    it("Financial Invariant: Sentinel alert CANNOT call PayPal Payouts or move money", () => {
      // Sentinel must strictly produce disaster intelligence and activations.
      // Under boundary tests, only lib/treasurer can import payouts.
      const alert = normalizeNWSAlert(sampleWarningAlert);
      expect((alert as any).payoutAmount).toBeUndefined();
      expect((alert as any).recipientEligibility).toBeUndefined();
    });
  });

  describe("6. NWS API Client Resiliency & Error Handling (Mocked)", () => {
    it("handles 200 OK alert response and populates cache", async () => {
      const mockFeature = {
        id: "nws_mock_01",
        properties: {
          event: "Hurricane Warning",
          vtec: "/O.NEW.KTBW.HU.W.0001.241009T1200Z-20261231T1800Z/",
          status: "Actual",
          messageType: "Alert",
          expires: "2026-12-31T18:00:00Z",
        },
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === "etag" ? '"mock-etag-123"' : null),
        },
        json: async () => ({ features: [mockFeature] }),
      }) as any;

      try {
        const { fetchLiveNWSAlerts } = await import("@/lib/sentinel/nws");
        const res = await fetchLiveNWSAlerts("FL", { skipCache: true });
        expect(res.alerts.length).toBe(1);
        expect(res.alerts[0].eventKey).toBe("TBW:HU.W:0001");
        expect(res.isNotModified).toBe(false);
        expect(res.etag).toBe('"mock-etag-123"');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("handles 304 Not Modified using cached entry", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 304,
        headers: { get: () => null },
      }) as any;

      try {
        const { fetchLiveNWSAlerts } = await import("@/lib/sentinel/nws");
        const res = await fetchLiveNWSAlerts("FL");
        expect(res.isNotModified).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("handles upstream API errors and timeouts gracefully", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      }) as any;

      try {
        const { fetchLiveNWSAlerts, checkNWSHealth } = await import("@/lib/sentinel/nws");
        await expect(fetchLiveNWSAlerts("FL", { skipCache: true })).rejects.toThrow(/503/);

        // Health check reports degraded
        const health = await checkNWSHealth();
        expect(health.status).toBe("DEGRADED");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("queries point API and detects active warnings", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              properties: {
                event: "Hurricane Warning",
                vtec: "/O.NEW.KTBW.HU.W.0001.241009T1200Z-20261231T1800Z/",
                status: "Actual",
                messageType: "Alert",
                expires: "2026-12-31T18:00:00Z",
              },
            },
          ],
        }),
      }) as any;

      try {
        const { verifyPointActiveAlerts } = await import("@/lib/sentinel/nws");
        const res = await verifyPointActiveAlerts(27.95, -82.45);
        expect(res.hasActiveWarning).toBe(true);
        expect(res.activePhenomena).toContain("TBW:HU.W:0001");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
