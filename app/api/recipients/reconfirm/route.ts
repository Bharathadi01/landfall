import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { households, locationHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptPII } from "@/lib/security/encryption";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: Request) {
  try {
    const { householdId, newAddress, newLat, newLng, isDisplaced } = await req.json();

    if (!householdId) {
      return NextResponse.json({ error: "householdId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    const now = new Date();
    let newVersion = existing.recipientVersion;

    const updates: Partial<typeof households.$inferInsert> = {
      reconfirmedAt: now,
    };

    // If address changed or displacement status changed, update location and bump version
    if (newAddress || isDisplaced !== undefined || newLat != null) {
      newVersion += 1;
      updates.recipientVersion = newVersion;

      if (isDisplaced !== undefined) {
        updates.isDisplaced = isDisplaced;
      }
      if (newLat != null) {
        updates.currentLat = newLat;
      }
      if (newLng != null) {
        updates.currentLng = newLng;
      }

      // Record location history entry
      if (newAddress && newLat != null && newLng != null) {
        const encryptedAddr = encryptPII(newAddress) || (existing.caseJson as any)?.encryptedAddress;
        await db.insert(locationHistory).values({
          householdId,
          address: encryptedAddr,
          lat: newLat,
          lng: newLng,
          isDisplaced: isDisplaced ?? existing.isDisplaced,
          recordedBy: householdId,
        });
      }
    }

    const [updated] = await db
      .update(households)
      .set(updates)
      .where(eq(households.id, householdId))
      .returning();

    return NextResponse.json({
      success: true,
      householdId: updated.id,
      reconfirmedAt: now.toISOString(),
      recipientVersion: updated.recipientVersion,
      isDisplaced: updated.isDisplaced,
      message: "Household eligibility reconfirmed for upcoming storm season.",
    });
  } catch (err: any) {
    return safeError(err, "Failed to reconfirm household", 500);
  }
}
