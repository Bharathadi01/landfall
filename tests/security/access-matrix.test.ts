import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { resolveApiRule, roleAllowed, API_RULES } from "@/lib/auth/policy";
import { signSession, SESSION_COOKIE, type Role } from "@/lib/auth/session";

const API_DIR = path.join(process.cwd(), "app/api");

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === "route.ts" ? [p] : [];
  });
}
const toPath = (file: string) => "/api/" + path.relative(API_DIR, path.dirname(file)).split(path.sep).map((seg) => (seg.startsWith("[") ? "abc123" : seg)).join("/");

describe("every API route has an explicit access rule (default deny can't be forgotten)", () => {
  const files = routeFiles(API_DIR);
  it("finds the routes", () => expect(files.length).toBeGreaterThan(30));

  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const methods = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    for (const m of methods) {
      it(`${m} ${toPath(f)} has a rule`, () => {
        expect(resolveApiRule(toPath(f), m), `no access rule for ${m} ${toPath(f)} — add one to lib/auth/policy.ts`).not.toBeNull();
      });
    }
  }

  it("every rule has a note explaining why it is open or restricted", () => {
    for (const r of API_RULES) expect(r.note.length).toBeGreaterThan(5);
  });
});

describe("sensitive routes are never public", () => {
  const mustNotBePublic: Array<[string, string]> = [
    ["GET", "/api/recipients"], ["GET", "/api/recipients/complaints"], ["GET", "/api/recipients/appeal"], ["GET", "/api/recipients/access-report"],
    ["GET", "/api/recipients/case"], ["POST", "/api/recipients/access-report"], ["POST", "/api/payouts/refresh"], ["GET", "/api/payouts"],
    ["POST", "/api/watch-officer"], ["GET", "/api/watch-officer"], ["POST", "/api/studio-llm"], ["GET", "/api/treasury/reconcile"], ["POST", "/api/treasury/reconcile"],
    ["GET", "/api/treasury/waterfall"], ["POST", "/api/workflow/golden"], ["POST", "/api/alerts/replay"], ["POST", "/api/rehearsal"],
  ];
  for (const [m, p] of mustNotBePublic) {
    it(`${m} ${p} requires a session`, () => {
      const rule = resolveApiRule(p, m)!;
      expect(rule).not.toBeNull();
      expect(["public", "webhook"]).not.toContain(rule.access);
      expect(roleAllowed(rule.access, null)).toBe(false);
    });
  }
  it("money movement is staff-only: a viewer can never propose or approve", () => {
    for (const p of ["/api/proposals", "/api/proposals/abc/approve", "/api/payouts/refresh"]) {
      const rule = resolveApiRule(p, "POST")!;
      expect(rule.access).toBe("staff");
    }
  });
});

const SECRET = "unit-test-secret-0123456789abcdef";
process.env.SESSION_SECRET = SECRET;
async function req(url: string, method = "GET", role?: Role, headers: Record<string, string> = {}) {
  const h = new Headers({ host: "localhost:3000", ...headers });
  if (role) h.set("cookie", `${SESSION_COOKIE}=${await signSession({ sub: "t", name: "T", role, ...(role === "resident" ? { hh: "hh_tbw_002" } : {}) }, { secret: SECRET })}`);
  return new NextRequest(`http://localhost:3000${url}`, { method, headers: h });
}

describe("middleware enforcement", () => {
  it("redirects unauthenticated console visits to /signin and keeps the destination", async () => {
    const res = await middleware(await req("/console/war-room"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/signin?next=%2Fconsole%2Fwar-room");
  });
  it("lets operators into the console but not residents", async () => {
    expect((await middleware(await req("/console/war-room", "GET", "coordinator"))).headers.get("location")).toBeNull();
    expect((await middleware(await req("/console/war-room", "GET", "resident"))).status).toBe(307);
  });
  it("unknown API paths are denied by default", async () => {
    const res = await middleware(await req("/api/definitely-not-a-route", "GET", "finance"));
    expect(res.status).toBe(403);
  });
  it("401 without a session, 403 with the wrong role, pass with the right one", async () => {
    expect((await middleware(await req("/api/payouts/refresh", "POST", undefined, { "content-type": "application/json" }))).status).toBe(401);
    expect((await middleware(await req("/api/payouts/refresh", "POST", "viewer"))).status).toBe(403);
    expect((await middleware(await req("/api/payouts/refresh", "POST", "coordinator"))).status).toBe(200);
  });
  it("residents cannot reach operator data", async () => {
    for (const p of ["/api/recipients", "/api/payouts", "/api/treasury/waterfall", "/api/watch-officer"]) {
      expect((await middleware(await req(p, "GET", "resident"))).status, p).toBe(403);
    }
    expect((await middleware(await req("/api/recipients/case?ref=hh_tbw_002", "GET", "resident"))).status).toBe(200);
  });
  it("public endpoints stay public (webhook, sign-in, weather, donor checkout)", async () => {
    for (const [p, m] of [["/api/paypal/webhook", "POST"], ["/api/auth/session", "POST"], ["/api/sentinel/live", "GET"], ["/api/donations/orders", "POST"]] as const) {
      expect((await middleware(await req(p, m))).status, p).toBe(200);
    }
  });
  it("blocks cross-site state-changing requests that carry a session cookie", async () => {
    const evil = await middleware(await req("/api/payouts/refresh", "POST", "coordinator", { origin: "https://evil.example" }));
    expect(evil.status).toBe(403);
    const ok = await middleware(await req("/api/payouts/refresh", "POST", "coordinator", { origin: "http://localhost:3000" }));
    expect(ok.status).toBe(200);
  });
  it("a forged cookie is treated as no session", async () => {
    const h = new Headers({ host: "localhost:3000", cookie: `${SESSION_COOKIE}=eyJyb2xlIjoiZmluYW5jZSJ9.AAAA` });
    const res = await middleware(new NextRequest("http://localhost:3000/api/payouts", { headers: h }));
    expect(res.status).toBe(401);
  });
});
