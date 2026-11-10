import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const run = vi.fn(async (..._args: unknown[]) => ({ stages: [] }));
vi.mock("@/lib/workflow/golden", () => ({ executeGoldenWorkflow: (...a: unknown[]) => run(...a) }));

import { GET, POST } from "@/app/api/workflow/golden/route";

const post = (ip = "9.9.9.9") =>
  new NextRequest("http://localhost/api/workflow/golden", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: JSON.stringify({ targetStage: 8 }),
  });

describe("golden workflow route safety (D2)", () => {
  it("GET never runs the workflow (it can submit a sandbox payout)", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(run).not.toHaveBeenCalled();
  });

  it("rate limits repeated POST runs per client", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await POST(post("1.2.3.4"))).status);
    expect(codes.slice(0, 8).every((c) => c === 200)).toBe(true);
    expect(codes.slice(8)).toEqual([429, 429]);
  });

  it("can be switched off for a deployment", async () => {
    process.env.JUDGE_MODE_ENABLED = "false";
    expect((await POST(post("5.6.7.8"))).status).toBe(403);
    delete process.env.JUDGE_MODE_ENABLED;
  });
});
