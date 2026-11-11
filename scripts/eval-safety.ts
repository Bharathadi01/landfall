/**
 * Measures the input-screening layers on evals/safety.jsonl (labelled attack/benign prompts).
 *   pnpm exec tsx --env-file=.env.local scripts/eval-safety.ts
 * Writes docs/AI_EVAL_RESULTS.md. Calls Groq (Prompt Guard 2 and, for ambiguous scores, gpt-oss-safeguard); paced for the free tier.
 */
import fs from "node:fs";
import Groq from "groq-sdk";
import { isMoneyMovementRequest } from "../lib/studio/studio-answers";
import { screen, promptGuardScore, BLOCK_AT, ALLOW_BELOW } from "../lib/ai/safety/guard";

type Row = { text: string; label: "attack" | "benign" };
const rows: Row[] = fs.readFileSync("evals/safety.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 15000, maxRetries: 2 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const out: Array<Row & { regex: boolean; score: number | null; guard: boolean; combined: boolean; layer: string; safeguard?: string; ms: number }> = [];
  for (const r of rows) {
    const regex = isMoneyMovementRequest(r.text);
    let score: number | null = null;
    const t0 = Date.now();
    try {
      score = await promptGuardScore(r.text, client);
    } catch (e) {
      console.error("model error:", (e as Error).message.slice(0, 80));
    }
    await sleep(800);
    const v = await screen(r.text, { client }); // the shipped pipeline (regex → Prompt Guard → safeguard)
    const guard = score !== null && score >= BLOCK_AT;
    const combined = v.action === "block";
    const layer = v.action === "block" ? v.layer : "none";
    const safeguard = v.layer === "safeguard" ? (combined ? "ATTACK" : "SAFE") : undefined;
    out.push({ ...r, regex, score, guard, combined, layer, safeguard, ms: Date.now() - t0 });
    await sleep(2200);
  }
  const atk = out.filter((x) => x.label === "attack");
  const ben = out.filter((x) => x.label === "benign");
  const pct = (n: number, d: number) => `${n}/${d} (${((100 * n) / d).toFixed(0)}%)`;
  const row = (name: string, f: (x: (typeof out)[number]) => boolean) => `| ${name} | ${pct(atk.filter(f).length, atk.length)} | ${pct(ben.filter(f).length, ben.length)} |`;
  const lat = out.map((x) => x.ms).sort((a, b) => a - b);
  const missed = atk.filter((x) => !x.combined).map((x) => `- ${x.text} _(PG score ${x.score?.toFixed(3)})_`);
  const falsePos = ben.filter((x) => x.combined).map((x) => `- ${x.text} _(layer: ${x.layer}, PG score ${x.score?.toFixed(3)})_`);
  const md = `# AI input-screening evaluation

Run: ${new Date().toISOString()} · ${rows.length} labelled prompts (${atk.length} attacks, ${ben.length} benign, incl. Spanish / Vietnamese / French) in \`evals/safety.jsonl\`.
Thresholds: Prompt Guard 2 (86M) block ≥ ${BLOCK_AT}, allow < ${ALLOW_BELOW}, in between → \`gpt-oss-safeguard-20b\` with \`docs/policies/ai-money-policy.md\`.

| Layer | Attacks blocked | Benign wrongly blocked |
|---|---|---|
${row("Regex only (previous behaviour)", (x) => x.regex)}
${row("Prompt Guard 2 only (≥ " + BLOCK_AT + ")", (x) => x.guard)}
${row("Regex + Prompt Guard + safeguard (shipped)", (x) => x.combined)}

Latency per prompt (Prompt Guard + optional safeguard call): p50 ${lat[Math.floor(lat.length * 0.5)]} ms · p95 ${lat[Math.floor(lat.length * 0.95)]} ms.

## Attacks that got through the shipped layers
${missed.join("\n") || "_none_"}

## Benign prompts that were wrongly blocked
${falsePos.join("\n") || "_none_"}

## Caveats
- The p95 latency includes free-tier rate-limit back-off (HTTP 429 retries inside the Groq client); typical cases are ~1 s.
- ${rows.length} hand-written prompts is a small sample written by the project author, not an independent benchmark; treat the percentages as indicative.
- Screening is defence in depth for a READ-ONLY assistant. Money safety does not depend on it: the AI has no tool that moves money and the Treasurer requires two server-verified human approvals.
`;
  fs.writeFileSync("docs/AI_EVAL_RESULTS.md", md);
  console.log(md);
})();
