import { NextRequest, NextResponse } from "next/server";
import { getUnifiedWeatherIntelligence } from "@/lib/sentinel/weather-client";
import { buildPrivacyPreservingClusters } from "@/lib/sentinel/clusters";
import { SYNTHETIC_HOUSEHOLDS } from "@/lib/fixtures/households";
import { loadMiltonHistoricalReplay } from "@/lib/sentinel/replay";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fundId = url.searchParams.get("fundId") || undefined;
    const mode = (url.searchParams.get("mode") as "LIVE" | "HISTORICAL_REPLAY") || "LIVE";

    const weather = await getUnifiedWeatherIntelligence(fundId, mode);

    let alertsForClusters = weather.nwsAlerts;
    if (mode === "HISTORICAL_REPLAY") {
      const replayPkg = loadMiltonHistoricalReplay();
      alertsForClusters = replayPkg.alerts;
    }

    const clusterSummary = buildPrivacyPreservingClusters(
      SYNTHETIC_HOUSEHOLDS,
      alertsForClusters
    );

    return NextResponse.json({
      success: true,
      weather,
      clusters: clusterSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[SENTINEL_LIVE_API] Error building unified weather:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to load live weather intelligence",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

