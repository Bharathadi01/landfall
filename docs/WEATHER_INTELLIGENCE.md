# Landfall Sentinel — Real-Time Weather Intelligence Engine

## 1. Executive Summary

Landfall's **Sentinel Engine** integrates authoritative United States government weather data to power anticipatory humanitarian relief cash transfers. Unlike generic weather widgets, Sentinel connects real-time National Weather Service (NWS) warning polygons, National Hurricane Center (NHC) tropical cyclone GIS products, and NOAA nowCOAST WMS radar reflectivity layers into a deterministic spatial exposure pipeline.

---

## 2. Authoritative US Government Data Sources

### A. National Weather Service API (`api.weather.gov`)
- **Specification:** RFC-compliant GeoJSON API with mandatory `User-Agent` and `Accept: application/geo+json`.
- **Endpoints Utilized:**
  - `/alerts/active?area=FL` — State and county-level active hazard warning polygons.
  - `/points/{lat},{lng}` — Dynamic gridpoint translation to Weather Forecast Office (WFO), station IDs, and forecast URLs.
  - `/gridpoints/{wfo}/{x},{y}/forecast/hourly` — 12-hour hourly wind velocity, precipitation probability, and temperature outlooks.
  - `/stations/{id}/observations/latest` — Real surface observations (temperature, barometric pressure, wind speed, gusts).
- **HTTP Cache Respect:** Uses conditional requests with `If-None-Match` (ETag) and `If-Modified-Since` headers to eliminate unnecessary bandwidth.

### B. National Hurricane Center GIS Feeds (`nhc.noaa.gov`)
- **Active Storms Product:** `https://www.nhc.noaa.gov/CurrentStorms.json`
- **Track & Hazard Data:**
  - 120-hour forecast trackline (`KMZ` / `GIS`).
  - Cone of uncertainty for track forecasts.
  - Initial and forecast tropical wind radii (34kt, 50kt, 64kt extents).
  - Storm surge watch/warning GIS layers when active.
- **Current-Data Honesty:** If no active Atlantic tropical cyclone exists, Sentinel explicitly displays `NO ACTIVE ATLANTIC CYCLONE`. Simulated or historical storm replays are segregated and labeled.

### C. NOAA nowCOAST Web Map Service (`nowcoast.noaa.gov`)
- **WMS Base URL:** `https://nowcoast.noaa.gov/geoserver/wms` (Migrated to AWS per NOAA Service Change Notice SCN 23-12).
- **Verified Published Layers (via `GetCapabilities` XML inspection):**
  1. `weather_radar:conus_base_reflectivity_mosaic` — Live CONUS NEXRAD weather radar base reflectivity mosaic.
  2. `tropical_cyclones:tropical_cyclone_cone_of_uncertainty_forecast` — Official 120-hour NHC forecast cone.
  3. `tropical_cyclones:tropical_cyclone_track_forecast` — Official 120-hour NHC storm trackline.
  4. `tropical_cyclones:tropical_cyclone_current_wind_extent` — Tropical cyclone current wind extent radii.
  5. `tropical_cyclones:tropical_cyclone_watches_warnings` — Coastal tropical cyclone watches and warnings.

---

## 3. Four Visible System States

Sentinel enforces four distinct operational system states across all dashboards and APIs:

| System State | Visual Indicator | Operational Definition |
|---|---|---|
| **LIVE** | 🟢 Emerald Pulse | Official upstream data received within the last 10 minutes (feed age < 600s). Fresh ETag validated. |
| **STALE** | 🟡 Amber Retained | Upstream API currently unreachable or delayed; last valid good data is retained with visible elapsed age. |
| **REPLAY** | 🟠 Amber Badge | Authentic historical disaster archive being replayed (e.g. Iowa Environmental Mesonet Milton 2024 archive). Zero live payments. |
| **ERROR** | 🔴 Red Alert | Upstream service failed with no prior cache available. Strictly zero fabricated data displayed. |

---

## 4. Deterministic Geospatial Exposure & Privacy Clustering

### Turf.js Point-in-Polygon Engine
- Spatial exposure calculation is executed via deterministic GeoJSON operations (`@turf/boolean-point-in-polygon` and `@turf/helpers`).
- **Architectural Boundary Rule:** The LLM is strictly prohibited from evaluating geometric intersections. All spatial decisions are pure TypeScript functions.

### Privacy-Preserving Household Clusters
- Public dashboards and War Room maps aggregate households into spatial zone clusters (`Zone A Coastal Surge`, `Zone B Barrier Island`, etc.).
- Centroids, household counts, vulnerability breakdowns (medical device dependent, elderly living alone), and confirmed exposure counts are displayed without exposing private street addresses or recipient coordinates.

---

## 5. Verification & Test Evidence

- `tests/sentinel/weather-intelligence.test.ts` (7/7 tests passing):
  - Multi-fund geographic scoping (Tampa Bay TBW, South Florida MFL, Big Bend TAE).
  - nowCOAST verified WMS layer metadata.
  - Privacy-preserving cluster generation and Turf.js point-in-polygon resolution.
  - Live vs. Replay vs. Honest Atlantic quiet status verification.

