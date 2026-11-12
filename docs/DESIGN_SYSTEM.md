# Landfall design system — "Refuge"

Source of truth: `styles/design-tokens.css`, `styles/typography.css`, `styles/components.css`, `styles/ag-studio-theme.ts`, `tailwind.config.ts`.
This replaces the earlier "Broadcast weather desk", "Field Atlas" and "Eye of the Storm" directions.

## The idea
Landfall exists to help. Its interface borrows the visual language of help, not of alarm: the paper forms and maps relief work runs on,
the green of first-aid and safe-exit signs, the warmth of the morning after a storm. Everyone who opens it is under some stress: a coordinator
hours before landfall, a finance officer asked to approve money, a resident who has just evacuated. Stress narrows attention and taxes working
memory, so every screen is built to be understood in seconds.

### Principles (and the research behind them)
1. **One question per screen, one primary action.** Under stress people fixate on a few cues; choice overload slows decisions (Hick's law).
   Every console page opens with the question it answers and has a single green action.
2. **Always say where you are and what comes next.** Uncertainty, not bad news, is what people find hardest to bear. The sidebar follows the
   life of a relief payment (Before landfall → Decide and pay → Did it land?), every page header says its stage, and every page ends with a
   "Next" step. The tour shows its whole outline before it starts.
3. **Progressive disclosure.** Summary first, detail on request: the Command Center shows three zones; evidence, scenarios and the money
   trail sit one click deeper.
4. **Gentle shapes.** People judge curved contours as safer than sharp angles (Bar & Neta, 2006). Panes have 8px corners, controls 6px, never pills.
5. **Plain, dignified words.** "Families" and "households", not "beneficiaries"; "Something wrong? Tell us." rather than "Assistance Review".
6. **Truth is visible.** Every fact says who reported it (PayPal, the family, Landfall, an operator). AI output is drawn as a draft.

## Colour = meaning
| Token | Hex | Meaning |
|---|---|---|
| `canvas` / `surface*` | #F6F3EC → #FFFFFF | warm paper: open, hopeful, calm. Light reads as safety; a dark "situation room" reads as threat |
| `ink`, `ink-2`, `ink-3` | #18221E / #46504B / #68706B | deep evergreen-black text (ink-3 ≥ 4.7:1 on paper) |
| `accent` (refuge green) | #0E6B50 | the one thing you can do, and the brand. ISO 7010 "safe condition" green: this way to safety, help is here |
| `sun` (sunrise) | #E8A33D | the morning after the storm. Logo and moments of hope only, never a status |
| `delivered` (leaf green) | #268C54 | it reached the family |
| `amber` | #B07012 | waiting on someone: pending, unclaimed, needs a person. Never a failure |
| `danger` (brick) | #B42318 | failed or blocked. Rare, so it is never ignored |
| `paypal` | #005EB8 | PayPal says so: facts from PayPal's own records |
| AI | no colour | drawn as a **draft**: a dashed edge (`.ai-draft`) and a dashed tag. It is advice for a person |

Maps are night instruments: inside `.theme-night` (the Storm Desk globe and its HUD, the map beside the payments grid) tokens switch to a
dark set so satellite imagery and radar read clearly. Map hazards keep official NWS colours; storm tracks are drawn in red, as NHC does.

## Type
| Role | Face | Why |
|---|---|---|
| Headlines | Archivo, expanded (`font-stretch` 106–118%) | the wide, steady letterforms of public-information signage: calm authority. The second half of a headline drops to a light weight, never a second colour |
| Everything people read and press | Public Sans | the U.S. Web Design System face, built for public-service forms read by everyone, including people in a crisis |
| Identifiers only | Overpass Mono (`font-code`) | Highway Gothic lineage: the evacuation-route signs families follow. Used for PayPal item IDs, batch IDs, hashes and codes, nothing else |

`font-mono` is kept as a utility name for labels and figures but renders tabular Public Sans, so screens no longer look like a terminal.
All numbers are tabular and lining.

## The mark
A roof over a sun rising on the coastline, with the sea beneath, on a refuge-green tile: shelter, the morning after the storm, and landfall
itself, where the sea meets the land. `components/brand/LandfallMark.tsx`, `app/icon.svg`.

## Components
- **Buttons**: `signal` (refuge green, one per view), `glass` (white, hairline), `ghost` (text), `danger`. Decorative trailing arrows are hidden;
  meaningful leading icons stay. 40px default height.
- **Tag**: a word with a small dot in its status colour. AI tags are dashed.
- **Note** (`.note[data-tone]`): every notice, warning and confirmation is a 2px rule in its status colour, a short bold label, then plain words.
- **Tabs** (`.tabs`/`.tab`) for page sections; **segmented control** (`.seg`) for switching a view.
- **Next step** (`.next-step`): the wayfinding footer on every console page, driven by `components/layout/flow.ts`.
- **Skeleton** (`.skeleton`): calm shimmer for loading states; no spinners on page loads.

## Information architecture
`components/layout/flow.ts` is the single ordered list that drives the sidebar, the "Next" footer and the guided tour.

| Stage | Question | Pages |
|---|---|---|
| (home) | What needs a person now? | Command Center |
| Before landfall | Who is in the storm's path? | Storm Desk, Storm Drill |
| Decide and pay | Who gets paid, and who agreed? | Guided Response, Approvals, Households |
| Did it land? | Did the money reach each family? | Payments (AG Grid), AI Watch Officer, Analytics Studio (AG Studio) |

Public flow: Home (live globe) → "Enter the console" → choose a seat (sign-in) → Command Center. Signing out returns to Home.

## Motion (GSAP)
Calm and purposeful, never bouncy; everything respects `prefers-reduced-motion`.
- Page entrance: the header, then each block a beat later (`expo.out`, 55 ms stagger).
- The sidebar's "you are here" marker glides between items.
- Command Center: the delivery-line bars grow left to right; figures count up.
- Landing: the headline surfaces line by line; "How it works" draws a line down the clock as you read and lights each step; proof bars grow in.
- AI answers surface as a draft, then their findings follow one by one; a citation pressed lights up its evidence.
- Tour: the outline rises in part by part; a spotlight glides from subject to subject; captions crossfade.

## AG Grid and AG Studio
One theme (`styles/ag-studio-theme.ts`) for AG Grid, AG Studio and AG Charts on the same palette. Payments and the household directory are AG
Grid; series colours follow meaning (reached, PayPal, action, waiting).
