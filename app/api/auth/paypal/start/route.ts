import { NextRequest, NextResponse } from "next/server";
import { buildPayPalAuthUrl } from "@/lib/paypal/identity";
import { limitRequest } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "auth-paypal-start-get", { limit: 20 });
  if (limited) return limited;

  const state = req.nextUrl.searchParams.get("state") || `lipp_${Date.now()}`;
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri") || undefined;

  const authUrl = buildPayPalAuthUrl(state, redirectUri);
  return NextResponse.redirect(authUrl);
}

