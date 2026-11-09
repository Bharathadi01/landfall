# Design QA & Accessibility Audit Report

## 1. Design System & Visual Hierarchy

Landfall is engineered to feel like an authoritative, mission-critical humanitarian finance command center.

- **Theme & Palette:** Dark operational substrate (`slate-950` / `#020617`, `slate-900` / `#0f172a`, `slate-800` / `#1e293b`).
- **Telemetry Accents:**
  - `sky-400` / `blue-500`: Neutral system status, metadata, coordinates, IDs.
  - `emerald-400` / `emerald-500`: Verified liquid capital, confirmed payouts, passing integrity checks.
  - `amber-400` / `amber-500`: Protected reserve floors, pending or unclaimed funds, rehearsal disclaimers.
  - `rose-400` / `rose-500`: Severe hazard alerts, surge warnings, failed disbursements, urgent action items.
  - `purple-400` / `purple-500`: Cryptographic hashes, WebAuthn passkeys, AG Studio canvas elements.
- **Typography:**
  - High-legibility sans-serif UI stack for rapid readability under stressful operational conditions.
  - Monospace font (`font-mono`) for all financial amounts, hashes, IDs, and coordinates to prevent digit misalignment.

---

## 2. Accessibility & Non-Map Equivalents (WCAG 2.1 AA)

- **MapLibre Non-Map Alternative:**
  For low-bandwidth connections, mobile devices, screen readers, or visually impaired users, the War Room and Sentinel consoles provide an interactive AG Grid tabular view of exposed sectors, coordinates, and household priority tiers with identical data parity.
- **High-Contrast Text Hierarchy:**
  All body text exceeds WCAG 2.1 AA 4.5:1 contrast ratios against dark slate backgrounds (`slate-100` / `white` on `slate-950` = 16.5:1).
- **Interactive Focus States:**
  Keyboard navigation is supported across all buttons, selectors, tabs, and passkey modal dialogs with visible focus rings (`focus:ring-2 focus:ring-sky-400`).
- **Screen Reader Announcements:**
  Critical state banners (e.g. "Rehearsal Mode Active", "Dual Approval Required") include explicit semantic labels and role announcements.

---

## 3. Multilingual Accessibility

The Resident Portal (`/r/enroll`) and Appeals Tracker (`/r/complaints`) feature first-class multilingual support across the five most prevalent languages spoken in Florida, Texas, and Gulf Coast disaster zones:
1. **English (en)**
2. **Spanish / Español (es)**
3. **Haitian Creole / Kreyòl Ayisyen (ht)**
4. **Vietnamese / Tiếng Việt (vi)**
5. **Chinese / 简体中文 (zh)**

All localized strings are verified for disaster relief clarity without colloquial confusion.

