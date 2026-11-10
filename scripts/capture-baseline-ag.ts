import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const consoleMessages: string[] = [];
  page.on("console", (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log("Navigating to http://localhost:3000/console/studio ...");
  await page.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const studioPath = path.join(process.cwd(), "public/screenshots/baseline-ag/baseline_studio_desktop.png");
  await page.screenshot({ path: studioPath, fullPage: true });
  console.log(`Saved baseline studio screenshot to ${studioPath}`);

  console.log("Navigating to http://localhost:3000/console/war-room ...");
  await page.goto("http://localhost:3000/console/war-room", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const warRoomPath = path.join(process.cwd(), "public/screenshots/baseline-ag/baseline_warroom_overview.png");
  await page.screenshot({ path: warRoomPath, fullPage: true });
  console.log(`Saved baseline war-room screenshot to ${warRoomPath}`);

  // Switch to GRID tab
  const gridTab = page.locator('button[role="tab"]:has-text("Households · AG Grid")');
  if (await gridTab.count() > 0) {
    await gridTab.click();
    await page.waitForTimeout(1000);
    const warRoomGridPath = path.join(process.cwd(), "public/screenshots/baseline-ag/baseline_warroom_grid.png");
    await page.screenshot({ path: warRoomGridPath, fullPage: true });
    console.log(`Saved baseline war-room grid screenshot to ${warRoomGridPath}`);
  }

  await browser.close();

  console.log("\nConsole log count:", consoleMessages.length);
  const errors = consoleMessages.filter((m) => m.startsWith("[error]"));
  const warnings = consoleMessages.filter((m) => m.startsWith("[warning]"));
  console.log("Errors:", errors);
  console.log("Warnings count:", warnings.length);
}

main().catch((err) => {
  console.error("Baseline capture failed:", err);
  process.exit(1);
});

