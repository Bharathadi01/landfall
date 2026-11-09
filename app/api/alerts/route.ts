import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { alerts, activations } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { checkNWSHealth } from "@/lib/sentinel/nws";
import { isWeatherFeedStale } from "@/lib/sentinel/normalize";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") as "LIVE" | "HISTORICAL_REPLAY" | "SYNTHETIC" | null;
    const tranche1Only = url.searchParams.get("tranche1Only") === "true";

    // Query alerts from DB
    const dbAlerts = await db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.lastSyncedAt));

    const filtered = dbAlerts.filter((a) => {
      if (mode && a.mode !== mode) return false;
      if (tranche1Only && !a.isTranche1Eligible) return false;
      return true;
    });

    // Check upstream service health
    const nwsHealth = await checkNWSHealth().catch(() => ({
      service: "NWS" as const,
      status: "OUTAGE" as const,
      lastSyncAt: null,
      error: "Health check failed",
    }));

    // Find the most recent sync time
    const mostRecentSync = dbAlerts.length > 0 ? dbAlerts[0].lastSyncedAt : null;
    const isStale = mostRecentSync ? isWeatherFeedStale(mostRecentSync) : true;

    // Query active activations
    const dbActivations = await db.select().from(activations).orderBy(desc(activations.createdAt));

    return NextResponse.json({
      alerts: filtered,
      count: filtered.length,
      activationsCount: dbActivations.length,
      nwsHealth,
      feedStatus: {
        lastSyncAt: mostRecentSync ? mostRecentSync.toISOString() : null,
        isStale,
        stalenessNotice: isStale ? "WARNING: Weather feed has not updated within 10 minutes." : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
