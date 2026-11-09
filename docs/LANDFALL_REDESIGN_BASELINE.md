# LANDFALL REDESIGN BASELINE INVENTORY & AUDIT
## FIELD ATLAS DESIGN SYSTEM · ARCHITECTURAL INVENTORY

**Project:** Landfall Anticipatory Disaster Relief  
**Evaluation Date:** November 10, 2026  
**Auditor:** Principal Product Designer & Design Systems Architect  
**Objective:** Phase A Comprehensive Design Inventory & Gap Analysis  

---

## 1. Executive Summary

Landfall possesses world-class underlying technical infrastructure:
- Real-time and replay disaster intelligence engine with MapLibre GL v6, NOAA nowCOAST WMS, and GOES-16 ABI satellite observations.
- AG Studio 3.1.0 embedded analytical canvas with real data bindings and Groq-backed AI Copilot.
- End-to-end 8-stage anticipatory relief workflow with deterministic policy execution.
- PayPal Sandbox webhook verification, dual-custody WebAuthn signatures, and double-entry accounting ledger.

However, the previous visual presentation suffered from severe design debt:
1. **Generic Dark SaaS Admin Template**: Heavy `bg-slate-950` with high-contrast borders (`border-slate-800`), glowing neon badges, and repetitive card grids that look like a developer dashboard rather than an authoritative, human-centered relief system.
2. **Visual Hierarchy & Cognitive Overload**: In the War Room, 12 operational widgets competed for visual dominance simultaneously with zero progressive disclosure. The central operational question — *"What needs attention right now?"* — was lost.
3. **Crowded Global Navigation**: A top horizontal navigation bar containing 7 items plus role selectors and badges crowded the desktop header and clipped on tablet viewports.
4. **Technical Copywriting & Jargon**: Labels such as *"Total Liquid PayPal Cash"*, *"Net Allocatable Tranche 1"*, *"Dual-Custody Governance"*, and *"AI Money Investigator"* obscured the human reality of disaster relief.
5. **Inconsistent Component States**: Form inputs, buttons, and tables lacked unified focus-visible states, subtle hover feedback, and clear tabular numerical alignment.

The **Field Atlas** redesign establishes a **light-first editorial financial identity** inspired by contemporary cartographic design, Linear's visual restraint, Palantir's operational clarity, and Apple's material precision.

---

## 2. Route & Experience Inventory

| Route | Family | Current Layout & Defects | Target Field Atlas Redesign |
|---|---|---|---|
| `/` | Public | Generic dark marketing page with neon gradients and dense cards. | Editorial split hero ("Relief should be ready before the storm"), authentic anticipatory relief visual, 4-stage explanation, proof of PayPal financial governance. |
| `/console/war-room` | Operations | 12 widgets displayed simultaneously; AG Studio embedded canvas theme mismatch; high cognitive fatigue. | Command header, operational summary (4 core metrics), prioritized payout exceptions queue, progressive tabs (Overview, Analytics, Recipients, Settlement, Evidence), custom Field Atlas AG Studio theme. |
| `/console/golden-flow` | Operations | 8 full cards stacked vertically; overwhelming narrative flow. | Guided 8-stage interactive progress line, active step spotlight with plain-English explanation and linked provider evidence. |
| `/console/sentinel` | Operations | Map canvas with floating overlays; needs unified Field Atlas glass controls. | Full responsive geographical map, compact floating layer controls, clean warning legends, emergency inspection drawer, overhead Weather View default. |
| `/console/rehearsal` | Operations | Dense parameter sliders and technical inputs. | Scenario-selection lab, 1-sentence scenario descriptions, clear chronological event timeline, funded vs waitlisted households breakdown. |
| `/console/recipients` | Operations | Standard dark table with raw data columns. | Clean, readable recipient directory with search, vulnerability tier badges, column visibility, and contextual drawer. |
| `/console/watch-officer` | Operations | Chat-like prompt window with bulky text blocks. | Evidence-oriented AI investigation workspace distinguishing confirmed facts, hypotheses, unknowns, and human-required decisions. |
| `/spike` | Operations | Dark debug log with raw database queries. | Professional PayPal financial audit ledger with tabular numerals, provider settlement states, and expandable transaction hashes. |
| `/r/enroll` | Resident | Technical inputs and dark encryption badges. | Calm, accessible, mobile-first step-based intake with prominent language switcher (EN, ES, HT, VI, ZH) and plain-English privacy protection. |
| `/r/complaints` | Resident | Form with technical status codes. | Reassuring grievance & appeal intake with transparent review timeline and honest SLA communication. |

---

## 3. Style & Token Inventory

### Existing Deficiencies
- `styles/tokens.css`: Primitive token system declaring dark blues (`--color-ocean: #0B3D91`), amber, and slate dark neutrals with no semantic surface hierarchy.
- `app/globals.css`: Mixed HSL variables from shadcn/ui template colliding with custom Tailwind classes.
- Typography: Fallback system sans-serif (`Inter`) with no editorial display face or refined tabular currency formatting.
- AG Grid Theme: `styles/ag-grid-theme.ts` configured for `colorSchemeDark`, causing harsh contrast when paired with lighter operational surfaces.

### Target Field Atlas Design System
- Light-first primary palette:
  - Canvas: `#F4F2EC`
  - Paper: `#FFFEFA`
  - Surface Muted: `#ECEAE2`
  - Surface Strong: `#E2E0D8`
  - Deep Ink: `#192A24`
  - Secondary Ink: `#58665F`
  - Muted Ink: `#7B847D`
  - Border: `#DEDCD3`
  - Evergreen: `#175B47`
  - Evergreen Light: `#E0EEE7`
  - Signal Coral: `#D76E4B`
  - Warm Amber: `#D99B43`
  - Atlas Blue: `#316B9B`
- Typography:
  - Primary UI: `Geist Sans`
  - Technical / Data: `Geist Mono`
  - Editorial Serif: `Newsreader` / Georgia / Iowan Old Style
- Surface Hierarchy:
  - Level 1: Paper (main content surfaces)
  - Level 2: Raised (cards, widgets, structured data)
  - Level 3: Floating (translucent navigation, drawers, map controls)
- Spacing: Strict 4px base scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96).

---

## 4. Preservation Matrix: High-Quality Capabilities to Protect

1. **PayPal Sandbox Invariants**: All webhook delivery verification, mock-outage toggles, payout idempotency keys, and payment capture flows must remain 100% operational.
2. **Double-Entry Accounting Ledger**: Allocatable funds, protected reserves, and waterfall reconciliations must balance with zero mathematical deviations.
3. **Groq AI Security Boundaries**: Watch Officer and AI Investigator must remain read-only with Zod structured output validation.
4. **AG Studio 3.1.0 Integration**: Four configured analytical widgets, license registration, and data adapters must remain fully interactive.
5. **Sentinel Meteorological Map**: Storm Atlas 3D/overhead projection, nowCOAST WMS radar, GOES-16 cloud-top altitude rasters, and evacuation zones must remain completely functional.

