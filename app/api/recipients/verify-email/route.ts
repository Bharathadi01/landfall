import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { emailVerifications, households } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyEmailToken } from "@/lib/recipients/index";

export async function POST(req: Request) {
  try {
    const { token, householdId } = await req.json();

    if (!token || !householdId) {
      return NextResponse.json(
        { error: "token and householdId are required" },
        { status: 400 }
      );
    }

    // Lookup verification record
    const [record] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.householdId, householdId),
        )
      )
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { error: "Verification record not found for this household" },
        { status: 404 }
      );
    }

    const verificationResult = verifyEmailToken({
      token,
      storedTokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
    });

    if (!verificationResult.valid) {
      return NextResponse.json(
        { error: verificationResult.reason || "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Mark token as used
    await db
      .update(emailVerifications)
      .set({ usedAt: new Date() })
      .where(eq(emailVerifications.id, record.id));

    // Update household payment channel to EMAIL with verified status
    const [hh] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    if (hh) {
      const caseJson = { ...(hh.caseJson as any), paymentVerified: true };
      await db
        .update(households)
        .set({
          caseJson,
          recipientPath: "EMAIL_CLAIM",
          recipientVersion: hh.recipientVersion + 1, // Material change increments version
        })
        .where(eq(households.id, householdId));
    }

    return NextResponse.json({
      success: true,
      message: "Email address verified successfully for Landfall relief disbursements.",
      householdId,
      email: record.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to verify email" },
      { status: 500 }
    );
  }
}
