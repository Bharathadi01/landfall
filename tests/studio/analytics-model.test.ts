import { describe, it, expect } from "vitest";
import {
  studioSources,
  studioPayoutItems,
  studioPayoutBatches,
  studioObligations,
  studioFundingEvents,
  studioLedgerReconciliation,
  studioSolvency,
  studioRelationships,
  TREASURY,
} from "@/lib/studio/landfall-studio-data";

describe("Phase 1 — Analytics Data Contract & Financial Semantic QA (§5.2, §9)", () => {
  it("maintains exact PayPal Payouts v1 transaction statuses without inventing states", () => {
    const validStatuses = new Set([
      "SUCCESS",
      "FAILED",
      "PENDING",
      "UNCLAIMED",
      "RETURNED",
      "ONHOLD",
      "BLOCKED",
      "REFUNDED",
      "REVERSED",
    ]);

    for (const item of studioPayoutItems) {
      expect(validStatuses.has(item.transaction_status)).toBe(true);
      expect(item.status_label).toBeDefined();
      expect(item.status_meaning).toBeDefined();
      expect(typeof item.is_unresolved).toBe("number");
      expect(typeof item.unresolved_usd).toBe("number");
    }
  });

  it("distinguishes provider SUCCESS from verified beneficiary receipt confirmation", () => {
    // SUCCESS indicates provider credited; beneficiary receipt confirmation is separate
    const successItems = studioPayoutItems.filter((i) => i.transaction_status === "SUCCESS");
    expect(successItems.length).toBeGreaterThan(0);

    for (const item of successItems) {
      expect(item.status_label).toBe("Provider Credited");
      // Beneficiary confirmed is an explicit separate field
      expect(["CONFIRMED", "UNCONFIRMED"]).toContain(item.beneficiary_confirmed);
    }

    // Unclaimed items must NEVER be marked as beneficiary confirmed
    const unclaimed = studioPayoutItems.filter((i) => i.transaction_status === "UNCLAIMED");
    expect(unclaimed.length).toBeGreaterThan(0);
    for (const item of unclaimed) {
      expect(item.beneficiary_confirmed).toBe("UNCONFIRMED");
    }
  });

  it("enforces deterministic 30% reserve floor invariant and calculates exact headroom", () => {
    const solvency = studioSolvency[0];
    expect(solvency.total_balance_usd).toBe(TREASURY.total);
    expect(solvency.reserve_usd).toBe(TREASURY.reserve);
    expect(solvency.policy_floor_pct).toBe(30);

    // 30% of $14,250 is $4,275
    const expectedFloor = (TREASURY.total * TREASURY.policyFloorPct) / 100;
    expect(solvency.required_reserve_usd).toBe(expectedFloor);

    // Headroom is $5,000 - $4,275 = $725
    expect(solvency.headroom_usd).toBe(solvency.reserve_usd - expectedFloor);
    expect(solvency.headroom_usd).toBeGreaterThan(0);
    expect(solvency.status).toBe("Within policy");
  });

  it("verifies double-entry ledger reconciliation has zero minor-unit variance", () => {
    for (const entry of studioLedgerReconciliation) {
      expect(entry.variance_cents).toBe(0);
      expect(entry.match_status).toBe("MATCHED_ZERO_DISCREPANCY");
      expect(entry.debit_usd).toBeGreaterThanOrEqual(0);
      expect(entry.credit_usd).toBeGreaterThanOrEqual(0);
    }
  });

  it("validates relationship integrity and ensures keys exist in both source and target", () => {
    // 1. rel_batch_items: payout_batches.batch_id -> payout_items.batch_id
    const batchIds = new Set(studioPayoutBatches.map((b) => b.batch_id));
    for (const item of studioPayoutItems) {
      expect(batchIds.has(item.batch_id)).toBe(true);
    }

    // 2. rel_obligation_item: relief_obligations.obligation_id -> payout_items.obligation_id
    const obligationIds = new Set(studioObligations.map((o) => o.obligation_id));
    for (const item of studioPayoutItems) {
      if (item.obligation_id.startsWith("obl_milton")) {
        expect(obligationIds.has(item.obligation_id)).toBe(true);
      }
    }

    expect(studioRelationships.length).toBe(4);
  });

  it("preserves currency isolation and never sums across mixed currencies", () => {
    for (const item of studioPayoutItems) {
      expect(item.currency).toBe("USD");
      expect(typeof item.amount_usd).toBe("number");
      expect(item.amount_usd).toBeGreaterThan(0);
    }
    for (const batch of studioPayoutBatches) {
      expect(batch.currency).toBe("USD");
    }
    for (const event of studioFundingEvents) {
      expect(event.currency).toBe("USD");
    }
  });

  it("verifies all registered Studio sources have valid field formats and metadata", () => {
    expect(studioSources.length).toBeGreaterThanOrEqual(10);
    const validFormats = new Set(["currencyFormat", "textFormat", "integerFormat", "dateFormat", "booleanFormat"]);

    for (const source of studioSources) {
      expect(source.id).toBeDefined();
      expect(source.name).toBeDefined();
      expect(Array.isArray(source.data)).toBe(true);
      expect(Array.isArray(source.fields)).toBe(true);

      for (const field of source.fields) {
        expect(field.id).toBeDefined();
        expect(field.name).toBeDefined();
        expect(validFormats.has(field.format)).toBe(true);
      }
    }
  });
});

