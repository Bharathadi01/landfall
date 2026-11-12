/**
 * Documentation checker. Read-only: it never writes, never calls PayPal, Groq or the app.
 *
 *   node scripts/check-docs.mjs                      # checks the current documentation set
 *   node scripts/check-docs.mjs docs/FOO.md README.md  # or the files you name
 *   node scripts/check-docs.mjs --no-mermaid         # skip the Mermaid syntax check (it loads mermaid from a CDN in a headless browser)
 *
 * It checks, for each Markdown file:
 *   1. every relative link points to a file or folder that exists;
 *   2. every `#anchor` (same file or another Markdown file) matches a heading, using GitHub's slug rules;
 *   3. every image path exists (and reports files over 1 MB so a large asset is noticed);
 *   4. every ```mermaid block parses with the real Mermaid parser.
 * External http(s) links are listed but not fetched. Exit code 1 if anything fails.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const SKIP_MERMAID = args.includes("--no-mermaid");
const named = args.filter((a) => !a.startsWith("--"));

const CURRENT = [
  "README.md", "SECURITY.md", "CONTRIBUTING.md",
  "docs/README.md", "docs/PRODUCT_OVERVIEW.md", "docs/USER_JOURNEYS.md", "docs/LIMITATIONS.md", "docs/ROADMAP.md",
  "docs/DATA_PROVENANCE.md", "docs/ARCHITECTURE.md", "docs/FINANCIAL_LEDGER.md", "docs/PAYPAL_INTEGRATION.md",
  "docs/AI_ARCHITECTURE.md", "docs/DATA_MODEL.md", "docs/API.md", "docs/THREAT_MODEL.md", "docs/TESTING.md",
  "docs/DEVELOPMENT.md", "docs/DEPLOYMENT.md",
];
const files = (named.length ? named : CURRENT).filter((f) => fs.existsSync(path.join(root, f)));

/** GitHub heading slug: lower-case, drop everything except letters, digits, spaces, hyphens and underscores, spaces to hyphens. */
function slug(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, (c) => (c === "_" ? "_" : ""))
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}
const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set();
  const seen = new Map();
  let inFence = false;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    let s = slug(m[2].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
    const n = seen.get(s) ?? 0;
    seen.set(s, n + 1);
    set.add(n === 0 ? s : `${s}-${n}`);
  }
  anchorCache.set(file, set);
  return set;
}

const problems = [];
const externals = new Set();
let linkCount = 0, imageCount = 0, mermaidBlocks = [];

for (const rel of files) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  let inFence = false, fenceLang = "", buf = [], start = 0;
  lines.forEach((line, i) => {
    const f = line.match(/^\s*```(\w*)/);
    if (f) {
      if (!inFence) { inFence = true; fenceLang = f[1]; buf = []; start = i + 1; }
      else { if (fenceLang === "mermaid") mermaidBlocks.push({ rel, line: start, code: buf.join("\n") }); inFence = false; }
      return;
    }
    if (inFence) { buf.push(line); return; }
    const noCode = line.replace(/`[^`]*`/g, "");
    // markdown links and images:  ![alt](target)  [text](target)
    for (const m of noCode.matchAll(/(!?)\[(?:[^\]\[]|\[[^\]]*\])*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const isImage = m[1] === "!";
      if (isImage) continue; // images (including those nested inside links) are handled in the image pass below
      const target = m[2];
      if (/^(https?:|mailto:)/i.test(target)) { externals.add(target); continue; }
      linkCount++;
      const [p0, hash] = target.split("#");
      const targetFile = p0 === "" ? file : path.resolve(path.dirname(file), decodeURIComponent(p0));
      if (!fs.existsSync(targetFile)) { problems.push(`${rel}:${i + 1}  missing target  ${target}`); continue; }
      if (hash && fs.statSync(targetFile).isFile() && targetFile.endsWith(".md")) {
        if (!anchorsOf(targetFile).has(hash.toLowerCase())) problems.push(`${rel}:${i + 1}  anchor not found  ${target}`);
      }
    }
    // markdown images, including ones nested inside a link:  [![alt](img)](target)
    for (const m of noCode.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^https?:/i.test(target)) { externals.add(target); continue; }
      imageCount++;
      const abs = path.resolve(path.dirname(file), decodeURIComponent(target.split("#")[0]));
      if (!fs.existsSync(abs)) { problems.push(`${rel}:${i + 1}  missing image  ${target}`); continue; }
      const size = fs.statSync(abs).size;
      if (size > 1_000_000) problems.push(`${rel}:${i + 1}  image over 1 MB (${(size / 1e6).toFixed(2)} MB)  ${target}  (informational)`);
    }
    // inline HTML images
    for (const m of noCode.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      if (/^https?:/i.test(m[1])) { externals.add(m[1]); continue; }
      imageCount++;
      if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) problems.push(`${rel}:${i + 1}  missing image  ${m[1]}`);
    }
  });
}

let mermaidOk = 0;
if (!SKIP_MERMAID && mermaidBlocks.length) {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { problems.push("playwright is not installed: cannot check Mermaid (use --no-mermaid)"); }
  if (chromium) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent("<html><body></body></html>");
    await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js" });
    await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false }));
    for (const b of mermaidBlocks) {
      const res = await page.evaluate(async (code) => {
        try { await window.mermaid.parse(code); return null; } catch (e) { return String(e && e.message ? e.message : e).split("\n")[0]; }
      }, b.code);
      if (res) problems.push(`${b.rel}:${b.line}  mermaid does not parse  ${res}`);
      else mermaidOk++;
    }
    await browser.close();
  }
}

console.log(`files checked: ${files.length}`);
console.log(`relative links: ${linkCount} (images: ${imageCount})   external links (not fetched): ${externals.size}`);
console.log(`mermaid blocks: ${mermaidBlocks.length}${SKIP_MERMAID ? " (skipped)" : `, parsed OK: ${mermaidOk}`}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(problems.every((p) => p.endsWith("(informational)")) ? 0 : 1);
}
console.log("\nOK: no broken relative links, anchors, images or Mermaid diagrams.");
