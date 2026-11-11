/**
 * INPUT SCREENING for every AI surface that accepts free text.
 *
 *   layer 1  regex    — the existing money-movement pattern (free, instant, deterministic)
 *   layer 2  Prompt Guard 2 (86M) on Groq — a probability that the text is a prompt injection / jailbreak
 *   layer 3  gpt-oss-safeguard-20b with docs/policies/ai-money-policy.md — for the ambiguous middle band AND for any
 *            message that mentions money, approvals, rules or personal data (Prompt Guard detects injection phrasing,
 *            not plain requests like "approve the pending plan")
 *
 * This is defence in depth, NOT the control that protects money: the AI has no tool that can move money, and the
 * Treasurer needs two server-verified human approvals. If the model layers are unavailable we say so and fall back to
 * the regex layer (fail-open for a READ-ONLY assistant, never for anything that could change state).
 */
import Groq from "groq-sdk";
import fs from "node:fs";
import path from "node:path";
import { isMoneyMovementRequest } from "@/lib/studio/studio-answers";
import { MODELS } from "@/lib/ai/groq";

/** Words that make a message worth a policy check even when Prompt Guard sees no injection pattern in it. */
export const SENSITIVE = /\b(pay|paid|payout|payment|approve|approval|authori[sz]|send|resend|re-?issue|cancel|refund|transfer|ledger|reserve|priority|tier|eligib|skip|bypass|override|admin|name|names|phone|address|email|receiver|account|decrypt|dump|pii|personal|secret|key|password|prompt|instruction|rules?|policy)\b/i;
export const BLOCK_AT = 0.9;
export const ALLOW_BELOW = 0.1;

export type Layer = "regex" | "prompt_guard" | "safeguard" | "none";
export interface Verdict {
  action: "allow" | "block";
  layer: Layer;
  score?: number;
  /** true when a model layer could not be reached and only the regex layer judged this text. */
  degraded?: boolean;
  reason: string;
}

type Client = Pick<Groq, "chat">;
let policyText: string | null = null;
const policy = () => (policyText ??= fs.readFileSync(path.join(process.cwd(), "docs/policies/ai-money-policy.md"), "utf8"));

export async function promptGuardScore(text: string, client: Client): Promise<number> {
  const r = await client.chat.completions.create({ model: MODELS.guard(), messages: [{ role: "user", content: text.slice(0, 2000) }] } as never);
  const n = Number(r.choices?.[0]?.message?.content);
  if (!Number.isFinite(n)) throw new Error("Prompt Guard returned a non-number");
  return n;
}

export async function safeguardVerdict(text: string, client: Client): Promise<"ATTACK" | "SAFE"> {
  const r = await client.chat.completions.create({
    model: MODELS.safeguard(),
    messages: [{ role: "system", content: policy() }, { role: "user", content: text.slice(0, 2000) }],
    reasoning_effort: "low",
    max_completion_tokens: 512,
    temperature: 0,
  } as never);
  return /\bATTACK\b/i.test(r.choices?.[0]?.message?.content ?? "") ? "ATTACK" : "SAFE";
}

export interface ScreenOptions {
  client?: Client;
  /** Skip model layers (tests, or when no key is configured). */
  regexOnly?: boolean;
}

export async function screen(text: string, opts: ScreenOptions = {}): Promise<Verdict> {
  if (isMoneyMovementRequest(text)) return { action: "block", layer: "regex", reason: "Asks the assistant to move or change money." };
  const client = opts.client ?? (process.env.GROQ_API_KEY && !opts.regexOnly ? new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 8000, maxRetries: 0 }) : null);
  if (!client) return { action: "allow", layer: "regex", degraded: true, reason: "Only the regex layer was available." };
  try {
    const score = await promptGuardScore(text, client);
    if (score >= BLOCK_AT) return { action: "block", layer: "prompt_guard", score, reason: "Prompt Guard flagged this as an injection attempt." };
    if (score < ALLOW_BELOW && !SENSITIVE.test(text)) return { action: "allow", layer: "prompt_guard", score, reason: "Prompt Guard found nothing suspicious and the message touches nothing sensitive." };
    // ambiguous score, or a message about money/approvals/personal data → a policy-following model decides
    const v = await safeguardVerdict(text, client);
    return v === "ATTACK"
      ? { action: "block", layer: "safeguard", score, reason: "The safeguard model judged this as an attack under the AI input policy." }
      : { action: "allow", layer: "safeguard", score, reason: "The safeguard model judged this as safe." };
  } catch {
    return { action: "allow", layer: "regex", degraded: true, reason: "The model layers were unavailable; only the regex layer judged this text." };
  }
}
