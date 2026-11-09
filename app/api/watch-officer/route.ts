import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { funds, watchOfficerRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { runWatchOfficerAnalysis } from "@/lib/ai/watch-officer/orchestrator";
import type { WatchOfficerContext, Role } from "@/lib/ai/watch-officer/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let targetFundId = body.fundId;

    // Resolve fund or default
    if (!targetFundId) {
      let [defaultFund] = await db.select().from(funds).limit(1);
      if (!defaultFund) {
        const [newFund] = await db
          .insert(funds)
          .values({
            name: "Tampa Bay Mutual Aid Relief Fund",
            paypalMerchantEmail: "sb-7sfg953788004@business.example.com",
          })
          .returning();
        defaultFund = newFund;
      }
      targetFundId = defaultFund.id;
    }

    const [fund] = await db.select().from(funds).where(eq(funds.id, targetFundId)).limit(1);

    const context: WatchOfficerContext = {
      fundId: targetFundId,
      fundName: fund?.name || "Community Relief Fund",
      actorId: body.actorId || "coordinator_1",
      actorRole: (body.actorRole as Role) || "coordinator",
      query: body.query,
      alertId: body.alertId,
      scenarioId: body.scenarioId,
    };

    const { analysis, evidence, modelUsed, latencyMs, auditRunId } =
      await runWatchOfficerAnalysis({
        context,
        useLiveModel: body.useLiveModel !== false,
      });

    return NextResponse.json({
      success: true,
      analysis,
      auditRunId,
      modelUsed,
      latencyMs,
      evidenceSummary: {
        itemCount: evidence.items.length,
        disaster: evidence.disaster.event,
        mode: evidence.disaster.mode,
        readinessState: analysis.financialReadiness.state,
        coveragePercentage: analysis.financialReadiness.coveragePercentage,
      },
    });
  } catch (err: any) {
    console.error("[WATCH_OFFICER_API] Analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute Watch Officer analysis" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fundId = url.searchParams.get("fundId");

    // Fetch latest run if exists
    let latestRun;
    if (fundId) {
      [latestRun] = await db
        .select()
        .from(watchOfficerRuns)
        .where(eq(watchOfficerRuns.fundId, fundId))
        .orderBy(desc(watchOfficerRuns.createdAt))
        .limit(1);
    } else {
      [latestRun] = await db
        .select()
        .from(watchOfficerRuns)
        .orderBy(desc(watchOfficerRuns.createdAt))
        .limit(1);
    }

    return NextResponse.json({
      status: "ACTIVE",
      latestRun: latestRun
        ? {
            runId: latestRun.runId,
            query: latestRun.query,
            mode: latestRun.mode,
            readinessState: latestRun.readinessState,
            createdAt: latestRun.createdAt.toISOString(),
            analysis: latestRun.responseJson,
          }
        : null,
      suggestedQuestions: [
        "Can this relief fund afford the proposed first tranche?",
        "What operational blockers are currently preventing payout approval?",
        "What is our verified funding gap and how much cash is available?",
        "What happens under the reduced reserve scenario?",
        "Are previous PayPal payout batches fully reconciled?",
        "How many households in the affected area require human coordinator review?",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch Watch Officer status" },
      { status: 500 }
    );
  }
}

