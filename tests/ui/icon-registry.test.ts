import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { I } from "@/components/icons";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("icon registry", () => {
  it("gives every concept its own icon — no two keys share a component", () => {
    const seen = new Map<string, string>();
    for (const [key, Comp] of Object.entries(I)) {
      const id = (Comp as { displayName?: string }).displayName;
      expect(id, `${key} needs a displayName`).toBeTruthy();
      expect(seen.get(id!), `${key} duplicates ${seen.get(id!)} (${id})`).toBeUndefined();
      seen.set(id!, key);
    }
    expect(seen.size).toBe(Object.keys(I).length);
  });

  it("ships the 14 bespoke Landfall glyphs", () => {
    const bespoke = Object.values(I).filter((c) => (c as { displayName?: string }).displayName?.startsWith("Glyph("));
    expect(bespoke).toHaveLength(14);
  });

  it("does not import lucide-react anywhere", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((d) => walk(path.join(process.cwd(), d)))
      .filter((f) => fs.readFileSync(f, "utf8").includes("lucide-react"));
    expect(offenders).toEqual([]);
  });
});
