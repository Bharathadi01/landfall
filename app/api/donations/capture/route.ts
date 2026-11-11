import { NextRequest, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal/orders";
import { db } from "@/lib/db/client";
import { donations } from "@/lib/db/schema";
import crypto from "crypto";
import { z } from "zod";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

const RequestSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "donations-capture-post", { limit: 10 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const { data, debugId } = await captureOrder(parsed.data.orderId, "donor");

    // Extract captured amount and donor email
    const captureUnit = data.purchase_units?.[0]?.payments?.captures?.[0];
    if (data.status !== "COMPLETED" || !captureUnit) {
      // PayPal did not complete the capture (e.g. payer action required): say so, record nothing as received.
      return NextResponse.json({ error: "capture_incomplete", message: "PayPal did not complete this payment, so nothing was recorded." }, { status: 409 });
    }
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
      captureId: captureUnit.id,
      amount: amountVal,
      debugId,
    });
  } catch (err: unknown) {
    return safeError(err, "Request failed", 500);
  }
}

