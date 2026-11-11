import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { fetchLiveNWSAlerts, checkNWSHealth } from "@/lib/sentinel/nws";
import { ingestAlertRecord, evaluateAndActivateFundResponse } from "@/lib/sentinel/activations";

export async function POST(req: NextRequest) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;

  const startTime = Date.now();
  try {
    // 1. Fetch live active alerts from official NWS API for Florida area
    const { alerts, isNotModified, rawFeatureCount } = await fetchLiveNWSAlerts("FL", {
      timeoutMs: 10000,
    });

    let ingestedCount = 0;
    let activatedCount = 0;
    const activatedEventKeys: string[] = [];

    // 2. Ingest alerts and evaluate Tranche 1 triggers
    for (const alert of alerts) {
      const { isNew, isUpdated } = await ingestAlertRecord(alert);
      if (isNew || isUpdated) ingestedCount++;

      if (alert.isTranche1Eligible) {
        const { activated, activation } = await evaluateAndActivateFundResponse({ alert });
        if (activated && activation) {
          activatedCount++;
          activatedEventKeys.push(activation.eventKey);
        }
      }
    }

    return NextResponse.json({
      status: "ok",
      polledAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      isNotModified,
      rawFeatureCount,
      alertsProcessed: alerts.length,
      ingestedCount,
      activatedCount,
      activatedEventKeys,
    });
  } catch (err: any) {
    console.error("[SENTINEL_POLL] Error polling NWS alerts:", err);
    return NextResponse.json(
      {
        status: "error",
        error: err.message || "Failed to poll NWS alerts",
        polledAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
