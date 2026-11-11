import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Cron/service authentication. Fails CLOSED: if CRON_SECRET is unset (or too short) no request is accepted,
 * and the comparison is constant-time. There is no default secret.
 */
export function verifyCronSecret(req: { headers: Headers }, secret: string | undefined = process.env.CRON_SECRET): NextResponse | null {
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "cron_not_configured", message: "CRON_SECRET is not configured on this deployment." }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
