import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { getSubscription } from "@/lib/paypal/subscriptions";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

/**
 * After the donor approves a subscription in PayPal's own window, the browser only tells us the subscription id.
 * We ask PayPal for the truth (status, plan, price) and record THAT; the browser's word is never trusted.
 */
const Body = z.object({ subscriptionId: z.string().regex(/^I-[A-Z0-9]{8,24}$/) });

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "subscriptions-activate", { limit: 6 });
  if (limited) return limited;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return safeError(parsed.error, "Invalid subscription.");

  try {
    const sub = await getSubscription(parsed.data.subscriptionId, "donor");
    if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
      return NextResponse.json({ error: "not_active", message: `PayPal reports this subscription as ${sub.status}, so it was not recorded as active.` }, { status: 409 });
    }
    const email = sub.subscriber?.email_address;
    const donorEmail = email ? `sha256:${crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex")}` : null; // never store the address itself
    const amount = (sub as { billing_info?: { last_payment?: { amount?: { value?: string } } } }).billing_info?.last_payment?.amount?.value ?? "25.00";
    await db
      .insert(subscriptions)
      .values({ paypalSubscriptionId: sub.id, planId: sub.plan_id, donorEmail, status: sub.status, amountMonthly: amount })
      .onConflictDoUpdate({ target: subscriptions.paypalSubscriptionId, set: { status: sub.status, updatedAt: new Date() } });
    return NextResponse.json({ subscriptionId: sub.id, status: sub.status });
  } catch (err) {
    return safeError(err, "Could not confirm the subscription.", 502);
  }
}
