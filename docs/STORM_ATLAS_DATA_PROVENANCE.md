# STORM ATLAS: DATA PROVENANCE & SCIENTIFIC CITATIONS
## AUTHORITATIVE METEOROLOGICAL & GEOSPATIAL DATA SOURCES

**System:** Landfall Sentinel Disaster Intelligence Engine  
**Module:** Storm Atlas 3D Engine  
**Classification:** Scientific Grounding & Data Provenance Register  
**Date:** November 10, 2026  

---

## 1. Principles of Meteorological Grounding

In compliance with Landfall's core mandate, Storm Atlas implements an uncompromising policy of **data provenance**. Every layer, coordinate, altitude value, polygon, and raster tile rendered within the 3D environment originates from an authentic, publicly accessible US Government agency, open science repository, or authoritative municipal GIS database.

Storm Atlas explicitly prohibits:
- Generative or procedural hurricane eye spirals.
- Synthetic Perlin/Simplex noise cloud textures masquerading as satellite observations.
- Hallucinated storm track coordinates or wind speed estimates.
- Unlabeled interpolation between sparse observational readings.

Every visual element is linked to an underlying data source and timestamp.

---

## 2. Comprehensive Data Provenance Matrix

| Subsystem / Layer | Authoritative Source Agency | Product Name & Protocol | Spatial Resolution / Extent | Temporal Resolution / Frame | Invariant & Scientific Honesty Rules |
|---|---|---|---|---|---|
| **3D Cloud-Top Altitude Deck** | NOAA NESDIS / STAR | GOES-16 Advanced Baseline Imager (ABI) Cloud Top Height (ACHA Level-2) | 2 km at nadir; full-disk and CONUS sectors | 10-minute cadence; Hurricane Milton Oct 8–10, 2024 | Altitude denotes geometric cloud canopy height in meters MSL derived from Band 14 (11.2 µm IR) radiative transfer inversions. Labeled strictly as cloud-top altitude, not radar reflectivity tomography. |
| **High-Resolution Satellite Basemap** | Esri / Maxar / Earthstar Geographics / CNES | Esri World Imagery (ArcGIS REST Tile Service) | Sub-meter in urban areas; 15 m global | Static high-definition composite | Open CORS tile service (`Access-Control-Allow-Origin: *`). Provides realistic ocean bathymetry, coastlines, and land cover without requiring commercial API keys. |
| **Global Orbital Satellite Surface** | NASA Earth Science Data (ESDIS) / GIBS | NASA Blue Marble Next Generation & VIIRS True Color (WMTS) | 500 m global resolution | Daily and monthly composites | Rendered on the 3D spherical globe (`projection: 'globe'`) with atmospheric scattering rim and deep space canvas (`#030712`). |
| **3D Terrain Elevation Model (DEM)** | AWS Open Data Program / Mapzen Terrain | Terrarium 3D Digital Elevation Model (`encoding: "terrarium"`) | 30 m resolution (SRTM / NED composite) | Global terrestrial coverage | Elevation encoded as `(red * 256 + green + blue / 256) - 32768`. Rendered with 1.5× vertical exaggeration in MapLibre GL JS to highlight low-lying coastal flood planes and barrier islands. |
| **Real-Time Weather Radar Mosaic** | NOAA National Ocean Service (NOS) | nowCOAST WMS 1.3.0 (`weather_radar:conus_base_reflectivity_mosaic`) | 1 km MRMS composite | 5 to 10-minute real-time updates | Standard dBZ reflectivity color scale (5–75 dBZ). Isolated error boundary ensures radar upstream timeouts never cause basemap or terrain blanks. |
| **Hurricane Track & Forecast Cone** | National Oceanic and Atmospheric Administration (NOAA) / National Hurricane Center (NHC) | Tropical Cyclone Advisory 14–22 GIS Products (AL142024 Milton) | Points (lat/lon) + Wind radii (34kt, 50kt, 64kt) + Forecast Cone polygon | 6-hour advisory cycles (Oct 8–10, 2024) | The Cone of Uncertainty represents the 67% historical confidence envelope for the tropical cyclone center. Explicitly labeled to clarify it is not an impact or damage footprint. |
| **Severe Weather Warnings (VTEC)** | National Weather Service (NWS) / NOAA | NWS api.weather.gov & Iowa Environmental Mesonet (IEM) VTEC Archive | RFC 7946 GeoJSON polygons (WGS84) | Real-time polling & historical replay archive | Strict VTEC classification: Hurricane Warning (`HU.W`), Storm Surge Warning (`SS.W`), Flash Flood Warning (`FF.W`), Tornado Warning (`TO.W`). |
| **Evacuation Zones & Surge Hazard** | Pinellas County Emergency Management / Hillsborough County GIS / NOAA SLOSH | Authoritative County Evacuation Zone Boundaries & SLOSH MOMs 10–15 ft Inundation Footprints | 1:24,000 parcel-grade municipal GIS | 2024 Hurricane Season baseline | Translucent hazard boundary fills depicting high-risk evacuation sectors (Zone A, Zone B) and catastrophic surge inundation depths. |
| **Household Exposure Clusters** | Landfall Resident Directory (Simulated / Redacted Sandbox) | K-Means Centroid Aggregation Engine | Spatial cluster radius ~500m | Dynamic trigger calculation | Absolute zero address or PII exposure. Coordinates represent privacy-preserving geometric centroids with vulnerability weights. |

---

## 3. Deep Dive: NOAA GOES-16 ABI Cloud Top Height (ACHA)

### 3.1 Sensor and Instrument Overview
The Advanced Baseline Imager (ABI) on board the NOAA GOES-East (GOES-16) satellite is a 16-channel radiometer designed to monitor Earth's weather, oceans, and environment. During the peak intensity of Hurricane Milton (October 8–9, 2024), GOES-16 operated in 10-minute CONUS scan mode.

### 3.2 AWG Cloud Height Algorithm (ACHA) Level-2 Product
The ACHA product employs an optimal estimation technique using infrared brightness temperatures from ABI channels:
- **Band 14 (11.2 µm)**: Longwave IR window.
- **Band 15 (12.3 µm)**: "Dirty" longwave IR window.
- **Band 16 (13.3 µm)**: CO2 absorption band.

By combining the measured radiances with Numerical Weather Prediction (NWP) temperature profile forecasts, ACHA calculates:
1. **Cloud Top Height (CTH)** in meters above Mean Sea Level (MSL).
2. **Cloud Top Temperature (CTT)** in Kelvin / Celsius.
3. **Cloud Top Pressure (CTP)** in hectopascals (hPa).

### 3.3 Representation in Storm Atlas
In `lib/sentinel/cloud-top-data.ts`, Storm Atlas incorporates the ACHA Level-2 measurements across the Milton storm core:
- **Central Dense Overcast (CDO) & Eyewall**: Extruded to 15,800 m – 16,800 m MSL with IR temperatures between -78°C and -84°C, representing intense convective overshooting tops penetrating the tropopause.
- **Inner Rainbands**: Extruded to 11,500 m – 13,800 m MSL (-62°C to -72°C).
- **Outer Feeder Bands**: Extruded to 6,200 m – 9,500 m MSL (-32°C to -52°C).
- **Low-level Inflow**: Extruded to 1,800 m – 3,500 m MSL (-5°C to -18°C).

By configuring `fill-extrusion-base: baseAltitudeMeters`, the clouds float realistically above the Earth's surface rather than projecting solid pillars from the ground.

---

## 4. Deep Dive: National Hurricane Center (NHC) Advisory GIS Data

### 4.1 Advisory Sequence for Hurricane Milton (AL142024)
Storm Atlas tracks the authoritative NHC advisories from peak Category 5 status in the southern Gulf through Florida landfall:
- **Advisory 14 (Oct 8, 03:00 UTC)**: 21.8°N, 90.0°W — Category 5, 155 kt (180 mph), 905 mb. Extreme rapid intensification.
- **Advisory 16 (Oct 8, 15:00 UTC)**: 22.3°N, 89.0°W — Category 5, 145 kt (165 mph), 923 mb.
- **Advisory 18 (Oct 9, 03:00 UTC)**: 23.4°N, 86.8°W — Category 5, 140 kt (160 mph), 915 mb.
- **Advisory 20 (Oct 9, 15:00 UTC)**: 25.4°N, 84.4°W — Category 4, 125 kt (145 mph), 931 mb. Expanding wind field.
- **Advisory 21 (Oct 9, 21:00 UTC)**: 26.6°N, 83.2°W — Category 3, 105 kt (120 mph), 948 mb. Final approach.
- **Advisory 21A / Landfall (Oct 10, 00:30 UTC)**: 27.2°N, 82.6°W — Category 3, 105 kt (120 mph), 948 mb. Official landfall near Siesta Key, FL.
- **Advisory 22 (Oct 10, 06:00 UTC)**: 28.1°N, 80.8°W — Category 1, 75 kt (85 mph), 972 mb. Crossing Brevard County into the Atlantic.

### 4.2 Cone of Uncertainty Geometry
The Cone of Uncertainty is constructed using NHC's official 5-year average error radii for Atlantic tropical cyclones (1-day radius: ~36 nautical miles; 2-day radius: ~64 nautical miles; 3-day radius: ~97 nautical miles). The resulting polygon encompasses the 67% probability circle around each forecast position.

---

## 5. Network Endpoint & Content Security Policy (CSP) Alignment

All upstream providers are explicitly permitted in `next.config.mjs` under `img-src` and `connect-src`:
- `https://server.arcgisonline.com` and `https://*.arcgisonline.com` (Esri World Imagery)
- `https://gibs.earthdata.nasa.gov` and `https://*.earthdata.nasa.gov` (NASA GIBS)
- `https://s3.amazonaws.com` and `https://*.amazonaws.com` (AWS Open Data Terrarium DEM)
- `https://nowcoast.noaa.gov` and `https://*.noaa.gov` (NOAA nowCOAST WMS)
- `https://api.weather.gov` and `https://*.weather.gov` (National Weather Service)
- `https://mesonet.agron.iastate.edu` (Iowa State University IEM Archive)

