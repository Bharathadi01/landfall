import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelSubscription } from "@/lib/paypal/subscriptions";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  reason: z.string().default("Donor requested cancellation"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = CancelSubscriptionSchema.parse(body);

    await cancelSubscription(input.subscriptionId, input.reason);

    await db
      .update(subscriptions)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.paypalSubscriptionId, input.subscriptionId));

    return NextResponse.json({
      status: "CANCELLED",
      subscriptionId: input.subscriptionId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Cancel subscription error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

