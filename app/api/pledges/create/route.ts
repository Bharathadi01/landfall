import { NextResponse } from "next/server";
import { exchangeSetupTokenForPaymentToken } from "@/lib/paypal/vault";
import { db } from "@/lib/db/client";
import { stormPledges, pledgeConsents } from "@/lib/db/schema";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: Request) {
  try {
    const {
      setupTokenId,
      donorEmail,
      amountPerEvent,
      seasonCap,
      consentText,
      consentVersion = "v1.0",
      hazardScope = ["HURRICANE", "FLOOD", "STORM_SURGE"],
    } = await req.json();

    if (!setupTokenId || !donorEmail || !amountPerEvent || !seasonCap) {
      return NextResponse.json(
        { error: "setupTokenId, donorEmail, amountPerEvent, and seasonCap are required" },
        { status: 400 }
      );
    }

    if (!consentText) {
      return NextResponse.json(
        { error: "Explicit donor consent text is mandatory before saving a payment method." },
        { status: 400 }
      );
    }

    let vaultPaymentToken = setupTokenId;
    try {
      // Exchange setup token for payment token in PayPal Sandbox
      const tokenRes = await exchangeSetupTokenForPaymentToken(setupTokenId);
      if (tokenRes.data.id) {
        vaultPaymentToken = tokenRes.data.id;
      }
    } catch (vaultErr) {
      // In sandbox without Vault onboarding, simulate with token ID
      console.warn("[VAULT_SANDBOX] Vault exchange simulated:", vaultErr);
    }

    // 1. Store explicit donor consent
    const [consent] = await db
      .insert(pledgeConsents)
      .values({
        donorEmail,
        consentText,
        consentVersion,
        hazardScope,
        maxPerEvent: Number(amountPerEvent).toFixed(2),
        seasonCap: Number(seasonCap).toFixed(2),
      })
      .returning();

    // 2. Persist storm pledge
    const [created] = await db
      .insert(stormPledges)
      .values({
        donorEmail,
        consentId: consent.id,
        vaultPaymentToken,
        amountPerEvent: Number(amountPerEvent).toFixed(2),
        seasonCap: Number(seasonCap).toFixed(2),
        hazardScope,
        status: "ACTIVE",
      })
      .returning();

    return NextResponse.json({ success: true, pledge: created, consent });
  } catch (err: any) {
    return safeError(err, "Failed to create storm pledge", 500);
  }
}
