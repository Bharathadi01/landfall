import { NextRequest, NextResponse } from "next/server";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";
import {
  runStormRehearsal,
  REHEARSAL_STORMS,
  REHEARSAL_SCENARIOS,
  type RehearsalScenarioId,
  type RehearsalStep,
} from "@/lib/rehearsal/lab";

export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "rehearsal-get", { limit: 20 });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const stormId = url.searchParams.get("stormId") || "milton-2024";
    const scenarioId = (url.searchParams.get("scenarioId") as RehearsalScenarioId) || "NORMAL_FUNDING";
    const step = (url.searchParams.get("step") as RehearsalStep) || "RECONCILIATION";

    const result = runStormRehearsal({ stormId, scenarioId, targetStep: step });

    return NextResponse.json({
      success: true,
      availableStorms: REHEARSAL_STORMS,
      availableScenarios: Object.values(REHEARSAL_SCENARIOS),
      rehearsalResult: result,
      disclaimer: "LANDFALL REHEARSAL LAB · Simulated scenario execution. No real money moved. No live PayPal orders created.",
      mode: "HISTORICAL_REPLAY",
    });
  } catch (err: any) {
    console.error("[REHEARSAL_API] Error running storm rehearsal:", err);
    return safeError(err, "Failed to run storm rehearsal", 500);
  }
}

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "rehearsal-post", { limit: 20 });
  if (limited) return limited;

  return GET(req);
}

