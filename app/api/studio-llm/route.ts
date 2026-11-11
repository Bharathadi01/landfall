import { NextRequest, NextResponse } from "next/server";
import { limitRequest } from "@/lib/security/rate-limit";
import { runStudioChat, StudioLlmUnavailable } from "@/lib/ai/studio-llm";
import { isMoneyMovementRequest } from "@/lib/studio/studio-answers";
import { lastUserText, isToolFollowUp } from "@/lib/ai/studio-llm-mapping";
import { screen } from "@/lib/ai/safety/guard";

/**
 * Model gateway for the AG Studio Agent.
 * - Read-only by construction: it returns requested tool calls; it executes nothing.
 * - Deterministic guardrail first: money-moving requests are refused here without calling a model.
 * - 503/429 tell the browser to use the labelled offline analyst instead.
 */
const MAX_BODY_CHARS = 120_000;
export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "studio-llm", { limit: 30 });
  if (limited) return limited;

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body?.input)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  // Guardrail: never put a money-moving instruction in front of a model.
  if (!isToolFollowUp(body.input) && isMoneyMovementRequest(lastUserText(body.input))) {
    return NextResponse.json({ refused: true }, { status: 200 });
  }

  // Layered screening (Prompt Guard 2 + policy model). Skipped for tool follow-ups, which carry our own tool output, not user text.
  if (!isToolFollowUp(body.input)) {
    const verdict = await screen(lastUserText(body.input));
    if (verdict.action === "block") return NextResponse.json({ refused: true, safety: { layer: verdict.layer } }, { status: 200 });
  }

  try {
    const turn = await runStudioChat({
      input: body.input,
      instructions: typeof body.instructions === "string" ? body.instructions.slice(0, 8000) : undefined,
      tools: Array.isArray(body.tools) ? body.tools.slice(0, 40) : undefined,
      toolChoice: body.toolChoice,
      responseFormat: body.responseFormat,
    });
    return NextResponse.json(turn);
  } catch (e) {
    const code = e instanceof StudioLlmUnavailable ? e.code : "PROVIDER_ERROR";
    const detail = process.env.NODE_ENV !== "production" && e instanceof Error ? e.message : undefined; // dev-only diagnostics
    return NextResponse.json({ error: "model_unavailable", code, detail }, { status: code === "RATE_LIMITED" ? 429 : 503 });
  }
}
