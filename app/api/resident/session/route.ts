import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieAttributes, signSession } from "@/lib/auth/session";
import { householdFromRef, verifyResidentCode } from "@/lib/auth/resident-code";
import { resolveCaseRef } from "@/lib/relief/access-reports";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";

/**
 * Resident sign-in: case reference + the 6-digit code a coordinator gave them.
 * The error for "no such case" and "wrong code" is deliberately the same, so the endpoint can't be used to
 * discover which references exist.
 */
const Body = z.object({ ref: z.string().min(3).max(120), code: z.string().min(4).max(12) });
const GENERIC = { error: "invalid_credentials", message: "That reference and code don’t match. Check them and try again." };

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "resident-signin", { limit: 12 });
  if (limited) return limited;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_request", message: "Enter your reference and 6-digit code." }, { status: 400 });

    const caseRef = resolveCaseRef(parsed.data.ref);
    const hh = householdFromRef(caseRef ?? parsed.data.ref);
    if (!caseRef || !hh) return NextResponse.json(GENERIC, { status: 401 });

    const check = await verifyResidentCode(hh, parsed.data.code);
    if (!check.ok) {
      if (check.reason === "locked") {
        return NextResponse.json({ error: "locked", message: "Too many wrong codes. Please wait 15 minutes or ask your coordinator." }, { status: 429, headers: { "Retry-After": String(check.retryAfterSec ?? 900) } });
      }
      return NextResponse.json(GENERIC, { status: 401 });
    }
    const token = await signSession({ sub: `resident:${hh}`, name: "Resident", role: "resident", hh });
    const res = NextResponse.json({ ok: true, caseRef });
    res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieAttributes(), maxAge: 2 * 60 * 60 });
    return res;
  } catch (err) {
    return safeError(err, "Could not sign in", 500);
  }
}
