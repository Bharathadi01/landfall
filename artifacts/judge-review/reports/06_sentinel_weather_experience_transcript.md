# Recording Transcript: 06_sentinel_weather_experience

**Recording Filename:** `06_sentinel_weather_experience.webm`  
**Viewport Resolution:** 1440 × 1000  
**Browser Engine:** Chromium Headed Emulation with Injected Visual Cursor  
**Elapsed Duration:** 16.6 seconds  
**Date:** 2026-11-10  

---

## Executive Summary
This recording captures Landfall's Sentinel Weather Intelligence and real-time disaster tracking system.
1. **Authoritative Warning Tracking:** Renders NWS Hurricane Warning polygon (`TBW:HU.W:0009`) and projected storm track for Hurricane Milton.
2. **Geospatial Household Exposure:** Overlays registered resident households onto coastal barrier evacuation zones (Zone A/B/C) to identify priority medical device and elderly residents.
3. **Data Provenance:** Explicit badges verify authoritative NOAA/NWS API data sources and historical replay timestamps.

---

## Timestamped Narration Script & Action Log

| Time | Step | Action | Target Component | Expected Outcome | Observed Outcome | Status |
|------|:----:|--------|------------------|------------------|------------------|:------:|
| 4.0s | 1 | Mount Sentinel HUD | Map & Telemetry | Loads MapLibre geospatial canvas and NWS warning polygons | Sentinel HUD mounted with live NWS check | **PASS** |
| 10.4s | 2 | Pan Map | MapLibre Canvas | Pans map across Tampa Bay and coastal barrier islands | Map panned smoothly | **PASS** |
| 11.4s | 3 | Zoom Map | MapLibre Wheel Event | Zooms map closer to barrier islands | Map zoom level updated | **PASS** |
| 16.4s | 4 | Inspect Exposed Households | Impact List | Displays 5 vulnerable households prioritized for evacuation grants | Exposed households displayed | **PASS** |

---

## Geospatial Integrity Audit
- **Map Library:** Vector map rendered via MapLibre GL JS with hardware-accelerated WebGL.
- **Exposure Calculation:** Point-in-polygon spatial calculation correctly tags coastal barrier residents as Zone A confirmed.
