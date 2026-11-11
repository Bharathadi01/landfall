import { NextRequest, NextResponse } from "next/server";
import { residentViewOf } from "@/lib/relief/access-reports";
import { findCaseIn, loadSnapshot, pickSource, SOURCE_COOKIE } from "@/lib/relief/case-source";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";

const NOT_FOUND = { error: "We couldn’t find that reference. Check it and try again." };

/**
 * Case status, from whichever data source this deployment is showing (live PayPal Sandbox records, or the replay).
 * A resident session can read ONLY its own household; an operator can read any.
 * Anything else — wrong household, unknown ref — gets the same 404, so references can't be probed.
 */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "case-lookup", { limit: 60 });
  if (limited) return limited;
  const session = await getSession(req);
  const ref = req.nextUrl.searchParams.get("ref") ?? (session?.role === "resident" ? session.hh ?? "" : "");
  const source = await pickSource(req.cookies.get(SOURCE_COOKIE)?.value);
  const { cases } = await loadSnapshot(source);
  const c = ref ? findCaseIn(cases, ref) : null;
  if (!c || !mayAccessHousehold(session, c.householdRef)) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json(residentViewOf(c));
}
