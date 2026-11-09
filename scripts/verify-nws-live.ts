import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { fetchLiveNWSAlerts, checkNWSHealth, verifyPointActiveAlerts } from "../lib/sentinel/nws";

async function runLiveNWSVerification() {
  console.log("=== NATIONAL WEATHER SERVICE (NWS) LIVE API VERIFICATION ===");

  // 1. Check API Health & Latency
  console.log("\n[1/3] Checking official NWS API health (/alerts/active/count)...");
  const health = await checkNWSHealth();
  console.log("Service:", health.service);
  console.log("Status:", health.status);
  console.log("Latency:", `${health.latencyMs}ms`);
  console.log("Timestamp:", health.lastSyncAt);

  // 2. Fetch live Florida alerts
  console.log("\n[2/3] Fetching live active alerts for area 'FL' (/alerts/active?area=FL)...");
  const liveRes = await fetchLiveNWSAlerts("FL", { timeoutMs: 10000, skipCache: true });
  console.log("Raw Features Received:", liveRes.rawFeatureCount);
  console.log("Normalized Alerts Count:", liveRes.alerts.length);
  console.log("ETag Received:", liveRes.etag || "None");

  if (liveRes.alerts.length > 0) {
    const sample = liveRes.alerts[0];
    console.log("\nSample Live Alert:");
    console.log("- Event:", sample.event);
    console.log("- Event Key:", sample.eventKey);
    console.log("- Status / MessageType:", `${sample.status} / ${sample.messageType}`);
    console.log("- Severity / Urgency:", `${sample.severity} / ${sample.urgency}`);
    console.log("- Tranche 1 Trigger Eligible:", sample.isTranche1Eligible ? "YES" : "NO");
    console.log("- Area:", sample.areaDesc.slice(0, 100) + "...");
  } else {
    console.log("No active alerts currently in Florida. (Normal during quiet weather)");
  }

  // 3. Test Point API
  console.log("\n[3/3] Querying NWS Point API for Tampa Bay (27.9506, -82.4572)...");
  const pointRes = await verifyPointActiveAlerts(27.9506, -82.4572);
  console.log("Has Active Warning:", pointRes.hasActiveWarning);
  console.log("Active Phenomena:", pointRes.activePhenomena);

  console.log("\n✅ NWS Live Integration Verification Completed Successfully.");
}

runLiveNWSVerification().catch((err) => {
  console.error("❌ NWS Live Verification Failed:", err);
  process.exit(1);
});
