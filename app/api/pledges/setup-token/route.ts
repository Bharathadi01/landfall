import { NextResponse } from "next/server";
import { createVaultSetupToken } from "@/lib/paypal/vault";

export async function POST(req: Request) {
  try {
    const { returnUrl, cancelUrl } = await req.json();
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    try {
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
      if (err.message?.includes("insufficient permissions") || err.message?.includes("NOT_AUTHORIZED")) {
        // As documented in docs/M3_PAYPAL_RESEARCH.md, standard sandbox accounts require Vault vetting
        return NextResponse.json({
          id: `sim_setup_tok_${Date.now()}`,
          status: "ACTION_REQUIRED",
          isSimulated: true,
          note: "Production path — Vault without purchase requires PayPal merchant onboarding.",
          links: [
            {
              href: `${appUrl}/pledge/approve?simulated=true`,
              rel: "approve",
              method: "GET",
            },
          ],
        });
      }
      throw err;
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create vault setup token" },
      { status: 500 }
    );
  }
}
