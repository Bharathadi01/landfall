/**
 * Layout audit of every page and tab, in a real browser. Finds what screenshots show by eye:
 *   overlap   two text/icon elements drawn on top of each other
 *   spill     text that sticks out of the card/box that contains it
 *   clip      text cut off with an ellipsis or hidden overflow
 *   narrow    text squeezed into a column so thin it wraps letter by letter
 *   hscroll   the page scrolls sideways
 *   tiny      a clickable thing smaller than 24 px
 * usage: node scripts/ux-audit.mjs <baseUrl> [outJson] [--mobile]
 */
import { chromium } from "playwright";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : null;
const MOBILE = process.argv.includes("--mobile");
const vp = MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const PAGES = [
  { name: "landing", path: "/", public: true },
  { name: "judges", path: "/judges", public: true },
  { name: "signin", path: "/signin", public: true },
  { name: "validate", path: "/validate", public: true },
  { name: "resident-enroll", path: "/r/enroll", public: true },
  { name: "resident-complaints", path: "/r/complaints", public: true },
  { name: "command-center", path: "/console/war-room" },
  { name: "payments", path: "/console/payments" },
  { name: "payments-trail", path: "/console/payments", tab: "Money trail" },
  { name: "studio", path: "/console/studio" },
  { name: "studio-treasury", path: "/console/studio", tab: "Treasury & reserve" },
  { name: "studio-recovery", path: "/console/studio", tab: "Payout recovery" },
  { name: "studio-accountability", path: "/console/studio", tab: "Accountability" },
  { name: "guided", path: "/console/golden-flow" },
  { name: "storm-desk", path: "/console/sentinel", wait: 7000 },
  { name: "storm-drill", path: "/console/rehearsal" },
  { name: "watch-officer", path: "/console/watch-officer" },
  { name: "households", path: "/console/recipients" },
  { name: "households-appeals", path: "/console/recipients", tab: "Appeals Queue" },
  { name: "approvals", path: "/console/proposals" },
  { name: "case-detail", path: "CASE" },
];

const probe = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const label = (el) => { const t = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.tagName).replace(/\s+/g, " ").trim().slice(0, 38); return `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean)[0] : ""} “${t}”`; };
  const issues = [];
  const add = (type, a, extra) => { if (issues.length < 400) issues.push({ type, el: label(a), ...extra }); };
  const all = [...document.body.querySelectorAll("*")].filter((e) => !e.closest("[data-tour-ui]") && !e.closest("canvas") && !e.closest(".ag-chart, .ag-charts-canvas") && vis(e));
  const hasOwnText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 0);
  const textEls = all.filter((e) => hasOwnText(e) && !["SCRIPT", "STYLE", "OPTION"].includes(e.tagName));
  const icons = all.filter((e) => e.tagName === "svg" && e.getBoundingClientRect().width < 40 && e.getBoundingClientRect().width > 6);
  const fields = all.filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName));
  const inScrollClip = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY) && p !== document.body && p !== document.documentElement) { const r = p.getBoundingClientRect(), q = e.getBoundingClientRect(); if (q.right > r.right + 1 || q.left < r.left - 1 || q.bottom > r.bottom + 1 || q.top < r.top - 1) return true; } } return false; };

  // hscroll
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push({ type: "hscroll", el: "document", w: document.documentElement.scrollWidth });
  // clip + narrow + spill
  for (const e of textEls) {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (/(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && cs.textOverflow === "ellipsis" && !e.closest(".ag-cell, .ag-header-cell, .ag-pivot")) add("clip", e, { w: Math.round(e.clientWidth), need: e.scrollWidth });
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; const lines = r.height / lh;
    if (lines >= 4 && r.width < 80 && (e.innerText || "").trim().length < 40 && !e.closest("[class*=ag-]")) add("narrow", e, { w: Math.round(r.width), lines: Math.round(lines) });
    const p = e.parentElement; if (p && p !== document.body) { const pr = p.getBoundingClientRect(); const pcs = getComputedStyle(p); const boxy = pcs.borderTopWidth !== "0px" || pcs.backgroundColor !== "rgba(0, 0, 0, 0)" || pcs.boxShadow !== "none"; if (boxy && pcs.overflowX === "visible" && (r.right > pr.right + 3 || r.left < pr.left - 3) && r.width < pr.width * 2) add("spill", e, { by: Math.round(Math.max(r.right - pr.right, pr.left - r.left)) }); }
  }
  // AG grid cells / headers: truncated or letter-wrapped
  for (const e of document.querySelectorAll(".ag-header-cell-text")) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(e).lineHeight) || 16; if (r.height / lh >= 3) add("narrow", e, { w: Math.round(r.width), lines: Math.round(r.height / lh), grid: "header" }); if (e.scrollWidth > e.clientWidth + 2) add("clip", e, { w: Math.round(e.clientWidth), need: e.scrollWidth, grid: "header" }); }
  const clippedCells = [...document.querySelectorAll(".ag-cell-value, .ag-cell")].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 2 && !inScrollClip(e));
  if (clippedCells.length) issues.push({ type: "clip", el: `${clippedCells.length} grid cells truncated`, sample: clippedCells.slice(0, 3).map((c) => (c.innerText || "").trim().slice(0, 24)).join(" | ") });
  // overlap: text/icon vs text/icon/field that are not ancestor/descendant
  const boxes = [...textEls, ...icons, ...fields].map((e) => ({ e, r: e.getBoundingClientRect() }));
  let ov = 0;
  for (let i = 0; i < boxes.length && ov < 60; i++) for (let j = i + 1; j < boxes.length && ov < 60; j++) {
    const a = boxes[i], b = boxes[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    if (a.e.closest(".ag-header") && b.e.closest(".ag-header")) { /* header cells legitimately adjoin */ }
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 3 && y > 3) { const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height); if (x * y > small * 0.2) { if (inScrollClip(a.e) || inScrollClip(b.e)) continue; ov++; add("overlap", a.e, { with: label(b.e), px: `${Math.round(x)}x${Math.round(y)}` }); } }
  }
  // tiny controls
  for (const e of all.filter((e) => e.matches("button,a[href],[role=tab],[role=button],input,select"))) { const r = e.getBoundingClientRect(); if ((r.width < 24 || r.height < 24) && !e.closest(".ag-root") && e.type !== "checkbox" && e.type !== "radio") add("tiny", e, { size: `${Math.round(r.width)}x${Math.round(r.height)}` }); }
  return issues;
};

const b = await chromium.launch({ channel: "chromium", args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const results = {};
for (const mode of ["live", "replay"]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.request.post(base + "/api/auth/session", { data: { persona: "judge-viewer" } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("landfall.tour.ai", "0"); } catch {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 120)));
  p.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(base)) errs.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  for (const pg of PAGES) {
    if (mode === "replay" && pg.public) continue;
    let path = pg.path;
    if (path === "CASE") { const cs = await (await ctx.request.get(base + "/api/cases")).json(); const c = cs.cases?.find((x) => x.status === "UNCLAIMED") ?? cs.cases?.[0]; if (!c) continue; path = "/console/cases/" + encodeURIComponent(c.caseRef); }
    errs.length = 0;
    await p.goto(base + path, { waitUntil: "load", timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(pg.wait ?? 2500);
    if (mode === "replay") { await p.getByRole("tab", { name: /Milton replay/ }).first().click().catch(() => {}); await p.waitForTimeout(2500); }
    if (pg.tab) { const t = p.getByRole("tab", { name: pg.tab, exact: true }).first(); if (await t.count()) await t.click().catch(() => {}); else await p.getByText(pg.tab, { exact: true }).first().click().catch(() => {}); await p.waitForTimeout(2500); }
    const key = `${mode}:${pg.name}`;
    const issues = await p.evaluate(probe).catch((e) => [{ type: "audit-error", el: String(e).slice(0, 100) }]);
    results[key] = { issues, errors: [...errs] };
    await p.screenshot({ path: `${process.env.UX_SHOTS ?? "/tmp"}/${MOBILE ? "m-" : "d-"}${mode}-${pg.name}.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}
await b.close();
const summary = Object.entries(results).map(([k, v]) => { const c = {}; for (const i of v.issues) c[i.type] = (c[i.type] ?? 0) + 1; return `${k.padEnd(34)} ${Object.entries(c).map(([t, n]) => `${t}:${n}`).join(" ") || "clean"}${v.errors.length ? "  ERRORS:" + v.errors.length : ""}`; });
console.log(summary.join("\n"));
if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
