/**
 * Server-side model call for the AG Studio Agent (Groq free tier, openai/gpt-oss-20b).
 * Never imported by the deterministic financial core. It forwards the tool schemas Studio sends
 * and returns the model's requested tool calls — it executes NOTHING. Tool execution happens in
 * the browser, inside Studio, against tools that cannot move money.
 */
import Groq from "groq-sdk";
import { GROQ_FREE_MODEL, validateModelName } from "@/lib/ai/watch-officer/groq-client";
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

  const { messages, tools, tool_choice, json } = requestToChat(req);
  try {
    const res: any = await (client as any).chat.completions.create({
      model,
      messages,
      ...(tools ? { tools, tool_choice } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.1,
      max_tokens: 1200,
    });
    const allowed = new Set((req.tools ?? []).map((t) => t.name));
    return chatChoiceToTurn(res.choices?.[0], allowed, `groq/${model}`, res.usage);
  } catch (err: any) {
    if (err?.status === 429) throw new StudioLlmUnavailable("RATE_LIMITED", "Groq free-tier rate limit");
    throw new StudioLlmUnavailable("PROVIDER_ERROR", String(err?.message ?? err).slice(0, 200));
  }
}
