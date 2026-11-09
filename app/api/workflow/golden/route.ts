import { NextRequest, NextResponse } from "next/server";
import { executeGoldenWorkflow } from "@/lib/workflow/golden";
import { z } from "zod";

const RequestSchema = z.object({
  targetStage: z.number().int().min(1).max(8).optional().default(8),
  donationAmountUsd: z.number().positive().optional().default(1000.0),
});

export async function GET() {
  // Returns initial state at Stage 0 / default snapshot
  try {
    const result = await executeGoldenWorkflow({ targetStage: 8 });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

