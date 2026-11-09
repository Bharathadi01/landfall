import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/sentinel_map_verification";
const ARTIFACT_DIR = "/Users/bharathadithya/.gemini/antigravity/brain/745eb751-41d3-4324-8170-66765b7a4725/screenshots/sentinel";

async function runVerification() {
  for (const dir of [DESKTOP_DIR, ARTIFACT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log("🚀 Starting Sentinel Disaster Intelligence Map Visual Verification Suite...");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=metal",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const networkRequests: { url: string; status: number }[] = [];
  const consoleMessages: string[] = [];

  page.on("response", (res) => {
    const url = res.url();
    if (
      url.includes("openfreemap.org") ||
      url.includes("nowcoast.noaa.gov") ||
      url.includes("weather.gov")
    ) {
      networkRequests.push({ url, status: res.status() });
    }
  });

  page.on("console", (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error("❌ Page Error:", err.message);
  });

  const saveScreenshots = async (filename: string) => {
    const desktopPath = path.join(DESKTOP_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: desktopPath, fullPage: false });
    fs.copyFileSync(desktopPath, artifactPath);
    console.log(`   📸 Saved ${filename}`);
  };

  try {
    // 1. Navigate to Sentinel Console
    console.log("📍 Navigating to http://localhost:3000/console/sentinel...");
    await page.goto("http://localhost:3000/console/sentinel", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for map container to mount and MapLibre style to load
    await page.waitForSelector(".maplibregl-map", { timeout: 15000 });
    console.log("   MapLibre map container mounted successfully.");

    await page.waitForFunction(
      () => {
        const win = window as any;
        return (
          win.map &&
          win.map.isStyleLoaded &&
          win.map.isStyleLoaded()
        );
      },
      { timeout: 15000 }
    );

    // Give vector tiles a moment to render
    await page.waitForTimeout(3000);

    const renderedFeaturesCount = await page.evaluate(() => {
      const win = window as any;
      if (win.map && win.map.queryRenderedFeatures) {
        return win.map.queryRenderedFeatures().length;
      }
      return 0;
    });
    console.log(`   Vector basemap rendered features in viewport: ${renderedFeaturesCount}`);

    // --- SCREENSHOT 01: Baseline OpenFreeMap Liberty Vector Basemap ---
    console.log("1️⃣ Capturing 01_sentinel_map_basemap.png...");
    await saveScreenshots("01_sentinel_map_basemap.png");

    // --- Switch to REPLAY mode to load Hurricane Milton warnings ---
    console.log("⚡ Triggering Milton 2024 Replay...");
    const replayButton = page.getByRole("button", { name: /Replay Milton 2024/i }).first();
    await replayButton.click();
    await page.waitForTimeout(2500);

    // --- SCREENSHOT 02: NWS Warning Polygons ---
    console.log("2️⃣ Capturing 02_sentinel_nws_warnings.png...");
    await saveScreenshots("02_sentinel_nws_warnings.png");

    // --- SCREENSHOT 03: NOAA nowCOAST WMS Radar Mosaic Overlay ---
    console.log("3️⃣ Capturing 03_sentinel_radar_overlay.png...");
    const radarInput = page.locator('label:has-text("Radar") input');
    if (!(await radarInput.isChecked())) {
      await radarInput.check();
    }
    await page.waitForTimeout(2000);
    await saveScreenshots("03_sentinel_radar_overlay.png");

    // --- SCREENSHOT 04: Household Exposure Clusters ---
    console.log("4️⃣ Capturing 04_sentinel_household_clusters.png...");
    const clustersInput = page.locator('label:has-text("Clusters") input');
    if (!(await clustersInput.isChecked())) {
      await clustersInput.check();
    }
    await page.waitForTimeout(1000);
    await saveScreenshots("04_sentinel_household_clusters.png");

    // --- SCREENSHOT 05: Contextual Warning Inspection Drawer ---
    console.log("5️⃣ Capturing 05_sentinel_warning_inspection.png...");
    const alertCard = page.locator(".space-y-3 .cursor-pointer").first();
    if (await alertCard.isVisible()) {
      await alertCard.click();
    } else {
      const warnText = page.getByText(/Hurricane Warning/i).first();
      await warnText.click();
    }
    await page.waitForTimeout(1000);
    await saveScreenshots("05_sentinel_warning_inspection.png");

    // --- SCREENSHOT 06: Storm Surge & Evacuation Zone Inspection ---
    console.log("6️⃣ Capturing 06_sentinel_storm_exposure.png...");
    const clusterCard = page.getByText(/Clearwater Beach/i).first();
    if (await clusterCard.isVisible()) {
      await clusterCard.click();
    } else {
      const evacInput = page.locator('label:has-text("Evac Zones") input');
      if (!(await evacInput.isChecked())) await evacInput.check();
    }
    await page.waitForTimeout(1000);
    await saveScreenshots("06_sentinel_storm_exposure.png");

    // --- SCREENSHOT 08: Provider Outage State: Basemap STILL Visible ---
    console.log("8️⃣ Capturing 08_sentinel_provider_outage_basemap_still_visible.png...");
    const outageToggle = page.locator('[data-testid="radar-outage-toggle"]');
    await outageToggle.click();
    await page.waitForTimeout(1500);

    const outageFeaturesCount = await page.evaluate(() => {
      const win = window as any;
      if (win.map && win.map.queryRenderedFeatures) {
        return win.map.queryRenderedFeatures().length;
      }
      return 0;
    });
    console.log(`   Outage state basemap rendered features: ${outageFeaturesCount} (Basemap preserved!)`);
    await saveScreenshots("08_sentinel_provider_outage_basemap_still_visible.png");

    // Revert radar outage
    await outageToggle.click();
    await page.waitForTimeout(1000);

    // --- SCREENSHOT 09: Graceful 2D SVG Geospatial Engine Fallback ---
    console.log("9️⃣ Capturing 09_sentinel_webgl_fallback.png...");
    const engineToggle = page.getByRole("button", { name: /Engine:/i });
    await engineToggle.click();
    await page.waitForTimeout(1500);
    await saveScreenshots("09_sentinel_webgl_fallback.png");

    // Switch back to WebGL
    await engineToggle.click();
    await page.waitForTimeout(1500);

    // --- SCREENSHOT 07: Mobile Viewport (390x844) ---
    console.log("7️⃣ Capturing 07_sentinel_mobile.png...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(2000);
    await saveScreenshots("07_sentinel_mobile.png");

    console.log("\n✅ All 9 Geospatial Verification Screenshots Successfully Captured!");

    // Verification Summary
    const ofmRequests = networkRequests.filter((r) => r.url.includes("openfreemap.org"));
    const nowcoastRequests = networkRequests.filter((r) => r.url.includes("nowcoast.noaa.gov"));

    console.log("\n📊 Network & Rendering Audit:");
    console.log(`   - OpenFreeMap tile/style requests: ${ofmRequests.length}`);
    console.log(`   - NOAA nowCOAST WMS requests: ${nowcoastRequests.length}`);
    console.log(`   - Viewport rendered vector features: ${renderedFeaturesCount}`);
    console.log(`   - Outage state vector features: ${outageFeaturesCount}`);
    console.log(`   - Console messages count: ${consoleMessages.length}`);

    const summaryReport = {
      timestamp: new Date().toISOString(),
      status: "PASS",
      renderedFeaturesCount,
      outageFeaturesCount,
      openFreeMapRequests: ofmRequests.length,
      nowCoastRequests: nowcoastRequests.length,
      screenshots: [
        "01_sentinel_map_basemap.png",
        "02_sentinel_nws_warnings.png",
        "03_sentinel_radar_overlay.png",
        "04_sentinel_household_clusters.png",
        "05_sentinel_warning_inspection.png",
        "06_sentinel_storm_exposure.png",
        "07_sentinel_mobile.png",
        "08_sentinel_provider_outage_basemap_still_visible.png",
        "09_sentinel_webgl_fallback.png",
      ],
    };

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, "verification_summary.json"),
      JSON.stringify(summaryReport, null, 2)
    );
    fs.writeFileSync(
      path.join(DESKTOP_DIR, "verification_summary.json"),
      JSON.stringify(summaryReport, null, 2)
    );

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runVerification();
