/**
 * End-to-end check of the guided tour in a real browser.
 *   node scripts/tour-e2e.mjs <baseUrl> [--ai] [--shots <dir>]
 * It presses the floating button, lets the whole tour run, and FAILS if the tour makes any write request that is not on the allow-list,
 * if the page throws, or if the tour does not reach its closing screen.
 */
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:3222";
const AI = process.argv.includes("--ai");
const shotsDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const ALLOWED_WRITES = [/^POST \/api\/auth\/session$/, /^POST \/api\/workflow\/golden$/, ...(AI ? [/^POST \/api\/cases\/[^/]+\/investigate$/, /^POST \/api\/watch-officer$/] : [])];
const browser = await chromium.launch({ channel: "chromium", args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const writes = [], errors = [], failed = [];
page.on("request", (r) => { if (r.method() !== "GET" && r.url().startsWith(base)) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
page.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(base)) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });

let pass = true; const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) pass = false; };
await page.goto(base + "/", { waitUntil: "load" });
await page.getByTestId("tour-fab").waitFor({ timeout: 30000 });
const fab = await page.getByTestId("tour-fab").boundingBox();
check(fab && fab.x + fab.width > 1280 - 60 && fab.y + fab.height > 720 - 60, `button sits at the bottom right (${Math.round(fab.x)},${Math.round(fab.y)})`);
await page.getByTestId("tour-fab").click();
await page.getByTestId("tour-intro").waitFor();
const box = page.getByRole("checkbox");
if ((await box.isChecked()) !== AI) await box.click();
await page.getByTestId("tour-start").click();

let pendingShot = null; const seen = new Set(); const t0 = Date.now(); let done = false;
while (Date.now() - t0 < 8 * 60 * 1000) {
  const dock = page.getByTestId("tour-dock");
  const txt = (await dock.innerText().catch(() => "")).replace(/\s+/g, " ");
  const m = txt.match(/Step (\d+) of (\d+)/);
  if (m && !seen.has(m[1])) { seen.add(m[1]); console.log(`  step ${m[1]}/${m[2]} @${Math.round((Date.now() - t0) / 1000)}s: ${txt.slice(txt.indexOf("Step") + 12, txt.indexOf("Step") + 90)}`); if (shotsDir) { pendingShot = { n: m[1], at: Date.now() + 5500 }; } }
  if (pendingShot && Date.now() >= pendingShot.at) { await page.screenshot({ path: `${shotsDir}/step-${String(pendingShot.n).padStart(2, "0")}.png` }); pendingShot = null; }
  if (/That.s Landfall/.test(txt)) { done = true; break; }
  await page.waitForTimeout(700);
}
check(done, `tour reached its closing screen in ${Math.round((Date.now() - t0) / 1000)}s`);
check(seen.size >= 12, `all steps were shown (${seen.size})`);
const bad = writes.filter((w) => !ALLOWED_WRITES.some((a) => a.test(w)));
console.log("  write requests during the tour:", [...new Set(writes)].join(", ") || "none");
check(bad.length === 0, `no write request outside the allow-list ${bad.length ? JSON.stringify(bad) : ""}`);
check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ""}`);
check(failed.length === 0, `no 5xx responses ${failed.length ? JSON.stringify(failed) : ""}`);
await page.getByTestId("tour-exit").click();
check((await page.getByTestId("tour-fab").count()) === 1, "closing the tour brings the button back");

// Esc leaves mid-tour
await page.getByTestId("tour-fab").click(); await page.getByTestId("tour-start").click(); await page.getByTestId("tour-dock").waitFor();
await page.waitForTimeout(2500); await page.keyboard.press("Escape"); await page.waitForTimeout(600);
check((await page.getByTestId("tour-dock").count()) === 0 && (await page.getByTestId("tour-fab").count()) === 1, "Esc exits mid-tour");
await browser.close();
console.log(pass ? "\nTOUR E2E: PASS" : "\nTOUR E2E: FAIL"); process.exit(pass ? 0 : 1);
