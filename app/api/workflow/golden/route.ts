import { NextRequest, NextResponse } from "next/server";
import { executeGoldenWorkflow } from "@/lib/workflow/golden";
import { z } from "zod";

const RequestSchema = z.object({
  targetStage: z.number().int().min(1).max(8).optional().default(8),
  donationAmountUsd: z.number().positive().optional().default(1000.0),
});

/**
 * Running the workflow can submit a real PayPal Sandbox payout batch (stage 7), so it is
 * POST-only (never a crawlable GET), switchable off, and rate limited per client.
 */
const WINDOW_MS = 60_000;
const MAX_RUNS_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_RUNS_PER_WINDOW;
}

export async function GET() {
  return NextResponse.json({ error: "Use POST to run the workflow" }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: NextRequest) {
  if (process.env.JUDGE_MODE_ENABLED === "false") {
    return NextResponse.json({ error: "Workflow runs are disabled on this deployment" }, { status: 403 });
  }
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(client)) {
    return NextResponse.json({ error: "Too many workflow runs; try again in a minute" }, { status: 429 });
  }
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty for default full run
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const result = await executeGoldenWorkflow({
      targetStage: parsed.data.targetStage,
      donationAmountUsd: parsed.data.donationAmountUsd,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

