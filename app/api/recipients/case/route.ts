import { NextRequest, NextResponse } from "next/server";
import { resolveCaseRef, residentView } from "@/lib/relief/access-reports";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { householdFromRef } from "@/lib/auth/resident-code";
import { limitRequest } from "@/lib/security/rate-limit";

const NOT_FOUND = { error: "We couldn’t find that reference. Check it and try again." };

/**
 * Case status. A resident session can read ONLY its own household; an operator can read any.
 * Anything else — wrong household, unknown ref — gets the same 404, so references can't be probed.
 */
export async function GET(req: NextRequest) {
  const limited = limitRequest(req, "case-lookup", { limit: 60 });
  if (limited) return limited;
  const session = await getSession(req);
  const ref = req.nextUrl.searchParams.get("ref") ?? (session?.role === "resident" ? session.hh ?? "" : "");
  const caseRef = ref ? resolveCaseRef(ref) : null;
  const hh = caseRef ? householdFromRef(caseRef) : null;
  if (!caseRef || !hh || !mayAccessHousehold(session, hh)) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json(residentView(caseRef));
}
