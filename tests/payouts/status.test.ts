import { describe, it, expect } from "vitest";
import {
  OFFICIAL_ITEM_STATUSES,
  INTERNAL_SUBMITTED,
  normalizeItemStatus,
  plannedPostings,
  toCents,
  isTerminalStatus,
} from "@/lib/payouts/status";
import { validateBalancedTransaction } from "@/lib/ledger/index";
import { makeSenderBatchId, MAX_SENDER_BATCH_ID } from "@/lib/treasurer";
import { PAYOUT_STATUS_PRECEDENCE } from "@/lib/paypal/webhooks";

describe("payout status vocabulary (D-11)", () => {
  it("matches PayPal's published transaction_status enum exactly", () => {
    expect([...OFFICIAL_ITEM_STATUSES].sort()).toEqual(
      ["BLOCKED", "FAILED", "ONHOLD", "PENDING", "REFUNDED", "RETURNED", "REVERSED", "SUCCESS", "UNCLAIMED"]
    );
  });

  it("every official status has an explicit precedence rank (none silently ranks 0)", () => {
    for (const s of OFFICIAL_ITEM_STATUSES) expect(PAYOUT_STATUS_PRECEDENCE[s], s).toBeGreaterThan(0);
  });

  it("maps documented event-name aliases and recognises the internal SUBMITTED state", () => {
    expect(normalizeItemStatus("SUCCEEDED")).toEqual({ status: "SUCCESS", recognised: true });
    expect(normalizeItemStatus("held")).toEqual({ status: "ONHOLD", recognised: true });
    expect(normalizeItemStatus(INTERNAL_SUBMITTED).recognised).toBe(true);
  });

  it("flags anything else as unrecognised instead of accepting it silently", () => {
    for (const bad of ["WEIRD", "", null, undefined, "SUCCESSFUL"]) {
      expect(normalizeItemStatus(bad as string).recognised, String(bad)).toBe(false);
    }
  });

  it("parses money as exact integer cents and rejects non-decimals", () => {
    expect(toCents("100.00")).toBe(10000);
    expect(toCents("0.25")).toBe(25);
    expect(toCents("3")).toBe(300);
    expect(toCents("-1.00")).toBeNull();
    expect(toCents("1e3")).toBeNull();
    expect(toCents(undefined)).toBeNull();
  });

  it("knows which statuses are terminal", () => {
    expect(["SUCCESS", "FAILED", "RETURNED", "REFUNDED", "REVERSED"].every(isTerminalStatus)).toBe(true);
    expect(["PENDING", "UNCLAIMED", "ONHOLD", "BLOCKED", "SUBMITTED"].some(isTerminalStatus)).toBe(false);
  });
});

describe("ledger postings per status transition (D-2)", () => {
  const post = (from: string | null, to: string, fee: number | null = null) =>
    plannedPostings({ senderItemId: "act:t1:hh_1", from, to, amountCents: 10000, feeCents: fee });
  const net = (ps: ReturnType<typeof post>, account: string) =>
    ps.flatMap((p) => p.entries).reduce((n, e) => (e.accountName === account ? n + (e.entryType === "DEBIT" ? e.amountCents : -e.amountCents) : n), 0);

  it("every planned posting is individually balanced", () => {
    const transitions: Array<[string | null, string]> = [
      [null, "SUCCESS"], ["SUBMITTED", "UNCLAIMED"], ["UNCLAIMED", "SUCCESS"], ["UNCLAIMED", "RETURNED"],
      ["UNCLAIMED", "CANCELED"], ["SUCCESS", "REFUNDED"], ["SUCCESS", "REVERSED"], ["PENDING", "SUCCESS"],
    ];
    for (const [from, to] of transitions) {
      for (const p of post(from, to, 25)) {
        expect(validateBalancedTransaction(p.entries).balanced, `${from}->${to}`).toBe(true);
      }
    }
  });

  it("SUCCESS moves money out of available cash into paid_out; UNCLAIMED holds it, it is not 'paid'", () => {
    expect(net(post("SUBMITTED", "SUCCESS"), "paid_out")).toBe(10000);
    expect(net(post("SUBMITTED", "SUCCESS"), "paypal_available")).toBe(-10000);
    const unclaimed = post("SUBMITTED", "UNCLAIMED");
    expect(net(unclaimed, "payout_unclaimed")).toBe(10000);
    expect(net(unclaimed, "paid_out")).toBe(0);
    expect(net(unclaimed, "paypal_available")).toBe(-10000);
  });

  it("UNCLAIMED → SUCCESS converts the held funds to paid_out without touching cash again", () => {
    const ps = post("UNCLAIMED", "SUCCESS");
    expect(net(ps, "paid_out")).toBe(10000);
    expect(net(ps, "payout_unclaimed")).toBe(-10000);
    expect(net(ps, "paypal_available")).toBe(0);
  });

  it("returns restore cash from the account that held the funds", () => {
    expect(net(post("UNCLAIMED", "RETURNED"), "paypal_available")).toBe(10000);
    expect(net(post("UNCLAIMED", "RETURNED"), "payout_unclaimed")).toBe(-10000);
    expect(net(post("SUCCESS", "REFUNDED"), "paid_out")).toBe(-10000);
    expect(net(post("SUCCESS", "REVERSED"), "paypal_available")).toBe(10000);
  });

  it("states where money did not (or cannot be shown to have) moved post nothing", () => {
    for (const to of ["SUBMITTED", "PENDING", "ONHOLD", "BLOCKED", "FAILED", "DENIED", "WEIRD"]) {
      expect(post("SUBMITTED", to), to).toEqual([]);
    }
    // a return observed for an item never seen deducted is not posted: we cannot know money left
    expect(post("PENDING", "RETURNED")).toEqual([]);
    expect(post(null, "REFUNDED")).toEqual([]);
  });

  it("a PayPal fee is posted once the item is UNCLAIMED or SUCCESS, with a stable id so replays are no-ops", () => {
    const a = post("SUBMITTED", "UNCLAIMED", 25);
    const b = post("UNCLAIMED", "SUCCESS", 25);
    const feeA = a.find((p) => p.transactionId.endsWith("_fee"));
    const feeB = b.find((p) => p.transactionId.endsWith("_fee"));
    expect(feeA).toBeDefined();
    expect(feeA!.transactionId).toBe(feeB!.transactionId);
    expect(net([feeA!], "payout_fees")).toBe(25);
    expect(post("SUBMITTED", "PENDING", 25)).toEqual([]);
  });

  it("transaction ids are deterministic per item and target state", () => {
    expect(post("SUBMITTED", "SUCCESS")[0].transactionId).toBe(post(null, "SUCCESS")[0].transactionId);
    const ids = new Set([...post("SUBMITTED", "UNCLAIMED"), ...post("UNCLAIMED", "SUCCESS"), ...post("SUCCESS", "REFUNDED")].map((p) => p.transactionId));
    expect(ids.size).toBe(3);
  });

  it("never posts a zero or negative amount", () => {
    expect(plannedPostings({ senderItemId: "x", from: null, to: "SUCCESS", amountCents: 0, feeCents: null })).toEqual([]);
  });
});

describe("sender_batch_id (D-14)", () => {
  it("keeps the readable id when it fits, so ids already used at PayPal are unchanged", () => {
    expect(makeSenderBatchId("TBW:HU.W:0009", 1)).toBe("batch_TBW:HU.W:0009_t1");
  });

  it("never exceeds PayPal's 30-character limit, and is stable and distinct for long activations", () => {
    const long1 = "act_hurricane_milton_2024_tampa_bay_zone_a";
    const long2 = "act_hurricane_milton_2024_tampa_bay_zone_b";
    const a = makeSenderBatchId(long1, 1);
    expect(a.length).toBeLessThanOrEqual(MAX_SENDER_BATCH_ID);
    expect(makeSenderBatchId(long1, 1)).toBe(a);
    expect(makeSenderBatchId(long1, 2)).not.toBe(a);
    expect(makeSenderBatchId(long2, 1)).not.toBe(a);
  });
});
