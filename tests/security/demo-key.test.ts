import { describe, it, expect } from "vitest";
import { demoKeyEnabled } from "@/lib/security/demo-key";

describe("demo approval PIN is never a way to authorise live money", () => {
  it("is on for Sandbox by default and can be switched off", () => {
    expect(demoKeyEnabled({ PAYPAL_ENV: "sandbox" })).toBe(true);
    expect(demoKeyEnabled({})).toBe(true);
    expect(demoKeyEnabled({ DEMO_KEY_DISABLED: "true" })).toBe(false);
  });
  it("is refused whenever PayPal is LIVE, even if nobody remembered to disable it", () => {
    expect(demoKeyEnabled({ PAYPAL_ENV: "live" })).toBe(false);
    expect(demoKeyEnabled({ PAYPAL_ENV: "live", DEMO_KEY_DISABLED: "false" })).toBe(false);
  });
});
