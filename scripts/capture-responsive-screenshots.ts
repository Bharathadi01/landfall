import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const PUBLIC_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");

async function main() {
  console.log("=== CAPTURING PHASE 5: RESPONSIVE VIEWPORTS ===");
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile 390px (iPhone 14)
  console.log("1. Capturing 390px mobile viewport...");
  const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pageMobile.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await pageMobile.waitForTimeout(2000);

  const path29 = path.join(PUBLIC_DIR, "29_ag_mobile_studio_fixed.png");
  await pageMobile.screenshot({ path: path29, fullPage: true });
  fs.copyFileSync(path29, path.join(DESKTOP_DIR, "29_ag_mobile_studio_fixed.png"));
  console.log("📸 Saved 29_ag_mobile_studio_fixed.png");
  await pageMobile.close();

  // 2. Tablet 768px (iPad)
  console.log("2. Capturing 768px tablet viewport...");
  const pageTablet = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await pageTablet.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await pageTablet.waitForTimeout(2000);

  const path30 = path.join(PUBLIC_DIR, "30_ag_tablet_studio_fixed.png");
  await pageTablet.screenshot({ path: path30, fullPage: true });
  fs.copyFileSync(path30, path.join(DESKTOP_DIR, "30_ag_tablet_studio_fixed.png"));
  console.log("📸 Saved 30_ag_tablet_studio_fixed.png");
  await pageTablet.close();

  await browser.close();
  console.log("=== PHASE 5 COMPLETED SUCCESSFULLY ===");
}

main().catch(console.error);

