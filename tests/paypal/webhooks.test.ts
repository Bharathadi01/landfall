import { describe, it, expect } from "vitest";
import { shouldUpdatePayoutStatus, PAYOUT_STATUS_PRECEDENCE } from "@/lib/paypal/webhooks";

describe("PayPal Webhook Status Precedence", () => {
  it("allows upgrading from PENDING to PROCESSING to SUCCESS", () => {
    expect(shouldUpdatePayoutStatus("PENDING", "PROCESSING")).toBe(true);
    expect(shouldUpdatePayoutStatus("PROCESSING", "SUCCESS")).toBe(true);
  });

  it("never downgrades a terminal or higher status", () => {
    // Should NOT downgrade SUCCESS to PENDING or PROCESSING
    expect(shouldUpdatePayoutStatus("SUCCESS", "PENDING")).toBe(false);
    expect(shouldUpdatePayoutStatus("SUCCESS", "PROCESSING")).toBe(false);
    expect(shouldUpdatePayoutStatus("RETURNED", "UNCLAIMED")).toBe(false);
  });

  it("allows transition from UNCLAIMED to RETURNED or CANCELED", () => {
    expect(shouldUpdatePayoutStatus("UNCLAIMED", "RETURNED")).toBe(true);
    expect(shouldUpdatePayoutStatus("UNCLAIMED", "CANCELED")).toBe(true);
  });

  it("handles null or undefined current status", () => {
    expect(shouldUpdatePayoutStatus(null, "PENDING")).toBe(true);
    expect(shouldUpdatePayoutStatus(undefined, "SUCCESS")).toBe(true);
  });
});
