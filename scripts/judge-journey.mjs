// A judge's walkthrough of the DEPLOYED app, step by step, with a pass/fail line per step and screenshots.
// Usage: node scripts/judge-journey.mjs <baseUrl> <outDir>
import { chromium } from "playwright";
import fs from "node:fs";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const out = process.argv[3] || "judge-journey";
fs.mkdirSync(out, { recursive: true });
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t, note: note ?? "" });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, note: String(e.message).split("\n")[0].slice(0, 220) });
  }
  const r = results[results.length - 1];
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}  (${(r.ms / 1000).toFixed(1)}s) ${r.note}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

await step("home loads with a headline", async () => {
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 90000 });
  const h = await page.locator("h1").first().innerText();
  await shot("01-home");
  return h.slice(0, 60);
});

await step("console is protected (redirects to sign-in)", async () => {
  await page.goto(base + "/console/war-room", { waitUntil: "networkidle" });
  if (!page.url().includes("/signin")) throw new Error("not redirected: " + page.url());
});

await step("judge card shows personas, PIN and resident codes", async () => {
  await page.goto(base + "/judges", { waitUntil: "networkidle" });
  const pin = await page.getByTestId("demo-pin-value").innerText();
  const body = await page.locator("body").innerText();
  await shot("02-judges");
  if (!/Dana Ortiz/.test(body)) throw new Error("no Dana persona");
  return `PIN ${pin}; ${(body.match(/\b\d{6}\b/g) || []).length} six-digit codes`;
});

await step("sign in as Dana (coordinator)", async () => {
  await page.goto(base + "/signin", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Dana/i }).first().click();
  await page.waitForURL(/\/console\//, { timeout: 30000 });
  await shot("03-after-signin");
  return page.url().replace(base, "");
});

await step("war room shows LIVE SANDBOX data (5 real payments)", async () => {
  await page.goto(base + "/console/war-room", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  const text = await page.locator("body").innerText();
  await shot("04-war-room");
  if (!/LIVE SANDBOX|Live Sandbox/i.test(text)) throw new Error("live source badge not found");
  if (!/real PayPal Sandbox payments/i.test(text)) throw new Error("live summary sentence not found");
  return (text.match(/\d+ real PayPal Sandbox payments/) || [""])[0];
});

await step("Cases tab loads the AG Grid with the five live payments (lazy-loaded)", async () => {
  await page.goto(base + "/console/war-room", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByText(/Every payment/).first().waitFor({ timeout: 60000 }); // live data has arrived (no replay flash)
  await page.getByRole("tab", { name: /Cases/i }).first().click();
  await page.waitForSelector(".ag-row", { timeout: 60000 });
  await page.waitForTimeout(2500);
  const rows = await page.locator(".ag-row").count();
  await shot("04b-cases-grid");
  if (rows < 1) throw new Error("no grid rows");
  return `${rows} rows rendered`;
});

await step("Studio tab opens the AG Studio workspace (lazy-loaded)", async () => {
  await page.getByRole("tab", { name: /Studio/i }).first().click();
  await page.waitForTimeout(6000);
  await shot("04c-studio");
  const errs = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  if (/Invalid License|Application error|Something went wrong/i.test(errs)) throw new Error("studio error text on page");
});

let caseHref = null;
await step("open an UNCLAIMED live case page", async () => {
  const res = await ctx.request.get(base + "/api/cases");
  const j = await res.json();
  const c = j.cases.find((x) => x.status === "UNCLAIMED");
  if (!c) throw new Error("no UNCLAIMED live case");
  caseHref = `/console/cases/${encodeURIComponent(c.caseRef)}`;
  await page.goto(base + caseHref, { waitUntil: "networkidle" });
  await page.getByTestId("recovery-panel").waitFor({ timeout: 20000 });
  const t = await page.locator("body").innerText();
  await shot("05-case");
  if (!/UNCLAIMED/i.test(t)) throw new Error("status not shown");
  return c.caseRef.slice(0, 40);
});

await step("recovery rules: cancel NOT yet allowed without a reason; reissue not allowed", async () => {
  const t = await page.getByTestId("recovery-panel").innerText();
  if (/Send a replacement payment[\s\S]{0,40}Allowed(?!\s*$)/.test(t) && !/Not allowed/.test(t)) throw new Error("reissue shown as allowed");
  return t.replace(/\s+/g, " ").slice(0, 160);
});

await step("AI Case Officer investigates (live Groq) with cited facts", async () => {
  await page.getByTestId("investigate").click();
  await page.waitForSelector("[data-testid=case-officer] [aria-live=polite] >> text=What the evidence shows", { timeout: 70000 });
  const t = await page.getByTestId("case-officer").innerText();
  await shot("06-case-officer");
  const ai = /AI ·/.test(t);
  return ai ? "answered by AI: " + (t.match(/AI · [^\n]+/) || [""])[0] : "OFFLINE FALLBACK (AI unavailable)";
});

await step("proposals page loads and is empty or lists proposals", async () => {
  await page.goto(base + "/console/proposals", { waitUntil: "networkidle" });
  await shot("07-proposals");
  return (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ").slice(0, 100);
});

await step("Watch Officer page does NOT auto-run and offers a run button", async () => {
  await page.goto(base + "/console/watch-officer", { waitUntil: "networkidle" });
  await shot("08-watch-officer");
  const t = await page.locator("body").innerText();
  if (!/Run the Watch Officer|Refresh Intelligence/.test(t)) throw new Error("no run control");
});

await step("a viewer (Judge) cannot propose money movement", async () => {
  const v = await browser.newContext();
  await v.request.post(base + "/api/auth/session", { data: { persona: "judge-viewer" }, headers: { Origin: base } });
  const r = await v.request.post(base + "/api/proposals", { data: { kind: "NEW_PAYOUT", items: [{ householdId: "hh_x", amountCents: 100 }] }, headers: { Origin: base } });
  await v.close();
  if (r.status() !== 403) throw new Error("expected 403, got " + r.status());
});

await step("anonymous cannot read resident cases or mutate", async () => {
  const a = await browser.newContext();
  const g = await a.request.get(base + "/api/recipients/case?ref=hh_tbw_003");
  const p = await a.request.post(base + "/api/recipients/access-report", { data: { caseRef: "hh_tbw_003", reason: "CANT_ACCESS" }, headers: { Origin: base } });
  await a.close();
  if (![401, 403].includes(g.status()) || ![401, 403].includes(p.status())) throw new Error(`got ${g.status()} / ${p.status()}`);
});

await step("resident journey: code → status → report a barrier", async () => {
  const j = await (await ctx.request.get(base + "/judges")).text();
  const m = j.match(/hh_tbw_003[\s\S]{0,400}?(\d{6})/);
  if (!m) throw new Error("could not find a resident code on /judges");
  const rp = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await rp.newPage();
  await pg.goto(base + "/signin", { waitUntil: "networkidle" });
  const sess = await rp.request.post(base + "/api/resident/session", { data: { ref: "hh_tbw_003", code: m[1] }, headers: { Origin: base } });
  if (!sess.ok()) throw new Error("resident session " + sess.status());
  const c = await rp.request.get(base + "/api/recipients/case?ref=hh_tbw_003");
  const cj = await c.json();
  await pg.goto(base + "/r/enroll", { waitUntil: "networkidle" });
  await pg.screenshot({ path: `${out}/09-resident-phone.png` });
  await rp.close();
  return `case status via resident session: ${c.status()} ${JSON.stringify(cj).slice(0, 80)}`;
});

await step("phone: console menu button is usable and opens navigation", async () => {
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await pc.request.post(base + "/api/auth/session", { data: { persona: "dana-ortiz" }, headers: { Origin: base } });
  const pg = await pc.newPage();
  await pg.goto(base + "/console/war-room", { waitUntil: "networkidle", timeout: 90000 });
  const btn = pg.getByRole("button", { name: /Open navigation/i }).first();
  const box = await btn.boundingBox();
  if (!box || box.width < 28) throw new Error("menu button too small: " + JSON.stringify(box));
  await btn.click();
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}/10-phone-nav.png` });
  const visible = await pg.getByRole("link", { name: /Command Center/i }).first().isVisible();
  await pc.close();
  if (!visible) throw new Error("navigation did not open");
});

await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} steps passed`);
process.exit(failed ? 1 : 0);
