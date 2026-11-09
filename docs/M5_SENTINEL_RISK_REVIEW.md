# LANDFALL M5 — SENTINEL ADVERSARIAL RISK & RELIABILITY REVIEW
### PayPal AI Hackathon 2026 · Landfall v3 · Step 5 Security & Robustness Audit

---

## 1. Executive Summary

Sentinel is the disaster intelligence layer of Landfall. It ingests official National Weather Service (NWS) warnings, normalizes VTEC event chains, evaluates geographic exposure against household coordinates, and triggers activations for downstream policy evaluation.

**Hard Invariant:** Sentinel is a disaster intelligence service, **NOT** a financial engine. It may identify a hazard and calculate geographic intersection, but it must **NEVER** decide recipient eligibility, priority, payout amounts or execute money.

This document audits 14 critical failure modes and adversarial attack vectors against Sentinel.

---

## 2. Threat Vector Analysis & Mitigation Matrix

| # | Threat Vector | Risk & Attack Surface | Architectural Defense & Mitigation | Status |
|---|---|---|---|---|
| **1** | **Malformed Upstream NWS API Data** | Unexpected JSON shapes, missing properties, invalid GeoJSON syntax causing server crashes. | Strict Zod boundary validation (`NWSPropertiesSchema`), defensive property parsing with safe defaults. | **MITIGATED** |
| **2** | **Forged or Injected Alert Payloads** | Attacker submitting fake hurricane warnings to `/api/alerts/poll` to trigger panic or early aid. | Polling endpoint strictly authenticated via `CRON_SECRET`. Alert ingestion requires valid VTEC structure. | **MITIGATED** |
| **3** | **Duplicate Alert Ingestion** | Rapid polling causing identical alerts to be inserted multiple times, multiplying downstream activations. | Database unique constraint on `nwsId`. Ingestion pipeline detects existing row and returns in-place update without creating duplicate activations. | **MITIGATED** |
| **4** | **Concurrent Event Ingestion** | Simultaneous cron workers polling and attempting concurrent DB writes on the same alert. | PostgreSQL row-level locks and `ON CONFLICT DO UPDATE` semantics. Idempotent `ingestAlertRecord()` contract. | **MITIGATED** |
| **5** | **Out-of-Order Alert Updates** | An older `Alert` message arriving after an `Update` or `Cancel` message has already been processed. | Event lifecycle tracking: update timestamps (`onset`, `expires`, `effective`) compared before overwriting newer state. | **MITIGATED** |
| **6** | **Cancelled Alert Replay** | Attacker or stale feed replaying a cancelled or expired warning to force a payout activation. | `evaluateHouseholdExposure()` explicitly evaluates `messageType === 'Cancel'` and expiration timestamps, returning `OUT_OF_AREA` (`ALERT_CANCELLED_OR_EXPIRED`). | **MITIGATED** |
| **7** | **Geometry Manipulation & Polygon Attacks** | Extremely complex or self-intersecting polygons causing CPU denial of service during point-in-polygon checks. | Turf.js ring normalization (`ensureClosedRing()`) with coordinate array validation and error boundary catch block. | **MITIGATED** |
| **8** | **Incorrect Coordinate Order (`[lat, lon]` vs `[lon, lat]`)** | GeoJSON standard uses `[longitude, latitude]`, whereas GPS APIs use `[latitude, longitude]`. Inverting them causes points to map to Antarctica or ocean. | Strict `GeoPoint` type `{ lat, lng }` explicitly converted to Turf GeoJSON point `[lng, lat]` at the boundary; bounds check rejects out-of-range coordinates. | **MITIGATED** |
| **9** | **Missing Household Coordinates** | Incomplete intake data lacking coordinates silently resolving to `CONFIRMED` or defaulting to (0,0). | `isValidGeoPoint()` validation: missing or invalid coordinates **strictly** return `NEEDS_REVIEW` (`MISSING_COORDINATES`), never `CONFIRMED`. | **MITIGATED** |
| **10** | **Displaced Resident Location Substitution** | An evacuated resident's temporary shelter location (outside warning cone) being evaluated instead of their home, disqualifying them from pre-storm aid. | Authoritative `resolveExposureCoordinates()` contract: displaced residents' original landfall coordinates are strictly preserved and evaluated. | **MITIGATED** |
| **11** | **Stale Weather Feed Outage** | NWS API downtime or silent failure leaving stale warnings active past their expiration. | Feed staleness monitor (`isWeatherFeedStale()` > 10 min) surfaces persistent warning banner. Never silently treats upstream outage as absence of danger. | **MITIGATED** |
| **12** | **Historical Replay Contaminating Live State** | Replay of Hurricane Milton 2024 triggering real bank charges or being mistaken for a live active disaster. | Explicit `mode: "HISTORICAL_REPLAY"` and `source: "replay"` in DB; persistent disclaimer banner; downstream PayPal Payouts completely isolated. | **MITIGATED** |
| **13** | **Unauthorised PII Exposure in Alert Logs** | Household addresses or names appearing in public alert feeds or exposure debug logs. | Sentinel logs and console feeds contain only `householdId`, `eventKey`, `status`, and `reasonCode`; PII is never included in alert records. | **MITIGATED** |
| **14** | **Financial Execution Bypass Attempt** | Malicious or buggy alert attempting to directly invoke PayPal Payouts API. | **Invariant 1 & 2:** Architecture boundary tests (`boundary.test.ts`) strictly forbid any module outside `lib/treasurer/` from importing PayPal Payouts. | **MITIGATED** |

---

## 3. Verification & Compliance Sign-off

Sentinel satisfies every applicable requirement of Landfall v3 §4.3 and §9. All 14 threat vectors have automated test coverage in `tests/sentinel/sentinel.test.ts` and `tests/arch/boundary.test.ts`.
