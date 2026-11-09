# STORM ATLAS: 3D METEOROLOGICAL VISUALISATION ENGINE
## ARCHITECTURE & TECHNICAL SPECIFICATION

**System:** Landfall Sentinel Disaster Intelligence Engine  
**Module:** Storm Atlas 3D Engine (`components/sentinel/WeatherMap.tsx`)  
**Engine:** MapLibre GL JS v6.17.0 (Native Globe Projection & 3D Terrain)  
**Classification:** Core Meteorological Intelligence Upgrade (Phases 1–14)  
**Date:** November 10, 2026  

---

## 1. System Audit & Baseline Capabilities

### 1.1 MapLibre GL JS v6.17.0 Inspection
- **Installed Version:** `maplibre-gl@6.17.0` (npm / pnpm).
- **Projection Capabilities:** Verified native globe projection support via `map.setProjection({ type: 'globe' })`. Globe transforms unit sphere planet with GPU inaccuracy mitigation, atmospheric clipping, and smooth interpolation to local projections at high zooms.
- **3D Terrain Capabilities:** Verified native raster-dem terrain elevation support via `map.setTerrain({ source: 'terrain-source', exaggeration: 1.5 })`. Supports both Mapbox RGB and AWS Terrarium encodings (`terrarium`).
- **3D Extrusion Support:** `fill-extrusion` layers render genuine 3D volumes with real-time directional shading, altitude scaling in meters (`fill-extrusion-height`), floating base elevation (`fill-extrusion-base`), and opacity.
- **Atmospheric Sky:** Sky shader with horizon blending, sunlight vector calculation, and space backdrop.

### 1.2 Web Worker & Bundling Status
- **Worker Script:** `public/maplibre-gl-worker.mjs` (508 KB) and `public/maplibre-gl-worker-dev.mjs` (1.1 MB).
- **Configuration:** Initialized in Next.js via:
  ```ts
  maplibre.config.WORKER_URL = "/maplibre-gl-worker.mjs";
  ```
  Resolves Next.js Webpack 404 chunk bundling defects with 100% same-origin HTTP 200 delivery.

### 1.3 Next.js Content Security Policy (`next.config.mjs`)
The existing CSP supports:
- `worker-src 'self' blob:; child-src 'self' blob:`
- Verified open sources:
  - `https://tiles.openfreemap.org` (OpenFreeMap vector reference)
  - `https://nowcoast.noaa.gov` (NOAA nowCOAST WMS radar)
  - `https://api.weather.gov` (NWS alert API)
  - `https://mesonet.agron.iastate.edu` (IEM VTEC & GOES composite archive)
  - `https://s3.amazonaws.com` (AWS Open Data Terrarium DEM elevation tiles)
  - `https://server.arcgisonline.com` (High-resolution satellite imagery)
  - `https://gibs.earthdata.nasa.gov` (NASA GIBS VIIRS / Blue Marble satellite tiles)

---

## 2. Reuse vs. Implementation Matrix

| Component | Status | Source / Subsystem | Integration Plan |
|---|---|---|---|
| **MapLibre Core & Worker** | **REUSE** | `maplibre-gl@6.17.0` | Keep self-hosted worker; activate native `projection: { type: 'globe' }` and `setTerrain`. |
| **NOAA nowCOAST Radar** | **REUSE & ENHANCE** | NOAA nowCOAST WMS 1.3.0 (`weather_radar:conus_base_reflectivity_mosaic`) | Maintain isolated error boundary and opacity slider. Add frame timestamp sync. |
| **NWS Active / Replay Alerts** | **REUSE** | NWS api.weather.gov & IEM archive | Keep RFC 7946 GeoJSON; enhance with 3D boundary rendering and inspection drawer. |
| **Tampa Bay Evacuation Zones** | **REUSE** | Authoritative Pinellas/Hillsborough GIS | Render Zone A, Zone B, and SLOSH 10-15ft model with translucent 3D boundaries. |
| **Household Exposure Clusters** | **REUSE & ELEVATE** | K-means privacy-preserving centroids | Elevate into 3D space with vulnerability pills and interactive inspection. |
| **2D SVG Geospatial Engine** | **REUSE** | Mercator projection SVG | Preserve 100% functional fallback for non-WebGL environments. |
| **Satellite-First Surface** | **NEW** | NASA GIBS / ESRI World Imagery / Blue Marble | Replace flat OpenFreeMap street map with high-definition satellite imagery. |
| **Orbital Earth Globe (Mode A)** | **NEW** | MapLibre Globe + NASA GIBS / Blue Marble | Realistic curved Earth, deep space backdrop, atmospheric blue rim. |
| **Regional 3D Storm View (Mode B)**| **NEW** | Oblique Camera (Pitch 55–65°, Bearing -25°) | High-definition satellite land/ocean, 3D Terrarium terrain elevation, subtle labels. |
| **Camera Transition Engine** | **NEW** | Programmatic MapLibre `flyTo` interpolation | Cinematic guided fly-in from orbit to Tampa Bay with skip, reset, and reduced-motion. |
| **3D GOES Cloud-Top Altitude** | **NEW** | NOAA GOES-16 ABI Cloud Top Height (ACHA) | Real data-driven 3D floating cloud deck (`fill-extrusion`) with scientific IR/height color ramp. |
| **NHC Storm Track & Cone** | **NEW** | National Hurricane Center GIS | Authoritative Milton track points (Cat 5 to landfall) + Cone of Uncertainty polygon. |
| **Weather Timeline & Scrubber** | **NEW** | Multi-frame synchronized time scrubber | Scrubber for Oct 8–10, 2024 Milton progression and LIVE mode synchronization. |
| **Redesigned Weather HUD** | **NEW** | Translucent tactical broadcast interface | Compact status HUD, layer switchers, camera controls, contextual inspection drawer. |
| **Cinematic Demo Experience** | **NEW** | 10-step guided tour engine | Interactive presentation tour for hackathon video recording with live map handoff. |

---

## 3. Layer Ordering & Rendering Pipeline

The Sentinel 3D scene renders layers in strict meteorological and visual hierarchy:

```
[Level 10] Floating UI & Tactical HUD (Status, Timeline, Layer Switches, Inspector Drawer)
[Level 09] Privacy-Preserving Household Exposure Centroids & Vulnerability Badges
[Level 08] Authoritative Evacuation Zones & SLOSH Storm Surge Footprint
[Level 07] NWS Active & Replay VTEC Warning Polygons (Hurricane, Surge, Flood)
[Level 06] NHC Hurricane Track, Wind Radii, and Forecast Cone of Uncertainty
[Level 05] NOAA nowCOAST WMS 1.3.0 Base Reflectivity Radar Mosaic
[Level 04] NOAA GOES-16 ABI 3D Cloud-Top Altitude Surface (Floating fill-extrusion deck)
[Level 03] GOES-East Infrared & NASA VIIRS TrueColor Cloud Formations
[Level 02] AWS Open Data Terrarium 3D Digital Elevation Model (DEM)
[Level 01] Satellite Geographic Imagery (NASA GIBS Blue Marble / World Imagery)
[Level 00] Deep Space Backdrop (#030712) & Atmospheric Scattering Rim
```

---

## 4. Scientific Honesty & Data Grounding Invariants

1. **Explicit Data Grounding:** Every pixel, polygon, track point, and cloud-top height originates from verified US Government meteorological agencies (NOAA NESDIS, NWS, NHC, NASA GIBS). No procedural noise shaders or synthetic storm particles.
2. **Volumetric Limitation Notice:** Cloud-top height is an altitude measurement of the cloud canopy, not a volumetric radar tomography scan. Labeled strictly as:
   `"GOES cloud-top altitude visualisation · Source: NOAA GOES-16 ABI ACHA Level 2"`.
3. **Forecast Cone Invariant:** The NHC Cone of Uncertainty represents the 67% historical probability envelope of the storm center's trajectory, not a damage footprint.
4. **Radar Failure Decoupling:** Radar WMS failure triggers an isolated status badge and never blank-screens the satellite basemap, terrain, or warning polygons.
5. **Resident Privacy Shield:** Household markers represent k-means aggregated clusters. Zero physical street addresses or resident PII are exposed in client DOM or network payloads.

