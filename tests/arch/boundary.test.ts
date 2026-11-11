import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const LIB_DIR = path.resolve(__dirname, "../../lib");

function getFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Architectural Boundary Rules (§9)", () => {
  const allLibFiles = getFilesRecursively(LIB_DIR);

  it("Invariant 1: Only lib/treasurer and spike/test scripts import PayPal Payouts", () => {
    const forbiddenImports: string[] = [];

    for (const file of allLibFiles) {
      const relPath = path.relative(LIB_DIR, file);
      // Skip lib/paypal/payouts.ts itself and lib/treasurer/
      if (relPath.startsWith("paypal/payouts") || relPath.startsWith("treasurer/")) {
        continue;
      }

      const content = fs.readFileSync(file, "utf8");
      if (content.includes("@/lib/paypal/payouts") || content.includes("./payouts") || content.includes("../paypal/payouts")) {
        forbiddenImports.push(relPath);
      }
    }

    expect(
      forbiddenImports,
      `Payouts API imported outside lib/treasurer: ${forbiddenImports.join(", ")}`
    ).toEqual([]);
  });

  it("Invariant 2: lib/rules, lib/ledger, lib/treasurer, lib/pledges, and lib/treasury NEVER import any AI SDK", () => {
    const criticalDirs = ["rules", "ledger", "treasurer", "pledges", "treasury"];
    const aiImports: string[] = [];

    for (const file of allLibFiles) {
      const relPath = path.relative(LIB_DIR, file);
      const isCritical = criticalDirs.some((d) => relPath.startsWith(d));
      if (!isCritical) continue;

      const content = fs.readFileSync(file, "utf8");
      if (
        content.includes("@ai-sdk") ||
        content.includes("ai") ||
        content.includes("@google/genai") ||
        content.includes("openai")
      ) {
        // Verify it is an actual import or require of an AI SDK
        const hasAiImport = /import\s+.*from\s+["'](@ai-sdk|ai|@google\/genai|openai)["']/.test(content);
        if (hasAiImport) {
          aiImports.push(relPath);
        }
      }
    }

    expect(
      aiImports,
      `Deterministic core modules must never import AI SDKs: ${aiImports.join(", ")}`
    ).toEqual([]);
  });

  it("Invariant 3: Golden Rule #1 - AI never sets eligibility, priority or amounts", () => {
    // Check that prompt builders and AI provider files don't define payout amounts
    const aiFiles = allLibFiles.filter((f) => path.relative(LIB_DIR, f).startsWith("ai/"));

    for (const file of aiFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toContain("setPayoutAmount");
      expect(content).not.toContain("approvePlan");
    }
  });

  it("Invariant 4: Client-exposed environment variables only use allow-listed NEXT_PUBLIC_*", () => {
    const envFile = path.resolve(__dirname, "../../lib/env.ts");
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf8");
      // Find all NEXT_PUBLIC_ occurrences
      const matches = content.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) || [];
      const allowList = new Set([
        "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
        // AG product licences are browser-embedded by design (they ship in the client bundle), so they are not secrets.
        "NEXT_PUBLIC_AG_STUDIO_LICENSE",
        "NEXT_PUBLIC_AG_GRID_LICENSE",
      ]);

      for (const m of matches) {
        expect(allowList.has(m), `Unapproved public env var: ${m}`).toBe(true);
      }
    }
  });

  it("Invariant 5: Only lib/pledges may invoke Vault-based pledge charging", () => {
    const forbiddenPledgeCallers: string[] = [];

    for (const file of allLibFiles) {
      const relPath = path.relative(LIB_DIR, file);
      if (relPath.startsWith("pledges/")) continue;

      const content = fs.readFileSync(file, "utf8");
      if (
        content.includes("executeVaultOrderCapture") ||
        content.includes("PledgeCallerEngine")
      ) {
        forbiddenPledgeCallers.push(relPath);
      }
    }

    expect(
      forbiddenPledgeCallers,
      `Vault pledge charging functionality imported outside lib/pledges: ${forbiddenPledgeCallers.join(", ")}`
    ).toEqual([]);
  });
});

