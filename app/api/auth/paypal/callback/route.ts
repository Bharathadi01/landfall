import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCodeForToken } from "@/lib/paypal/oauth";
import { getPayPalUserInfo } from "@/lib/paypal/identity";
import { logAuditEvent } from "@/lib/db/audit";
import crypto from "crypto";
import { safeError } from "@/lib/http/safe-error";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error || !code) {
    return NextResponse.json(
      { error: error || "missing_code", description: errorDescription },
      { status: 400 }
    );
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/paypal/callback`;
    const tokenRes = await exchangeAuthCodeForToken(code, redirectUri);
    const userInfo = await getPayPalUserInfo(tokenRes.access_token);

    const email = userInfo.email || "";
    const emailHash = email
      ? crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex")
      : null;

    const hasPayerId = Boolean(userInfo.payer_id);
    const identifier = userInfo.payer_id || `${userInfo.user_id || userInfo.sub}:${emailHash}`;

    await logAuditEvent({
      actor: "resident",
      action: "paypal_lipp_verified",
      requestRedacted: { state },
      responseRedacted: {
        hasPayerId,
        payerId: userInfo.payer_id,
        userId: userInfo.user_id || userInfo.sub,
        emailVerified: userInfo.email_verified,
        accountVerified: userInfo.verified_account,
        identifier,
      },
    });

    // In resident enrollment flow, redirect back to /enroll with verified token or render response
    return NextResponse.json({
      success: true,
      hasPayerId,
      payerId: userInfo.payer_id || null,
      userId: userInfo.user_id || userInfo.sub || null,
      name: userInfo.name || `${userInfo.given_name || ""} ${userInfo.family_name || ""}`.trim(),
      email: userInfo.email,
      verifiedAccount: userInfo.verified_account ?? true,
      address: userInfo.address || null,
      dedupKey: identifier,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("LIPP callback error:", msg);
    return safeError(err, "Request failed", 500);
  }
}

