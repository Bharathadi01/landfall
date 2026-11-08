import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { paypalFetch } from "../lib/paypal/client";

const REQUIRED_EVENTS = [
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTSBATCH.PROCESSING",
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.CANCELED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
];

async function main() {
  const targetUrl = process.argv[2] || process.env.APP_URL;

  if (!targetUrl || targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) {
    console.error("❌ ERROR: Please supply a public HTTPS URL (Render or Cloudflare tunnel).");
    console.log("Usage: pnpm exec tsx scripts/register-webhook.ts https://your-app.onrender.com\n");
    process.exit(1);
  }

  const webhookUrl = `${targetUrl.replace(/\/$/, "")}/api/paypal/webhook`;
  console.log(`\n🔗 Registering PayPal Sandbox Webhook for: ${webhookUrl}\n`);

  // 1. Check existing webhooks
  try {
    const listRes = await paypalFetch<{ webhooks: { id: string; url: string }[] }>(
      "GET",
      "/v1/notifications/webhooks"
    );

    const existing = listRes.data.webhooks?.find((wh) => wh.url === webhookUrl);
    if (existing) {
      console.log(`✅ Webhook already registered with ID: ${existing.id}`);
      console.log(`\nAdd this to your .env.local and Render environment:`);
      console.log(`PAYPAL_WEBHOOK_ID=${existing.id}\n`);
      return;
    }
  } catch (err) {
    console.warn("Could not list existing webhooks, attempting fresh creation...", err);
  }

  // 2. Register webhook
  try {
    const createRes = await paypalFetch<{ id: string }>("POST", "/v1/notifications/webhooks", {
      url: webhookUrl,
      event_types: REQUIRED_EVENTS.map((name) => ({ name })),
    });

    console.log(`✅ Webhook successfully created!`);
    console.log(`🆔 Webhook ID: ${createRes.data.id}`);
    console.log(`\n👉 Set this environment variable:`);
    console.log(`PAYPAL_WEBHOOK_ID=${createRes.data.id}\n`);
  } catch (err: unknown) {
    console.error("❌ Failed to create webhook:", err);
    process.exit(1);
  }
}

main();
