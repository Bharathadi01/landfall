# Data provenance

> Which data on every screen is **live**, **historical replay**, **synthetic**, **Sandbox**, or **owner-provided evidence**, and how the interface labels it. Verified against the code at commit `f8f21a7`. A longer, older note specific to the storm atlas is in [STORM_ATLAS_DATA_PROVENANCE.md](STORM_ATLAS_DATA_PROVENANCE.md). Summary: **no real person, donation or relief payment appears anywhere in this repository or its demonstration.**

## 1. Vocabulary

| Label | Meaning |
|---|---|
| **LIVE** (weather) | Fetched from the official source now; shown with its feed state `LIVE`, `STALE` or `ERROR` |
| **HISTORICAL_REPLAY / REPLAY** | A real past event (Hurricane Milton, 2024) replayed from a bundled archive; always tagged and bannered, never presented as current |
| **SYNTHETIC** | Invented for demonstration: households, names, addresses, coordinates, evidence |
| **SANDBOX / SANDBOX_LIVE** | A real call to PayPal's Sandbox environment: real API behaviour, **play money** |
| **Owner-provided evidence** | A record or screenshot from the maintainer's own runs (for example Sandbox payout batches), quoted in documents but **not re-executed** by this documentation |
| **Recipient-reported** | What a household itself said ("I received it", "I can't access it"); never upgraded to provider-verified |

In the application the case origin is the enum `DataOrigin = "REPLAY" | "SANDBOX_LIVE"`, alert mode is `LIVE | HISTORICAL_REPLAY | SYNTHETIC`, and a `ProvenanceTag` marks each fact in a case as provider, Landfall, or recipient-reported.

## 2. By surface

| Surface | Data source | Live / replay / synthetic | Notes |
|---|---|---|---|
| Landing page globe and warnings | NWS alerts, NHC products, NASA GIBS, RainViewer, Open-Meteo; base map OpenFreeMap, Esri World Imagery | **LIVE** weather over **synthetic** household clusters | Upstream layers can be unavailable (seen: NASA GIBS 504, Open-Meteo 429) and are then reported as such |
| Landing "Relief board" card | `lib/studio/landfall-studio-data.ts` (replay scenario) | **REPLAY**, static | Not live data and not labelled on the card ([LIMITATIONS.md](LIMITATIONS.md)) |
| Donations (Smart Buttons) | PayPal Sandbox Orders v2 | **Sandbox** | No real money; Sandbox test card on `/judges` |
| Monthly sustainer | PayPal Sandbox Subscriptions | **Sandbox** | |
| Command Center, Payments, case pages | Selected source: stored **Sandbox** payout records, else the **Milton replay** cases | **Sandbox** or **replay**, named on the page and in `/api/cases` | The Sandbox cases come from payout batches created in Sandbox and (for some) imported through `scripts/import-sandbox-batch.ts` |
| Storm Desk | As the globe; household clusters from `lib/fixtures/households.ts` (6 synthetic households) | **LIVE** + **synthetic** | Household exposure is deterministic point-in-polygon |
| Storm Drill | `lib/rehearsal/lab.ts` storms (Milton, Helene, Idalia, …) and scenarios | **Historical** parameters, simulated outcomes | No PayPal call; every response says "Simulated" |
| Guided Response | `lib/workflow/golden.ts` | **Synthetic**, simulated PayPal sender | Persists nothing |
| Households | `households` table | Whatever was enrolled: on the deployment none are real; screenshots use three obviously synthetic households in a local disposable database | |
| Analytics Studio | `landfall-studio-data.ts` | **REPLAY / synthetic**, with an on-screen data notice | Pseudonymous; zero personal data is sent to the AI |
| AI answers | Evidence from the above, plus the model's wording | Inherit the evidence's provenance | Fallbacks are labelled `OFFLINE_FALLBACK` / `deterministic` |
| Resident portal | Case snapshot (replay or Sandbox) | **Synthetic** demo households | Judge card shows a demo reference and code |

## 3. The Milton 2024 replay

`lib/fixtures/milton-2024.json` is a bundled snapshot assembled from the Iowa Environmental Mesonet VTEC archive and historical NEXRAD radar frames, per the header of `lib/sentinel/replay.ts` (it is **not** fetched at run time). Replay alerts are inserted with `mode = HISTORICAL_REPLAY` and `source = replay`; the API response says "Historical storm replay activated. Replay mode is clearly tagged; no real payments are executed". The replay *obligations, payments and ledger lines* in `landfall-studio-data.ts` are a **synthetic scenario modelled on the real Milton timeline and on PayPal Payouts v1 semantics** (the case module's header says so); they are not records of any real fund's payments.

## 4. Owner-provided evidence

These items are quoted from the project's own records and were **not** reproduced for this documentation: the Sandbox payout batches and webhook deliveries, the webhook registration, the Orders and subscription objects, the Vault refusal, the AI input-screening eval run. They are listed with their sources in [PAYPAL_INTEGRATION.md §8](PAYPAL_INTEGRATION.md#8-evidence-register-owner-provided-not-re-executed) and [AI_ARCHITECTURE.md §5](AI_ARCHITECTURE.md#5-what-is-not-claimed). Older milestone reports under `docs/` (`LIVE_PROOF.md`, `PAYPAL_EVIDENCE*.md`, `M*_EVIDENCE.md`) are the original source of many of them.

## 5. What was verified for this documentation

| Check | How | Result |
|---|---|---|
| Screens, labels and layout in the gallery | A read-only browser script (`scripts/capture-docs-assets.mjs`) loaded the pages as the read-only "Judge" persona; it never submitted a form or pressed a PayPal button | 14 screenshots + a preview GIF; each is a real capture, none edited beyond resizing, a caption strip in the GIF and WebP compression |
| Which screenshots came from a local build | Three screens could not be captured faithfully on production: **Households** (three obviously synthetic households enrolled in a disposable local database), **AI Case Officer** (investigation of a *Milton replay* case, with replay stated on the page) and **Storm Desk** (production's NASA GIBS and Open-Meteo layers were unavailable at capture time, so a local build with a working wind layer was used; its satellite chip still reads "unavailable", a real upstream state left visible rather than hidden). The other 11 are from the production deployment | Disclosed in the captions in [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) |
| Test results | `tsc`, lint, build and the full suite on a disposable database | [TESTING.md](TESTING.md) |

## 6. Third-party data and attribution

NWS and NHC (US government, public domain), NASA GIBS and EOSDIS (NASA imagery), RainViewer (radar tiles, subject to their terms), Open-Meteo (forecast data), OpenFreeMap and OpenStreetMap contributors (base map), Esri World Imagery tiles. Their terms govern their data; Landfall does not republish it beyond rendering it in the browser and, for alerts, storing the alert record. Fonts: Archivo, Public Sans and Overpass Mono via Google Fonts. Icons: Phosphor.
