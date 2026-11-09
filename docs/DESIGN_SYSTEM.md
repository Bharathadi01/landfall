# Landfall — Product Design System & Interface Specification

## 1. Visual Direction: Premium Disaster Command Centre

Landfall is designed as a mission-critical financial operations command centre for humanitarian relief coordinators, residents, and donors. It rejects decorative neon effects, generic dashboard templates, and unnecessary visual noise in favour of clarity, information hierarchy, and operational calmness under crisis.

---

## 2. Colour System & Tokens

### Foundations
- **Canvas Base:** `#020617` (`slate-950`) — Deepest obsidian navy foundation.
- **Card Surfaces:** `#0f172a` (`slate-900`) — Structured module container background.
- **Sub-surfaces:** `#020617` with `#1e293b` borders — Inner telemetry readouts and code panels.
- **Borders:** `#1e293b` (`slate-800`) and `#334155` (`slate-700`) — Subtle, structural dividing lines.

### Signal Semantics
- **Verified / Safe:** `#10b981` (`emerald-500`) / `#064e3b` (`emerald-950`) — Confirmed payouts, healthy feeds.
- **Informational / Primary:** `#3b82f6` (`blue-500`) / `#172554` (`blue-950`) — Sentinel spatial checks, general flows.
- **Warning / Review:** `#f59e0b` (`amber-500`) / `#451a03` (`amber-950`) — Stale feeds, historical replay mode.
- **Hazard / Critical:** `#ef4444` (`red-500`) / `#450a0a` (`red-950`) — Hurricane warnings, policy anomalies, outage.
- **Advisory / AI:** `#a855f7` (`purple-500`) / `#3b0764` (`purple-950`) — Watch Officer, AG Studio Assistant.

---

## 3. Responsive Layout Strategy

The application layout is engineered and verified across four standard target viewports:

| Device Target | Viewport Width | Interface Adaptation |
|---|---|---|
| **Desktop Workstation** | `1440px+` | Full 12-column AG Grid War Room, side-by-side WMS radar map and telemetry panels. |
| **Operational Laptop** | `1280px` | Adaptive 12-column layout with scrollable telemetry ribbons and compact chart cards. |
| **Field Tablet** | `768px` | Stacked grid; interactive map remains touch-friendly with layer toggles preserved. |
| **Resident Mobile** | `390px` | Single-column, mobile-first resident enrollment form, big touch targets (min 44px), sticky status banner. |

---

## 4. Accessibility & WCAG AA Compliance

1. **Contrast Ratios:** All primary text elements maintain a minimum contrast ratio of **4.5:1** against backgrounds (standard body text achieves **7:1+** white on `slate-950`).
2. **Keyboard Navigation:** All interactive controls (tabs, scenario selectors, layer toggles, modal dialogs) feature visible focus indicators (`ring-2 ring-blue-500`).
3. **Screen Reader Support:** Form inputs include explicit `<label>` tags with matching `htmlFor` or nested wrapping.
4. **Reduced Motion:** Interactive state transitions respect user preferences via Tailwind's `motion-safe` utilities.

---

## 5. Three Complete Product Surfaces

### Surface A: Resident Assistance Portal (`/r/enroll`)
- **Target Audience:** Vulnerable community members in hurricane-prone coastal areas.
- **Key Capabilities:** Mobile-first multilingual onboarding (`en`, `es`, `ht`, `vi`, `zh`), primary vs. displaced address separation, evidence upload with location-only disclaimer, real-time application status tracker, and community appeals form.

### Surface B: Coordinator War Room (`/console/war-room`)
- **Target Audience:** Fund coordinators, emergency directors, and humanitarian trustees.
- **Key Capabilities:** Real-time NWS/nowCOAST weather map centerpiece, AG Grid Community & AG Charts Community integration, Watch Officer assistant with suggested inquiries, 8 synchronized operational widgets, and dual passkey authorization.

### Surface C: Donor Transparency Experience (`/`)
- **Target Audience:** Institutional donors, mutual aid contributors, and the public.
- **Key Capabilities:** Interactive PayPal Sandbox donation widget with preset amounts, pre-disaster liquidity ladder telemetry, 99.75% capital efficiency metric, and peer-reviewed WFP/World Bank research citations.

