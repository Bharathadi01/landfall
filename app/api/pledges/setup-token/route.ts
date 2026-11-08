import { NextResponse } from "next/server";
import { createVaultSetupToken } from "@/lib/paypal/vault";

export async function POST(req: Request) {
  try {
    const { returnUrl, cancelUrl } = await req.json();
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const res = await createVaultSetupToken({
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          customer_type: "CONSUMER",
          experience_context: {
            brand_name: "Landfall Mutual Aid",
            return_url: returnUrl || `${appUrl}/pledge/success`,
            cancel_url: cancelUrl || `${appUrl}/pledge/cancel`,
          },
        },
      },
    });

    return NextResponse.json(res.data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create vault setup token" },
      { status: 500 }
    );
  }
}
