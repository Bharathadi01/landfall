import { chromium, type Page } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR =
  process.env.OUTPUT_DIR || "/Users/bharathadithya/Desktop/landfall_screenshots_reconciled_20261110_001000";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface LoggedIssue {
  route: string;
  type: "CONSOLE_ERROR" | "PAGE_ERROR" | "REQUEST_FAILED" | "VISUAL_WARNING";
  message: string;
  detail?: any;
}

const issues: LoggedIssue[] = [];

function setupPageMonitoring(page: Page, routeName: string) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter out known harmless third-party browser aborts
      if (!text.includes("favicon") && !text.includes("404 (Not Found)")) {
        issues.push({
          route: routeName,
          type: "CONSOLE_ERROR",
          message: text,
        });
      }
    }
  });

  page.on("pageerror", (err) => {
    issues.push({
      route: routeName,
      type: "PAGE_ERROR",
      message: err.message,
      detail: err.stack,
    });
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    // Exclude deliberate client page-close aborts
    if (!url.includes("favicon.ico") && !req.failure()?.errorText.includes("ERR_ABORTED")) {
      issues.push({
        route: routeName,
        type: "REQUEST_FAILED",
        message: `Failed request: ${req.method()} ${url} (${req.failure()?.errorText || "unknown error"})`,
      });
    }
  });
}

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = { fullPage: true }) {
  const filePath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: options.fullPage });
  console.log(`📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log(`Starting comprehensive Playwright visual audit...`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Output Directory: ${OUTPUT_DIR}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    deviceScaleFactor: 2,
    isMobile: true,
  });

  // --- 1. Public Landing Page ---
  console.log("--> Auditing: Landing Page (/)");
  const p1 = await desktopContext.newPage();
  setupPageMonitoring(p1, "/");
  await p1.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await capture(p1, "01_landing_page_desktop.png");
  await p1.close();

  const p1m = await mobileContext.newPage();
  setupPageMonitoring(p1m, "/ (mobile)");
  await p1m.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await capture(p1m, "01_landing_page_mobile.png");
  await p1m.close();

  // --- 2. Console War Room ---
  console.log("--> Auditing: Console War Room (/console/war-room)");
  const p2 = await desktopContext.newPage();
  setupPageMonitoring(p2, "/console/war-room");
  await p2.goto(`${BASE_URL}/console/war-room`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(3500);
  await capture(p2, "02_war_room_tab1_ag_studio_canvas.png");

  // Tab 2: Tactical HUD
  console.log("--> Testing War Room: Tactical HUD Tab");
  const tacticalHudBtn = p2.locator("button:has-text('Tactical HUD')");
  if (await tacticalHudBtn.isVisible()) {
    await tacticalHudBtn.click();
    await p2.waitForTimeout(1500); // Allow AG Charts & AG Grid to render
    await capture(p2, "02_war_room_tab2_tactical_hud.png");

    // Test Passkey Modal
    console.log("--> Opening Passkey Approval Modal...");
    const passkeyBtn = p2.locator("button:has-text('Test Live WebAuthn Passkeys')");
    if (await passkeyBtn.isVisible()) {
      await passkeyBtn.click();
      await p2.waitForTimeout(800);
      await capture(p2, "02_war_room_passkey_modal.png");
      const closeBtn = p2.locator("button:has-text('Close'), button:has-text('Cancel')").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await p2.waitForTimeout(500);
      }
    }
  }

  // Tab 3: Modular Widgets & Perspectives (12 Widgets)
  console.log("--> Testing War Room: Modular Widgets & Perspectives");
  const widgetsTabBtn = p2.locator("button:has-text('Widgets & Roles'), button:has-text('Widgets')").first();
  if (await widgetsTabBtn.isVisible()) {
    await widgetsTabBtn.click();
    await p2.waitForTimeout(1500);
    await capture(p2, "02_war_room_tab3_modular_widgets_all12.png");

    // Operations Perspective
    const opsBtn = p2.locator("button:has-text('Operations Lead')");
    if (await opsBtn.isVisible()) {
      await opsBtn.click();
      await p2.waitForTimeout(500);
      await capture(p2, "02_war_room_perspective_operations.png");
    }

    // Finance Perspective
    const finBtn = p2.locator("button:has-text('Finance Officer')");
    if (await finBtn.isVisible()) {
      await finBtn.click();
      await p2.waitForTimeout(500);
      await capture(p2, "02_war_room_perspective_finance.png");
    }

    // Auditor Perspective
    const auditBtn = p2.locator("button:has-text('Audit & Compliance')");
    if (await auditBtn.isVisible()) {
      await auditBtn.click();
      await p2.waitForTimeout(500);
      await capture(p2, "02_war_room_perspective_auditor.png");
    }

    // Reset to All (12 Widgets)
    const allBtn = p2.locator("button:has-text('All (12 Widgets)'), button:has-text('All')").first();
    if (await allBtn.isVisible()) {
      await allBtn.click();
      await p2.waitForTimeout(500);
    }

    // Test Inspecting Exception Case in Recipient Rescue Queue
    console.log("--> Inspecting Exception in Recipient Rescue Queue...");
    const inspectBtn = p2.locator("button:has-text('Inspect Case')").first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await p2.waitForTimeout(1500);
      await capture(p2, "02_war_room_ai_investigator_case_drawer.png");
    }
  }
  await p2.close();

  // --- 3. M7 Golden Flow ---
  console.log("--> Auditing: Golden Flow (/console/golden-flow)");
  const p3 = await desktopContext.newPage();
  setupPageMonitoring(p3, "/console/golden-flow");
  await p3.goto(`${BASE_URL}/console/golden-flow`, { waitUntil: "networkidle" });
  await capture(p3, "03_golden_flow_stage1_initial.png");

  // Click Run Full 8-Stage Flow
  const runFlowBtn = p3.locator("button:has-text('Run Full 8-Stage Flow')");
  if (await runFlowBtn.isVisible()) {
    console.log("--> Executing Golden Workflow from UI...");
    await runFlowBtn.click();
    await p3.waitForTimeout(4000); // Wait for pipeline execution
    await capture(p3, "03_golden_flow_all8_completed.png");
  }
  await p3.close();

  // --- 4. Sentinel Weather Intelligence ---
  console.log("--> Auditing: Sentinel Monitor (/console/sentinel)");
  const p4 = await desktopContext.newPage();
  setupPageMonitoring(p4, "/console/sentinel");
  await p4.goto(`${BASE_URL}/console/sentinel`, { waitUntil: "networkidle" });
  await p4.waitForTimeout(2000);
  await capture(p4, "04_sentinel_monitor.png");
  await p4.close();

  // --- 5. Rehearsal Lab ---
  console.log("--> Auditing: Rehearsal Lab (/console/rehearsal)");
  const p5 = await desktopContext.newPage();
  setupPageMonitoring(p5, "/console/rehearsal");
  await p5.goto(`${BASE_URL}/console/rehearsal`, { waitUntil: "networkidle" });
  await p5.waitForTimeout(1500);
  await capture(p5, "05_rehearsal_lab.png");
  await p5.close();

  // --- 6. Recipients Directory ---
  console.log("--> Auditing: Recipients Directory (/console/recipients)");
  const p6 = await desktopContext.newPage();
  setupPageMonitoring(p6, "/console/recipients");
  await p6.goto(`${BASE_URL}/console/recipients`, { waitUntil: "networkidle" });
  await p6.waitForTimeout(1500);
  await capture(p6, "06_recipients_directory.png");
  await p6.close();

  // --- 7. Watch Officer Standalone ---
  console.log("--> Auditing: Watch Officer Standalone (/console/watch-officer)");
  const p7 = await desktopContext.newPage();
  setupPageMonitoring(p7, "/console/watch-officer");
  await p7.goto(`${BASE_URL}/console/watch-officer`, { waitUntil: "networkidle" });
  await p7.waitForTimeout(1500);
  await capture(p7, "07_watch_officer_standalone.png");
  await p7.close();

  // --- 8. Resident Intake (5 Languages) ---
  console.log("--> Auditing: Resident Intake (/r/enroll) across 5 languages");
  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "ht", name: "HaitianCreole" },
    { code: "vi", name: "Vietnamese" },
    { code: "zh", name: "Chinese" },
  ];

  for (const lang of languages) {
    const pLang = await desktopContext.newPage();
    setupPageMonitoring(pLang, `/r/enroll?lang=${lang.code}`);
    await pLang.goto(`${BASE_URL}/r/enroll?lang=${lang.code}`, { waitUntil: "networkidle" });
    await capture(pLang, `08_resident_enroll_${lang.code}_${lang.name}.png`);
    await pLang.close();
  }

  // Mobile Resident Intake
  const pEnrollMob = await mobileContext.newPage();
  setupPageMonitoring(pEnrollMob, "/r/enroll (mobile)");
  await pEnrollMob.goto(`${BASE_URL}/r/enroll?lang=es`, { waitUntil: "networkidle" });
  await capture(pEnrollMob, "08_resident_enroll_mobile_es.png");
  await pEnrollMob.close();

  // --- 9. Resident Complaints Portal ---
  console.log("--> Auditing: Resident Grievances & Appeals (/r/complaints)");
  const p9 = await desktopContext.newPage();
  setupPageMonitoring(p9, "/r/complaints");
  await p9.goto(`${BASE_URL}/r/complaints`, { waitUntil: "networkidle" });
  await capture(p9, "09_resident_complaints_portal.png");
  await p9.close();

  await browser.close();

  // Save audit log of issues
  const reportPath = path.join(OUTPUT_DIR, "audit_issues_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2), "utf8");
  console.log(`\nAudit complete! Found ${issues.length} total logged issues/warnings.`);
  console.log(`Saved report: ${reportPath}`);
}

run().catch((err) => {
  console.error("Fatal Playwright error:", err);
  process.exit(1);
});
