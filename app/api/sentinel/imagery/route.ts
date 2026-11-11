import { NextResponse } from "next/server";
import { getImagery } from "@/lib/sentinel/imagery";

export const dynamic = "force-dynamic";

/** Latest real satellite (NASA GIBS) and radar (RainViewer) frame times. Read-only, cached server-side. */
export async function GET() {
  const payload = await getImagery();
  return NextResponse.json(payload, {
    status: payload.state === "error" ? 502 : 200,
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
