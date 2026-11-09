import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { paypalFetch } from "../lib/paypal/client";

async function runPayerIdSpike() {
  console.log("=== PAYPAL PAYER_ID -> PAYPAL_ID COMPATIBILITY SPIKE ===");

  // Step 1: Inspect environment
  const clientId = process.env.PAYPAL_CLIENT_ID;
  console.log("Client ID configured:", clientId ? `${clientId.slice(0, 8)}...` : "NONE");

  // Step 2: Test sending a small test payout with recipient_type: 'PAYPAL_ID'
  // Using personal sandbox account payer ID or known sandbox test ID
  const testBatchId = `spike_payer_id_${Date.now()}`;
  const testItemId = `item_payer_id_${Date.now()}`;

  console.log(`\nAttempting Payouts with recipient_type: 'PAYPAL_ID' (Batch: ${testBatchId})...`);

  // We test with a sample sandbox payer ID format (13 alphanumeric chars)
  // E.g. account RMYYMT3FXD8LJ (our sandbox merchant payer ID) or another sandbox payer ID
  const testPayerId = "RMYYMT3FXD8LJ";

  try {
    const payoutRes = await paypalFetch<any>(
      "POST",
      "/v1/payments/payouts",
      {
        sender_batch_header: {
          sender_batch_id: testBatchId,
          email_subject: "Landfall Payer ID Compatibility Spike",
          recipient_type: "PAYPAL_ID",
        },
        items: [
          {
            recipient_type: "PAYPAL_ID",
            amount: {
              value: "1.00",
              currency: "USD",
            },
            receiver: testPayerId,
            note: "Testing PAYPAL_ID recipient compatibility",
            sender_item_id: testItemId,
          },
        ],
      },
      { actor: "m4_spike" }
    );

    console.log("✅ Payouts POST succeeded!");
    console.log("Batch ID:", payoutRes.data?.batch_header?.payout_batch_id);
    console.log("Batch Status:", payoutRes.data?.batch_header?.batch_status);
    console.log("Debug ID:", payoutRes.debugId);

    // Step 3: Check item status
    const batchId = payoutRes.data?.batch_header?.payout_batch_id;
    if (batchId) {
      console.log(`\nFetching batch details for ${batchId}...`);
      await new Promise((r) => setTimeout(r, 2000));
      const detailsRes = await paypalFetch<any>(
        "GET",
        `/v1/payments/payouts/${batchId}`,
        undefined,
        { actor: "m4_spike" }
      );
      console.log("Batch Details:", JSON.stringify(detailsRes.data, null, 2));
    }
  } catch (err: any) {
    console.log("❌ Payouts with PAYPAL_ID failed:");
    console.log("Message:", err.message);
    console.log("Status:", err.status);
    console.log("Debug ID:", err.debugId);
    console.log("Details:", JSON.stringify(err.details || {}, null, 2));
  }
}

runPayerIdSpike().catch(console.error);
