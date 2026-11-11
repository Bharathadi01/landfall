import { NextRequest, NextResponse } from "next/server";
import { loadSnapshot, pickSource, SOURCE_COOKIE } from "@/lib/relief/case-source";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases?source=live|replay
 * The case list every console surface reads. `source` defaults to the `lf_source` cookie, then to LIVE SANDBOX when
 * real PayPal payments are stored, else MILTON REPLAY. Operators only (see lib/auth/policy.ts).
 * Responses say which source they came from and when PayPal was last asked, so no screen can pass off one as the other.
 */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "cases-list", { limit: 60 });
  if (limited) return limited;
  try {
    const asked = req.nextUrl.searchParams.get("source");
    const source = await pickSource(asked === "live" || asked === "replay" ? asked : req.cookies.get(SOURCE_COOKIE)?.value);
    const snap = await loadSnapshot(source);
    return NextResponse.json(snap);
  } catch (err) {
    return safeError(err, "Could not load cases", 503);
  }
}
