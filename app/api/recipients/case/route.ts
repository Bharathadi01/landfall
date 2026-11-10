import { NextRequest, NextResponse } from "next/server";
import { resolveCaseRef, residentView } from "@/lib/relief/access-reports";

/** Resident-facing case status. Accepts a household id or case reference. */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const caseRef = ref ? resolveCaseRef(ref) : null;
  if (!caseRef) return NextResponse.json({ error: "We couldn’t find that reference. Check it and try again." }, { status: 404 });
  return NextResponse.json(residentView(caseRef));
}
