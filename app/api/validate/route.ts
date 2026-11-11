import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { validationResponses } from "@/lib/db/schema";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";

/**
 * Stakeholder feedback. Only consented responses are stored; the public GET returns the COUNT only (never content or
 * contact details), so the number shown on the page is exactly the number of real people who answered.
 */
const Body = z.object({
  role: z.enum(["fund_coordinator", "finance_or_treasurer", "emergency_manager", "nonprofit_staff", "resident_or_recipient", "other"]),
  orgType: z.enum(["community_foundation", "mutual_aid_fund", "local_government", "relief_nonprofit", "faith_or_neighbourhood_group", "other"]),
  problemToday: z.string().trim().min(10).max(1000),
  wouldUse: z.number().int().min(1).max(5).optional(),
  comments: z.string().trim().max(1000).optional(),
  contact: z.string().trim().email().max(200).optional(),
  consent: z.literal(true),
});

export async function GET() {
  try {
    const [row] = await db.select({ n: count() }).from(validationResponses);
    return NextResponse.json({ responses: Number(row?.n ?? 0) });
  } catch {
    return NextResponse.json({ responses: null });
  }
}

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "validate", { limit: 5 });
  if (limited) return limited;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return safeError(parsed.error, "Invalid response.");
  try {
    const d = parsed.data;
    await db.insert(validationResponses).values({ role: d.role, orgType: d.orgType, problemToday: d.problemToday, wouldUse: d.wouldUse ?? null, comments: d.comments ?? null, contact: d.contact ?? null, consent: true });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return safeError(err, "Could not save your response.", 503);
  }
}
