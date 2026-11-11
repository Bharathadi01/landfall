/**
 * Groq gateway used by every AI feature that needs a model.
 *
 * What it fixes (all were real bugs found against the live API):
 *  - gpt-oss models return EMPTY content when reasoning_effort is unset and the token budget is small → we always set
 *    reasoning_effort and a generous max_completion_tokens;
 *  - a truncated answer (finish_reason "length") used to be parsed as if it were complete → we throw instead;
 *  - 429s used to drop straight to a silent fallback → one jittered retry that honours Retry-After.
 * Every caller must handle GroqUnavailable by labelling its fallback as such; nothing here hides a failure.
 */
import Groq from "groq-sdk";

export const MODELS = {
  reasoning: () => process.env.GROQ_MODEL_REASONING || "openai/gpt-oss-120b",
  fast: () => process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b",
  guard: () => process.env.GROQ_MODEL_GUARD || "meta-llama/llama-prompt-guard-2-86m",
  safeguard: () => process.env.GROQ_MODEL_SAFEGUARD || "openai/gpt-oss-safeguard-20b",
  stt: () => process.env.GROQ_MODEL_STT || "whisper-large-v3-turbo",
};

export class GroqUnavailable extends Error {
  constructor(public readonly code: "TOOL_FORMAT" | "NO_KEY" | "RATE_LIMITED" | "TIMEOUT" | "EMPTY" | "TRUNCATED" | "PROVIDER_ERROR" | "BAD_JSON", message: string) {
    super(message);
    this.name = "GroqUnavailable";
  }
}

export type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
export type ToolDef = Groq.Chat.Completions.ChatCompletionTool;

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  /** JSON schema for a strict structured answer. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  timeoutMs?: number;
  /** Test seam. */
  client?: Pick<Groq, "chat">;
}

export interface ChatResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; args: string }>;
  finishReason: string;
  model: string;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number };
}

export const groqConfigured = () => !!process.env.GROQ_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  if (!opts.client && !groqConfigured()) throw new GroqUnavailable("NO_KEY", "GROQ_API_KEY is not configured.");
  const client = opts.client ?? new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: opts.timeoutMs ?? 20_000, maxRetries: 0 });
  const model = opts.model ?? MODELS.reasoning();
  const started = Date.now();

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: opts.messages,
        ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" as const } : {}),
        ...(opts.jsonSchema ? { response_format: { type: "json_schema" as const, json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema } } } : {}),
        // gpt-oss: required for non-empty content on short budgets
        reasoning_effort: opts.effort ?? "low",
        max_completion_tokens: opts.maxTokens ?? 4096,
        temperature: 0.2,
      } as never);
      const choice = res.choices?.[0];
      const content = choice?.message?.content ?? "";
      const toolCalls = (choice?.message?.tool_calls ?? []).map((t) => ({ id: t.id, name: t.function.name, args: t.function.arguments ?? "{}" }));
      const finishReason = choice?.finish_reason ?? "unknown";
      if (finishReason === "length") throw new GroqUnavailable("TRUNCATED", "The model ran out of tokens before finishing.");
      if (!content.trim() && toolCalls.length === 0) throw new GroqUnavailable("EMPTY", "The model returned no content.");
      return {
        content,
        toolCalls,
        finishReason,
        model,
        latencyMs: Date.now() - started,
        usage: { promptTokens: res.usage?.prompt_tokens ?? 0, completionTokens: res.usage?.completion_tokens ?? 0 },
      };
    } catch (err) {
      if (err instanceof GroqUnavailable) throw err;
      const status = (err as { status?: number })?.status;
      const name = (err as { name?: string })?.name ?? "";
      if (status === 429 && attempt < 1) {
        const ra = Number((err as { headers?: Record<string, string> })?.headers?.["retry-after"]);
        await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500, 6000) + Math.random() * 300);
        continue;
      }
      if (status === 400 && /tool_use_failed|tool call validation/i.test(String((err as Error)?.message ?? ""))) throw new GroqUnavailable("TOOL_FORMAT", "The model produced a malformed tool call.");
      if (status === 429) throw new GroqUnavailable("RATE_LIMITED", "The model provider is rate limiting requests.");
      if (/timeout|abort/i.test(name) || /timed out|timeout/i.test((err as Error)?.message ?? "")) throw new GroqUnavailable("TIMEOUT", "The model took too long to answer.");
      console.error(`[groq] ${model} failed: status=${status ?? "n/a"} ${String((err as Error)?.message ?? err).slice(0, 400)}`);
      throw new GroqUnavailable("PROVIDER_ERROR", "The model provider returned an error.");
    }
  }
}

/** Parse a strict-JSON answer; anything that is not valid JSON is a failure, never a guess. */
export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GroqUnavailable("BAD_JSON", "The model's answer was not valid JSON.");
  }
}
