import { describe, it, expect, vi } from "vitest";
import { runStudioChat, StudioLlmUnavailable } from "@/lib/ai/studio-llm";

const req = { input: [{ type: "message", role: "user", content: [{ type: "text", text: "Which payments are unclaimed?" }] }], tools: [] } as never;
const limited = () => Object.assign(new Error("429 TPM"), { status: 429, headers: {} });
const answer = { choices: [{ message: { role: "assistant", content: "Three payments are unclaimed." }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
const client = (fn: ReturnType<typeof vi.fn>) => ({ chat: { completions: { create: fn } } }) as never;

describe("Studio agent model ladder", () => {
  it("when the first model is rate limited it answers with the OTHER model straight away (no waiting)", async () => {
    const create = vi.fn().mockRejectedValueOnce(limited()).mockResolvedValueOnce(answer);
    const t0 = Date.now();
    const turn = await runStudioChat(req, { client: client(create) });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(turn.text).toContain("Three payments");
    const models = create.mock.calls.map((c) => c[0].model);
    expect(new Set(models).size).toBe(2);
    expect(turn.model).toMatch(/^groq\/openai\/gpt-oss-/);
  });

  it("asks for a small, low-reasoning answer so one call stays well inside the 8,000-per-minute budget", async () => {
    const create = vi.fn().mockResolvedValue(answer);
    await runStudioChat(req, { client: client(create) });
    expect(create.mock.calls[0][0]).toMatchObject({ reasoning_effort: "low", max_completion_tokens: 600 });
  });

  it("when both models fail it reports RATE_LIMITED so the UI can say the AI is unavailable (never a fake answer)", async () => {
    const create = vi.fn().mockRejectedValue(limited());
    await expect(runStudioChat(req, { client: client(create) })).rejects.toBeInstanceOf(StudioLlmUnavailable);
  }, 40_000);
});
