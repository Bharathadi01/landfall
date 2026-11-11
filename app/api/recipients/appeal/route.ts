import { NextResponse } from "next/server";
import { createAppealRecord, type AppealInput } from "@/lib/recipients/index";
import { db } from "@/lib/db/client";
import { appeals, households } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: Request) {
  try {
    const body: AppealInput = await req.json();

    if (!body.householdId || !body.reason) {
      return NextResponse.json(
        { error: "householdId and reason are required" },
        { status: 400 }
      );
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
