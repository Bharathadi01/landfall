import { describe, it, expect, vi } from "vitest";
import {
  shouldUpdatePayoutStatus,
  PAYOUT_STATUS_PRECEDENCE,
  fetchPayoutItemDetails,
  fetchHateoasLink,
} from "@/lib/paypal/webhooks";

describe("PayPal Webhook Status Precedence & HATEOAS Traversal (§2, §3)", () => {
  it("allows upgrading from PENDING to PROCESSING to SUCCESS", () => {
    expect(shouldUpdatePayoutStatus("PENDING", "PROCESSING")).toBe(true);
    expect(shouldUpdatePayoutStatus("PROCESSING", "SUCCESS")).toBe(true);
  });

  it("never downgrades a terminal or higher status", () => {
    // Should NOT downgrade SUCCESS to PENDING or PROCESSING
    expect(shouldUpdatePayoutStatus("SUCCESS", "PENDING")).toBe(false);
    expect(shouldUpdatePayoutStatus("SUCCESS", "PROCESSING")).toBe(false);
    expect(shouldUpdatePayoutStatus("RETURNED", "UNCLAIMED")).toBe(false);
    expect(shouldUpdatePayoutStatus("FAILED", "PENDING")).toBe(false);
    expect(shouldUpdatePayoutStatus("BLOCKED", "PROCESSING")).toBe(false);
  });

  it("allows transition from UNCLAIMED to RETURNED or CANCELED", () => {
    expect(shouldUpdatePayoutStatus("UNCLAIMED", "RETURNED")).toBe(true);
    expect(shouldUpdatePayoutStatus("UNCLAIMED", "CANCELED")).toBe(true);
  });

  it("handles null or undefined current status", () => {
    expect(shouldUpdatePayoutStatus(null, "PENDING")).toBe(true);
    expect(shouldUpdatePayoutStatus(undefined, "SUCCESS")).toBe(true);
  });

  it("ranks terminal statuses with highest precedence", () => {
    expect(PAYOUT_STATUS_PRECEDENCE["SUCCESS"]).toBe(5);
    expect(PAYOUT_STATUS_PRECEDENCE["RETURNED"]).toBe(6);
    expect(PAYOUT_STATUS_PRECEDENCE["FAILED"]).toBe(6);
    expect(PAYOUT_STATUS_PRECEDENCE["PENDING"]).toBe(1);
  });

  it("ranks ONHOLD and REVERSED so out-of-order events behave (provider vocabulary)", () => {
    expect(PAYOUT_STATUS_PRECEDENCE.ONHOLD).toBeDefined();
    expect(PAYOUT_STATUS_PRECEDENCE.REVERSED).toBeDefined();
    expect(shouldUpdatePayoutStatus("PENDING", "ONHOLD")).toBe(true);
    expect(shouldUpdatePayoutStatus("UNCLAIMED", "ONHOLD")).toBe(false);
    expect(shouldUpdatePayoutStatus("ONHOLD", "SUCCESS")).toBe(true);
  });
});
