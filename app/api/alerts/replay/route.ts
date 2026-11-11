import { NextRequest, NextResponse } from "next/server";
import { loadMiltonHistoricalReplay } from "@/lib/sentinel/replay";
import { ingestAlertRecord, evaluateAndActivateFundResponse } from "@/lib/sentinel/activations";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const autoActivate = body.autoActivate !== false;

    // Load deterministic Milton 2024 archive from IEM
    const replayPackage = loadMiltonHistoricalReplay();

    let ingestedCount = 0;
    const activatedRecords: any[] = [];

    for (const alert of replayPackage.alerts) {
      const { isNew, isUpdated } = await ingestAlertRecord(alert);
      if (isNew || isUpdated) ingestedCount++;

      if (autoActivate && alert.isTranche1Eligible) {
        const { activated, activation, exposureSummary } = await evaluateAndActivateFundResponse({ alert });
        if (activated && activation) {
          activatedRecords.push({
            activationId: activation.id,
            eventKey: activation.eventKey,
            candidateCount: activation.candidateHouseholdCount,
            confirmedExposureCount: activation.confirmedExposureCount,
            exposureSummary,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: "HISTORICAL_REPLAY",
      storm: replayPackage.meta.storm,
      year: replayPackage.meta.year,
      source: replayPackage.meta.source,
      bannerText: replayPackage.bannerText,
      alertsCount: replayPackage.alerts.length,
      radarFrames: replayPackage.radarFrames,
      alerts: replayPackage.alerts,
      activations: activatedRecords,
      message: "Historical storm replay activated. Replay mode is clearly tagged; no real payments are executed.",
    });
  } catch (err: any) {
    console.error("[SENTINEL_REPLAY] Error executing historical replay:", err);
    return safeError(err, "Failed to execute historical replay", 500);
  }
}

export async function GET() {
  const replayPackage = loadMiltonHistoricalReplay();
  return NextResponse.json({
    availableStorms: [
      {
        storm: replayPackage.meta.storm,
        year: replayPackage.meta.year,
        wfo: replayPackage.meta.wfo,
        source: replayPackage.meta.source,
        bannerText: replayPackage.bannerText,
        alertsAvailable: replayPackage.alerts.length,
      },
    ],
  });
}
