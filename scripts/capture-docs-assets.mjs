/**
 * Captures the README / documentation screenshots from a RUNNING Landfall.
 *
 *   node scripts/capture-docs-assets.mjs --base https://landfall-web-t5rw.onrender.com --group prod
 *   node scripts/capture-docs-assets.mjs --base http://localhost:3300 --group local
 *
 * It is deliberately read-only toward the target:
 *   - it signs in as the read-only "Judge" demo persona (a cookie; nothing is stored server-side),
 *   - it only loads pages and presses view controls (tabs, filters). It never submits a form, never presses
 *     "Refresh from PayPal", never proposes or approves anything, and never presses a PayPal button.
 *   - group "prod":  pages that only READ (plus the Guided Response rehearsal, which the code proves makes no PayPal
 *                    call and persists nothing: lib/workflow/golden.ts).
 *   - group "local": pages that need data a production database must never be seeded with. Run it ONLY against a
 *                    local build that points at a disposable database (docs/DEVELOPMENT.md). It enrols two clearly
 *                    synthetic households and runs the AI Case Officer on a replay case.
 *
 * Output: docs/assets/screenshots/<name>.png (1440x900 unless a shot sets its own height).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const GROUP = arg("group", "prod");
const OUT = path.resolve(arg("out", "docs/assets/screenshots"));
const ONLY = arg("only", "")?.split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { sessionStorage.setItem("landfall.tour.ai", "0"); } catch {} });
const signIn = await ctx.request.post(`${BASE}/api/auth/session`, { data: { persona: "judge-viewer" } });
if (!signIn.ok()) throw new Error(`Judge sign-in failed (${signIn.status()}). Is JUDGE_MODE_ENABLED on?`);
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message.slice(0, 120)));

const caseRoute = async () => {
  const j = await (await ctx.request.get(`${BASE}/api/cases`)).json();
  const c = j.cases?.find((x) => x.status === "UNCLAIMED") ?? j.cases?.[0];
  if (!c) throw new Error("No case to open");
  return `/console/cases/${encodeURIComponent(c.caseRef)}`;
};

/** shot: { file, path|route(), ready (css), settle (ms), height, act(page), element (css) } */
const SHOTS = {
  prod: [
    { file: "landing-page", path: "/", ready: "canvas", settle: 9000 },
    { file: "command-center", path: "/console/war-room", ready: "[data-testid=response-path]", settle: 4000 },
    { file: "sentinel-storm-atlas", path: "/console/sentinel", ready: "section[aria-label='Live weather globe'] canvas", settle: 16000 },
    { file: "storm-drill", path: "/console/rehearsal", ready: "#scen-h", settle: 2500 },
    {
      file: "guided-response", path: "/console/golden-flow", ready: "h1", settle: 1500,
      act: async (p) => { await p.getByRole("button", { name: "Rehearse all 8 steps" }).click(); await p.getByText("8 of 8 complete").waitFor({ timeout: 40000 }); await p.waitForTimeout(1500); },
    },
    { file: "paypal-financial-operations", path: "/console/payments", ready: ".ag-row", settle: 5000 },
    { file: "payout-evidence", route: caseRoute, ready: "[data-testid=case-officer]", settle: 3000, height: 1100 },
    {
      file: "payout-reconciliation", path: "/console/payments", ready: ".ag-row", settle: 1500, height: 1100,
      act: async (p) => { await p.getByRole("tab", { name: "Money trail" }).click(); await p.waitForTimeout(3500); },
    },
    { file: "ai-watch-officer", path: "/console/watch-officer", ready: "[data-testid=wo-answer]", settle: 4000, height: 1200 },
    { file: "approvals", path: "/console/proposals", ready: "#queue-h", settle: 3500, height: 1000 },
    { file: "analytics-studio", path: "/console/studio", ready: ".ag-root-wrapper", settle: 6000 },
    { file: "resident-portal", path: "/r/enroll", ready: "h1", settle: 2500 },
    {
      file: "public-donation", path: "/", ready: "#give", settle: 1000, element: "#paypal",
      act: async (p) => { await p.locator("#paypal").scrollIntoViewIfNeeded(); await p.waitForFunction(() => [...document.querySelectorAll("iframe")].some((f) => /paypal/.test(f.src || f.name || "")), null, { timeout: 40000 }); await p.waitForTimeout(4000); },
    },
  ],
  local: [
    {
      file: "recipient-management", path: "/console/recipients", ready: "[role=tablist]", settle: 1000, height: 820,
      prep: async () => {
        const households = [
          { name: "Synthetic Household A", address: "100 Example Street, Tampa, FL", lat: 27.9506, lng: -82.4572, zone: "Zone A", evidenceLevel: "DOCUMENT_PROVIDED", documentSnippet: "synthetic utility bill", hasMedicalDevice: true, numMembers: 3, consentAccepted: true, paymentChannel: "EMAIL", paypalEmailOrId: "synthetic-a@example.invalid", language: "en" },
          { name: "Synthetic Household B", address: "200 Example Avenue, St. Petersburg, FL", lat: 27.7676, lng: -82.6403, zone: "Zone B", evidenceLevel: "SELF_DECLARED", isElderlyLivingAlone: true, numMembers: 1, consentAccepted: true, paymentChannel: "MANUAL", language: "es" },
          { name: "Synthetic Household C", address: "300 Example Road, Clearwater, FL", lat: 27.9659, lng: -82.8001, zone: "Zone A", evidenceLevel: "VOLUNTEER_ATTESTATION", assistedByVolunteerId: "volunteer_synthetic_1", volunteerAttestationNote: "synthetic attestation", isDisplaced: true, currentAddress: "Shelter, Example County", currentLat: 28.0, currentLng: -82.4, numMembers: 4, consentAccepted: true, paymentChannel: "UNSET", language: "vi" },
        ];
        for (const h of households) {
          const r = await ctx.request.post(`${BASE}/api/recipients/enroll`, { data: h });
          if (!r.ok()) throw new Error(`enrol failed ${r.status()}: ${(await r.text()).slice(0, 200)}`);
        }
      },
      act: async (p) => { await p.getByTestId("household-grid").waitFor({ timeout: 30000 }); await p.waitForSelector(".ag-row", { timeout: 30000 }); await p.waitForTimeout(1500); },
    },
    {
      file: "ai-case-officer", route: async () => { const j = await (await ctx.request.get(`${BASE}/api/cases?source=replay`)).json(); const c = j.cases.find((x) => x.status === "UNCLAIMED") ?? j.cases[0]; return `/console/cases/${encodeURIComponent(c.caseRef)}`; },
      ready: "[data-testid=case-officer]", settle: 1500, height: 1850,
      act: async (p) => { await p.getByRole("tab", { name: /Milton replay/ }).first().click().catch(() => {}); await p.getByTestId("investigate").click(); await p.getByText("What the evidence shows").waitFor({ timeout: 90000 }); await p.waitForTimeout(2500); },
    },
  ],
};

let failed = 0;
for (const s of SHOTS[GROUP] ?? []) {
  if (ONLY.length && !ONLY.includes(s.file)) continue;
  try {
    if (s.prep) await s.prep();
    const route = s.route ? await s.route() : s.path;
    await page.setViewportSize({ width: 1440, height: s.height ?? 900 });
    await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
    if (s.ready) await page.waitForSelector(s.ready, { timeout: 60000 });
    if (s.settle) await page.waitForTimeout(s.settle);
    if (s.act) await s.act(page);
    const dest = path.join(OUT, `${s.file}.png`);
    if (s.element) await page.locator(s.element).screenshot({ path: dest });
    else await page.screenshot({ path: dest });
    console.log("captured", s.file, `${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed++;
    console.error("FAILED", s.file, String(e).slice(0, 200));
  }
}
if (problems.length) console.log("page errors seen:", [...new Set(problems)].slice(0, 5));
await browser.close();
process.exit(failed ? 1 : 0);
