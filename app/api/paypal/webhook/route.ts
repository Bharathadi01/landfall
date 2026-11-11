import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, shouldUpdateSubscriptionStatus } from "@/lib/paypal/webhooks";
import { db } from "@/lib/db/client";
import { webhookEvents, donations, subscriptions } from "@/lib/db/schema";
import { applyBatchSnapshot, applyItemObservation } from "@/lib/payouts/store";
import { refreshPayoutBatch } from "@/lib/payouts/refresh";
import { toCents } from "@/lib/payouts/status";
import { recordLedgerTransaction, isTransactionRecorded } from "@/lib/ledger/index";
import { eq } from "drizzle-orm";
import { safeError } from "@/lib/http/safe-error";

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

    // 1. Signature verification FIRST, via PayPal's verify-webhook-signature API.
    //    Nothing is persisted and no state changes until PayPal confirms the signature,
    //    so a forged event can neither move money nor pre-empt the real delivery's event id.
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    if (!webhookId) {
      return NextResponse.json(
        { error: "Webhook receiver not configured (PAYPAL_WEBHOOK_ID unset); event rejected" },
        { status: 503 }
      );
    }
    if (!(authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime)) {
      return NextResponse.json({ error: "Missing PayPal signature headers; event rejected" }, { status: 401 });
    }

    const isVerified = await verifyWebhookSignature({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    });
    if (!isVerified) {
      return NextResponse.json({ error: "PayPal signature verification failed; event rejected" }, { status: 401 });
    }

    // 2. Claim the event. De-duplication is on the PayPal event id, but an event only counts as
    //    DONE once it has been fully handled (processed_at is set at the very end). If an earlier
    //    attempt crashed or threw, PayPal's retry finds processed_at NULL and handles it again,
    //    instead of being acknowledged as a duplicate and lost. Every handler below is idempotent.
    const claimed = await db
      .insert(webhookEvents)
      .values({ paypalEventId: eventId, type: eventType, verified: true, payload: event, receivedAt: new Date(), processedAt: null })
      .onConflictDoNothing({ target: webhookEvents.paypalEventId })
      .returning({ id: webhookEvents.paypalEventId });

    if (claimed.length === 0) {
      const [prior] = await db.select({ processedAt: webhookEvents.processedAt }).from(webhookEvents).where(eq(webhookEvents.paypalEventId, eventId)).limit(1);
      if (prior?.processedAt) {
        return NextResponse.json({ message: "Duplicate event already processed" }, { status: 200 });
      }
      // previous attempt did not finish: fall through and process it again
    }

    // 4. Handle Event Payload
    const resource = (event.resource || {}) as Record<string, unknown>;
    const eventTime = typeof event.create_time === "string" && !Number.isNaN(Date.parse(event.create_time)) ? new Date(event.create_time) : null;

    // 4a. Payout item events -> durable payout records (+ ledger), serialised per item under a row lock.
    if (eventType.startsWith("PAYMENT.PAYOUTS-ITEM.") || eventType.startsWith("PAYMENT.PAYOUTS_ITEM.")) {
      const payoutItem = (resource.payout_item || {}) as Record<string, unknown>;
      const amount = (payoutItem.amount || {}) as Record<string, string>;
      const fee = (resource.payout_item_fee || {}) as Record<string, string>;
      // Prefer the item's own transaction_status; otherwise the event-name suffix (SUCCEEDED/HELD are mapped in normalizeItemStatus).
      const rawStatus = String(resource.transaction_status || eventType.split(".").pop() || "");
      const payoutItemId = String(resource.payout_item_id || "");
      if (payoutItemId) {
        await applyItemObservation({
          paypalItemId: payoutItemId,
          senderItemId: payoutItem.sender_item_id ? String(payoutItem.sender_item_id) : undefined,
          paypalBatchId: resource.payout_batch_id ? String(resource.payout_batch_id) : undefined,
          transactionId: resource.transaction_id ? String(resource.transaction_id) : null,
          rawStatus,
          amountCents: toCents(amount.value),
          currency: amount.currency ?? null,
          feeCents: toCents(fee.value),
          providerTime: typeof resource.time_processed === "string" ? new Date(resource.time_processed) : null,
          eventTime,
          source: "webhook",
          eventId,
        });
      }
    }

    // 4a-2. Payout batch events carry the batch header, not the items. Record the batch status, then ask
    //       PayPal (read-only GET) for the items, so a batch event brings every item up to date.
    if (eventType.startsWith("PAYMENT.PAYOUTSBATCH.")) {
      const batchHeader = (resource.batch_header || resource) as Record<string, unknown>;
      const batchId = String(batchHeader.payout_batch_id || "");
      const batchStatus = String(batchHeader.batch_status || eventType.split(".").pop() || "").toUpperCase();
      if (batchId) {
        await applyBatchSnapshot(batchId, { status: batchStatus, source: "webhook" });
        try {
          await refreshPayoutBatch(batchId);
        } catch (err) {
          // Best effort: the webhook itself is still valid and recorded. A later refresh recovers the items.
          console.warn("[webhook] batch refresh failed", batchId, err instanceof Error ? err.message : err);
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

    await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.paypalEventId, eventId));
    return NextResponse.json({ status: "success", verified: isVerified });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook processing error:", msg);
    return safeError(err, "Request failed", 500);
  }
}
