import { NextRequest, NextResponse } from "next/server";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { createAppealRecord, type AppealInput } from "@/lib/recipients/index";
import { db } from "@/lib/db/client";
import { appeals, households } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "resident-write", { limit: 10 });
  if (limited) return limited;
  try {
    const body: AppealInput = await req.json();

    if (!body.householdId || !body.reason) {
      return NextResponse.json(
        { error: "householdId and reason are required" },
        { status: 400 }
      );
    }

    // A resident may only act for their own household; operators may act for any. Same 404 either way.
    if (!mayAccessHousehold(await getSession(req), body.householdId)) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    // Verify household exists
    const [hh] = await db
      .select()
      .from(households)
      .where(eq(households.id, body.householdId))
      .limit(1);

    if (!hh) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    // Generate appeal record with strict 24-hour SLA
    const appealRecord = createAppealRecord(body);

    const [inserted] = await db
      .insert(appeals)
      .values({
        householdId: appealRecord.householdId,
        caseReference: appealRecord.caseReference,
        category: appealRecord.category,
        explanation: appealRecord.explanation,
        status: appealRecord.status,
        slaDeadline: new Date(appealRecord.slaDeadline),
      })
      .returning();

    return NextResponse.json({
      success: true,
      appealId: inserted.id,
      caseReference: inserted.caseReference,
      category: inserted.category,
      status: inserted.status,
      slaDeadline: inserted.slaDeadline.toISOString(),
      message: "Appeal submitted. A human coordinator will review within 24 hours.",
    });
  } catch (err: any) {
    return safeError(err, "Failed to submit appeal", 500);
  }
}

export async function GET(req: Request) {
  const limited = limitRequest(req, "recipients-appeal-get", { limit: 30 });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const householdId = url.searchParams.get("householdId");

    if (householdId) {
      const results = await db
        .select()
        .from(appeals)
        .where(eq(appeals.householdId, householdId));
      return NextResponse.json({ appeals: results });
    }

    const allAppeals = await db.select().from(appeals);
    return NextResponse.json({ appeals: allAppeals });
  } catch (err: any) {
    return safeError(err, "Failed to list appeals", 500);
  }
}
