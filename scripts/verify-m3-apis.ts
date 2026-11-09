import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { paypalFetch } from "../lib/paypal/client";

async function verifyM3APIs() {
  console.log("=== VERIFYING M3 APIS AGAINST LIVE SANDBOX ===");

  // 1. Vault v3 Setup Token
  console.log("\n1. Testing Vault v3 Setup Token (POST /v3/vault/setup-tokens)...");
  try {
    const setupTokenRes = await paypalFetch<any>(
      "POST",
      "/v3/vault/setup-tokens",
      {
        payment_source: {
          paypal: {
            usage_type: "MERCHANT",
            customer_type: "CONSUMER",
            experience_context: {
              brand_name: "Landfall Mutual Aid",
              return_url: "https://example.com/return",
              cancel_url: "https://example.com/cancel",
            },
          },
        },
      },
      { actor: "m3_research" }
    );
    console.log("✅ Setup Token SUCCESS:", setupTokenRes.data);
  } catch (err: any) {
    console.log("❌ Setup Token FAILED:", err.message);
  }

  // 2. Subscriptions Catalog Product
  console.log("\n2. Testing Subscriptions Catalog Product (POST /v1/catalogs/products)...");
  let productId = "";
  try {
    const productRes = await paypalFetch<any>(
      "POST",
      "/v1/catalogs/products",
      {
        name: "Landfall Mutual Aid Sustainer",
        description: "Monthly recurring sustainer contribution",
        type: "SERVICE",
        category: "CHARITY",
      },
      { actor: "m3_research" }
    );
    console.log("✅ Catalog Product SUCCESS:", productRes.data);
    productId = productRes.data.id;
  } catch (err: any) {
    console.log("❌ Catalog Product FAILED:", err.message);
  }

  // 3. Subscriptions Billing Plan (if product created)
  if (productId) {
    console.log(`\n3. Testing Subscriptions Billing Plan (POST /v1/billing/plans) for product ${productId}...`);
    try {
      const planRes = await paypalFetch<any>(
        "POST",
        "/v1/billing/plans",
        {
          product_id: productId,
          name: "Monthly Sustainer ($25/mo)",
          billing_cycles: [
            {
              frequency: {
                interval_unit: "MONTH",
                interval_count: 1,
              },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  value: "25.00",
                  currency_code: "USD",
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3,
          },
        },
        { actor: "m3_research" }
      );
      console.log("✅ Billing Plan SUCCESS:", planRes.data);
    } catch (err: any) {
      console.log("❌ Billing Plan FAILED:", err.message);
    }
  }

  // 4. Reporting API Balances
  console.log("\n4. Testing Reporting API Balances (GET /v1/reporting/balances)...");
  try {
    const balancesRes = await paypalFetch<any>(
      "GET",
      "/v1/reporting/balances?currency_code=USD",
      undefined,
      { actor: "m3_research" }
    );
    console.log("✅ Reporting Balances SUCCESS:", balancesRes.data);
  } catch (err: any) {
    console.log("❌ Reporting Balances FAILED (expected in standard sandbox):", err.message);
  }

  // 5. Transaction Search
  console.log("\n5. Testing Transaction Search (GET /v1/reporting/transactions)...");
  try {
    const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const endDate = new Date().toISOString();
    const txRes = await paypalFetch<any>(
      "GET",
      `/v1/reporting/transactions?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&fields=all`,
      undefined,
      { actor: "m3_research" }
    );
    console.log("✅ Transaction Search SUCCESS:", txRes.data);
  } catch (err: any) {
    console.log("❌ Transaction Search FAILED:", err.message);
  }
}

verifyM3APIs().catch(console.error);

