import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const OUTPUT_DIR = "/Users/bharathadithya/Desktop/unified_navigation_verification";

interface RouteCheckResult {
  route: string;
  name: string;
  status: "PASS" | "FAIL";
  activeNavVisible: boolean;
  breadcrumbMatch: boolean;
  httpStatus?: number;
  durationMs: number;
  notes?: string;
}

async function verifyUnifiedApplicationExperience() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🚀 Starting Playwright Unified Application Navigation & Shell Verification Suite...");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const results: RouteCheckResult[] = [];

  // 1. Direct URL Access & Active States for all 7 primary routes + 3 secondary
  const routesToTest = [
    { href: "/", label: "Overview", breadcrumbTitle: "Overview" },
    { href: "/console/war-room", label: "War Room", breadcrumbTitle: "Coordinator War Room" },
    { href: "/console/golden-flow", label: "Golden Workflow", breadcrumbTitle: "Golden Workflow" },
    { href: "/console/sentinel", label: "Sentinel", breadcrumbTitle: "Sentinel Weather Intelligence" },
    { href: "/console/rehearsal", label: "Rehearsal Lab", breadcrumbTitle: "Storm Rehearsal Lab" },
    { href: "/r/enroll", label: "Resident Portal", breadcrumbTitle: "Household Enrollment" },
    { href: "/r/complaints", label: "Grievances", breadcrumbTitle: "Community Grievances" },
    { href: "/console/recipients", label: "Recipient Directory", breadcrumbTitle: "Recipient Directory" },
    { href: "/console/watch-officer", label: "Watch Officer AI", breadcrumbTitle: "Watch Officer AI" },
    { href: "/spike", label: "PayPal Audit Ledger", breadcrumbTitle: "PayPal Audit Ledger" },
  ];

  console.log("\n📋 Phase 1: Testing Direct URL Access and Active Navigation State for all routes...");

  for (const r of routesToTest) {
    const startTime = Date.now();
    try {
      const resp = await page.goto(`http://localhost:3000${r.href}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      const httpStatus = resp?.status() || 200;

      // Verify breadcrumb contains title
      const breadcrumbText = await page.textContent("header + div");
      const breadcrumbMatch = Boolean(breadcrumbText && breadcrumbText.includes(r.breadcrumbTitle));

      // Verify active link state in header if primary route
      let activeNavVisible = true;
      if (["Overview", "War Room", "Golden Workflow", "Sentinel", "Rehearsal Lab", "Resident Portal", "Grievances"].includes(r.label)) {
        const activeLink = page.locator(`header nav a[href="${r.href}"]`);
        const classes = await activeLink.getAttribute("class");
        activeNavVisible = Boolean(classes && (classes.includes("bg-blue-600/20") || classes.includes("border-blue-500/50")));
      }

      const durationMs = Date.now() - startTime;
      const passed = httpStatus === 200 && breadcrumbMatch && activeNavVisible;

      results.push({
        route: r.href,
        name: r.label,
        status: passed ? "PASS" : "FAIL",
        activeNavVisible,
        breadcrumbMatch,
        httpStatus,
        durationMs,
        notes: passed ? "All invariants verified" : "Check breadcrumb or active class match",
      });

      console.log(`  ${passed ? "✅" : "❌"} ${r.label} (${r.href}) [${httpStatus}] - Active: ${activeNavVisible}, Breadcrumb: ${breadcrumbMatch} (${durationMs}ms)`);
    } catch (err: any) {
      results.push({
        route: r.href,
        name: r.label,
        status: "FAIL",
        activeNavVisible: false,
        breadcrumbMatch: false,
        durationMs: Date.now() - startTime,
        notes: err.message,
      });
      console.log(`  ❌ ${r.label} (${r.href}) Error: ${err.message}`);
    }
  }

  // 2. Client-Side Navigation Chain across all 7 primary routes
  console.log("\n🔗 Phase 2: Testing Full Client-Side Navigation Sequence...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Set experience mode to "ALL" to ensure all 7 primary links are in the nav
  const allFilterBtn = page.getByRole("button", { name: "All (7)", exact: true }).first();
  if (await allFilterBtn.isVisible()) {
    await allFilterBtn.click();
    await page.waitForTimeout(500);
  }

  // Capture Screenshot 1: Desktop Overview
  console.log("📸 Capturing 01_desktop_unified_navigation_overview.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "01_desktop_unified_navigation_overview.png"),
    fullPage: false,
  });

  // Navigate to War Room via client-side link
  console.log("  → Clicking 'War Room' link...");
  await page.locator('header nav a[href="/console/war-room"]').first().click();
  await page.waitForURL("**/console/war-room");
  await page.waitForTimeout(1000);

  // Capture Screenshot 2: War Room with Unified Navigation
  console.log("📸 Capturing 02_desktop_unified_navigation_war_room.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "02_desktop_unified_navigation_war_room.png"),
    fullPage: false,
  });

  // Navigate to Golden Workflow
  console.log("  → Clicking 'Golden Workflow' link...");
  await page.locator('header nav a[href="/console/golden-flow"]').first().click();
  await page.waitForURL("**/console/golden-flow");
  await page.waitForTimeout(1000);

  // Navigate to Sentinel
  console.log("  → Clicking 'Sentinel' link...");
  await page.locator('header nav a[href="/console/sentinel"]').first().click();
  await page.waitForURL("**/console/sentinel");
  await page.waitForTimeout(1500);

  // Capture Screenshot 3: Sentinel with Unified Navigation
  console.log("📸 Capturing 03_desktop_unified_navigation_sentinel.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "03_desktop_unified_navigation_sentinel.png"),
    fullPage: false,
  });

  // Navigate to Rehearsal Lab
  console.log("  → Clicking 'Rehearsal Lab' link...");
  await page.locator('header nav a[href="/console/rehearsal"]').first().click();
  await page.waitForURL("**/console/rehearsal");
  await page.waitForTimeout(1000);

  // Navigate to Resident Portal
  console.log("  → Clicking 'Resident Portal' link...");
  await page.locator('header nav a[href="/r/enroll"]').first().click();
  await page.waitForURL("**/r/enroll");
  await page.waitForTimeout(1000);

  // Navigate to Grievances
  console.log("  → Clicking 'Grievances' link...");
  await page.locator('header nav a[href="/r/complaints"]').first().click();
  await page.waitForURL("**/r/complaints");
  await page.waitForTimeout(1000);

  // 3. Browser History & Refresh Verification
  console.log("\n🔄 Phase 3: Testing Browser Back, Forward & Refresh...");
  // Now on /r/complaints. Go back to /r/enroll
  await page.goBack();
  await page.waitForTimeout(1000);
  console.log("  Browser back URL:", page.url());
  const isBackEnroll = page.url().includes("/r/enroll");

  // Go forward back to /r/complaints
  await page.goForward();
  await page.waitForTimeout(1000);
  console.log("  Browser forward URL:", page.url());
  const isForwardComplaints = page.url().includes("/r/complaints");

  // Refresh page
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  console.log("  Browser reload URL:", page.url());
  const isReloadComplaints = page.url().includes("/r/complaints");

  // 4. Experience Variants (Public vs Operations vs Resident)
  console.log("\n🔀 Phase 4: Testing Experience Mode Switching...");
  await page.goto("http://localhost:3000/console/war-room", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Switch to Operations variant explicitly
  const opsFilterBtn = page.getByRole("button", { name: "Operations", exact: true }).first();
  await opsFilterBtn.click();
  await page.waitForTimeout(500);

  console.log("📸 Capturing 04_desktop_experience_variants_ops.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "04_desktop_experience_variants_ops.png"),
    fullPage: false,
  });

  // 5. Role Restrictions & RBAC Simulation
  console.log("\n🛡️ Phase 5: Testing Role-Based Operational Observation Notice...");
  // Open Role Dropdown
  const roleButton = page.locator('[data-testid="role-selector-button"]');
  await roleButton.click();
  await page.waitForTimeout(500);

  // Select Public Visitor / Donor role
  const publicVisitorOption = page.locator('[data-testid="role-option-public"]');
  await publicVisitorOption.click();
  await page.waitForTimeout(1000);

  // Verify Observation Notice appears on operational route
  const observationBanner = page.locator("text=Operational Observation Mode:");
  const isObservationBannerVisible = await observationBanner.isVisible();
  console.log("  Observation notice visible for Public role on /console/war-room:", isObservationBannerVisible);

  console.log("📸 Capturing 05_desktop_role_restriction_banner.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "05_desktop_role_restriction_banner.png"),
    fullPage: false,
  });

  // Restore coordinator role
  const simCoordinatorBtn = page.getByRole("button", { name: "Simulate Coordinator Login" }).first();
  if (await simCoordinatorBtn.isVisible()) {
    await simCoordinatorBtn.click();
    await page.waitForTimeout(500);
  }

  // 6. Capture Footer Sitemap
  console.log("\n📜 Phase 6: Capturing Global Footer Sitemap...");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  console.log("📸 Capturing 08_desktop_footer_sitemap.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "08_desktop_footer_sitemap.png"),
    fullPage: false,
  });

  // 7. Mobile Navigation Verification (390x844 - iPhone 14)
  console.log("\n📱 Phase 7: Testing Responsive Mobile Viewport (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/console/war-room", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(1500);

  // Capture Screenshot 6: Mobile Closed
  console.log("📸 Capturing 06_mobile_navigation_closed.png...");
  await mobilePage.screenshot({
    path: path.join(OUTPUT_DIR, "06_mobile_navigation_closed.png"),
    fullPage: false,
  });

  // Open mobile drawer
  console.log("  Opening mobile hamburger drawer...");
  const hamburger = mobilePage.getByLabel("Toggle navigation menu");
  await hamburger.click();
  await mobilePage.waitForTimeout(1000);

  // Capture Screenshot 7: Mobile Drawer Open
  console.log("📸 Capturing 07_mobile_navigation_drawer_open.png...");
  await mobilePage.screenshot({
    path: path.join(OUTPUT_DIR, "07_mobile_navigation_drawer_open.png"),
    fullPage: false,
  });

  // Click a navigation item inside mobile drawer (Sentinel)
  console.log("  Navigating to Sentinel via mobile drawer...");
  const mobileSentinelLink = mobilePage.locator('[data-testid="mobile-nav-drawer"] a[href="/console/sentinel"]').first();
  await mobileSentinelLink.click();
  await mobilePage.waitForURL("**/console/sentinel");
  await mobilePage.waitForTimeout(1000);
  console.log("  Mobile current URL after click:", mobilePage.url());

  await mobileContext.close();
  await browser.close();

  // Summary Report
  console.log("\n========================================================");
  console.log("🎉 UNIFIED APPLICATION EXPERIENCE VERIFICATION COMPLETE");
  console.log("========================================================");
  console.log(`Routes Tested: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.status === "PASS").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "FAIL").length}`);
  console.log(`Browser Back / Forward / Refresh: ${isBackEnroll && isForwardComplaints && isReloadComplaints ? "PASS" : "FAIL"}`);
  console.log(`Role Restrictions & Observation Banner: ${isObservationBannerVisible ? "PASS" : "FAIL"}`);
  console.log(`Screenshots Output Directory: ${OUTPUT_DIR}`);

  // Write detailed verification JSON
  const reportPath = path.join(OUTPUT_DIR, "unified_navigation_report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalRoutes: results.length,
        passedRoutes: results.filter((r) => r.status === "PASS").length,
        historyAndRefreshTest: isBackEnroll && isForwardComplaints && isReloadComplaints,
        roleRestrictionTest: isObservationBannerVisible,
        routes: results,
      },
      null,
      2
    )
  );
  console.log(`Report JSON written to ${reportPath}\n`);
}

verifyUnifiedApplicationExperience().catch((err) => {
  console.error("❌ Verification Suite Failed:", err);
  process.exit(1);
});
