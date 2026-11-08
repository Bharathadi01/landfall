import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { households } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { householdId } = await req.json();

    if (!householdId) {
      return NextResponse.json({ error: "householdId is required" }, { status: 400 });
    }

    const now = new Date();

    const [updated] = await db
      .update(households)
      .set({
        reconfirmedAt: now,
      })
      .where(eq(households.id, householdId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      householdId: updated.id,
      reconfirmedAt: now.toISOString(),
      message: "Household eligibility reconfirmed for upcoming storm season.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reconfirm household" },
      { status: 500 }
    );
  }
}
