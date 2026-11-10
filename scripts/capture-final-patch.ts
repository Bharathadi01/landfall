import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const PUBLIC_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");

// Ensure directories exist
fs.mkdirSync(DESKTOP_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// User instruction: "Delete the old screenshots and then just keep the new one you take"
console.log("Cleaning old screenshots from desktop directory...");
const desktopFiles = fs.readdirSync(DESKTOP_DIR);
for (const file of desktopFiles) {
  if (file.endsWith(".png")) {
    fs.unlinkSync(path.join(DESKTOP_DIR, file));
    console.log(`  Removed old screenshot: ${file}`);
  }
}

async function run() {
  console.log("==================================================================");
  console.log("   LANDFALL AG STUDIO PRIZE FINAL ACCEPTANCE SCREENSHOT CAPTURE");
  console.log("==================================================================");

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------------------
  // 1. AI-GENERATED REPORT POPULATED (Screenshot 31)
  // -------------------------------------------------------------------------
  console.log("\n[1/8] Capturing 31_ag_generated_report_populated.png...");
  const studioContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const studioPage = await studioContext.newPage();

  await studioPage.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await studioPage.evaluate(() => localStorage.clear());
  await studioPage.reload({ waitUntil: "networkidle" });
  await studioPage.waitForTimeout(2000);

  // Switch to Edit Mode (Build with AI)
  const buildTab = studioPage.locator("button:has-text('Build with AI'), [role='tab']:has-text('Build with AI')").first();
  await buildTab.click();
  await studioPage.waitForTimeout(2500);

  // Submit report prompt
  const textarea = studioPage.locator(".ag-studio-ai-assistant-textarea").first();
  await textarea.fill("Create a payout recovery report showing PayPal statuses, ageing buckets, unresolved value and the oldest exceptions.");
  await studioPage.waitForTimeout(300);
  const sendBtn = studioPage.locator(".ag-studio-ai-assistant-send-button").first();
  await sendBtn.click();

  // Wait for LLM completion
  await studioPage.waitForTimeout(3500);
  try {
    await studioPage.waitForSelector(".ag-studio-ai-status-bar-stop.ag-hidden", { timeout: 10000 });
  } catch {}
  await studioPage.waitForTimeout(1500);

  // Switch to the AI Generated Page tab
  const aiTab = studioPage.locator("button:has-text('AI Generated'), button:has-text('Payout Recovery Intelligence')").first();
  if (await aiTab.count() > 0) {
    await aiTab.click();
    await studioPage.waitForTimeout(2500);
  }

  const path31 = path.join(PUBLIC_DIR, "31_ag_generated_report_populated.png");
  await studioPage.screenshot({ path: path31, fullPage: true });
  fs.copyFileSync(path31, path.join(DESKTOP_DIR, "31_ag_generated_report_populated.png"));
  console.log("  📸 Saved 31_ag_generated_report_populated.png");

  // -------------------------------------------------------------------------
  // 2, 3, 4. WAR ROOM GRID: ERROR-FREE GROUPING, MASTER/DETAIL, AGGREGATIONS
  // -------------------------------------------------------------------------
  console.log("\n[2/8] Capturing 32_ag_error_free_grouping.png...");
  const warContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const warPage = await warContext.newPage();

  await warPage.goto("http://localhost:3000/console/war-room", { waitUntil: "networkidle" });
  await warPage.waitForTimeout(2000);

  // Click tab "Households · AG Grid"
  await warPage.locator("button[role='tab']:has-text('AG Grid')").first().click();
  await warPage.waitForTimeout(1500);

  // Default is Grouped View
  const path32 = path.join(PUBLIC_DIR, "32_ag_error_free_grouping.png");
  await warPage.screenshot({ path: path32, fullPage: true });
  fs.copyFileSync(path32, path.join(DESKTOP_DIR, "32_ag_error_free_grouping.png"));
  console.log("  📸 Saved 32_ag_error_free_grouping.png");

  // 3. Native Master/Detail for Arthur Pendelton
  console.log("\n[3/8] Capturing 33_ag_native_master_detail.png...");
  const toggleBtn = warPage.locator("[data-testid='toggle-grouping-btn']").first();
  await toggleBtn.click(); // switch to flat view
  await warPage.waitForTimeout(1500);

  // Select Arthur Pendelton row
  const arthurRow = warPage.locator(".ag-row:has-text('Arthur Pendelton')").first();
  if (await arthurRow.count() > 0) {
    await arthurRow.click();
    await warPage.waitForTimeout(1000);
  }

  const path33 = path.join(PUBLIC_DIR, "33_ag_native_master_detail.png");
  await warPage.screenshot({ path: path33, fullPage: true });
  fs.copyFileSync(path33, path.join(DESKTOP_DIR, "33_ag_native_master_detail.png"));
  console.log("  📸 Saved 33_ag_native_master_detail.png");

  // 4. Status Amount Aggregations (Expand All Groups)
  console.log("\n[4/8] Capturing 34_ag_status_amount_aggregations.png...");
  await toggleBtn.click(); // switch back to grouped view
  await warPage.waitForTimeout(1500);

  const expandAllBtn = warPage.locator("[data-testid='expand-all-btn']").first();
  if (await expandAllBtn.count() > 0) {
    await expandAllBtn.click();
    await warPage.waitForTimeout(1500);
  }

  const path34 = path.join(PUBLIC_DIR, "34_ag_status_amount_aggregations.png");
  await warPage.screenshot({ path: path34, fullPage: true });
  fs.copyFileSync(path34, path.join(DESKTOP_DIR, "34_ag_status_amount_aggregations.png"));
  console.log("  📸 Saved 34_ag_status_amount_aggregations.png");

  // -------------------------------------------------------------------------
  // 5, 6, 7. FULL CUSTOM WIDGET CONTAINERS
  // -------------------------------------------------------------------------
  console.log("\n[5/8] Capturing 35_ag_reserve_guardrail_full.png...");
  await studioPage.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await studioPage.waitForTimeout(2000);

  // 5. Reserve Guardrail (Treasury & Reserve)
  await studioPage.locator("button[role='tab']:has-text('Treasury & Reserve')").first().click();
  await studioPage.waitForTimeout(2500);

  const guardrailCard = studioPage.locator(".ag-studio-layout-widget:has([data-testid='reserve-guardrail-widget'])").first();
  const path35 = path.join(PUBLIC_DIR, "35_ag_reserve_guardrail_full.png");
  await guardrailCard.screenshot({ path: path35 });
  fs.copyFileSync(path35, path.join(DESKTOP_DIR, "35_ag_reserve_guardrail_full.png"));
  console.log("  📸 Saved 35_ag_reserve_guardrail_full.png");

  // 6. Payout Lifecycle (Payout Recovery)
  console.log("\n[6/8] Capturing 36_ag_payout_lifecycle_seven_stages.png...");
  await studioPage.locator("button[role='tab']:has-text('Payout Recovery')").first().click();
  await studioPage.waitForTimeout(2500);

  const lifecycleCard = studioPage.locator(".ag-studio-layout-widget:has([data-testid='payout-lifecycle-widget'])").first();
  const path36 = path.join(PUBLIC_DIR, "36_ag_payout_lifecycle_seven_stages.png");
  await lifecycleCard.screenshot({ path: path36 });
  fs.copyFileSync(path36, path.join(DESKTOP_DIR, "36_ag_payout_lifecycle_seven_stages.png"));
  console.log("  📸 Saved 36_ag_payout_lifecycle_seven_stages.png");

  // 7. Recovery Evidence Chain (Payout Recovery)
  console.log("\n[7/8] Capturing 37_ag_recovery_evidence_chain_full.png...");
  const evidenceCard = studioPage.locator(".ag-studio-layout-widget:has([data-testid='recovery-evidence-chain-widget'])").first();
  const path37 = path.join(PUBLIC_DIR, "37_ag_recovery_evidence_chain_full.png");
  await evidenceCard.screenshot({ path: path37 });
  fs.copyFileSync(path37, path.join(DESKTOP_DIR, "37_ag_recovery_evidence_chain_full.png"));
  console.log("  📸 Saved 37_ag_recovery_evidence_chain_full.png");

  // -------------------------------------------------------------------------
  // 8. MOBILE RESPONSIVENESS AT 390px (Screenshot 38)
  // -------------------------------------------------------------------------
  console.log("\n[8/8] Capturing 38_ag_mobile_chart_fit.png...");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(2500);

  const path38 = path.join(PUBLIC_DIR, "38_ag_mobile_chart_fit.png");
  await mobilePage.screenshot({ path: path38, fullPage: true });
  fs.copyFileSync(path38, path.join(DESKTOP_DIR, "38_ag_mobile_chart_fit.png"));
  console.log("  📸 Saved 38_ag_mobile_chart_fit.png");

  await browser.close();
  console.log("\n==================================================================");
  console.log("   ALL 8 SCREENSHOTS SUCCESSFULLY CAPTURED AND SYNCHRONIZED!");
  console.log("==================================================================");
}

run().catch((err) => {
  console.error("FATAL ERROR IN CAPTURE:", err);
  process.exit(1);
});

