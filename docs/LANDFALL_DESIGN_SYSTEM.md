# FIELD ATLAS DESIGN SYSTEM SPECIFICATION
## LANDFALL ANTICIPATORY DISASTER RELIEF · GLOBAL HACKATHON EDITION

**Author:** Principal Product Designer & Design Systems Architect  
**Version:** 2.0.0 (Production Release)  
**Date:** November 10, 2026  
**Status:** Implemented & Verified  

---

## 1. Design Philosophy & Creative Direction

Landfall is an anticipatory disaster relief platform connecting meteorological intelligence, donor treasury liquidity, deterministic household prioritization, and dual-custody PayPal Hyperwallet disbursements before hurricane landfall.

The previous interface suffered from the ubiquitous "dark SaaS admin template" cliché: heavy slate backgrounds (`bg-slate-950`), glowing cyan borders, and uniform card grids that obscured operational clarity and felt disconnected from human disaster relief.

The **Field Atlas** design system re-imagines Landfall as:
1. **An Editorial Financial Product**: Clean, authoritative, light-first typography and structured financial ledger tables with tabular numerals.
2. **Contemporary Cartographic Design**: Deep ink contours, parchment surfaces, and precision map overlays that present satellite observations and National Weather Service warning cones with geographical authority.
3. **A Human-Centered Experience**: Radical clarity and progressive disclosure distinguishing emergency decisions, financial safeguards, and multi-language resident dignity.
4. **Controlled Simplicity**: An interface that answers the coordinator's primary operational question — *"What needs attention right now?"* — within 5 seconds.

---

## 2. Foundations: Colour & Semantic Token System

Field Atlas establishes a **Light-First** design system with strict WCAG 2.2 AA contrast compliance across all text and interactive states.

### 2.1 Primary Surface & Ink Tokens

| Token | CSS Variable | Hex Value | Semantic Role |
|---|---|---|---|
| **Canvas** | `--canvas` | `#F4F2EC` | Main page application background; warm stone canvas. |
| **Paper** | `--paper` | `#FFFEFA` | Primary content surfaces, cards, and modal sheets. |
| **Surface Muted** | `--surface-muted` | `#ECEAE2` | Table headers, secondary toolbars, and inactive segments. |
| **Surface Strong** | `--surface-strong` | `#E2E0D8` | Elevated surfaces, hover states, and structured borders. |
| **Deep Ink** | `--deep-ink` | `#192A24` | Primary typography, headlines, and critical figures (Contrast > 11:1). |
| **Secondary Ink** | `--secondary-ink` | `--58665F` | Subtitles, descriptions, and metadata (Contrast > 5.2:1). |
| **Muted Ink** | `--muted-ink` | `#7B847D` | Timestamps, inactive states, and placeholder text (Contrast > 4.5:1). |
| **Border** | `--border-subtle` | `#DEDCD3` | Dividers, card boundaries, and gridlines. |

### 2.2 Brand & Accents

| Token | CSS Variable | Hex Value | Usage |
|---|---|---|---|
| **Evergreen** | `--evergreen` | `#175B47` | Primary brand accent, primary CTA buttons, verified badges. |
| **Evergreen Light**| `--evergreen-light`| `#E0EEE7` | Soft accent surfaces, active tab backgrounds, pill indicators. |
| **Signal Coral** | `--signal-coral` | `#D76E4B` | Storytelling callouts, urgency highlights, critical alert markers. |
| **Warm Amber** | `--warm-amber` | `#D99B43` | Rehearsal / simulation banners, warnings, review queues. |
| **Atlas Blue** | `--atlas-blue` | `#316B9B` | Deep analytical links, NWS meteorological metadata, telemetry. |

### 2.3 Semantic Status System

Never rely on colour alone to communicate state. All indicators pair semantic colour with a distinguishable label and icon.

- **Success / Verified**: `#175B47` text on `#E0EEE7` background with `border-[#97D5B2]` and `CheckCircle2` icon.
- **Attention / Warning**: `#B46914` text on `#FEF5E7` background with `border-[#F3CA8A]` and `AlertTriangle` icon.
- **Critical / Exception**: `#B92525` text on `#FDF4F0` background with `border-[#F5A3A3]` and `AlertCircle` icon.
- **Informational**: `#2B5D88` text on `#E8F1F8` background with `border-[#A9CCE3]` and `Info` icon.
- **Neutral**: `#58665F` text on `#ECEAE2` background with `border-[#DEDCD3]`.

---

## 3. Surface & Material Hierarchy

Field Atlas enforces three physical surface planes:

1. **Level 1 — Canvas & Paper (Base)**:
   - Page background: `#F4F2EC`
   - Content cards: Predominantly opaque `#FFFEFA` with crisp 1px `#DEDCD3` borders and soft ambient drop shadows (`box-shadow: 0 1px 3px rgba(25, 42, 36, 0.04)`).
2. **Level 2 — Raised (Cards & Modules)**:
   - Data widgets, metric cards, exception cards, and form containers.
   - Distinct hover states with `#175B47` border accents and 0.5px subtle lift.
3. **Level 3 — Floating (Overlays & Map Controls)**:
   - Top contextual breadcrumb navigation, Sentinel map layer switchers, passkey modals, and detail drawers.
   - Frosted glass effect used selectively (`backdrop-blur-md` with `bg-[#FFFEFA]/90` or `bg-[#192A24]/80` on the map) to ensure maximum text readability without muddling data underneath.

---

## 4. Typography Scale & Formatting

Field Atlas pairs an editorial serif with modern technical sans and mono:
- **Primary UI**: `Geist Sans` (`var(--font-sans)`)
- **Data & Identifiers**: `Geist Mono` (`var(--font-mono)`)
- **Editorial Headlines**: `Newsreader` / Serif fallback (`var(--font-serif)`)

### Typographic Scale

| Element | Desktop | Mobile | Line Height | Tracking | Weight |
|---|---:|---:|---:|---:|---|
| **Marketing Hero** | `clamp(2.5rem, 5vw, 4.5rem)` | 2.5rem | 1.08 | -0.03em | Bold (700) |
| **Page Title** | 2.25rem (36px) | 1.875rem (30px) | 1.15 | -0.025em | Bold (700) Serif |
| **Section Heading** | 1.5rem (24px) | 1.3125rem (21px) | 1.25 | -0.02em | Semi-bold (600) Serif |
| **Card Heading** | 1.125rem (18px) | 1.0625rem (17px) | 1.3 | -0.015em | Bold (700) Sans |
| **Body Large** | 1.0625rem (17px) | 1rem (16px) | 1.55 | normal | Regular (400) |
| **Body Default** | 0.9375rem (15px) | 0.9375rem (15px) | 1.5 | normal | Regular (400) |
| **Supporting / Meta** | 0.8125rem (13px) | 0.8125rem (13px) | 1.4 | +0.01em | Medium (500) |
| **Technical / Hashes** | 0.75rem (12px) | 0.75rem (12px) | 1.35 | +0.02em | Semi-bold Mono |

### Formatting Rules
- **Financial Figures**: Always set in tabular numerals (`tabular-nums font-mono font-bold`) and right-aligned in table columns.
- **Currencies**: Always include ISO currency code on public surfaces (e.g. `$500.00 USD`).
- **Cryptographic & Provider IDs**: Rendered in monospace font with copy-to-clipboard actions and truncated display (e.g. `81V9...04P`).

---

## 5. AG Studio 3.1.0 Custom Theme

Landfall embeds AG Studio 3.1.0 with official AG Grid & AG Charts theming API:

```typescript
import { themeQuartz } from "ag-grid-community";

export const fieldAtlasTheme = themeQuartz.withParams({
  backgroundColor: "#FFFEFA", // Paper
  foregroundColor: "#192A24", // Deep ink
  headerBackgroundColor: "#ECEAE2", // Surface muted
  headerTextColor: "#58665F", // Secondary ink
  borderColor: "#DEDCD3", // Border
  rowBorder: { color: "#EBE9E1" },
  headerRowBorder: { color: "#DEDCD3" },
  oddRowBackgroundColor: "#FFFEFA",
  rowHoverColor: "rgba(224, 238, 231, 0.45)", // Evergreen light soft hover
  selectedRowBackgroundColor: "rgba(224, 238, 231, 0.75)", // Evergreen selected
  accentColor: "#175B47", // Evergreen primary accent
  chromeBackgroundColor: "#F4F2EC", // Canvas
  fontSize: 12.5,
  fontFamily: "var(--font-sans, system-ui, sans-serif)",
});
```

Benefits:
- Eliminates legacy dark/light mismatches.
- Embedded AG Charts (bar charts, donuts, and KPI summary tiles) automatically adopt Field Atlas palette.
- AG Studio AI Harness (backed by Groq Free Tier LLM) renders suggestions with seamless contrast.

---

## 6. Information Architecture: Three Experience Shells

`components/layout/UnifiedAppShell.tsx` renders three specialized layouts:

### A. Public Experience Shell (`/`)
- Minimalist sticky editorial header with LF insignia and public section jumps.
- Primary CTA: *"Explore Landfall"* (`/console/war-room`).
- Resident CTA: *"Resident Assistance"* (`/r/enroll`).
- Contextual breadcrumb bar showing live PayPal Sandbox and Zero-Cost AI verification status.

### B. Operations Experience Shell (`/console/*`, `/spike`)
- Compact, collapsible left sidebar (expanded 244px, collapsed 68px).
- Navigation divided into two clear operational sections:
  1. **Command**: War Room, Golden Workflow, Sentinel Weather, Rehearsal Lab.
  2. **Intelligence & Audit**: Watch Officer AI, Recipient Directory, PayPal Audit Ledger.
- Top contextual toolbar showing page title, live provider telemetry (NWS live, PayPal Sandbox active, Groq AI $0.00), and quick action controls.

### C. Resident Portal Shell (`/r/*`)
- Calm, accessible, distraction-free layout.
- Prominent top-level language switcher supporting:
  - English (EN)
  - Español (ES)
  - Kreyòl Ayisyen (HT)
  - Tiếng Việt (VI)
  - 简体中文 (ZH)
- Plain-English reassurance regarding AES-256 bank-grade encryption and privacy safeguards.

---

## 7. Motion & Interaction Standards

All animations adhere to strict performance and accessibility standards:
- **Respects `prefers-reduced-motion`**: Disabled or instant transitions for users with motion sensitivity.
- **Page Entrance**: Coordinated 450–700ms sequence (Hero tag → Headline → Subtitle → CTA).
- **Interface Transitions**: 150–250ms cubic-bezier easing for tabs, dropdowns, and drawers.
- **Zero Distracting Loops**: No constantly pulsing buttons, bouncing badges, or decorative particle canvas animations.

