import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/validate/route";
import { _resetRateLimitsForTests } from "@/lib/security/rate-limit";

const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const post = (body: unknown, raw = false) => POST(new NextRequest("http://localhost/api/validate", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: raw ? (body as string) : JSON.stringify(body) }));
const good = { role: "fund_coordinator", orgType: "mutual_aid_fund", problemToday: "We call recipients one by one and keep a spreadsheet.", wouldUse: 4, consent: true };

beforeEach(() => _resetRateLimitsForTests());

run("stakeholder feedback intake", () => {
  it("refuses a response without consent or with bad input, and bad JSON", async () => {
    expect((await post({ ...good, consent: false })).status).toBe(400);
    expect((await post({ ...good, role: "ceo" })).status).toBe(400);
    expect((await post({ ...good, problemToday: "short" })).status).toBe(400);
    expect((await post({ ...good, wouldUse: 9 })).status).toBe(400);
    expect((await post({ ...good, contact: "not-an-email" })).status).toBe(400);
    _resetRateLimitsForTests();
    expect((await post("{nope", true)).status).toBe(400);
  });

  it("stores a consented response and the public GET exposes only the count", async () => {
    const before = (await (await GET()).json()).responses as number;
    const r = await post({ ...good, comments: "Fine.", contact: "someone@example.org" });
    expect(r.status).toBe(201);
    const after = await (await GET()).json();
    expect(after).toEqual({ responses: before + 1 });
    expect(JSON.stringify(after)).not.toMatch(/someone@example/);
  });

  it("rate-limits repeated submissions from one client", async () => {
    let last = 201;
    for (let i = 0; i < 7; i++) last = (await post(good)).status;
    expect(last).toBe(429);
  });
});
