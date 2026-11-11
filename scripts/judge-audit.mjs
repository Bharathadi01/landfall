// Plays a judge against a running deployment: visits pages on desktop and phone, records console errors, failed
// requests, horizontal overflow, axe violations and screenshots. Usage: node scripts/judge-audit.mjs <baseUrl> [outDir]
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const out = process.argv[3] || "judge-audit";
fs.mkdirSync(out, { recursive: true });
const report = [];

const PUBLIC = ["/", "/signin", "/judges", "/r/enroll", "/r/complaints", "/r/status"];
const CONSOLE = ["/console/war-room", "/console/watch-officer", "/console/proposals", "/console/golden-flow", "/console/recipients", "/console/rehearsal", "/console/sentinel", "/console/studio"];

const browser = await chromium.launch();

async function audit(ctx, label, path, viewport) {
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 200)));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url().replace(base, "")}`.slice(0, 160)));
  const t0 = Date.now();
  let status = 0;
  try {
    const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 });
    status = res?.status() ?? 0;
  } catch (e) {
    errors.push("goto: " + String(e.message).slice(0, 150));
  }
  await page.waitForTimeout(1200);
  const ms = Date.now() - t0;
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })).catch(() => ({ sw: 0, cw: 0 }));
  let axe = [];
  try {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    axe = r.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`);
  } catch {}
  const shot = `${out}/${label}-${path.replace(/\W+/g, "_") || "home"}.png`;
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
  report.push({ label, path, status, ms, finalUrl: page.url().replace(base, ""), hOverflow: overflow.sw > overflow.cw + 1 ? `${overflow.sw}>${overflow.cw}` : "", errors: [...new Set(errors)].slice(0, 4), failed: [...new Set(failed)].slice(0, 4), axe });
  await page.close();
}

for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const anon = await browser.newContext({ viewport });
  for (const p of PUBLIC) await audit(anon, label, p, viewport);
  // console pages anonymously must redirect to sign-in
  await audit(anon, label + "-anon", "/console/war-room", viewport);
  await anon.close();

  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(base + "/signin", { waitUntil: "networkidle" });
  const resp = await ctx.request.post(base + "/api/auth/session", { data: { persona: "dana-ortiz" }, headers: { Origin: base } });
  report.push({ label, path: "sign-in dana", status: resp.status() });
  await page.close();
  for (const p of CONSOLE) await audit(ctx, label, p, viewport);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
for (const r of report) {
  const flags = [r.hOverflow && "OVERFLOW " + r.hOverflow, r.errors?.length && "ERR " + r.errors.length, r.failed?.length && "HTTP " + r.failed.join(" | "), r.axe?.length && "AXE " + r.axe.join(","), r.ms > 8000 && "SLOW"].filter(Boolean).join("  ");
  console.log(`${r.label.padEnd(12)} ${String(r.status).padEnd(4)} ${(r.path).padEnd(26)} ${r.finalUrl && r.finalUrl !== r.path ? "→" + r.finalUrl : ""} ${flags}`);
}
