import { NextResponse } from "next/server";
import {
  createEncryptedHouseholdCase,
  type EnrollmentInput,
  createLocationHistoryEntry,
  createConsentRecord,
  generateEmailVerificationToken,
} from "@/lib/recipients/index";
import { db } from "@/lib/db/client";
import {
  households,
  funds,
  recipientConsents,
  volunteerAttestations,
  locationHistory,
  emailVerifications,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: Request) {
  try {
    const body: EnrollmentInput = await req.json();

    if (!body.name || !body.address) {
      return NextResponse.json(
        { error: "name and address are required" },
        { status: 400 }
      );
    }

    // 1. Process encryption, consent, and channel resolution
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

    // 3. Persist household record with dual-axis architecture
    const [inserted] = await db
      .insert(households)
      .values({
        fundId: fund.id,
        status: storedCase.status,
        enrollmentMethod: storedCase.enrollmentMethod,
        paymentChannel: storedCase.paymentChannel,
        recipientPath: storedCase.recipientPath,
        recipientVersion: storedCase.recipientVersion,
        caseJson: storedCase,
        lat: storedCase.lat,
        lng: storedCase.lng,
        currentLat: storedCase.currentLat,
        currentLng: storedCase.currentLng,
        isDisplaced: storedCase.isDisplaced,
        language: storedCase.language,
        receiver: storedCase.receiver,
        reconfirmedAt: new Date(storedCase.lastReconfirmedAt),
      })
      .returning();

    // 4. Record unbundled consents
    const consentMethod = body.consentMethod || (body.assistedByVolunteerId ? "VERBAL_TO_VOLUNTEER" : "SELF_DIGITAL");
    const actor = body.assistedByVolunteerId || inserted.id;

    await db.insert(recipientConsents).values([
      {
        householdId: inserted.id,
        purpose: "TERMS_OF_SERVICE",
        consentVersion: "v1.0.0",
        language: storedCase.language,
        actor,
        method: consentMethod,
      },
      {
        householdId: inserted.id,
        purpose: "PAYMENT_ROUTING",
        consentVersion: "v1.0.0",
        language: storedCase.language,
        actor,
        method: consentMethod,
      },
    ]);

    // Optional location consent if provided
    if (body.consents?.LOCATION_TRACKING) {
      await db.insert(recipientConsents).values({
        householdId: inserted.id,
        purpose: "LOCATION_TRACKING",
        consentVersion: "v1.0.0",
        language: storedCase.language,
        actor,
        method: consentMethod,
      });
    }

    // 5. Record location history entry
    if (storedCase.lat != null && storedCase.lng != null) {
      await db.insert(locationHistory).values({
        householdId: inserted.id,
        address: storedCase.encryptedAddress,
        lat: storedCase.lat,
        lng: storedCase.lng,
        isDisplaced: storedCase.isDisplaced,
        recordedBy: actor,
      });
    }

    // 6. Record volunteer attestation if assisted
    if (body.assistedByVolunteerId && body.volunteerAttestationNote) {
      await db.insert(volunteerAttestations).values({
        householdId: inserted.id,
        volunteerId: body.assistedByVolunteerId,
        attestationType: "RESIDENCE_VERIFIED",
        isDirectObservation: true,
        statementNote: body.volunteerAttestationNote,
      });
    }

    // 7. If email channel and email is provided, generate verification token
    let emailVerificationToken: string | undefined;
    if (storedCase.paymentChannel === "EMAIL" && body.paypalEmailOrId?.includes("@")) {
      const email = body.paypalEmailOrId.trim().toLowerCase();
      const tokenInfo = generateEmailVerificationToken(email);
      await db.insert(emailVerifications).values({
        householdId: inserted.id,
        email,
        tokenHash: tokenInfo.tokenHash,
        expiresAt: tokenInfo.expiresAt,
      });
      emailVerificationToken = tokenInfo.token;
    }

    return NextResponse.json({
      success: true,
      householdId: inserted.id,
      enrollmentMethod: storedCase.enrollmentMethod,
      paymentChannel: storedCase.paymentChannel,
      recipientPath: storedCase.recipientPath,
      recipientVersion: storedCase.recipientVersion,
      evidenceLevel: storedCase.evidenceLevel,
      status: inserted.status,
      emailVerificationPending: !!emailVerificationToken,
      ...(process.env.NODE_ENV !== "production" && emailVerificationToken ? { devEmailToken: emailVerificationToken } : {}),
    });
  } catch (err: any) {
    return safeError(err, "Failed to enroll household", 500);
  }
}
