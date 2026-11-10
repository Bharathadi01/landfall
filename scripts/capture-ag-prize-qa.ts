import { chromium, type Page } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");
const BASE_URL = "http://localhost:3000";

interface LoggedIssue {
  type: string;
  text: string;
}

const issues: LoggedIssue[] = [];

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = { fullPage: true }) {
  const filePath = path.join(TARGET_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: options.fullPage });
  console.log(`📸 Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
}

async function run() {
  console.log("=== LANDFALL AG STUDIO / AG GRID PRIZE VISUAL QA & REHEARSAL ===");
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  // 1. Desktop 1440x900 context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await desktopContext.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  const page = await desktopContext.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("404")) {
      issues.push({ type: "CONSOLE_ERROR", text: msg.text() });
    }
  });

  console.log("\n--> 1. Navigating to AG Studio (/console/studio)...");
  await page.goto(`${BASE_URL}/console/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // 01: Overview Desktop
  console.log("--> Capturing 01_ag_overview_desktop.png (Page A: Relief Overview)");
  await capture(page, "01_ag_overview_desktop.png");

  // 02: Cross-Filter Interaction
  console.log("--> Testing cross-filter interaction on Page A...");
  // Click on a chart segment or button in the overview canvas
  const chartEl = page.locator('.ag-charts-canvas, canvas, [role="button"]').first();
  if (await chartEl.count() > 0) {
    try {
      await chartEl.click({ force: true });
      await page.waitForTimeout(800);
    } catch {
      /* ignore */
    }
  }
  await capture(page, "02_ag_overview_table_crossfilter.png");

  // 03: Page B — Treasury & Reconciliation
  console.log("--> Navigating to Page B: Treasury & Reserve...");
  const treasuryTab = page.locator('button[role="tab"]:has-text("Treasury & Reserve")');
  if (await treasuryTab.count() > 0) {
    await treasuryTab.click();
    await page.waitForTimeout(1500);
  }
  await capture(page, "03_ag_treasury_reconciliation.png");

  // 06: Custom Widget 1 — Reserve Guardrail close-up
  console.log("--> Capturing 06_ag_custom_reserve_guardrail.png...");
  await capture(page, "06_ag_custom_reserve_guardrail.png");

  // 04: Page C — Payout Recovery Intelligence
  console.log("--> Navigating to Page C: Payout Recovery...");
  const recoveryTab = page.locator('button[role="tab"]:has-text("Payout Recovery")');
  if (await recoveryTab.count() > 0) {
    await recoveryTab.click();
    await page.waitForTimeout(1500);
  }
  await capture(page, "04_ag_payout_recovery_intelligence.png");

  // 07: Custom Widget 2 — Payout Lifecycle close-up
  console.log("--> Capturing 07_ag_payout_lifecycle.png...");
  await capture(page, "07_ag_payout_lifecycle.png");

  // 08: Custom Widget 3 — Recovery Evidence Chain close-up
  console.log("--> Capturing 08_ag_recovery_evidence_chain.png...");
  const chainBtn = page.locator('button:has-text("WebAuthn")');
  if (await chainBtn.count() > 0) {
    await chainBtn.click();
    await page.waitForTimeout(500);
  }
  await capture(page, "08_ag_recovery_evidence_chain.png");

  // 05: Page D — Beneficiary Accountability
  console.log("--> Navigating to Page D: Beneficiary Accountability...");
  const accountabilityTab = page.locator('button[role="tab"]:has-text("Beneficiary Accountability")');
  if (await accountabilityTab.count() > 0) {
    await accountabilityTab.click();
    await page.waitForTimeout(1500);
  }
  await capture(page, "05_ag_beneficiary_accountability.png");

  // 09: Studio Agent Framework Dashboard Creation / Prompt
  console.log("--> Capturing 09_ag_agent_dashboard_creation.png...");
  // Return to Overview
  await page.locator('button[role="tab"]:has-text("Relief Overview")').click();
  await page.waitForTimeout(1000);
  await capture(page, "09_ag_agent_dashboard_creation.png");

  // 10: Edit Mode & Layout Tools
  console.log("--> Switching to Edit Mode (Build with AI)...");
  const editModeBtn = page.locator('button[role="tab"]:has-text("Build with AI")');
  if (await editModeBtn.count() > 0) {
    await editModeBtn.click();
    await page.waitForTimeout(1500);
  }
  await capture(page, "10_ag_edit_mode_layout_tools.png");

  // 11: Report State Persistence (Saved & Restored)
  console.log("--> Testing state persistence across refresh...");
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await capture(page, "11_ag_report_saved_restored.png");

  // 13: Accessibility & Keyboard Navigation (Tab focus)
  console.log("--> Testing accessibility keyboard navigation...");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  await capture(page, "13_ag_accessibility_keyboard.png");

  await page.close();

  // 12: Mobile Responsive Viewport (390x844 iPhone 14)
  console.log("\n--> 12. Testing mobile responsive layout (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/console/studio`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(2000);
  await capture(mobilePage, "12_ag_mobile_responsive.png");
  await mobilePage.close();

  // Also capture War Room with embedded Studio tab
  console.log("\n--> Auditing War Room Studio Tab...");
  const warRoomPage = await desktopContext.newPage();
  await warRoomPage.goto(`${BASE_URL}/console/war-room`, { waitUntil: "networkidle" });
  await warRoomPage.waitForTimeout(1500);
  const studioTabWarRoom = warRoomPage.locator('button[role="tab"]:has-text("Relief Studio")');
  if (await studioTabWarRoom.count() > 0) {
    await studioTabWarRoom.click();
    await warRoomPage.waitForTimeout(1500);
    await capture(warRoomPage, "warroom_embedded_studio.png");
  }
  await warRoomPage.close();

  await browser.close();

  console.log("\n=== VISUAL QA CAPTURE COMPLETE ===");
  console.log("Logged Console Errors (excluding 404):", issues.length);
  if (issues.length > 0) {
    console.log(issues);
  }
}

run().catch((err) => {
  console.error("QA automation failed:", err);
  process.exit(1);
});
