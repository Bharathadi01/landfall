/**
 * Server-side model call for the AG Studio Agent (Groq free tier, openai/gpt-oss-20b).
 * Never imported by the deterministic financial core. It forwards the tool schemas Studio sends
 * and returns the model's requested tool calls — it executes NOTHING. Tool execution happens in
 * the browser, inside Studio, against tools that cannot move money.
 */
import Groq from "groq-sdk";
import { GROQ_FREE_MODEL, FREE_MODEL_ALLOWLIST, validateModelName, createWithRateLimitRetry } from "@/lib/ai/watch-officer/groq-client";
import { slimTools, dataDictionary } from "./studio-slim";
import { requestToChat, chatChoiceToTurn, type StudioRequestLike, type ModelTurn } from "./studio-llm-mapping";

export class StudioLlmUnavailable extends Error {
  constructor(public code: "NO_KEY" | "RATE_LIMITED" | "PROVIDER_ERROR", message: string) {
    super(message);
  }
}

export async function runStudioChat(req: StudioRequestLike, opts: { client?: Pick<Groq, "chat">; apiKey?: string } = {}): Promise<ModelTurn> {
  const model = validateModelName(GROQ_FREE_MODEL);
  const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY ?? "";
  if (!opts.client && !apiKey) throw new StudioLlmUnavailable("NO_KEY", "GROQ_API_KEY is not set");
  const client = opts.client ?? new Groq({ apiKey, timeout: 20_000, maxRetries: 0 });

  // Studio's own tool schemas are ~45,000 characters; send the model the slimmed (strictly narrower) versions so each call fits the budget.
  const { messages, tools, tool_choice, json } = requestToChat({ ...req, tools: slimTools(req.tools), instructions: [req.instructions, dataDictionary(req.tools)].filter(Boolean).join("\n\n") });
  const allowed = new Set((req.tools ?? []).map((t) => t.name));
  // gpt-oss-20b and gpt-oss-120b have separate per-minute token buckets. A Studio question is two or more model calls, and the second
  // carries the data schema, so one model alone runs out within a minute. Try the other model at once instead of waiting.
  const ladder = [model, ...FREE_MODEL_ALLOWLIST.filter((m) => m !== model)];
  let lastErr: any;
  for (let i = 0; i < ladder.length; i++) {
    const m = ladder[i];
    try {
      const res: any = await createWithRateLimitRetry(client as Groq, {
        model: m,
        messages,
        ...(tools ? { tools, tool_choice } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        temperature: 0.1,
        reasoning_effort: "low",
        max_completion_tokens: 600,
      }, undefined, i === ladder.length - 1 ? 2 : 1);
      return chatChoiceToTurn(res.choices?.[0], allowed, `groq/${m}`, res.usage);
    } catch (err: any) {
      lastErr = err;
      console.warn(`[studio-llm] ${m} failed: status=${err?.status ?? "n/a"} approx_prompt_tokens=${Math.round(JSON.stringify(messages).length / 4)} tools=${tools?.length ?? 0} ${String(err?.message ?? err).slice(0, 300)}${i < ladder.length - 1 ? " (trying the other model)" : ""}`);
    }
  }
  if (lastErr?.status === 429) throw new StudioLlmUnavailable("RATE_LIMITED", "Groq free-tier rate limit");
  throw new StudioLlmUnavailable("PROVIDER_ERROR", String(lastErr?.message ?? lastErr).slice(0, 200));
}
