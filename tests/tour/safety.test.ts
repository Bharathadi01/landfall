import { describe, it, expect } from "vitest";
import { ALLOWED_CLICKS, mayClick, mayType } from "@/components/tour/safety";
import { CHAPTERS, TOTAL_SECTIONS } from "@/components/tour/steps";

describe("guided tour safety", () => {
  it("allows only the listed read-only controls", () => {
    for (const l of ALLOWED_CLICKS) expect(mayClick(l, { ai: true }).ok, l).toBe(true);
  });

  it("refuses every control that moves money or writes data, whatever the case", () => {
    for (const l of ["Refresh from PayPal", "Refresh warnings", "Replay Hurricane Milton", "Replay Milton 2024", "Replay PayPal feed", "Replay PayPal webhooks", "Propose payout", "Propose payout (needs two approvals)", "Approve", "Pay now as guest", "Create Account & Pay Now", "I can’t get to it", "I received it", "Submit Appeal for Review", "Send", "Sign out", "Continue as Dana", "Cancel and return the funds", "Send a replacement payment", "Donate", "Subscribe", "PAY NOW", "CSV", "Excel"]) {
      expect(mayClick(l, { ai: true }).ok, l).toBe(false);
    }
  });

  it("does not run the live AI unless the judge opted in", () => {
    expect(mayClick("Investigate", { ai: false })).toEqual({ ok: false, reason: "ai_off" });
    expect(mayClick("Ask", { ai: false })).toEqual({ ok: false, reason: "ai_off" });
    expect(mayClick("investigate", { ai: true }).ok).toBe(true);
  });

  it("types only into the listed boxes", () => {
    expect(mayType("Ask about readiness")).toBe(true);
    expect(mayType("6-digit code")).toBe(true);
    expect(mayType("Amount per household (USD)")).toBe(false);
    expect(mayType("Other amount (USD)")).toBe(false);
  });

  it("every click and every typed box in the tour script is allowed", () => {
    for (const c of CHAPTERS) for (const s of c.sections) for (const a of s.actions ?? []) {
      if ("click" in a) expect(mayClick(a.click, { ai: true }).ok, `${c.id}: ${a.click}`).toBe(true);
      if ("type" in a) expect(mayType(a.type.into), `${c.id}: ${a.type.into}`).toBe(true);
    }
  });

  it("a section that calls the AI says what it would do when the AI is switched off", () => {
    for (const c of CHAPTERS) for (const s of c.sections) if (s.ai) expect(s.captionNoAi, `${c.id}`).toBeTruthy();
  });

  it("walks the product in the same order as the console's sidebar", () => {
    const order = CHAPTERS.map((c) => (typeof c.route === "string" ? c.route : "CASE"));
    const want = ["/", "/signin", "/console/war-room", "/console/sentinel", "/console/rehearsal", "/console/golden-flow", "/console/proposals", "/console/recipients", "/console/payments", "CASE", "/console/watch-officer", "/console/studio"];
    let last = -1;
    for (const r of want) { const i = order.indexOf(r); expect(i, r).toBeGreaterThan(last); last = i; }
  });

  it("covers the whole product: every page, unique chapters, and safe routes only", () => {
    const routes = new Set(CHAPTERS.map((c) => (typeof c.route === "string" ? c.route : "CASE")));
    for (const r of ["/", "/signin", "/console/war-room", "/console/payments", "/console/sentinel", "/console/rehearsal", "/console/golden-flow", "/console/studio", "CASE", "/console/watch-officer", "/console/recipients", "/console/proposals", "/r/enroll", "/r/complaints", "/judges"]) expect(routes.has(r), r).toBe(true);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    expect(TOTAL_SECTIONS).toBeGreaterThan(40);
  });
});
