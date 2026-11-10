import { NextRequest, NextResponse } from "next/server";
import { AccessReportInput, addAccessReport, listAccessReports, residentView } from "@/lib/relief/access-reports";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Coordinator view: reports are case refs + a reason code only (no personal details). */
export async function GET() {
  return NextResponse.json({ reports: listAccessReports(), store: "memory (demo — resets on restart)" });
}

/** A household reports whether it received the money or cannot access it. Recipient-reported evidence only. */
export async function POST(req: NextRequest) {
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(client)) return NextResponse.json({ error: "Too many reports; please wait a minute." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = AccessReportInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report", details: parsed.error.flatten() }, { status: 400 });

  const result = addAccessReport(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ report: result.report, case: residentView(result.report.caseRef) }, { status: 201 });
}
