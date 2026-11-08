import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const token = authHeader?.replace("Bearer ", "") || cronSecretHeader;

  if (env.CRON_SECRET && token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sentinel polling logic will run here in M5
  return NextResponse.json({
    status: "ok",
    message: "Sentinel alert polling endpoint active",
    polledAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
