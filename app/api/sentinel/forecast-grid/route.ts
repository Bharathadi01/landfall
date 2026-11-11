import { NextResponse, NextRequest } from "next/server";
import { getForecastGrid } from "@/lib/sentinel/forecast-grid";
import { limitRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** 48-hour wind / rain / cloud forecast grid over the Gulf and western Atlantic (Open-Meteo). */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "sentinel-forecast-grid-get", { limit: 60 });
  if (limited) return limited;

  const grid = await getForecastGrid();
  return NextResponse.json(grid, {
    status: grid.state === "error" ? 502 : 200,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
