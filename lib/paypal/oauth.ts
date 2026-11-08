import { logAuditEvent } from "@/lib/db/audit";
import { PayPalError } from "./client";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export interface UserTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/**
 * Exchange an authorization code from Log in with PayPal for an access token.
 */
export async function exchangeAuthCodeForToken(
  code: string,
  redirectUri: string
): Promise<UserTokenResponse> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new PayPalError("Missing PayPal client credentials", 401);
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const debugId = res.headers.get("paypal-debug-id") || undefined;
  const data = await res.json();

  if (!res.ok) {
    await logAuditEvent({
      actor: "resident",
      action: "paypal_auth_code_exchange_failure",
      responseRedacted: data,
      debugId,
    });
    throw new PayPalError(
      data.error_description || "Failed to exchange auth code for PayPal user token",
      res.status,
      debugId,
      data
    );
  }

  await logAuditEvent({
    actor: "resident",
    action: "paypal_auth_code_exchange_success",
    responseRedacted: { token_type: data.token_type, expires_in: data.expires_in, scope: data.scope },
    debugId,
  });

  return data as UserTokenResponse;
}
