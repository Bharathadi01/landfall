import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const PUBLIC_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");

async function main() {
  console.log("=== CAPTURING PHASE 3: AG GRID GROUPING & MASTER/DETAIL ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto("http://localhost:3000/console/war-room", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Switch to "Households · AG Grid" tab
  console.log("1. Switching to Households · AG Grid tab...");
  await page.getByRole("tab", { name: /Households · AG Grid/i }).click();
  await page.waitForTimeout(2000);

  // 2. Verify grouping is active
  const toggleBtn = page.locator("[data-testid='toggle-grouping-btn']");
  const toggleText = await toggleBtn.innerText();
  console.log("Toggle button text:", toggleText);

  // If not grouped, click it
  if (toggleText.includes("Group by PayPal Status")) {
    console.log("Clicking Group by PayPal Status...");
    await toggleBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Expand All to show all rows in groups
  const expandBtn = page.locator("[data-testid='expand-all-btn']");
  if (await expandBtn.count() > 0) {
    console.log("Clicking Expand All...");
    await expandBtn.click();
    await page.waitForTimeout(1500);
  }

  // Capture Grouping & Aggregation
  const path24 = path.join(PUBLIC_DIR, "24_ag_grouping_amount_aggregation_fixed.png");
  await page.screenshot({ path: path24, fullPage: true });
  fs.copyFileSync(path24, path.join(DESKTOP_DIR, "24_ag_grouping_amount_aggregation_fixed.png"));
  console.log("📸 Saved 24_ag_grouping_amount_aggregation_fixed.png");

  // 3. Verify Master/Detail panel
  const drawer = page.locator("[data-testid='grid-master-detail-panel']");
  const isDrawerVisible = await drawer.isVisible();
  console.log("Master/Detail panel visible initially:", isDrawerVisible);

  if (!isDrawerVisible) {
    console.log("Clicking Arthur Pendelton row...");
    const row = page.locator(".ag-row:has-text('Arthur Pendelton')").first();
    await row.click();
    await page.waitForTimeout(1000);
  }

  const drawerText = await drawer.innerText();
  console.log("=== MASTER/DETAIL TEXT ===");
  console.log(drawerText);
  console.log("Contains Arthur Pendelton:", drawerText.includes("Arthur Pendelton"));
  console.log("Contains NOT LINKED:", drawerText.includes("NOT LINKED — PENDING RECIPIENT CLAIM"));
  console.log("Contains Awaiting Recipient:", drawerText.includes("Awaiting Recipient Wallet Confirmation"));
  console.log("Does NOT have false proof_milton_001:", !drawerText.includes("proof_milton_001"));

  // Capture True Master/Detail Evidence
  const path25 = path.join(PUBLIC_DIR, "25_ag_true_master_detail_evidence.png");
  await page.screenshot({ path: path25, fullPage: true });
  fs.copyFileSync(path25, path.join(DESKTOP_DIR, "25_ag_true_master_detail_evidence.png"));
  console.log("📸 Saved 25_ag_true_master_detail_evidence.png");

  await browser.close();
  console.log("=== PHASE 3 COMPLETED SUCCESSFULLY ===");
}

main().catch(console.error);
