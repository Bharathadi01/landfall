import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, shouldUpdatePayoutStatus } from "@/lib/paypal/webhooks";
import { db } from "@/lib/db/client";
import { webhookEvents, payoutItems, donations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let event: Record<string, unknown> = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const eventId = String(event.id || "");
    const eventType = String(event.event_type || "");

    if (!eventId) {
      return NextResponse.json({ error: "Missing webhook event id" }, { status: 400 });
    }

    // 1. Deduplication Check
    const existing = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.paypalEventId, eventId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ message: "Duplicate event already processed" }, { status: 200 });
    }

    // 2. Cryptographic Signature Verification
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    let isVerified = false;
    if (authAlgo && certUrl && transmissionId && transmissionSig && webhookId) {
      isVerified = await verifyWebhookSignature({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      });
    } else {
      // In local dev without tunnel headers, mark appropriately
      console.warn("Webhook received without complete PayPal signature headers");
    }

    // 3. Persist Event to webhook_events Table
    await db.insert(webhookEvents).values({
      paypalEventId: eventId,
      type: eventType,
      verified: isVerified,
      payload: event,
      receivedAt: new Date(),
      processedAt: new Date(),
    });

    // 4. Handle Event Payload
    const resource = (event.resource || {}) as Record<string, unknown>;

    // Payout item events: update payout_items table
    if (eventType.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      const payoutItemId = String(resource.payout_item_id || "");
      const newStatus = String(resource.transaction_status || eventType.split(".").pop() || "");

      if (payoutItemId) {
        const currentItem = await db
          .select()
          .from(payoutItems)
          .where(eq(payoutItems.paypalItemId, payoutItemId))
          .limit(1);

        if (currentItem.length > 0) {
          if (shouldUpdatePayoutStatus(currentItem[0].status, newStatus)) {
            await db
              .update(payoutItems)
              .set({
                status: newStatus,
                lastEventAt: new Date(),
              })
              .where(eq(payoutItems.paypalItemId, payoutItemId));
          }
        }
      }
    }

    // Capture completed events: update donations
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const suppData = resource.supplementary_data as Record<string, Record<string, string>> | undefined;
      const orderId = String(suppData?.related_ids?.order_id || resource.id || "");
      const amountObj = (resource.amount || {}) as Record<string, string>;
      const amountValue = amountObj.value || "0.00";

      if (orderId) {
        await db
          .insert(donations)
          .values({
            paypalOrderId: orderId,
            amount: amountValue,
            status: "COMPLETED",
            capturedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: donations.paypalOrderId,
            set: { status: "COMPLETED", capturedAt: new Date() },
          });
      }
    }

    return NextResponse.json({ status: "success", verified: isVerified });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook processing error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
