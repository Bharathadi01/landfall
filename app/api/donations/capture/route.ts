import { NextRequest, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal/orders";
import { db } from "@/lib/db/client";
import { donations } from "@/lib/db/schema";
import crypto from "crypto";
import { z } from "zod";

const RequestSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const { data, debugId } = await captureOrder(parsed.data.orderId, "donor");

    // Extract captured amount and donor email
    const captureUnit = data.purchase_units?.[0]?.payments?.captures?.[0];
    const amountVal = captureUnit?.amount?.value || "5.00";
    const donorEmail = data.payer?.email_address || "";
    const emailHash = donorEmail
      ? crypto.createHash("sha256").update(donorEmail.toLowerCase().trim()).digest("hex")
      : null;

    // Store in donations table
    await db
      .insert(donations)
      .values({
        paypalOrderId: data.id,
        amount: amountVal,
        donorEmailHash: emailHash,
        status: data.status,
        capturedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: donations.paypalOrderId,
        set: { status: data.status, capturedAt: new Date() },
      });

    return NextResponse.json({
      orderId: data.id,
      status: data.status,
      amount: amountVal,
      debugId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

