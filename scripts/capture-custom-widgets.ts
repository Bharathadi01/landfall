import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const PUBLIC_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");

async function main() {
  console.log("=== CAPTURING PHASE 4: COMPLETE CUSTOM WIDGETS ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 1. Navigate to Treasury & Reserve (Page B) for Reserve Guardrail
  console.log("1. Switching to Treasury & Reserve (Page B)...");
  const treasuryTab = page.locator("button:has-text('Treasury & Reserve')").first();
  await treasuryTab.click();
  await page.waitForTimeout(2000);

  const guardrailWidget = page.locator("[data-testid='reserve-guardrail-widget']").first();
  const guardrailParent = guardrailWidget.locator("xpath=../.."); // Get parent widget container
  const guardrailTarget = (await guardrailParent.count() > 0) ? guardrailParent : guardrailWidget;

  const path26 = path.join(PUBLIC_DIR, "26_ag_reserve_guardrail_complete.png");
  await guardrailTarget.screenshot({ path: path26 });
  fs.copyFileSync(path26, path.join(DESKTOP_DIR, "26_ag_reserve_guardrail_complete.png"));
  console.log("📸 Saved 26_ag_reserve_guardrail_complete.png");

  // 2. Navigate to Payout Recovery (Page C) for Payout Lifecycle & Recovery Evidence Chain
  console.log("2. Switching to Payout Recovery (Page C)...");
  const recoveryTab = page.locator("button:has-text('Payout Recovery')").first();
  await recoveryTab.click();
  await page.waitForTimeout(2000);

  // Payout Lifecycle Widget
  const lifecycleWidget = page.locator("[data-testid='payout-lifecycle-widget']").first();
  const lifecycleParent = lifecycleWidget.locator("xpath=../..");
  const lifecycleTarget = (await lifecycleParent.count() > 0) ? lifecycleParent : lifecycleWidget;

  const path27 = path.join(PUBLIC_DIR, "27_ag_payout_lifecycle_complete.png");
  await lifecycleTarget.screenshot({ path: path27 });
  fs.copyFileSync(path27, path.join(DESKTOP_DIR, "27_ag_payout_lifecycle_complete.png"));
  console.log("📸 Saved 27_ag_payout_lifecycle_complete.png");

  // Recovery Evidence Chain Widget
  const evidenceWidget = page.locator("[data-testid='recovery-evidence-chain-widget']").first();
  const evidenceParent = evidenceWidget.locator("xpath=../..");
  const evidenceTarget = (await evidenceParent.count() > 0) ? evidenceParent : evidenceWidget;

  const path28 = path.join(PUBLIC_DIR, "28_ag_recovery_evidence_chain_complete.png");
  await evidenceTarget.screenshot({ path: path28 });
  fs.copyFileSync(path28, path.join(DESKTOP_DIR, "28_ag_recovery_evidence_chain_complete.png"));
  console.log("📸 Saved 28_ag_recovery_evidence_chain_complete.png");

  await browser.close();
  console.log("=== PHASE 4 COMPLETED SUCCESSFULLY ===");
}

main().catch(console.error);

