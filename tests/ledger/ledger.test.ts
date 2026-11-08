import { describe, it, expect } from "vitest";
import {
  validateBalancedTransaction,
  calculateAllocatable,
  type LedgerEntryItem,
} from "@/lib/ledger/index";

describe("Double-Entry Ledger Engine", () => {
  it("validates perfectly balanced transactions", () => {
    const entries: LedgerEntryItem[] = [
      { accountName: "paypal_available", entryType: "DEBIT", amountCents: 10000 },
      { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 10000 },
    ];

    const result = validateBalancedTransaction(entries);
    expect(result.balanced).toBe(true);
    expect(result.totalDebits).toBe(10000);
    expect(result.totalCredits).toBe(10000);
    expect(result.difference).toBe(0);
  });

  it("detects and flags unbalanced transactions", () => {
    const entries: LedgerEntryItem[] = [
      { accountName: "paypal_available", entryType: "DEBIT", amountCents: 10000 },
      { accountName: "reserve_protected", entryType: "CREDIT", amountCents: 9500 },
    ];

    const result = validateBalancedTransaction(entries);
    expect(result.balanced).toBe(false);
    expect(result.totalDebits).toBe(10000);
    expect(result.totalCredits).toBe(9500);
    expect(result.difference).toBe(500);
  });

  it("strictly throws on negative entry amounts", () => {
    const entries: LedgerEntryItem[] = [
      { accountName: "paypal_available", entryType: "DEBIT", amountCents: -500 },
      { accountName: "reserve_protected", entryType: "CREDIT", amountCents: -500 },
    ];

    expect(() => validateBalancedTransaction(entries)).toThrow(/Negative amounts are illegal/);
  });

  describe("Allocatable Waterfall Calculation (§4.2)", () => {
    it("deducts protected reserve, fees, and committed for general operations", () => {
      // $1000 available, $300 protected reserve, $50 fees reserved, $150 already committed
      const allocatable = calculateAllocatable({
        paypalAvailableCents: 100000,
        reserveProtectedCents: 30000,
        feesReservedCents: 5000,
        committedCents: 15000,
        isTranche1: false,
      });

      // 100000 - 30000 - 5000 - 15000 = 50000 ($500.00)
      expect(allocatable).toBe(50000);
    });

    it("allows Tranche 1 to draw directly from the protected reserve", () => {
      // For Tranche 1, protected reserve floor is unlocked:
      // 100000 - 0 - 5000 - 15000 = 80000 ($800.00)
      const allocatable = calculateAllocatable({
        paypalAvailableCents: 100000,
        reserveProtectedCents: 30000,
        feesReservedCents: 5000,
        committedCents: 15000,
        isTranche1: true,
      });

      expect(allocatable).toBe(80000);
    });

    it("clamps allocatable to 0 if commitments exceed available", () => {
      const allocatable = calculateAllocatable({
        paypalAvailableCents: 20000,
        reserveProtectedCents: 30000,
        feesReservedCents: 5000,
        committedCents: 10000,
        isTranche1: false,
      });

      expect(allocatable).toBe(0);
    });
  });
});
