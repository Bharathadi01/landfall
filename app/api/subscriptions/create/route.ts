import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/paypal/subscriptions";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { safeError } from "@/lib/http/safe-error";

const CreateSustainerSchema = z.object({
  planId: z.string(),
  donorEmail: z.string().email(),
  returnUrl: z.string().url().default("https://landfall.relief/sustainer/return"),
  cancelUrl: z.string().url().default("https://landfall.relief/sustainer/cancel"),
  amountMonthly: z.string().default("25.00"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = CreateSustainerSchema.parse(body);

    const paypalSub = await createSubscription({
      plan_id: input.planId,
      subscriber: {
        email_address: input.donorEmail,
      },
      application_context: {
        brand_name: "Landfall Mutual Aid Relief",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    });

    const approveLink = paypalSub.links?.find((l) => l.rel === "approve")?.href;

    await db.insert(subscriptions).values({
      paypalSubscriptionId: paypalSub.id,
      planId: input.planId,
      donorEmail: input.donorEmail,
      status: "APPROVAL_PENDING",
      amountMonthly: input.amountMonthly,
    });

    return NextResponse.json({
      subscriptionId: paypalSub.id,
      status: paypalSub.status,
      approveUrl: approveLink,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Create subscription error:", msg);
    return safeError(err, "Request failed", 400);
  }
}

