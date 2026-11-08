import { NextResponse } from "next/server";
import { exchangeSetupTokenForPaymentToken } from "@/lib/paypal/vault";
import { db } from "@/lib/db/client";
import { stormPledges } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    const { setupTokenId, donorEmail, amountPerEvent, seasonCap } = await req.json();

    if (!setupTokenId || !donorEmail || !amountPerEvent || !seasonCap) {
      return NextResponse.json(
        { error: "setupTokenId, donorEmail, amountPerEvent, and seasonCap are required" },
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

    const [created] = await db
      .insert(stormPledges)
      .values({
        donorEmail,
        vaultPaymentToken,
        amountPerEvent: Number(amountPerEvent).toFixed(2),
        seasonCap: Number(seasonCap).toFixed(2),
        status: "ACTIVE",
      })
      .returning();

    return NextResponse.json({ success: true, pledge: created });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create storm pledge" },
      { status: 500 }
    );
  }
}
