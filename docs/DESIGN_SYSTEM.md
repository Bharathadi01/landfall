# Landfall design system — Broadcast weather desk

Source of truth: `styles/design-tokens.css`, `styles/typography.css`, `styles/components.css`, `tailwind.config.ts`.
This replaces the earlier "Field Atlas" and "Eye of the Storm" documents.

## Idea
A TV weather studio at night: warm graphite, frosted glass panes like on-air graphics, a globe as the hero. Lower-thirds, a live clock, a storm "bug" and a news crawl give the product its voice. No grid backdrop, no aurora orbs.

## Type
| Role | Face | Notes |
|---|---|---|
| Display / headlines | Fraunces | variable `opsz`, `SOFT`, `WONK`; italic for the single emphasised phrase |
| UI / body | Schibsted Grotesk | |
| Data, labels, tickers | Martian Mono | run condensed (`font-stretch: 87.5%`); tabular figures |

## Colour = meaning
| Token | Hex | Use |
|---|---|---|
| `canvas` / `surface*` | #0A0A0C → #262429 | warm graphite, never navy |
| `ink`, `ink-2`, `ink-3` | #F3EFE8 / #B9B3AA / #8A847B | text (ink-3 ≥ 5:1 on canvas) |
| `accent` | #FF6B2C | the action, the live moment, "now" |
| `money` | #F2C14E | relief dollars |
| `delivered` | #6FD49A | confirmed delivery, done |
| `paypal` | #4C9BFF | PayPal rails and sandbox evidence only |
| `ai` | #8EE3F5 | AI advises (read-only) |
| `amber` | #FFB020 | protected reserve, caution, pending |
| `storm` | #FF4FA3 | hazard, exposure |
| `danger` | #FF3B4E | failure, blocked |

Map hazards use official NWS hazard colours.

## Glass
Panes use `--glass-fill*` over a translucent surface with backdrop blur and a specular top edge. Buttons add a pointer-tracked highlight and, in Chromium, refraction through the shared `#lg-refract` SVG filter (defined once in `app/layout.tsx`). Other engines fall back to blur.

## Honesty labels are part of the design
Replay data, sandbox mode, simulated steps and demo passkeys must stay visible in every layout. "PayPal SUCCESS" is provider evidence, not proof the family received help.

## Components (`components/ui`, `components/grid`, `components/sentinel/desk`)
- `Button` — liquid glass; variants `signal` (primary), `glass`, `ghost`, `paypal`, `danger`. `Tag` is the on-air label (solid = LIVE / REPLAY / SANDBOX bug). `GlassPane` levels 1–3. `LowerThird`, `NewsCrawl`, `SegmentedTabs`, `Ticker`, `LiveClock`, `Dialog`.
- Icons: one concept = one icon through `components/icons` (`I.twoKeyApproval`, `I.reserve`, …). Phosphor duotone for generic UI plus 14 hand-drawn Landfall glyphs. `tests/ui/icon-registry.test.ts` guards uniqueness.
- Colour: `tests/ui/no-raw-palette.test.ts` forbids raw Tailwind palette classes; use meaning tokens.

## The storm desk globe
Real data only: NASA GIBS GOES-East/West + Himawari infrared lifted into 3D clouds, RainViewer radar and falling rain, Open-Meteo wind and 48 h forecast, NWS warnings, NHC storms. Replay data (Milton 2024) is drawn only in replay mode and always tagged. WebGL layers live in `components/sentinel/desk/gl`.

## The case grid
`components/grid/CaseGrid.tsx` is the centre of the app: AG Grid Enterprise with grouping panel, set/floating filters, sparkline, integrated charts, Find, context menu, live feed with cell flashing, custom status bar, and a globe linked both ways. Licence keys: `NEXT_PUBLIC_AG_GRID_LICENSE` (grid) and `NEXT_PUBLIC_AG_STUDIO_LICENSE` (Studio) are separate.
