import { z } from "zod";
import { paypalFetch } from "./client";

export const UserInfoSchema = z.object({
  user_id: z.string().optional(),
  sub: z.string().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  verified_account: z.union([z.boolean(), z.string()]).optional(),
  payer_id: z.string().optional(),
  address: z
    .object({
      street_address: z.string().optional(),
      locality: z.string().optional(),
      region: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

/**
 * Builds the Log in with PayPal (LIPP) authorization URL.
 */
export function buildPayPalAuthUrl(state: string, redirectUri?: string): string {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const redirect = redirectUri || process.env.PAYPAL_LIPP_REDIRECT || "http://127.0.0.1:3000/api/auth/paypal/callback";
  const scopes = [
    "openid",
    "email",
    "profile",
    "address",
    "https://uri.paypal.com/services/paypalattributes",
  ].join(" ");

  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: clientId,
    response_type: "code",
    scope: scopes,
    redirect_uri: redirect,
    state,
  });

  const base =
    process.env.PAYPAL_ENV === "live"
      ? "https://www.paypal.com/connect"
      : "https://www.sandbox.paypal.com/connect";

  return `${base}?${params.toString()}`;
}

/**
 * Fetches userinfo from PayPal Identity API using the resident's user token.
 * Tries `schema=paypalv1.1` first, falling back to `schema=openid`.
 */
export async function getPayPalUserInfo(userAccessToken: string): Promise<UserInfo> {
  try {
    const res = await paypalFetch<UserInfo>(
      "GET",
      "/v1/identity/oauth2/userinfo?schema=paypalv1.1",
      undefined,
      {
        token: userAccessToken,
        actor: "resident",
        schema: UserInfoSchema,
      }
    );
    return res.data;
  } catch (err) {
    console.warn("paypalv1.1 schema fetch failed, falling back to schema=openid:", err);
    const fallbackRes = await paypalFetch<UserInfo>(
      "GET",
      "/v1/identity/openidconnect/userinfo?schema=openid",
      undefined,
      {
        token: userAccessToken,
        actor: "resident",
        schema: UserInfoSchema,
      }
    );
    return fallbackRes.data;
  }
}
