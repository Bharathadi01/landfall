import { NextResponse, NextRequest } from "next/server";
import { getImagery } from "@/lib/sentinel/imagery";
import { limitRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Latest real satellite (NASA GIBS) and radar (RainViewer) frame times. Read-only, cached server-side. */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "sentinel-imagery-get", { limit: 60 });
  if (limited) return limited;

  const payload = await getImagery();
  return NextResponse.json(payload, {
    status: payload.state === "error" ? 502 : 200,
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
