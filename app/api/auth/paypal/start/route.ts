import { NextRequest, NextResponse } from "next/server";
import { buildPayPalAuthUrl } from "@/lib/paypal/identity";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || `lipp_${Date.now()}`;
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri") || undefined;

  const authUrl = buildPayPalAuthUrl(state, redirectUri);
  return NextResponse.redirect(authUrl);
}
