import { describe, it, expect, vi } from "vitest";
import { lookupTransaction, TOOLKIT_ACTIONS } from "@/lib/paypal/agent-toolkit";

const respond = (details: unknown[]) => ({ handleToolCall: vi.fn(async () => ({ role: "tool", tool_call_id: "x", content: JSON.stringify({ transaction_details: details }) })) }) as never;

describe("PayPal Agent Toolkit wrapper (read-only)", () => {
  it("enables exactly one action: transactions.list — no write action", () => {
    expect(TOOLKIT_ACTIONS).toEqual({ transactions: { list: true } });
    expect(Object.keys(TOOLKIT_ACTIONS)).toEqual(["transactions"]);
    expect(Object.keys(TOOLKIT_ACTIONS.transactions)).toEqual(["list"]);
  });

  it("builds the call itself (fixed tool, id and a 30-day window) and parses PayPal's record", async () => {
    const runner = respond([{ transaction_info: { transaction_id: "75T85158X6122100W", transaction_event_code: "T0001", transaction_status: "S", transaction_amount: { value: "-100.00", currency_code: "USD" }, transaction_initiation_date: "2026-11-09T17:56:38Z" } }]);
    const r = await lookupTransaction("75T85158X6122100W", runner, new Date("2026-11-11T12:00:00Z"));
    expect(r).toEqual({ transactionId: "75T85158X6122100W", eventCode: "T0001", status: "S", amount: "-100.00", currency: "USD", initiated: "2026-11-09T17:56:38Z" });
    const call = (runner as unknown as { handleToolCall: ReturnType<typeof vi.fn> }).handleToolCall.mock.calls[0][0];
    expect(call.function.name).toBe("list_transactions");
    const args = JSON.parse(call.function.arguments);
    expect(args).toMatchObject({ transaction_id: "75T85158X6122100W", page_size: 5, end_date: "2026-11-11T12:00:00Z", start_date: "2026-10-12T12:00:00Z" });
  });

  it("returns null when PayPal lists nothing for that id, and rejects malformed ids before any call", async () => {
    expect(await lookupTransaction("75T85158X6122100W", respond([]), new Date())).toBeNull();
    expect(await lookupTransaction("75T85158X6122100W", respond([{ transaction_info: { transaction_id: "OTHER000000001" } }]), new Date())).toBeNull();
    const runner = respond([]);
    await expect(lookupTransaction("1; drop table", runner)).rejects.toThrow(/Invalid/);
    expect((runner as unknown as { handleToolCall: ReturnType<typeof vi.fn> }).handleToolCall).not.toHaveBeenCalled();
  });

  it("fails loudly on a non-JSON toolkit response and tolerates a record with missing fields", async () => {
    const bad = { handleToolCall: vi.fn(async () => ({ content: "boom" })) } as never;
    await expect(lookupTransaction("75T85158X6122100W", bad)).rejects.toThrow(/not JSON/);
    const sparse = respond([{ transaction_info: { transaction_id: "75T85158X6122100W" } }]);
    expect(await lookupTransaction("75T85158X6122100W", sparse)).toMatchObject({ eventCode: "", status: "", amount: "" });
    const objContent = { handleToolCall: vi.fn(async () => ({ content: [{ type: "text", text: "x" }] })) } as never;
    expect(await lookupTransaction("75T85158X6122100W", objContent)).toBeNull(); // structured content without transaction_details = no record
  });
});
