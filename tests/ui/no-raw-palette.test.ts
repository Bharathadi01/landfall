import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAW =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|placeholder|shadow|decoration|outline|accent|caret)-(?:slate|gray|zinc|neutral|stone|emerald|green|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("design tokens only", () => {
  it("uses no raw Tailwind palette classes in app/ or components/ — colour comes from meaning tokens", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const f of walk(path.join(process.cwd(), dir))) {
        const lines = fs.readFileSync(f, "utf8").split("\n");
        lines.forEach((l, i) => {
          if (RAW.test(l)) offenders.push(`${path.relative(process.cwd(), f)}:${i + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
