import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { alerts, households } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { normalizeNWSAlert } from "@/lib/sentinel/normalize";
import { evaluateHouseholdExposure } from "@/lib/sentinel/exposure";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { householdId, alertId, lat, lng, isDisplaced } = body;

    if (!alertId) {
      return NextResponse.json({ error: "alertId is required" }, { status: 400 });
    }

    // Lookup alert
    const [alertRecord] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alertId))
      .limit(1);

    if (!alertRecord) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const normalizedAlert = normalizeNWSAlert(alertRecord.rawJson || alertRecord, {
      mode: alertRecord.mode as any,
    });

    // If householdId provided, lookup household
    let landfallLat = lat;
    let landfallLng = lng;
    let displaced = isDisplaced ?? false;
    let currentLat = lat;
    let currentLng = lng;

    if (householdId) {
      const [hh] = await db
        .select()
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1);

      if (hh) {
        landfallLat = hh.lat;
        landfallLng = hh.lng;
        displaced = hh.isDisplaced;
        currentLat = hh.currentLat;
        currentLng = hh.currentLng;
      }
    }

    const evaluation = evaluateHouseholdExposure({
      householdId: householdId || "adhoc",
      landfallLat,
      landfallLng,
      currentLat,
      currentLng,
      isDisplaced: displaced,
      alert: normalizedAlert,
    });

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err: any) {
    return safeError(err, "Failed to evaluate exposure", 500);
  }
}
