import { describe, it, expect } from "vitest";
import { recoveryOptionsForCase, FINAL_CLAIM_DAYS } from "@/lib/recovery/decision";

const opt = (c: Parameters<typeof recoveryOptionsForCase>[0]) => Object.fromEntries(recoveryOptionsForCase(c).map((o) => [o.kind, o]));

describe("recovery options (deterministic gate for money-moving proposals)", () => {
  it("never allows a replacement payment while the original could still land", () => {
    for (const status of ["SUCCESS", "PENDING", "UNCLAIMED", "ONHOLD", "BLOCKED", "SUBMITTED", "WEIRD", ""]) {
      const o = opt({ status, claimDaysLeft: 20 });
      expect(o.REISSUE.allowed, status).toBe(false);
      expect(o.REISSUE.reason.length).toBeGreaterThan(10);
    }
  });
  it("allows a replacement only from RETURNED, FAILED or CANCELED", () => {
    for (const status of ["RETURNED", "FAILED", "CANCELED"]) expect(opt({ status, claimDaysLeft: null }).REISSUE.allowed, status).toBe(true);
  });
  it("cancel is only ever possible for UNCLAIMED items", () => {
    for (const status of ["SUCCESS", "PENDING", "FAILED", "RETURNED", "ONHOLD", "BLOCKED", "REFUNDED", "REVERSED", "WEIRD"]) {
      expect(opt({ status, claimDaysLeft: 1, barrier: "NO_PAYPAL_ACCOUNT" }).CANCEL_ITEM.allowed, status).toBe(false);
    }
  });
  it("an UNCLAIMED item with days left and no barrier cannot be cancelled: help them claim it", () => {
    const o = opt({ status: "UNCLAIMED", claimDaysLeft: 26 });
    expect(o.CANCEL_ITEM.allowed).toBe(false);
    expect(o.CANCEL_ITEM.reason).toMatch(/Help the resident claim it/);
  });
  it("a barrier that makes claiming unrealistic opens the cancel option; a language barrier alone does not", () => {
    for (const barrier of ["NO_PAYPAL_ACCOUNT", "CANT_SIGN_IN", "NO_PHONE"]) expect(opt({ status: "UNCLAIMED", claimDaysLeft: 26, barrier }).CANCEL_ITEM.allowed, barrier).toBe(true);
    for (const barrier of ["LANGUAGE", "OTHER"]) expect(opt({ status: "UNCLAIMED", claimDaysLeft: 26, barrier }).CANCEL_ITEM.allowed, barrier).toBe(false);
  });
  it("the final days of the claim window open the cancel option", () => {
    expect(opt({ status: "UNCLAIMED", claimDaysLeft: FINAL_CLAIM_DAYS }).CANCEL_ITEM.allowed).toBe(true);
    expect(opt({ status: "UNCLAIMED", claimDaysLeft: FINAL_CLAIM_DAYS + 1 }).CANCEL_ITEM.allowed).toBe(false);
  });
  it("never cancels money a resident says they received", () => {
    const o = opt({ status: "UNCLAIMED", claimDaysLeft: 1, barrier: "NO_PAYPAL_ACCOUNT", reportedReceived: true });
    expect(o.CANCEL_ITEM.allowed).toBe(false);
  });
});
