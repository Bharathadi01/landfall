import { describe, it, expect, vi } from "vitest";
import { GroqStudioLlmAdapter, CREATE_RECOVERY_PAGE_TOOL, addRecoveryPage, RECOVERY_PAGE_ID } from "@/lib/ai/watch-officer/studio-adapter";
import { requestToChat, chatChoiceToTurn, lastUserText, isToolFollowUp, turnToOutput } from "@/lib/ai/studio-llm-mapping";
import { runStudioChat, StudioLlmUnavailable } from "@/lib/ai/studio-llm";

const userMsg = (text: string) => ({ id: "u1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text }] });
const TOOLS = [
  { name: CREATE_RECOVERY_PAGE_TOOL, description: "Add the payout recovery page", parameters: { type: "object", properties: {} } },
  { name: "viewSchema", description: "View the schema", parameters: { type: "object", properties: {} } },
];

describe("Studio ↔ chat mapping (the real Agent Framework message shapes)", () => {
  it("reads the user's question from Studio's content[] shape", () => {
    expect(lastUserText([userMsg("hello"), { type: "function_call_output", callId: "c", output: "x", status: "completed" }])).toBe("hello");
  });

  it("maps a tool round trip: user → assistant tool call → tool result", () => {
    const input = [
      userMsg("create a payout recovery report"),
      { id: "f1", kind: "output", type: "function_call", callId: "call_1", name: CREATE_RECOVERY_PAGE_TOOL, arguments: "{}", status: "completed" },
      { type: "function_call_output", callId: "call_1", output: "Added the page", status: "completed" },
    ];
    expect(isToolFollowUp(input)).toBe(true);
    const { messages, tools, tool_choice } = requestToChat({ input, instructions: "You are the analyst.", tools: TOOLS, toolChoice: "auto" });
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(messages[2].tool_calls?.[0]).toMatchObject({ id: "call_1", function: { name: CREATE_RECOVERY_PAGE_TOOL } });
    expect(messages[3]).toMatchObject({ role: "tool", tool_call_id: "call_1", content: "Added the page" });
    expect(tools).toHaveLength(2);
    expect(tool_choice).toBe("auto");
  });

  it("never surfaces a tool call the request did not advertise", () => {
    const turn = chatChoiceToTurn(
      { message: { content: "", tool_calls: [{ id: "a", function: { name: "send_payout", arguments: "{}" } }, { id: "b", function: { name: "viewSchema", arguments: "{}" } }] } },
      new Set(["viewSchema"])
    );
    expect(turn.toolCalls.map((c) => c.name)).toEqual(["viewSchema"]);
  });

  it("produces Studio output items: text as a message, tools as function_call items", () => {
    const out = turnToOutput({ text: "hi", toolCalls: [{ id: "c1", name: "viewSchema", arguments: "{}" }] }, "t");
    expect(out[0]).toMatchObject({ kind: "output", type: "message", role: "assistant", content: [{ type: "text", text: "hi", annotations: [] }] });
    expect(out[1]).toMatchObject({ kind: "output", type: "function_call", callId: "c1", name: "viewSchema" });
  });
});

describe("GroqStudioLlmAdapter", () => {
  it("sends the question and advertised tools to the model gateway and returns its tool call", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ text: "", toolCalls: [{ id: "call_9", name: CREATE_RECOVERY_PAGE_TOOL, arguments: "{}" }], model: "groq/openai/gpt-oss-20b" }), { status: 200 }));
    const adapter = new GroqStudioLlmAdapter({ endpoint: "/api/studio-llm", fetchImpl: fetchImpl as any });
    const res = await adapter.executeTurn({ input: [userMsg("Build a payout recovery report")], tools: TOOLS as any, responseFormat: { type: "text" } } as any).complete;
    const sent = JSON.parse((fetchImpl.mock.calls[0] as any)[1].body);
    expect(sent.tools.map((t: any) => t.name)).toContain(CREATE_RECOVERY_PAGE_TOOL);
    expect(res.model).toBe("groq/openai/gpt-oss-20b");
    expect((res.output as any[]).find((o) => o.type === "function_call")).toMatchObject({ name: CREATE_RECOVERY_PAGE_TOOL, callId: "call_9" });
  });

  it("refuses money-moving requests WITHOUT calling any model", async () => {
    const fetchImpl = vi.fn();
    const adapter = new GroqStudioLlmAdapter({ endpoint: "/api/studio-llm", fetchImpl: fetchImpl as any });
    const res = await adapter.executeTurn({ input: [userMsg("Pay her again now")], tools: TOOLS as any, responseFormat: { type: "text" } } as any).complete;
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((res.output[0] as any).content[0].text).toContain("ACCESS DENIED");
    expect((res.output as any[]).some((o) => o.type === "function_call")).toBe(false);
  });

  it("falls back to a LABELLED offline analyst when the model is unavailable — and still issues a real Studio tool call", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "model_unavailable" }), { status: 503 }));
    const adapter = new GroqStudioLlmAdapter({ endpoint: "/api/studio-llm", fetchImpl: fetchImpl as any });

    const first = await adapter.executeTurn({ input: [userMsg("Create a payout recovery report")], tools: TOOLS as any, responseFormat: { type: "text" } } as any).complete;
    expect(first.model).toContain("offline-analyst");
    const call = (first.output as any[]).find((o) => o.type === "function_call");
    expect(call.name).toBe(CREATE_RECOVERY_PAGE_TOOL);

    const second = await adapter
      .executeTurn({
        input: [userMsg("Create a payout recovery report"), call, { type: "function_call_output", callId: call.callId, output: "Added the page", status: "completed" }],
        tools: TOOLS as any,
        responseFormat: { type: "text" },
      } as any)
      .complete;
    expect((second.output[0] as any).content[0].text).toContain("Offline analyst");
  });

  it("answers analytical questions with computed data when offline (labelled)", async () => {
    const adapter = new GroqStudioLlmAdapter({ endpoint: null });
    const res = await adapter.executeTurn({ input: [userMsg("Who is most at risk?")], responseFormat: { type: "text" } } as any).complete;
    const text = (res.output[0] as any).content[0].text;
    expect(text).toContain("Highest priority first");
    expect(text).toContain("Offline analyst");
  });

  it("streams text and tool-call events", async () => {
    const adapter = new GroqStudioLlmAdapter({ endpoint: null });
    const h = adapter.executeTurn({ input: [userMsg("Create a payout recovery report")], tools: TOOLS as any, responseFormat: { type: "text" } } as any);
    const events: any[] = [];
    for await (const e of h.stream as any) events.push(e);
    expect(events.some((e) => e.type === "TOOL_CALL_CHUNK" && e.toolCallName === CREATE_RECOVERY_PAGE_TOOL)).toBe(true);
  });
});

describe("addRecoveryPage (the tool's effect)", () => {
  it("adds one page through api.setState tagged as an AI change, and is idempotent", () => {
    let state: any = { pages: [{ id: "overview" }], selectedPageId: "overview" };
    const calls: any[] = [];
    const api = { getState: () => state, setState: (s: any, o: any) => ((state = s), calls.push(o)) };
    expect(addRecoveryPage(api).ok).toBe(true);
    expect(addRecoveryPage(api).ok).toBe(true);
    expect(state.pages.filter((p: any) => p.id === RECOVERY_PAGE_ID)).toHaveLength(1);
    expect(state.selectedPageId).toBe(RECOVERY_PAGE_ID);
    expect(calls[0].source.type).toBe("ai");
    expect(addRecoveryPage(null).ok).toBe(false);
  });
});

describe("runStudioChat (server gateway)", () => {
  const client = (impl: any) => ({ chat: { completions: { create: impl } } }) as any;
  it("passes tools through, returns requested tool calls, and uses only the free model", async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: null, tool_calls: [{ id: "x", function: { name: "viewSchema", arguments: "{}" } }] } }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } }));
    const turn = await runStudioChat({ input: [userMsg("what data do we have?")], tools: TOOLS as any }, { client: client(create) });
    const arg = (create.mock.calls[0] as any)[0];
    expect(arg.model).toBe("openai/gpt-oss-20b");
    expect(arg.tools).toHaveLength(2);
    expect(turn.toolCalls[0].name).toBe("viewSchema");
    expect(turn.usage?.totalTokens).toBe(7);
  });
  it("maps provider failures to an 'unavailable' error the browser turns into the offline analyst", async () => {
    await expect(runStudioChat({ input: [userMsg("x")] }, { client: client(async () => { throw Object.assign(new Error("429"), { status: 429 }); }) })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(runStudioChat({ input: [userMsg("x")] }, { apiKey: "" })).rejects.toBeInstanceOf(StudioLlmUnavailable);
  });
});
