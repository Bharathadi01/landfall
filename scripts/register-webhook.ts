/**
 * Register Landfall's webhook receiver with PayPal (Sandbox).
 *
 *   pnpm exec tsx scripts/register-webhook.ts https://landfall-web.onrender.com            # dry run (lists, changes nothing)
 *   pnpm exec tsx scripts/register-webhook.ts https://landfall-web.onrender.com --apply    # create (+ delete stale test hooks)
 *
 * Prints the webhook id: set it as PAYPAL_WEBHOOK_ID on the deployment (the receiver refuses events without it).
 * Only webhooks that point at throw-away inspectors (webhook.site, requestbin, ngrok) are ever deleted.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { paypalFetch } from "../lib/paypal/client";

const EVENT_TYPES = [
  "PAYMENT.PAYOUTSBATCH.DENIED",
  "PAYMENT.PAYOUTSBATCH.PROCESSING",
  "PAYMENT.PAYOUTSBATCH.SUCCESS",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.CANCELED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.HELD",
  "PAYMENT.PAYOUTS-ITEM.REFUNDED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
];
const THROWAWAY = /(webhook\.site|requestbin|pipedream|ngrok|localtunnel)/i;

interface Hook { id: string; url: string; event_types?: { name: string }[] }

async function main() {
  const base = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!base || !/^https:\/\//.test(base)) {
    console.error("Usage: register-webhook.ts <https://your-app-host> [--apply]  (PayPal requires https)");
    process.exit(2);
  }
  if (process.env.PAYPAL_ENV === "live") {
    console.error("Refusing to run against PayPal LIVE. This script is for the Sandbox.");
    process.exit(2);
  }
  const url = `${base.replace(/\/$/, "")}/api/paypal/webhook`;

  const list = await paypalFetch<{ webhooks?: Hook[] }>("GET", "/v1/notifications/webhooks", undefined, { actor: "register_webhook" });
  const hooks = list.data.webhooks ?? [];
  console.log(`Existing webhooks (${hooks.length}):`);
  for (const h of hooks) console.log(`  ${h.id}  ${h.url.replace(/(https?:\/\/[^/]+).*/, "$1/…")}  events=${h.event_types?.length ?? 0}`);

  const existing = hooks.find((h) => h.url === url);
  if (existing) {
    console.log(`\nAlready registered: ${existing.id}  → set PAYPAL_WEBHOOK_ID=${existing.id}`);
  } else if (!apply) {
    console.log(`\nDRY RUN: would create a webhook for ${url} with ${EVENT_TYPES.length} event types. Re-run with --apply.`);
  } else {
    const created = await paypalFetch<Hook>("POST", "/v1/notifications/webhooks", { url, event_types: EVENT_TYPES.map((name) => ({ name })) }, { actor: "register_webhook", requestId: `landfall-webhook-${Buffer.from(url).toString("hex").slice(0, 40)}` });
    console.log(`\nCreated webhook ${created.data.id} for ${url}\n→ set PAYPAL_WEBHOOK_ID=${created.data.id} on the deployment (and in .env.local).`);
  }

  const stale = hooks.filter((h) => THROWAWAY.test(h.url));
  for (const h of stale) {
    if (!apply) console.log(`DRY RUN: would delete throw-away webhook ${h.id} (${new URL(h.url).host})`);
    else {
      await paypalFetch("DELETE", `/v1/notifications/webhooks/${h.id}`, undefined, { actor: "register_webhook" });
      console.log(`Deleted throw-away webhook ${h.id}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("FAILED:", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
