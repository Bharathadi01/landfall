import { describe, it, expect, vi } from "vitest";
import { modelLadder } from "@/lib/ai/watch-officer/groq-client";
import { runWatchOfficerAnalysis } from "@/lib/ai/watch-officer/orchestrator";
import type { WatchOfficerContext } from "@/lib/ai/watch-officer/types";

describe("Watch Officer model ladder", () => {
  it("tries the configured model first and then the other allowed model, never anything else", () => {
    const l = modelLadder();
    expect(l).toHaveLength(2);
    expect(new Set(l)).toEqual(new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]));
  });
});

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
run("Watch Officer falls through the ladder before the offline template (database)", () => {
  const ctx = (): WatchOfficerContext => ({ fundId: "00000000-0000-0000-0000-000000000000", fundName: "Test fund", actorId: "t", actorRole: "coordinator", query: "status?" });
  const rateLimited = () => Object.assign(new Error("429 rate limit"), { status: 429, headers: {} });

  it("when every model fails, the answer is the LABELLED offline template with the reason, never a fake model answer", async () => {
    const create = vi.fn().mockRejectedValue(rateLimited());
    const r = await runWatchOfficerAnalysis({ context: ctx(), groqClient: { chat: { completions: { create } } } as never });
    expect(r.modelUsed).toMatch(/OFFLINE_FALLBACK/);
    expect(r.analysis.warnings?.join(" ")).toMatch(/RATE_LIMITED/);
    expect(r.analysis.warnings?.join(" ")).toMatch(/try again in about a minute/i);
    // both models were actually tried (each retries a 429 once)
    const models = new Set(create.mock.calls.map((c) => c[0].model));
    expect(models.size).toBe(2);
  }, 60_000);
});
