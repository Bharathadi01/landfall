import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCase } from "@/app/api/recipients/case/route";
import { GET as listReports, POST as postReport } from "@/app/api/recipients/access-report/route";
import { resetAccessReports, resolveCaseRef, residentView } from "@/lib/relief/access-reports";
import { RELIEF_CASES } from "@/lib/relief/cases";

const post = (body: unknown, ip = "7.7.7.7") =>
  new NextRequest("http://localhost/api/recipients/access-report", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) });

const unclaimed = () => RELIEF_CASES.find((c) => c.status === "UNCLAIMED")!;
const creditedUnconfirmed = () => RELIEF_CASES.find((c) => c.status === "SUCCESS" && !c.stagesReached.CONFIRMED)!;

describe("Resident loop: case lookup and access reports", () => {
  beforeEach(() => resetAccessReports());

  it("resolves a household id, item id or case ref to the same case", () => {
    const c = unclaimed();
    expect(resolveCaseRef(c.householdRef)).toBe(c.caseRef);
    expect(resolveCaseRef(c.itemId)).toBe(c.caseRef);
    expect(resolveCaseRef(c.caseRef)).toBe(c.caseRef);
    expect(resolveCaseRef("hh_nobody")).toBeNull();
  });

  it("GET /case gives a plain-language status, with the claim clock for UNCLAIMED, and 404 for unknown refs", async () => {
    const c = unclaimed();
    const res = await getCase(new NextRequest(`http://localhost/api/recipients/case?ref=${c.householdRef}`));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.paypalStatus).toBe("UNCLAIMED");
    expect(j.plainStatus).toContain(`${c.claimDaysLeft} days left`);
    expect((await getCase(new NextRequest("http://localhost/api/recipients/case?ref=nope"))).status).toBe(404);
  });

  it("'I can't access it' is recorded as a resident-reported barrier and does not change PayPal's status", async () => {
    const c = creditedUnconfirmed();
    const res = await postReport(post({ caseRef: c.householdRef, kind: "CANT_ACCESS", reason: "CANT_SIGN_IN" }));
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
    await postReport(post({ caseRef: c.caseRef, kind: "RECEIVED" }));
    expect(residentView(c.caseRef)!.plainStatus).toContain("you confirmed you have it");
  });

  it("validates input: reason required for CANT_ACCESS, unknown refs rejected, bad JSON rejected", async () => {
    expect((await postReport(post({ caseRef: unclaimed().caseRef, kind: "CANT_ACCESS" }))).status).toBe(400);
    expect((await postReport(post({ caseRef: "hh_nobody", kind: "RECEIVED" }))).status).toBe(404);
    expect((await postReport(post({ caseRef: unclaimed().caseRef, kind: "SOMETHING" }))).status).toBe(400);
    const bad = new NextRequest("http://localhost/api/recipients/access-report", { method: "POST", body: "{not json" });
    expect((await postReport(bad)).status).toBe(400);
  });

  it("rate limits a noisy client", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await postReport(post({ caseRef: creditedUnconfirmed().caseRef, kind: "RECEIVED" }, "8.8.8.8"))).status);
    expect(codes.slice(-2)).toEqual([429, 429]);
  });
});
