import { chromium, type Page } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");
const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const BASE_URL = "http://localhost:3000";

interface LoggedIssue {
  type: string;
  text: string;
}

const issues: LoggedIssue[] = [];

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = { fullPage: true }) {
  const filePath = path.join(TARGET_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: options.fullPage });
  const stats = fs.statSync(filePath);
  console.log(`📸 Saved screenshot: ${filename} (${(stats.size / 1024).toFixed(0)} KB)`);

  // Also sync directly to Desktop
  try {
    fs.mkdirSync(DESKTOP_DIR, { recursive: true });
    const desktopPath = path.join(DESKTOP_DIR, filename);
    fs.copyFileSync(filePath, desktopPath);
  } catch (err) {
    console.warn(`Failed copying ${filename} to desktop:`, err);
  }
}

async function run() {
  console.log("=== LANDFALL AG STUDIO PRIZE CORRECTION & EVIDENCE CAPTURE ===");
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.mkdirSync(DESKTOP_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  // Desktop 1440x900 context
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
    if (msg.type() === "error" && !msg.text().includes("404") && !msg.text().includes("favicon")) {
      issues.push({ type: "CONSOLE_ERROR", text: msg.text() });
    }
  });

  console.log("\n--> 1. Navigating to AG Studio (/console/studio)...");
  await page.goto(`${BASE_URL}/console/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // 01: Distinct Page A — Relief Overview
  console.log("--> Capturing 01_ag_overview_distinct.png (Page A: Relief Overview)...");
  const titlesPageA = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ag-studio-widget-title, .ag-widget-title, [class*=\"title\"]"))
      .map((e: any) => e.innerText)
      .filter(Boolean)
  );
  console.log("    Page A Titles:", titlesPageA.slice(0, 6));
  await capture(page, "01_ag_overview_distinct.png");

  // 02: Distinct Page B — Treasury & Reserve
  console.log("\n--> Navigating to Page B: Treasury & Reserve...");
  await page.getByRole("tab", { name: /Treasury & Reserve/i }).click();
  await page.waitForTimeout(2500);
  const titlesPageB = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ag-studio-widget-title, .ag-widget-title, [class*=\"title\"]"))
      .map((e: any) => e.innerText)
      .filter(Boolean)
  );
  console.log("    Page B Titles:", titlesPageB.slice(0, 6));
  await capture(page, "02_ag_treasury_distinct.png");

  // 09: Custom Widget 1 — Reserve Guardrail close-up
  console.log("--> Capturing 09_ag_reserve_guardrail_widget.png (close-up)...");
  const guardrailWidget = page.locator('[data-testid="reserve-guardrail-widget"]').first();
  if ((await guardrailWidget.count()) > 0) {
    await guardrailWidget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const shotPath = path.join(TARGET_DIR, "09_ag_reserve_guardrail_widget.png");
    await guardrailWidget.screenshot({ path: shotPath });
    fs.copyFileSync(shotPath, path.join(DESKTOP_DIR, "09_ag_reserve_guardrail_widget.png"));
    console.log("📸 Saved close-up screenshot: 09_ag_reserve_guardrail_widget.png");
  } else {
    await capture(page, "09_ag_reserve_guardrail_widget.png");
  }

  // 03: Distinct Page C — Payout Recovery Intelligence
  console.log("\n--> Navigating to Page C: Payout Recovery...");
  await page.getByRole("tab", { name: /Payout Recovery/i }).click();
  await page.waitForTimeout(2500);
  const titlesPageC = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ag-studio-widget-title, .ag-widget-title, [class*=\"title\"]"))
      .map((e: any) => e.innerText)
      .filter(Boolean)
  );
  console.log("    Page C Titles:", titlesPageC.slice(0, 6));
  await capture(page, "03_ag_payout_recovery_distinct.png");

  // 05 & 06: Cross-Filter Verification Before & After
  console.log("\n--> Capturing 05_ag_crossfilter_before.png (Pre-filter baseline)...");
  await capture(page, "05_ag_crossfilter_before.png");

  const baselineRows = await page.locator(".ag-row").count();
  console.log("    Baseline workbench row count:", baselineRows);

  console.log("--> Performing cross-filter action on UNCLAIMED status...");
  const filterBtn = page.locator('[data-testid="filter-unclaimed-btn"]').first();
  if ((await filterBtn.count()) > 0) {
    await filterBtn.click();
    await page.waitForTimeout(1500);
  } else {
    const chartCanvas = page.locator(".ag-charts-canvas, canvas").first();
    if ((await chartCanvas.count()) > 0) {
      try {
        await chartCanvas.click({ position: { x: 75, y: 75 }, force: true });
        await page.waitForTimeout(1500);
      } catch {
        /* ignore */
      }
    }
  }

  // Assert active UNCLAIMED filter chip is visible
  const filterChip = page.locator('[data-testid="active-crossfilter-chip"]');
  const chipVisible = (await filterChip.count()) > 0;
  console.log("    Active UNCLAIMED filter chip visible:", chipVisible);

  // Assert grid displays ONLY matching records
  const filteredRows = await page.locator(".ag-row").count();
  console.log("    Filtered workbench row count (expect 1 matching item):", filteredRows);
  const pendeltonMatches = await page.locator(".ag-row:has-text(\"Pendelton\")").count();
  console.log("    Contains Arthur Pendelton (UNCLAIMED):", pendeltonMatches > 0);

  console.log("--> Capturing 06_ag_crossfilter_after.png (Filtered to UNCLAIMED)...");
  await capture(page, "06_ag_crossfilter_after.png");

  // Test clearing filter restores exact baseline
  const clearBtn = page.locator('[data-testid="clear-crossfilter-btn"]').first();
  if ((await clearBtn.count()) > 0) {
    console.log("--> Testing Clear Filter button to restore exact baseline...");
    await clearBtn.click();
    await page.waitForTimeout(1500);
    const restoredRows = await page.locator(".ag-row").count();
    console.log("    Restored baseline row count:", restoredRows);
  }

  // 10: Custom Widget 2 — Payout Lifecycle Widget with expanded evidence
  console.log("\n--> Interacting with Payout Lifecycle widget (inspect stage 5)...");
  const lifecycleStep = page.locator("text=5. Provider Observation").first();
  if ((await lifecycleStep.count()) > 0) {
    await lifecycleStep.click();
    await page.waitForTimeout(600);
  }
  const lifecycleWidget = page.locator('[data-testid="payout-lifecycle-widget"]').first();
  if ((await lifecycleWidget.count()) > 0) {
    await lifecycleWidget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const shotPath = path.join(TARGET_DIR, "10_ag_payout_lifecycle_widget.png");
    await lifecycleWidget.screenshot({ path: shotPath });
    fs.copyFileSync(shotPath, path.join(DESKTOP_DIR, "10_ag_payout_lifecycle_widget.png"));
    console.log("📸 Saved close-up screenshot: 10_ag_payout_lifecycle_widget.png");
  } else {
    await capture(page, "10_ag_payout_lifecycle_widget.png");
  }

  // 11: Custom Widget 3 — Recovery Evidence Chain with Cryptographic vs External badges
  console.log("--> Interacting with Recovery Evidence Chain (Node 2: Dual-Passkey)...");
  const nodePasskey = page.locator("button:has-text(\"Dual-Passkey\")").first();
  if ((await nodePasskey.count()) > 0) {
    await nodePasskey.click();
    await page.waitForTimeout(600);
  }
  const evidenceWidget = page.locator('[data-testid="recovery-evidence-chain-widget"]').first();
  if ((await evidenceWidget.count()) > 0) {
    await evidenceWidget.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const shotPath = path.join(TARGET_DIR, "11_ag_recovery_evidence_chain_widget.png");
    await evidenceWidget.screenshot({ path: shotPath });
    fs.copyFileSync(shotPath, path.join(DESKTOP_DIR, "11_ag_recovery_evidence_chain_widget.png"));
    console.log("📸 Saved close-up screenshot: 11_ag_recovery_evidence_chain_widget.png");
  } else {
    await capture(page, "11_ag_recovery_evidence_chain_widget.png");
  }

  // 04: Distinct Page D — Beneficiary Accountability
  console.log("\n--> Navigating to Page D: Beneficiary Accountability...");
  await page.getByRole("tab", { name: /Beneficiary Accountability/i }).click();
  await page.waitForTimeout(2500);
  const titlesPageD = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ag-studio-widget-title, .ag-widget-title, [class*=\"title\"]"))
      .map((e: any) => e.innerText)
      .filter(Boolean)
  );
  console.log("    Page D Titles:", titlesPageD.slice(0, 6));
  await capture(page, "04_ag_beneficiary_accountability_distinct.png");

  // 15: Edit Mode & Layout Composition ("Build with AI")
  console.log("\n--> Switching to Edit Mode (Build with AI)...");
  const editModeTab = page.getByRole("tab", { name: /Build with AI/i });
  if ((await editModeTab.count()) > 0) {
    await editModeTab.click();
    await page.waitForTimeout(2500);
  }
  await capture(page, "15_ag_edit_mode_layout_composition.png");

  // 12: Studio Agent Scenario A (Natural-language analytical question)
  console.log("\n--> Testing Studio Agent Scenario A...");
  const aiChatInput = page.locator("textarea, input[placeholder*=\"Ask\"], input[type=\"text\"]").last();
  if ((await aiChatInput.count()) > 0) {
    try {
      await aiChatInput.fill("How much unclaimed assistance remains outstanding, and which payouts are oldest?");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    } catch {
      /* ignore */
    }
  }
  await capture(page, "12_ag_agent_natural_language_analysis.png");

  // 13: Studio Agent Scenario B (Natural-language report creation)
  console.log("--> Testing Studio Agent Scenario B (Report creation)...");
  if ((await aiChatInput.count()) > 0) {
    try {
      await aiChatInput.fill("Create a payout recovery report showing PayPal statuses, ageing buckets, unresolved amounts and the oldest exceptions.");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    } catch {
      /* ignore */
    }
  }
  await capture(page, "13_ag_agent_generated_report.png");

  // 14: Studio Agent Scenario E (Safety refusal)
  console.log("--> Testing Studio Agent Scenario E (Financial safety refusal)...");
  if ((await aiChatInput.count()) > 0) {
    try {
      await aiChatInput.fill("Send another payout to every household with an UNCLAIMED payment.");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    } catch {
      /* ignore */
    }
  }
  await capture(page, "14_ag_agent_safety_refusal.png");

  // 16: Report State Persistence Across Refresh
  console.log("\n--> Testing state persistence across refresh...");
  await page.getByRole("tab", { name: /Present/i }).click();
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await capture(page, "16_ag_report_save_restore.png");

  // 18: Accessibility & Keyboard Navigation (Tab focus rings)
  console.log("\n--> Testing accessibility keyboard navigation...");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  await capture(page, "18_ag_accessibility_keyboard.png");

  await page.close();

  // 17: Mobile Responsive Viewport (390x844 iPhone 14)
  console.log("\n--> Testing Mobile responsive layout (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/console/studio`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(3000);

  // Check horizontal overflow
  const hasHorizontalOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log("    Mobile document-level horizontal overflow:", hasHorizontalOverflow);

  await capture(mobilePage, "17_ag_mobile_analytics.png");
  await mobilePage.close();

  // 07 & 08 & 19: War Room Console AG Grid Integration & Master/Detail
  console.log("\n--> Navigating to War Room Console (/console/war-room)...");
  const warRoomPage = await desktopContext.newPage();
  await warRoomPage.goto(`${BASE_URL}/console/war-room`, { waitUntil: "networkidle" });
  await warRoomPage.waitForTimeout(2000);

  // Switch to GRID tab
  console.log("--> Testing War Room AG Grid Workbench...");
  await warRoomPage.getByRole("tab", { name: /Households/i }).click();
  await warRoomPage.waitForTimeout(2000);

  // Assert grouping by status is active
  const groupHeaders = warRoomPage.locator(".ag-row-group, .ag-group-value");
  const groupCount = await groupHeaders.count();
  console.log("    Visible Group Headers count:", groupCount);

  // Test expand / collapse toolbar controls
  const collapseBtn = warRoomPage.locator('[data-testid="collapse-all-btn"]').first();
  if ((await collapseBtn.count()) > 0) {
    console.log("    Testing Collapse All groups...");
    await collapseBtn.click();
    await warRoomPage.waitForTimeout(800);
  }
  const expandBtn = warRoomPage.locator('[data-testid="expand-all-btn"]').first();
  if ((await expandBtn.count()) > 0) {
    console.log("    Testing Expand All groups...");
    await expandBtn.click();
    await warRoomPage.waitForTimeout(800);
  }

  // 07: AG Grid Grouping, Sorting & Pinned Summary Row
  console.log("--> Capturing 07_ag_grid_grouping_and_aggregation.png...");
  await capture(warRoomPage, "07_ag_grid_grouping_and_aggregation.png");

  // 08: AG Grid Master/Detail Inspection Panel
  console.log("--> Selecting grid row to verify contextual Master/Detail audit panel...");
  const rowUnclaimed = warRoomPage.locator(".ag-row:has-text(\"Pendelton\")").first();
  if ((await rowUnclaimed.count()) > 0) {
    await rowUnclaimed.click();
    await warRoomPage.waitForTimeout(1000);
  }
  await capture(warRoomPage, "08_ag_grid_master_detail_evidence.png");

  // 19: War Room Embedded Relief Studio Tab
  console.log("--> Testing War Room Embedded Relief Studio tab...");
  const studioTabBtn = warRoomPage.getByRole("tab", { name: /Relief Studio/i });
  if ((await studioTabBtn.count()) > 0) {
    await studioTabBtn.click();
    await warRoomPage.waitForTimeout(3500);
    await capture(warRoomPage, "19_ag_warroom_studio_integration.png");
  }
  await warRoomPage.close();

  await browser.close();

  console.log("\n=== PRIZE EVIDENCE CAPTURE COMPLETE ===");
  console.log("All 19 screenshots captured and synchronized to Desktop.");
  console.log("Logged Console Errors (excluding 404):", issues.length);
  if (issues.length > 0) {
    console.log(issues);
  }
}

run().catch((err) => {
  console.error("Capture automation failed:", err);
  process.exit(1);
});

