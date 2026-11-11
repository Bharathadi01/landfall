import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal/orders";
import { z } from "zod";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

const RequestSchema = z.object({
  amountUsd: z.string().regex(/^\d+\.\d{2}$/, "Amount must be 2-decimal USD (e.g. 5.00)"),
  fundId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, "donations-orders-post", { limit: 10 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const { data, debugId } = await createOrder(
      parsed.data.amountUsd,
      parsed.data.fundId || "fund_general",
      "donor"
    );

    return NextResponse.json({ orderId: data.id, status: data.status, debugId });
  } catch (err: unknown) {
    return safeError(err, "Request failed", 500);
  }
}

