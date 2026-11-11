import { NextResponse, NextRequest } from "next/server";
import { getForecastGrid } from "@/lib/sentinel/forecast-grid";
import { limitRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** 48-hour wind / rain / cloud forecast grid over the Gulf and western Atlantic (Open-Meteo). */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "sentinel-forecast-grid-get", { limit: 60 });
  if (limited) return limited;

  const grid = await getForecastGrid();
  // An upstream outage is part of the payload (state: "error" / stale: true), not an HTTP failure: the page shows
  // "forecast unavailable" instead of a red console error, and the CDN doesn't cache the failure for long.
  return NextResponse.json(grid, {
    headers: { "Cache-Control": grid.state === "error" ? "public, max-age=30" : "public, max-age=300, s-maxage=300" },
  });
}
