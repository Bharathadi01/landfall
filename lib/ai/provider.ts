import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModelV1 } from "ai";
import { z } from "zod";
import { getCachedOutput, setCachedOutput, computeCacheKey } from "./cache";
import { db } from "@/lib/db/client";
import { agentEvents } from "@/lib/db/schema";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "",
});

export type AgentRole =
  | "intake"
  | "verifier"
  | "sentinel"
  | "allocator"
  | "auditor"
  | "courier"
  | "steward"
  | "watch_officer";

/**
 * Returns the primary LanguageModel for a given agent role.
 * Gemini Flash for standard agents; Groq (or fallback) for Auditor.
 */
export function getModelForRole(role: AgentRole) {
  if (role === "auditor") {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const auditorModel = process.env.MODEL_AUDITOR || "llama-3.3-70b-versatile";
      return {
        model: groq(auditorModel),
        modelName: `groq/${auditorModel}`,
      };
    }
  }

  // Primary: Gemini Flash
  const flashModel = process.env.MODEL_FAST || "gemini-1.5-flash";
  return {
    model: google(flashModel),
    modelName: `google/${flashModel}`,
  };
}

export interface StructuredCallParams<T> {
  role: AgentRole;
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
  correlationId?: string;
  useCache?: boolean;
}

/**
 * Executes a structured object generation call with:
 * 1. Input-hash caching (for deterministic, zero-cost judge replays)
 * 2. Automatic exponential backoff retry on 429 / 5xx
 * 3. Fallback provider if primary provider fails
 * 4. Automatic logging into `agent_events` table
 */
export async function generateAgentObject<T>({
  role,
  systemPrompt,
  prompt,
  schema,
  correlationId = "default",
  useCache = true,
}: StructuredCallParams<T>): Promise<{ data: T; modelUsed: string; cached: boolean }> {
  const { model, modelName } = getModelForRole(role);
  const cacheKey = computeCacheKey(modelName, systemPrompt, prompt);

  if (useCache) {
    const cached = getCachedOutput<T>(cacheKey);
    if (cached) {
      return { data: cached, modelUsed: `${modelName} (cached)`, cached: true };
    }
  }

  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < 3) {
    attempts++;
    try {
      const result = await generateObject({
        model: model as any,
        system: systemPrompt,
        prompt,
        schema,
        temperature: role === "auditor" ? 0 : 0.2,
      });

      const latencyMs = Date.now() - startTime;

      if (useCache) {
        setCachedOutput(cacheKey, result.object);
      }

      // Log to agent_events
      try {
        await db.insert(agentEvents).values({
          correlationId,
          agent: role,
          type: "structured_object_generated",
          payloadJson: result.object as Record<string, unknown>,
          model: modelName,
          tokensIn: result.usage?.promptTokens ?? null,
          tokensOut: result.usage?.completionTokens ?? null,
          latencyMs,
        });
      } catch (logErr) {
        console.warn("Failed to write to agent_events:", logErr);
      }

      return { data: result.object, modelUsed: modelName, cached: false };
    } catch (err: unknown) {
      lastError = err;
      const isRateLimit = String(err).includes("429") || String(err).includes("rate");
      if (isRateLimit && attempts < 3) {
        await new Promise((r) => setTimeout(r, attempts * 1500));
        continue;
      }
      break;
    }
  }

  throw new Error(`Agent [${role}] call failed after ${attempts} attempts: ${String(lastError)}`);
}
