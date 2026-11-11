import { NextRequest, NextResponse } from "next/server";
import { AccessReportInput, addAccessReport, listAccessReports, residentView, resolveCaseRef } from "@/lib/relief/access-reports";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { householdFromRef } from "@/lib/auth/resident-code";
import { limitRequest } from "@/lib/security/rate-limit";

/** Coordinator view: reports are case refs + a reason code only (no personal details). */
export async function GET() {
  return NextResponse.json({ reports: listAccessReports(), store: "memory (demo — resets on restart)" });
}

/** A household reports whether it received the money or cannot access it. Recipient-reported evidence only. */
export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "access-report", { limit: 20 });
  if (limited) return limited;
  const session = await getSession(req);
  // The read-only viewer role can look but never write on a resident's behalf.
  if (session?.role === "viewer") return NextResponse.json({ error: "forbidden", message: "Your role doesn't allow this action." }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = AccessReportInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report", details: parsed.error.flatten() }, { status: 400 });

  // A resident can only report for their own household; the same 404 hides whether the reference exists.
  const ref = resolveCaseRef(parsed.data.caseRef);
  const hh = ref ? householdFromRef(ref) : null;
  if (!ref || !hh || !mayAccessHousehold(session, hh)) return NextResponse.json({ error: "Unknown case reference" }, { status: 404 });

  const result = addAccessReport(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ report: result.report, case: residentView(result.report.caseRef) }, { status: 201 });
}
