import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  shouldUpdatePayoutStatus,
  shouldUpdateSubscriptionStatus,
} from "@/lib/paypal/webhooks";
import { db } from "@/lib/db/client";
import { webhookEvents, payoutItems, donations, subscriptions } from "@/lib/db/schema";
import { recordLedgerTransaction, isTransactionRecorded } from "@/lib/ledger/index";
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

    // 1. Deduplication Check on Webhook Event ID
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

    // 4a. Payout item events: update payout_items table
    if (
      eventType.startsWith("PAYMENT.PAYOUTS-ITEM.") ||
      eventType.startsWith("PAYMENT.PAYOUTS_ITEM.")
    ) {
      const payoutItemId = String(resource.payout_item_id || "");
      let rawStatus = String(resource.transaction_status || eventType.split(".").pop() || "");
      const newStatus = rawStatus.toUpperCase() === "SUCCEEDED" ? "SUCCESS" : rawStatus.toUpperCase();

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

    // 4a-2. Payout batch events: update items via batch manifest or HATEOAS traversal
    if (eventType.startsWith("PAYMENT.PAYOUTSBATCH.")) {
      const batchHeader = (resource.batch_header || resource) as Record<string, unknown>;
      const batchStatus = String(batchHeader.batch_status || eventType.split(".").pop() || "").toUpperCase();
      const itemsList = Array.isArray(resource.items) ? (resource.items as Array<Record<string, unknown>>) : [];

      for (const it of itemsList) {
        const itemId = String(it.payout_item_id || "");
        const itStatusRaw = String(it.transaction_status || (batchStatus === "SUCCESS" ? "SUCCESS" : "PROCESSING"));
        const itStatus = itStatusRaw.toUpperCase() === "SUCCEEDED" ? "SUCCESS" : itStatusRaw.toUpperCase();

        if (itemId) {
          const currentItem = await db
            .select()
            .from(payoutItems)
            .where(eq(payoutItems.paypalItemId, itemId))
            .limit(1);

          if (currentItem.length > 0 && shouldUpdatePayoutStatus(currentItem[0].status, itStatus)) {
            await db
              .update(payoutItems)
              .set({
                status: itStatus,
                lastEventAt: new Date(),
              })
              .where(eq(payoutItems.paypalItemId, itemId));
          }
        }
      }
    }

    // 4b. Capture completed events: update donations & record double-entry ledger entry
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const suppData = resource.supplementary_data as Record<string, Record<string, string>> | undefined;
      const orderId = String(suppData?.related_ids?.order_id || resource.id || "");
      const amountObj = (resource.amount || {}) as Record<string, string>;
      const amountValue = amountObj.value || "0.00";
      const amountCents = Math.round(parseFloat(amountValue) * 100);

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

        // Record balanced ledger transaction idempotently
        if (amountCents > 0) {
          const txId = `tx_donation_capture_${orderId}`;
          const alreadyRecorded = await isTransactionRecorded(txId);
          if (!alreadyRecorded) {
            await recordLedgerTransaction({
              hostId: "default",
              transactionId: txId,
              description: `One-time donation capture (Order ${orderId})`,
              correlationId: orderId,
              entries: [
                {
                  accountName: "paypal_available",
                  entryType: "DEBIT",
                  amountCents: amountCents,
                },
                {
                  accountName: "reserve_protected",
                  entryType: "CREDIT",
                  amountCents: amountCents,
                },
              ],
            });
          }
        }
      }
    }

    // Helper for safe out-of-order subscription status updates
    const updateSubscriptionSafe = async (
      subId: string,
      newStatus: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED"
    ) => {
      if (!subId) return;
      const [existing] = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId))
        .limit(1);

      if (existing) {
        if (shouldUpdateSubscriptionStatus(existing.status, newStatus)) {
          await db
            .update(subscriptions)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(subscriptions.paypalSubscriptionId, subId));
        }
      }
    };

    // 4c. Monthly Sustainer Subscription Lifecycle Events
    if (eventType === "BILLING.SUBSCRIPTION.CREATED") {
      const subId = String(resource.id || "");
      const planId = String(resource.plan_id || "");
      const subscriber = resource.subscriber as Record<string, unknown> | undefined;
      const email = subscriber?.email_address ? String(subscriber.email_address) : null;

      if (subId) {
        const [existing] = await db
          .select({ status: subscriptions.status })
          .from(subscriptions)
          .where(eq(subscriptions.paypalSubscriptionId, subId))
          .limit(1);

        if (!existing) {
          await db.insert(subscriptions).values({
            paypalSubscriptionId: subId,
            planId: planId || "default-plan",
            donorEmail: email,
            status: "APPROVAL_PENDING",
            amountMonthly: "25.00",
          });
        } else if (shouldUpdateSubscriptionStatus(existing.status, "APPROVAL_PENDING")) {
          await db
            .update(subscriptions)
            .set({ status: "APPROVAL_PENDING", updatedAt: new Date() })
            .where(eq(subscriptions.paypalSubscriptionId, subId));
        }
      }
    }

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const subId = String(resource.id || "");
      // Safe status transition; INVARIANT: Activation represents authorization, moves 0 money.
      await updateSubscriptionSafe(subId, "ACTIVE");
    }

    if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
      const subId = String(resource.id || "");
      await updateSubscriptionSafe(subId, "CANCELLED");
    }

    if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
      const subId = String(resource.id || "");
      await updateSubscriptionSafe(subId, "SUSPENDED");
    }

    if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
      const subId = String(resource.id || "");
      await updateSubscriptionSafe(subId, "EXPIRED");
    }

    // 4d. Monthly Sustainer Payment Completed: moves money into ledger
    if (eventType === "PAYMENT.SALE.COMPLETED") {
      const saleId = String(resource.id || "");
      const billingAgreementId = String(resource.billing_agreement_id || "");
      const amountObj = (resource.amount || {}) as Record<string, string>;
      const totalStr = amountObj.total || amountObj.value || "0.00";
      const totalCents = Math.round(parseFloat(totalStr) * 100);

      if (saleId && totalCents > 0) {
        const txId = `tx_sustainer_sale_${saleId}`;
        const alreadyRecorded = await isTransactionRecorded(txId);

        if (!alreadyRecorded) {
          await recordLedgerTransaction({
            hostId: "default",
            transactionId: txId,
            description: `Monthly sustainer payment for subscription ${billingAgreementId || "direct"} (Sale ${saleId})`,
            correlationId: saleId,
            entries: [
              {
                accountName: "paypal_available",
                entryType: "DEBIT",
                amountCents: totalCents,
              },
              {
                accountName: "reserve_protected",
                entryType: "CREDIT",
                amountCents: totalCents,
              },
            ],
          });
        }

        if (billingAgreementId) {
          await db
            .update(subscriptions)
            .set({
              lastPaymentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.paypalSubscriptionId, billingAgreementId));
        }
      }
    }

    return NextResponse.json({ status: "success", verified: isVerified });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook processing error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
