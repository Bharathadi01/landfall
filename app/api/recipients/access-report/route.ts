import { NextRequest, NextResponse } from "next/server";
import { AccessReportInput, listAccessReports, recordAccessReport, residentViewOf } from "@/lib/relief/access-reports";
import { hydrateAccessReports, persistAccessReport } from "@/lib/relief/access-reports.server";
import { findCaseIn, loadSnapshot, pickSource, SOURCE_COOKIE } from "@/lib/relief/case-source";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";

/** Coordinator view: reports are case refs + a reason code (and, for voice, the resident's words and a translation). */
export async function GET() {
  await hydrateAccessReports();
  return NextResponse.json({ reports: listAccessReports() });
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
  const source = await pickSource(req.cookies.get(SOURCE_COOKIE)?.value);
  const before = await loadSnapshot(source);
  const target = findCaseIn(before.cases, parsed.data.caseRef);
  if (!target || !mayAccessHousehold(session, target.householdRef)) return NextResponse.json({ error: "Unknown case reference" }, { status: 404 });

  const report = recordAccessReport(target.caseRef, parsed.data, { channel: "web" });
  await persistAccessReport(report);
  const after = await loadSnapshot(source);
  const updated = findCaseIn(after.cases, target.caseRef) ?? target;
  return NextResponse.json({ report, case: residentViewOf(updated) }, { status: 201 });
}
