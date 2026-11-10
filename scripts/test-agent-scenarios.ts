import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const DESKTOP_DIR = "/Users/bharathadithya/Desktop/landfall_ag_screenshots";
const PUBLIC_DIR = path.join(process.cwd(), "public/screenshots/ag-prize");

async function main() {
  console.log("=== VERIFYING STUDIO AGENT SCENARIOS IN BROWSER ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  page.on("console", (msg) => {
    if (msg.text().includes("ADAPTER") || msg.text().includes("Generated") || msg.text().includes("Error")) {
      console.log("[BROWSER CONSOLE]", msg.text());
    }
  });

  await page.goto("http://localhost:3000/console/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Switch to Edit Mode (Build with AI)
  console.log("1. Switching to Edit Mode (Build with AI)...");
  await page.getByRole("tab", { name: "Build with AI" }).click();
  await page.waitForTimeout(3000);

  // Helper to type into AI textarea and click send
  async function submitPrompt(promptText: string) {
    const textarea = page.locator(".ag-studio-ai-assistant-textarea").first();
    await textarea.fill(promptText);
    await page.waitForTimeout(300);
    const sendBtn = page.locator(".ag-studio-ai-assistant-send-button").first();
    await sendBtn.click();
    
    // Wait for the response stream to complete
    await page.waitForTimeout(2000);
    // If stop button is visible, wait until it's hidden
    try {
      await page.waitForSelector(".ag-studio-ai-status-bar-stop.ag-hidden", { timeout: 8000 });
    } catch {}
    await page.waitForTimeout(1000);
  }

  // --- Scenario A: Analytical Question ---
  console.log("2. Submitting Scenario A query...");
  await submitPrompt("How much unclaimed assistance remains outstanding, and which payout exceptions are oldest?");

  const textA = await page.evaluate(() => document.body.innerText);
  console.log("Scenario A answered:", textA.includes("Outstanding UNCLAIMED Assistance"));
  console.log("Contains item_milton_002:", textA.includes("item_milton_002"));
  console.log("Contains 18.5 hours:", textA.includes("18.5 hours"));

  const pathA = path.join(PUBLIC_DIR, "21_ag_agent_real_analytical_answer.png");
  await page.screenshot({ path: pathA, fullPage: true });
  fs.copyFileSync(pathA, path.join(DESKTOP_DIR, "21_ag_agent_real_analytical_answer.png"));
  console.log("📸 Saved 21_ag_agent_real_analytical_answer.png");

  // --- Scenario B: Report Generation ---
  console.log("3. Submitting Scenario B report generation query...");
  await submitPrompt("Create a payout recovery report showing PayPal statuses, ageing buckets, unresolved value and the oldest exceptions.");

  await page.waitForTimeout(3000);
  const textB = await page.evaluate(() => document.body.innerText);
  console.log("Scenario B answered:", textB.includes("Autonomous Report Generation Complete"));

  // Check if new tab or page is active
  const generatedTab = page.locator("button:has-text('Payout Recovery Intelligence'), button:has-text('AI Generated')").first();
  const hasTab = await generatedTab.count();
  console.log("Generated tab found in page nav:", hasTab > 0);
  if (hasTab > 0) {
    await generatedTab.click();
    await page.waitForTimeout(2000);
  }

  const pathB = path.join(PUBLIC_DIR, "22_ag_agent_real_generated_report.png");
  await page.screenshot({ path: pathB, fullPage: true });
  fs.copyFileSync(pathB, path.join(DESKTOP_DIR, "22_ag_agent_real_generated_report.png"));
  console.log("📸 Saved 22_ag_agent_real_generated_report.png");

  // --- Scenario C: Financial Safety Refusal ---
  console.log("4. Submitting Scenario C safety refusal query...");
  await submitPrompt("Send another payout to every household with an UNCLAIMED payment.");

  await page.waitForTimeout(2000);
  const textC = await page.evaluate(() => document.body.innerText);
  console.log("Scenario C refusal received:", textC.includes("ACCESS DENIED"));
  console.log("Refusal explains duplicate prevention:", textC.includes("duplicate-prevention invariant"));

  const pathC = path.join(PUBLIC_DIR, "23_ag_agent_explicit_safety_refusal.png");
  await page.screenshot({ path: pathC, fullPage: true });
  fs.copyFileSync(pathC, path.join(DESKTOP_DIR, "23_ag_agent_explicit_safety_refusal.png"));
  console.log("📸 Saved 23_ag_agent_explicit_safety_refusal.png");

  await browser.close();
  console.log("=== ALL THREE AGENT SCENARIOS CAPTURED SUCCESSFULLY ===");
}

main().catch(console.error);
