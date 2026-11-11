import { describe, it, expect } from "vitest";
import { ALLOWED_CLICKS, mayClick } from "@/components/tour/safety";
import { STEPS } from "@/components/tour/steps";

describe("guided tour safety", () => {
  it("allows only the listed read-only controls", () => {
    for (const l of ALLOWED_CLICKS) expect(mayClick(l, { ai: true }).ok).toBe(true);
  });

  it("refuses every control that moves money or writes data, whatever the case", () => {
    for (const l of ["Refresh from PayPal", "Refresh warnings", "Replay Hurricane Milton", "Propose payout (needs two approvals)", "Approve", "Pay now as guest", "Create Account & Pay Now", "I can’t get to it", "I received it", "Submit Appeal", "Send", "Enroll Household", "Sign out", "Continue as Dana", "Cancel and return the funds", "Send a replacement payment", "Donate", "Subscribe", "PAY NOW"]) {
      expect(mayClick(l, { ai: true }).ok, l).toBe(false);
    }
  });

  it("does not click the live AI buttons unless the judge opted in", () => {
    expect(mayClick("Investigate", { ai: false })).toEqual({ ok: false, reason: "ai_off" });
    expect(mayClick("Run the Watch Officer", { ai: false })).toEqual({ ok: false, reason: "ai_off" });
    expect(mayClick("investigate", { ai: true }).ok).toBe(true);
  });

  it("every click in the tour script is on the allow-list", () => {
    for (const s of STEPS) for (const a of s.actions ?? []) if ("click" in a) expect(mayClick(a.click, { ai: true }).ok, `${s.id}: ${a.click}`).toBe(true);
  });

  it("the tour script never targets an unsafe route", () => {
    for (const s of STEPS) if (typeof s.route === "string") expect(s.route).toMatch(/^\/(console\/(war-room|sentinel|golden-flow|watch-officer|proposals)|r\/enroll|judges)?$/);
  });
});
