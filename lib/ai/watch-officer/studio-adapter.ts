/**
 * AG STUDIO AGENT FRAMEWORK ADAPTER
 *
 * Implements AG Studio's `AgLlmAdapter`. Each turn:
 *   1. Money-moving requests are refused deterministically, before any model is called.
 *   2. Otherwise the turn goes to the server model gateway (/api/studio-llm → Groq free tier,
 *      openai/gpt-oss-20b) with the tool schemas Studio advertises. The model may answer in text or
 *      request Studio tools; Studio executes those tools itself (add a page, filter, query data…).
 *   3. If the model is unavailable (no key, rate limit, offline) a clearly LABELLED offline analyst
 *      answers from the same data with deterministic rules — and, for the recovery report, still
 *      issues a real Studio tool call so the dashboard really changes.
 *
 * Invariants: read-only analysis and dashboard edits only. No tool in the analyst's set can move
 * money, approve a plan, or touch the ledger. Zero PII is sent to the model (the data model is
 * pseudonymous demo data).
 */

import type { AgLlmAdapter, AgLlmRequest, AgLlmExecuteTurnOptions, AgLlmResponseHandler, AgLlmResponse, AgAiEvent } from "ag-studio";
import { interpretStudioQuery } from "./studio-bridge";
import { answerFromReliefData, isMoneyMovementRequest, isRecoveryReportRequest } from "@/lib/studio/studio-answers";
import { lastUserText, isToolFollowUp, turnToOutput, type ModelTurn } from "@/lib/ai/studio-llm-mapping";

export const RECOVERY_PAGE_ID = "ai-payout-recovery";
export const RECOVERY_PAGE_TITLE = "AI · Payout recovery";
export const CREATE_RECOVERY_PAGE_TOOL = "create_recovery_page";

const OFFLINE_NOTE =
  "\n\n— Offline analyst: the live model is unavailable, so this answer comes from deterministic rules over the same data.";

/** The page the agent adds. Pure data; no side effects. */
export function buildRecoveryPage() {
  const status = (title: string) => ({ type: "donut-chart", format: { title: { text: title, enabled: true, wrapping: true }, crossFilter: "filter" }, dataMapping: { categoryKey: [{ id: "payout_items.transaction_status" }], valueKey: [{ id: "payout_items.items_count", aggregation: "sum" }] } });
  return {
    id: RECOVERY_PAGE_ID,
    crossFilter: { values: {} },
    widgets: {
      "kpi-ai-unresolved": { type: "value", format: { title: { text: "Unresolved value", enabled: true, wrapping: true } }, dataMapping: { value: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }] } },
      "kpi-ai-unclaimed": { type: "value", format: { title: { text: "Unresolved items", enabled: true, wrapping: true } }, dataMapping: { value: [{ id: "payout_items.is_unresolved", aggregation: "sum" }] } },
      "kpi-ai-oldest": { type: "value", format: { title: { text: "Oldest exception (hours)", enabled: true, wrapping: true } }, dataMapping: { value: [{ id: "payout_items.age_hours", aggregation: "max" }] } },
      "kpi-ai-dispatched": { type: "value", format: { title: { text: "Sent to PayPal", enabled: true, wrapping: true } }, dataMapping: { value: [{ id: "payout_items.amount_usd", aggregation: "sum" }] } },
      "c-ai-status": status("PayPal status"),
      "c-ai-aging": { type: "bar-chart-grouped", format: { title: { text: "Unresolved value by age", enabled: true, wrapping: true }, crossFilter: "filter" }, dataMapping: { categoryKey: [{ id: "payout_items.age_band" }], valueKey: [{ id: "payout_items.unresolved_usd", aggregation: "sum" }] } },
      "g-ai-workbench": {
        type: "grid",
        format: { title: { text: "Recovery workbench", enabled: true, wrapping: true }, style: { columnAutoSize: true } },
        dataMapping: {
          cols: [
            { id: "payout_items.item_id" },
            { id: "payout_items.resident_name" },
            { id: "payout_items.priority_tier" },
            { id: "payout_items.amount_usd" },
            { id: "payout_items.transaction_status" },
            { id: "payout_items.age_hours" },
            { id: "payout_items.safe_action" },
          ],
        },
      },
    },
    widgetLayout: {
      "kpi-ai-unresolved": { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 8 },
      "kpi-ai-unclaimed": { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 8 },
      "kpi-ai-oldest": { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 8 },
      "kpi-ai-dispatched": { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 8 },
      "c-ai-status": { xTrack: 0, yTrack: 8, xSpan: 12, ySpan: 14 },
      "c-ai-aging": { xTrack: 12, yTrack: 8, xSpan: 12, ySpan: 14 },
      "g-ai-workbench": { xTrack: 0, yTrack: 22, xSpan: 24, ySpan: 20 },
    },
  };
}

/**
 * Add (or replace) the recovery page through Studio's own state API, tagged as an AI change so it
 * appears in Studio's history and can be undone. Returns a plain-language result for the model.
 */
export function addRecoveryPage(api: any): { ok: boolean; message: string } {
  if (!api || typeof api.getState !== "function" || typeof api.setState !== "function") return { ok: false, message: "Studio API not available" };
  const state = api.getState();
  const pages = (Array.isArray(state?.pages) ? state.pages : []).filter((p: any) => p.id !== RECOVERY_PAGE_ID);
  api.setState({ ...state, pages: [...pages, buildRecoveryPage()], selectedPageId: RECOVERY_PAGE_ID }, { historyLabel: "AI: payout recovery page", source: { type: "ai", agent: "relief-finance-analyst" } });
  return { ok: true, message: `Added the page “${RECOVERY_PAGE_TITLE}” (7 widgets: 4 KPIs, status donut, ageing bars, workbench grid) and opened it. Undo is available in Studio history.` };
}

/** Back-compat for callers/tests that pass the API directly. */
export function createGeneratedReportPage(api: any) {
  return addRecoveryPage(api);
}

/* ── Adapter ───────────────────────────────────────────────── */

export interface StudioAdapterOptions {
  /** Model gateway. `null` forces the offline analyst (used in tests and when no server is reachable). */
  endpoint?: string | null;
  fetchImpl?: typeof fetch;
  /** Retained for call-site compatibility; the adapter itself never needs the Studio API. */
  api?: unknown;
  model?: string;
}

export class GroqStudioLlmAdapter implements AgLlmAdapter {
  private endpoint: string | null;
  private fetchImpl: typeof fetch | undefined;
  private model: string;

  constructor(opts: StudioAdapterOptions = {}) {
    this.endpoint = opts.endpoint === undefined ? "/api/studio-llm" : opts.endpoint;
    this.fetchImpl = opts.fetchImpl ?? (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);
    this.model = opts.model ?? "groq/openai/gpt-oss-20b";
  }

  executeTurn(request: AgLlmRequest, options?: AgLlmExecuteTurnOptions): AgLlmResponseHandler {
    const id = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();
    const run = this.run(request, options?.signal).then(
      (turn): AgLlmResponse => ({
        id,
        createdAt,
        status: "completed",
        output: turnToOutput(turn, id) as any,
        usage: turn.usage ?? estimateUsage(request, turn),
        model: turn.model ?? this.model,
      })
    );

    const stream = {
      async *[Symbol.asyncIterator](): AsyncIterator<AgAiEvent> {
        const r = await run;
        for (const item of r.output as any[]) {
          if (item.type === "message") {
            yield { type: "TEXT_MESSAGE_CHUNK", messageId: item.id, role: "assistant", delta: item.content?.[0]?.text ?? "" } as AgAiEvent;
          } else if (item.type === "function_call") {
            yield { type: "TOOL_CALL_CHUNK", toolCallId: item.callId, toolCallName: item.name, delta: item.arguments } as AgAiEvent;
          }
        }
      },
    };
    return { stream, complete: run };
  }

  private async run(request: AgLlmRequest, signal?: AbortSignal): Promise<ModelTurn> {
    const input = request.input as any[];
    const question = lastUserText(input);

    // 1. Deterministic guardrail — before any model sees it.
    if (!isToolFollowUp(input) && isMoneyMovementRequest(question)) {
      return { text: answerFromReliefData(question) ?? "ACCESS DENIED — read-only agent.", toolCalls: [], model: "guardrail/deterministic" };
    }

    // 2. Live model through the server gateway.
    if (this.endpoint && this.fetchImpl) {
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input,
            instructions: request.instructions,
            tools: request.tools,
            toolChoice: request.toolChoice,
            responseFormat: request.responseFormat,
          }),
          signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.refused) return { text: answerFromReliefData(question) ?? "ACCESS DENIED — read-only agent.", toolCalls: [], model: "guardrail/deterministic" };
          if (typeof data?.text === "string" || Array.isArray(data?.toolCalls)) {
            return { text: data.text ?? "", toolCalls: data.toolCalls ?? [], model: data.model, usage: data.usage };
          }
        }
      } catch {
        /* fall through to the offline analyst */
      }
    }

    // 3. Labelled offline analyst.
    return this.offline(request, input, question);
  }

  private offline(request: AgLlmRequest, input: any[], question: string): ModelTurn {
    const tools = new Set((request.tools ?? []).map((t) => t.name));
    const model = "offline-analyst/deterministic";

    if (isToolFollowUp(input)) {
      // A tool just ran. Only echo the result when it is OUR tool's short human message; raw tool output
      // (e.g. a schema dump) is never shown as the answer.
      const lastOut: any = input[input.length - 1];
      const call: any = input.find((i: any) => i?.type === "function_call" && i.callId === lastOut.callId);
      const output = String(lastOut.output ?? "");
      if (call?.name === CREATE_RECOVERY_PAGE_TOOL && output && !output.trim().startsWith("{")) return { text: output + OFFLINE_NOTE, toolCalls: [], model };
      const grounded = answerFromReliefData(question);
      return { text: (grounded ?? "I read the data, but the live model is unavailable to finish the analysis. Try one of the suggested questions.") + OFFLINE_NOTE, toolCalls: [], model };
    }
    if (isRecoveryReportRequest(question) && tools.has(CREATE_RECOVERY_PAGE_TOOL)) {
      return { text: "", toolCalls: [{ id: `call_${Date.now()}`, name: CREATE_RECOVERY_PAGE_TOOL, arguments: "{}" }], model };
    }
    const grounded = answerFromReliefData(question);
    if (grounded) return { text: grounded + OFFLINE_NOTE, toolCalls: [], model };
    return { text: interpretStudioQuery(question).agentResponse + OFFLINE_NOTE, toolCalls: [], model };
  }
}

function estimateUsage(request: AgLlmRequest, turn: ModelTurn) {
  const inChars = JSON.stringify(request.input ?? []).length;
  const outChars = turn.text.length + turn.toolCalls.reduce((t, c) => t + c.arguments.length, 0);
  const i = Math.max(1, Math.round(inChars / 4));
  const o = Math.max(1, Math.round(outChars / 4));
  return { inputTokens: i, outputTokens: o, totalTokens: i + o };
}
