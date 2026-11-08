import { NextResponse } from "next/server";
import { createEncryptedHouseholdCase, type EnrollmentInput } from "@/lib/recipients/index";
import { db } from "@/lib/db/client";
import { households, funds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body: EnrollmentInput = await req.json();

    if (!body.name || !body.address || !body.recipientPath) {
      return NextResponse.json(
        { error: "name, address, and recipientPath are required" },
        { status: 400 }
      );
    }

    // 1. Process encryption and consent
    const storedCase = createEncryptedHouseholdCase(body);

    // 2. Resolve default fund (or create if not exists for dev/test)
    let [fund] = await db.select().from(funds).limit(1);
    if (!fund) {
      const [newFund] = await db
        .insert(funds)
        .values({
          name: "Tampa Bay Mutual Aid Relief Fund",
          paypalMerchantEmail: "sb-7sfg953788004@business.example.com",
        })
        .returning();
      fund = newFund;
    }

    // 3. Persist household record
    const [inserted] = await db
      .insert(households)
      .values({
        fundId: fund.id,
        status: storedCase.status,
        recipientPath: storedCase.recipientPath,
        caseJson: storedCase,
        lat: storedCase.lat,
        lng: storedCase.lng,
        language: storedCase.language,
        receiver: storedCase.receiver,
        reconfirmedAt: new Date(storedCase.lastReconfirmedAt),
      })
      .returning();

    return NextResponse.json({
      success: true,
      householdId: inserted.id,
      recipientPath: storedCase.recipientPath,
      evidenceLevel: storedCase.evidenceLevel,
      status: inserted.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to enroll household" },
      { status: 500 }
    );
  }
}
