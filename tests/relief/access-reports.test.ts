import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCase } from "@/app/api/recipients/case/route";
import { GET as listReports, POST as postReport } from "@/app/api/recipients/access-report/route";
import { resetAccessReports, resolveCaseRef, residentView, listAccessReports } from "@/lib/relief/access-reports";
import { RELIEF_CASES } from "@/lib/relief/cases";
import { signSession, SESSION_COOKIE, type Role } from "@/lib/auth/session";
import { _resetRateLimitsForTests } from "@/lib/security/rate-limit";

/** Cookie for a session: a resident bound to one household, or an operator role. */
const cookieFor = async (role: Role, hh?: string) => `${SESSION_COOKIE}=${await signSession({ sub: "t", name: "T", role, ...(hh ? { hh } : {}) })}`;
const post = (body: unknown, cookie?: string) =>
  new NextRequest("http://localhost/api/recipients/access-report", { method: "POST", headers: { ...(cookie ? { cookie } : {}), "x-forwarded-for": "7.7.7.7" }, body: JSON.stringify(body) });
const getCaseReq = (ref: string, cookie?: string) =>
  new NextRequest(`http://localhost/api/recipients/case?ref=${encodeURIComponent(ref)}`, { headers: cookie ? { cookie } : {} });

const unclaimed = () => RELIEF_CASES.find((c) => c.status === "UNCLAIMED")!;
const creditedUnconfirmed = () => RELIEF_CASES.find((c) => c.status === "SUCCESS" && !c.stagesReached.CONFIRMED)!;

describe("Resident loop: case lookup and access reports", () => {
  beforeEach(() => {
    resetAccessReports();
    _resetRateLimitsForTests();
  });

  it("resolves a household id, item id or case ref to the same case", () => {
    const c = unclaimed();
    expect(resolveCaseRef(c.householdRef)).toBe(c.caseRef);
    expect(resolveCaseRef(c.itemId)).toBe(c.caseRef);
    expect(resolveCaseRef(c.caseRef)).toBe(c.caseRef);
    expect(resolveCaseRef("hh_nobody")).toBeNull();
  });

  it("GET /case gives a plain-language status, with the claim clock for UNCLAIMED, and 404 for unknown refs", async () => {
    const c = unclaimed();
    const mine = await cookieFor("resident", c.householdRef);
    const res = await getCase(getCaseReq(c.householdRef, mine));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.paypalStatus).toBe("UNCLAIMED");
    expect(j.plainStatus).toContain(`${c.claimDaysLeft} days left`);
    expect((await getCase(getCaseReq("nope", mine))).status).toBe(404);
  });

  it("'I can't access it' is recorded as a resident-reported barrier and does not change PayPal's status", async () => {
    const c = creditedUnconfirmed();
    const res = await postReport(post({ caseRef: c.householdRef, kind: "CANT_ACCESS", reason: "CANT_SIGN_IN" }, await cookieFor("resident", c.householdRef)));
    expect(res.status).toBe(201);
    const view = residentView(c.caseRef)!;
    expect(view.paypalStatus).toBe("SUCCESS"); // provider status untouched
    expect(view.barrier).toBe("CANT_SIGN_IN");
    expect(view.plainStatus).toContain("coordinator will contact you");
    const list = await (await listReports()).json();
    expect(list.reports).toHaveLength(1);
    expect(list.reports[0]).toEqual(expect.objectContaining({ caseRef: c.caseRef, kind: "CANT_ACCESS", reason: "CANT_SIGN_IN" }));
    expect(Object.keys(list.reports[0]).sort()).toEqual(["caseRef", "createdAt", "kind", "reason"]); // no personal details
  });

  it("'I received it' closes the credited case and is labelled resident-reported", async () => {
    const c = creditedUnconfirmed();
    await postReport(post({ caseRef: c.caseRef, kind: "RECEIVED" }, await cookieFor("resident", c.householdRef)));
    expect(residentView(c.caseRef)!.plainStatus).toContain("you confirmed you have it");
  });

  it("validates input: reason required for CANT_ACCESS, unknown refs rejected, bad JSON rejected", async () => {
    const ck = await cookieFor("coordinator");
    expect((await postReport(post({ caseRef: unclaimed().caseRef, kind: "CANT_ACCESS" }, ck))).status).toBe(400);
    expect((await postReport(post({ caseRef: "hh_nobody", kind: "RECEIVED" }, ck))).status).toBe(404);
    expect((await postReport(post({ caseRef: unclaimed().caseRef, kind: "SOMETHING" }, ck))).status).toBe(400);
    const bad = new NextRequest("http://localhost/api/recipients/access-report", { method: "POST", body: "{not json" });
    expect((await postReport(bad)).status).toBe(400);
  });

  it("rate limits a noisy client", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await postReport(post({ caseRef: creditedUnconfirmed().caseRef, kind: "RECEIVED" }, "8.8.8.8"))).status);
    expect(codes.slice(-2)).toEqual([429, 429]);
  });

  it("authorisation: no session, another household, and the read-only viewer are all refused with the same 404/403", async () => {
    const a = unclaimed();
    const other = RELIEF_CASES.find((c) => c.householdRef !== a.householdRef)!;
    // anonymous: no data, no write
    expect((await getCase(getCaseReq(a.householdRef))).status).toBe(404);
    expect((await postReport(post({ caseRef: a.caseRef, kind: "CANT_ACCESS", reason: "OTHER" }))).status).toBe(404);
    // a resident cannot read or write another household — and cannot tell whether it exists
    const mine = await cookieFor("resident", other.householdRef);
    const peek = await getCase(getCaseReq(a.householdRef, mine));
    expect(peek.status).toBe(404);
    expect(await peek.json()).toEqual((await (await getCase(getCaseReq("hh_nobody", mine))).json()));
    expect((await postReport(post({ caseRef: a.caseRef, kind: "CANT_ACCESS", reason: "OTHER" }, mine))).status).toBe(404);
    expect(listAccessReports().length).toBe(0);
    // the read-only viewer can look but not write
    const viewer = await cookieFor("viewer");
    expect((await getCase(getCaseReq(a.householdRef, viewer))).status).toBe(200);
    expect((await postReport(post({ caseRef: a.caseRef, kind: "RECEIVED" }, viewer))).status).toBe(403);
  });
});
