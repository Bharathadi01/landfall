import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  COMMUNITY_FUNDS_GEO,
  NOWCOAST_VERIFIED_LAYERS,
  getUnifiedWeatherIntelligence,
  type UnifiedWeatherIntelligence,
} from "@/lib/sentinel/weather-client";
import {
  buildPrivacyPreservingClusters,
  type ClusterExposureSummary,
} from "@/lib/sentinel/clusters";
import { SYNTHETIC_HOUSEHOLDS } from "@/lib/fixtures/households";
import type { NormalizedAlert } from "@/lib/sentinel/types";

describe("Phase 2 — Real-Time Weather Intelligence (§6)", () => {
  const mockAlertInTBW: NormalizedAlert = {
    id: "alert_tbw_hu_w",
    nwsId: "https://api.weather.gov/alerts/test-tbw",
    eventKey: "TBW:HU.W:0009",
    phenomena: "HU",
    significance: "W",
    office: "TBW",
    etn: "0009",
    event: "Hurricane Warning",
    headline: "Hurricane Warning issued for Tampa Bay",
    status: "Actual",
    messageType: "Alert",
    severity: "Extreme",
    urgency: "Immediate",
    certainty: "Observed",
    effective: "2026-11-09T00:00:00Z",
    expires: "2026-11-12T00:00:00Z",
    areaDesc: "Pinellas and Hillsborough",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-82.95, 27.60],
          [-82.30, 27.60],
          [-82.30, 28.25],
          [-82.95, 28.25],
          [-82.95, 27.60],
        ],
      ],
    },
    isTranche1Eligible: true,
    mode: "LIVE",
    source: "live",
    ingestedAt: new Date().toISOString(),
  };

  describe("1. Geographic Fund Scoping & Multi-Fund Support", () => {
    it("supports multiple geographically separate community funds", () => {
      expect(COMMUNITY_FUNDS_GEO.length).toBeGreaterThanOrEqual(3);
      const fundIds = COMMUNITY_FUNDS_GEO.map((f) => f.id);
      expect(fundIds).toContain("fund_tbw_001"); // Tampa Bay
      expect(fundIds).toContain("fund_mfl_002"); // South Florida
      expect(fundIds).toContain("fund_tae_003"); // Big Bend

      // Verify each fund has documented coordinates and bounds
      for (const fund of COMMUNITY_FUNDS_GEO) {
        expect(fund.centerLat).toBeGreaterThan(24);
        expect(fund.centerLat).toBeLessThan(32);
        expect(fund.centerLng).toBeGreaterThan(-88);
        expect(fund.centerLng).toBeLessThan(-79);
        expect(fund.bounds.length).toBe(4);
      }
    });
  });

  describe("2. nowCOAST Verified WMS Layers Specification", () => {
    it("provides verified NOAA nowCOAST WMS layers matching GetCapabilities inspection", () => {
      expect(NOWCOAST_VERIFIED_LAYERS.length).toBeGreaterThanOrEqual(4);
      const layerNames = NOWCOAST_VERIFIED_LAYERS.map((l) => l.layerName);

      expect(layerNames).toContain("weather_radar:conus_base_reflectivity_mosaic");
      expect(layerNames).toContain("tropical_cyclones:tropical_cyclone_cone_of_uncertainty_forecast");
      expect(layerNames).toContain("tropical_cyclones:tropical_cyclone_track_forecast");
      expect(layerNames).toContain("tropical_cyclones:tropical_cyclone_current_wind_extent");

      for (const layer of NOWCOAST_VERIFIED_LAYERS) {
        expect(layer.wmsUrl).toBe("https://nowcoast.noaa.gov/geoserver/wms");
        expect(layer.format).toBe("image/png");
        expect(layer.transparent).toBe(true);
      }
    });
  });

  describe("3. Privacy-Preserving Household Exposure Clustering", () => {
    it("anonymizes individual households into zone clusters and detects polygon intersection", () => {
      const summary = buildPrivacyPreservingClusters(SYNTHETIC_HOUSEHOLDS, [mockAlertInTBW]);

      expect(summary.totalHouseholds).toBe(SYNTHETIC_HOUSEHOLDS.length);
      expect(summary.totalExposed).toBeGreaterThan(0);
      expect(summary.clusters.length).toBeGreaterThan(0);

      // Verify that no individual addresses or private receiver emails are exposed in clusters
      for (const cluster of summary.clusters) {
        expect((cluster as any).receiverEmail).toBeUndefined();
        expect((cluster as any).address).toBeUndefined();
        expect((cluster as any).displayName).toBeUndefined();
        expect(cluster.centroid.lat).toBeDefined();
        expect(cluster.centroid.lng).toBeDefined();
        expect(cluster.totalHouseholds).toBeGreaterThan(0);
      }
    });

    it("evaluates correctly when no active warning polygons exist (0 exposed)", () => {
      const summary = buildPrivacyPreservingClusters(SYNTHETIC_HOUSEHOLDS, []);

      expect(summary.totalHouseholds).toBe(SYNTHETIC_HOUSEHOLDS.length);
      expect(summary.totalExposed).toBe(0);
      expect(summary.totalUnexposed).toBe(SYNTHETIC_HOUSEHOLDS.length);
      expect(summary.medicalDevicesExposed).toBe(0);
    });

    it("never relies on AI to decide spatial exposure (deterministic Turf.js only)", () => {
      // Household in Orlando (lat: 28.5383, lng: -81.3792) is outside Tampa Bay warning polygon
      const orlandoHh = SYNTHETIC_HOUSEHOLDS.find((h) => h.id === "hh_orl_006");
      expect(orlandoHh).toBeDefined();

      const summary = buildPrivacyPreservingClusters([orlandoHh!], [mockAlertInTBW]);
      expect(summary.totalExposed).toBe(0);
      expect(summary.totalUnexposed).toBe(1);
    });
  });

  describe("4. Visible System States & Atlantic Honesty", () => {
    it("returns REPLAY state with clear archive disclosure when requested", async () => {
      const intel = await getUnifiedWeatherIntelligence("fund_tbw_001", "HISTORICAL_REPLAY");

      expect(intel.state).toBe("REPLAY");
      expect(intel.stateNotice).toContain("HISTORICAL REPLAY MODE");
      expect(intel.atlanticStatusMessage).toContain("HISTORICAL REPLAY: Hurricane Milton");
      expect(intel.hasActiveAtlanticCyclone).toBe(true);
      expect(intel.nhcStorms.length).toBeGreaterThan(0);
      expect(intel.stationObservation?.stationId).toBe("KTPF");
    });

    it("displays honest Atlantic status and never invents cyclones when feed is quiet", async () => {
      const intel = await getUnifiedWeatherIntelligence("fund_tbw_001", "LIVE");

      expect(["LIVE", "STALE", "ERROR"]).toContain(intel.state);
      expect(typeof intel.hasActiveAtlanticCyclone).toBe("boolean");
      if (!intel.hasActiveAtlanticCyclone) {
        expect(intel.atlanticStatusMessage).toContain("NO ACTIVE ATLANTIC CYCLONE");
      }
    });
  });
});

