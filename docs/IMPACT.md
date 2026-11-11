# Impact: why "did it reach them?" matters

Landfall's thesis: a payment provider's "SUCCESS" means *credited*, not *received and usable*. In the real batch we imported,
PayPal reports the batch `SUCCESS`, yet **1 of 5 items was credited and 4 ($400) were UNCLAIMED** — 30-day claim links the
recipients had not used. A fund looking only at the batch status would have counted $500 as delivered.

## External evidence (retrieved 2026-11-11; read the sources, do not trust our paraphrase)
- **Unbanked households:** FDIC's 2023 survey: 4.2% of US households (~5.6 million) were unbanked; two-thirds of them relied entirely on cash.
  <https://fdic.gov/household-survey/2023-fdic-national-survey-unbanked-and-underbanked-households-executive-summary>
- **Accountability gap:** the Core Humanitarian Standard's Commitment 5 (people can safely report concerns and get them addressed) is
  consistently the lowest-scoring commitment in CHS Alliance verification data.
  <https://www.chsalliance.org/get-support/article/meeting-chs-commitment-5-five-best-practice-tips-when-responding-to-complaints/>
- **AI without an answer loop:** The New Humanitarian (31 Aug 2026) reports that GiveDirectly's AI-triggered flood cash programme in
  Nigeria excluded some of the most vulnerable people (939 failed ID checks; others lacked a charged phone for verification calls).
  <https://www.thenewhumanitarian.org/investigations/2026/08/31/givedirectlys-ai-experiment-left-vulnerable-flood-victims-behind-nigeria>

## What Landfall changes (demonstrated, Sandbox scale)
| Problem | Landfall behaviour | Evidence |
|---|---|---|
| "Sent" ≠ "received" | five-stage case per payment; SUCCESS shown as *credited*, only the resident's own answer closes it | `/console/war-room`, live data |
| Stuck money | UNCLAIMED payments surfaced with days left; the resident can say "I can't get to it" in their language | resident page, `docs/LIVE_PROOF.md` |
| One person moving money | proposal → two different people (one Finance) approve the exact payload → Treasurer executes once; server-verified | `tests/proposals/*`, live cancel of one $100 unclaimed item |
| AI deciding alone | AI investigates and drafts only; every fact cites evidence; action clamped to deterministic rules | `lib/ai/case-officer`, `docs/AI_VERIFICATION.md` |

## Limits (stated plainly)
- All money is PayPal Sandbox play money and the households are fictional; no real-world outcome is claimed.
- No stakeholder interviews are claimed; see `docs/VALIDATION_KIT.md` and `/validate`.
- Whether funds would pay for or adopt this is an open hypothesis.
