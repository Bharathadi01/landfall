# AI verification (what was actually run)

All runs below were made against the live Groq API with the project's key on 2026-11-11, using synthetic case data only
(`scripts/ai-smoke.ts`, `scripts/watch-officer-smoke.ts`).

## AI Case Officer (`gpt-oss-120b`)
- Input: one synthetic UNCLAIMED $100 case (20 claim-days left, resident has not answered).
- The model called the read-only tools (`get_case`, `get_recovery_rules`), then returned strict JSON.
- Result: `answeredBy: "ai"`, 4 cited facts, one hypothesis, one unknown, recommended action `SEND_REMINDER`
  (allowed by the rules), a Spanish resident message with an English gloss, 0 dropped facts. About 2.8 s end to end.
- Bugs found and fixed by this run: the model sometimes writes its final JSON as a "tool call" (Groq 400
  `tool_use_failed`) — now handled; `reasoning_effort` must be set or gpt-oss can return empty content — now set.

## Watch Officer (`gpt-oss-20b`)
- Before: the live path always fell back, because evidence ids contained `Date.now()` (so every citation was "invalid"),
  the schema was never sent to the model, and the token budget was too small.
- After: the model answers (`model: groq/openai/gpt-oss-20b`, ~6 s); citations match; the server still overrides a
  model-claimed readiness state that disagrees with the deterministic one (and records that in `warnings`).
- Groq's free tier rate-limits (HTTP 429) when runs are repeated within a minute; the page then shows
  "OFFLINE TEMPLATE (AI unavailable)" rather than pretending.

## Not yet measured
Block rate / false-positive rate of the prompt-injection layer and investigator factuality over a labelled set
(`evals/`) have **not** been run. Do not cite numbers for them.
