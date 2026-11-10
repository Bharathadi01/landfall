/**
 * Pure mapping between AG Studio's Agent Framework message format and an OpenAI-style chat
 * completion (Groq). No I/O here, so the contract with Studio is unit-testable.
 *
 * Studio → chat:  user/system messages, prior assistant output, `function_call` items (the model's
 *                 earlier tool calls) and `function_call_output` items (Studio's tool results).
 * chat → Studio:  assistant text and/or tool calls, which Studio then EXECUTES against its own tools.
 *
 * The model can only ever request tools that Studio advertised in the request. None of them can
 * move money: the analyst's tool set is read-only analysis plus dashboard edits.
 */

export interface StudioToolSchema {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface StudioRequestLike {
  input: any[];
  instructions?: string;
  tools?: StudioToolSchema[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  responseFormat?: { type: "text" } | { type: "json"; name?: string; schema?: unknown };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface ModelTurn {
  text: string;
  toolCalls: { id: string; name: string; arguments: string }[];
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/** Text of one input/output item, tolerant of Studio's `content[]` shape and a legacy `parts[]` shape. */
export function itemText(item: any): string {
  const parts: any[] = Array.isArray(item?.content) ? item.content : Array.isArray(item?.parts) ? item.parts : [];
  if (parts.length) return parts.filter((p) => p?.type === "text" || typeof p?.text === "string").map((p) => p.text ?? "").join("");
  if (typeof item?.content === "string") return item.content;
  if (typeof item?.text === "string") return item.text;
  return "";
}

/** The user's most recent question, ignoring tool results and prior assistant turns. */
export function lastUserText(input: any[]): string {
  for (let i = input.length - 1; i >= 0; i--) {
    const it = input[i];
    if (it?.type === "message" && it?.role === "user") return itemText(it);
  }
  return "";
}

/** True while the model is mid tool-loop (the newest item is a tool result Studio just produced). */
export function isToolFollowUp(input: any[]): boolean {
  return input[input.length - 1]?.type === "function_call_output";
}

export function requestToChat(req: StudioRequestLike): {
  messages: ChatMessage[];
  tools?: { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  json: boolean;
} {
  const messages: ChatMessage[] = [];
  const json = req.responseFormat?.type === "json";
  const sys = [req.instructions, json ? `Respond with a single JSON object only. ${JSON.stringify((req.responseFormat as any)?.schema ?? {})}` : ""].filter(Boolean).join("\n\n");
  if (sys) messages.push({ role: "system", content: sys });

  let pendingCalls: NonNullable<ChatMessage["tool_calls"]> = [];
  const flush = () => {
    if (pendingCalls.length) {
      messages.push({ role: "assistant", content: null, tool_calls: pendingCalls });
      pendingCalls = [];
    }
  };

  for (const it of req.input ?? []) {
    if (it?.type === "function_call") {
      pendingCalls.push({ id: it.callId, type: "function", function: { name: it.name, arguments: it.arguments || "{}" } });
      continue;
    }
    flush();
    if (it?.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: it.callId, content: String(it.output ?? "") });
    } else if (it?.type === "message") {
      const text = itemText(it);
      if (it.role === "user" || it.role === "system") messages.push({ role: it.role, content: text });
      else if (it.role === "assistant" && text) messages.push({ role: "assistant", content: text });
    }
    // reasoning items are intentionally not replayed
  }
  flush();

  const tools = (req.tools ?? []).map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description ?? "", parameters: (t.parameters as Record<string, unknown>) ?? { type: "object", properties: {} } },
  }));
  const choice = req.toolChoice;
  return {
    messages,
    tools: tools.length ? tools : undefined,
    tool_choice: !tools.length ? undefined : typeof choice === "object" && choice ? { type: "function", function: { name: choice.name } } : choice ?? "auto",
    json,
  };
}

/** One chat-completion choice → what Studio needs to continue the run. */
export function chatChoiceToTurn(choice: any, allowedTools: Set<string>, model?: string, usage?: any): ModelTurn {
  const msg = choice?.message ?? {};
  const toolCalls = (msg.tool_calls ?? [])
    .filter((c: any) => c?.function?.name && allowedTools.has(c.function.name)) // never surface a tool Studio did not advertise
    .map((c: any, i: number) => ({
      id: c.id || `call_${Date.now()}_${i}`,
      name: c.function.name as string,
      arguments: typeof c.function.arguments === "string" && c.function.arguments ? c.function.arguments : "{}",
    }));
  return {
    text: typeof msg.content === "string" ? msg.content : "",
    toolCalls,
    model,
    usage: usage
      ? { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0, totalTokens: usage.total_tokens ?? 0 }
      : undefined,
  };
}

/** Build Studio's `AgLlmResponse` output items from a model turn. */
export function turnToOutput(turn: ModelTurn, idPrefix: string): any[] {
  const out: any[] = [];
  if (turn.text) {
    out.push({
      id: `${idPrefix}_msg`,
      kind: "output",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "text", text: turn.text, annotations: [] }],
    });
  }
  for (const c of turn.toolCalls) {
    out.push({ id: `${idPrefix}_${c.id}`, kind: "output", type: "function_call", callId: c.id, name: c.name, arguments: c.arguments, status: "completed" });
  }
  return out;
}
