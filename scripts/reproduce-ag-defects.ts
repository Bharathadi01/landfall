import { chromium } from "playwright";

async function main() {
  console.log("=== PHASE 0: REPRODUCING AG DEFECTS IN BROWSER ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleLogs: { type: string; text: string }[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; failure: string }[] = [];

  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message + "\n" + err.stack);
  });

  page.on("requestfailed", (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText || "unknown" });
  });

  // 1. War Room route
  console.log("\n--> 1. Navigating to /console/war-room...");
  await page.goto("http://localhost:3000/console/war-room", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Check for toasts or alerts
  const toastsOnWarRoom = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="alert"], [class*="toast"], [class*="error"], [class*="notification"]'))
      .map((el: any) => ({
        tag: el.tagName,
        className: el.className,
        text: el.innerText,
      }))
      .filter((t) => t.text && t.text.trim().length > 0);
  });
  console.log("    War Room alerts/toasts count:", toastsOnWarRoom.length);
  if (toastsOnWarRoom.length > 0) {
    console.log("    War Room alerts/toasts:", JSON.stringify(toastsOnWarRoom.slice(0, 10), null, 2));
  }

  // Check AG Grid in War Room (Households / AG Grid tab)
  console.log("\n--> 2. Checking War Room Grid tab...");
  await page.getByRole("tab", { name: /Households/i }).click();
  await page.waitForTimeout(2000);
  const gridRows = await page.locator(".ag-row").count();
  const groupRows = await page.locator(".ag-row-group").count();
  console.log(`    AG Grid rows: ${gridRows}, group rows: ${groupRows}`);

  // Check Master/Detail in War Room
  const firstRow = page.locator(".ag-row").first();
  if ((await firstRow.count()) > 0) {
    await firstRow.click();
    await page.waitForTimeout(1000);
  }
  const detailPanel = await page.locator('[data-testid="payout-audit-panel"], [class*="detail"]').count();
  console.log(`    Detail panel count: ${detailPanel}`);

  // Check War Room Embedded Relief Studio Tab
  console.log("\n--> 3. Switching to War Room Embedded Studio tab...");
  await page.getByRole("tab", { name: /Relief Studio/i }).click();
  await page.waitForTimeout(4000);

  const toastsOnEmbeddedStudio = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="alert"], [class*="toast"], [class*="notification"], .ag-studio-notification, [class*="error"]'))
      .map((el: any) => ({
        className: el.className,
        text: el.innerText,
      }))
      .filter((t) => t.text && t.text.trim().length > 0);
  });
  console.log("    Embedded Studio alerts/toasts count:", toastsOnEmbeddedStudio.length);
  if (toastsOnEmbeddedStudio.length > 0) {
    console.log("    Embedded Studio alerts/toasts:", JSON.stringify(toastsOnEmbeddedStudio, null, 2));
  }

  const studioWidgetsCount = await page.locator(".ag-studio-widget, .ag-widget").count();
  const studioCanvasCount = await page.locator(".ag-studio-canvas, canvas").count();
  const studioLoadingCount = await page.locator("text=Loading AG Studio workspace").count();
  console.log(`    Embedded Studio widgets: ${studioWidgetsCount}, canvases: ${studioCanvasCount}, loading spinners: ${studioLoadingCount}`);

  // 4. Standalone Studio (/console/studio)
  console.log("\n--> 4. Navigating to Standalone /console/studio...");
  await page.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const standaloneWidgets = await page.locator(".ag-studio-widget, .ag-widget").count();
  console.log(`    Standalone Studio widgets count: ${standaloneWidgets}`);

  // Check all 4 canonical report tabs
  for (const tabName of ["Relief Overview", "Treasury & Reserve", "Payout Recovery", "Beneficiary Accountability"]) {
    console.log(`    Clicking report tab: ${tabName}...`);
    await page.getByRole("tab", { name: new RegExp(tabName, "i") }).click();
    await page.waitForTimeout(1500);
    const widgetCount = await page.locator(".ag-studio-widget, .ag-widget").count();
    console.log(`      Tab ${tabName} widget count: ${widgetCount}`);
  }

  // 5. Build/Edit mode
  console.log("\n--> 5. Checking Build/Edit mode in /console/studio...");
  const editToggle = page.locator("text=Build with AI, text=Edit Mode, text=Edit").first();
  if ((await editToggle.count()) > 0) {
    await editToggle.click();
    await page.waitForTimeout(2000);
    const aiPanel = await page.locator(".ag-studio-ai-panel, [class*=\"ai-panel\"], textarea, input[placeholder*=\"Ask\"]").count();
    console.log(`    AI panel elements count: ${aiPanel}`);
  }

  // 6. Mobile Viewport 390x844
  console.log("\n--> 6. Checking Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`    Mobile document-level horizontal overflow: ${overflow}`);

  // Summary of issues
  console.log("\n=== LOGGED DIAGNOSTICS ===");
  console.log(`Page Errors (${pageErrors.length}):`, pageErrors);
  console.log(`Failed Requests (${failedRequests.length}):`, failedRequests);
  const errorsOnly = consoleLogs.filter((l) => l.type === "error");
  console.log(`Console Errors (${errorsOnly.length}):`, errorsOnly);

  await browser.close();
}

main().catch(console.error);

