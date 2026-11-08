import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal/orders";
import { z } from "zod";

const RequestSchema = z.object({
  amountUsd: z.string().regex(/^\d+\.\d{2}$/, "Amount must be 2-decimal USD (e.g. 5.00)"),
  fundId: z.string().optional(),
});

export async function POST(req: NextRequest) {
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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
