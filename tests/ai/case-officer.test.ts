import { describe, it, expect } from "vitest";
import { investigateCase, checkClaims, allowedActions } from "@/lib/ai/case-officer";
import type { ChatResult } from "@/lib/ai/groq";
import { GroqUnavailable } from "@/lib/ai/groq";
import type { ReliefCase } from "@/lib/relief/case-types";

const c = {
  origin: "SANDBOX_LIVE", caseRef: "sandbox:act_x:t1:hh_tbw_003", itemId: "ITEM3", batchId: "B1", householdRef: "hh_tbw_003", amountUsd: 100, status: "UNCLAIMED", claimDaysLeft: 20, barrier: undefined,
  nextAction: { safeAction: "SEND_REMINDER", plain: "Remind the resident to claim.", needsPerson: false, reason: "Unclaimed for 10 days." },
  evidenceCount: { present: 1, applicable: 2 },
  evidence: [
    { key: "provider", title: "PayPal status", state: "present", provenance: "PROVIDER", detail: "UNCLAIMED, PayPal sent a claim link" },
    { key: "recipient", title: "Resident's answer", state: "missing", provenance: "RECIPIENT_REPORTED", detail: "No answer yet" },
  ],
} as unknown as ReliefCase;

const res = (over: Partial<ChatResult>): ChatResult => ({ content: "", toolCalls: [], finishReason: "stop", model: "m", latencyMs: 1, usage: { promptTokens: 1, completionTokens: 1 }, ...over });
const deps = (chat: never) => ({ chat, history: async () => [{ observedAt: "2026-11-01T10:00:00Z", status: "UNCLAIMED", source: "import" }] });

const toolCall = (name: string) => ({ id: `c_${name}`, name, args: "{}" });
function script(finalJson: unknown) {
  let n = 0;
  return (async (o: { jsonSchema?: unknown }) => {
    if (o.jsonSchema) return res({ content: JSON.stringify(finalJson) });
    n++;
    return n === 1 ? res({ toolCalls: [toolCall("get_case"), toolCall("get_status_history"), toolCall("get_recovery_rules")] }) : res({ content: "ready" });
  }) as never;
}

describe("AI case officer", () => {
  it("keeps cited facts, drops uncited facts and invented numbers, and clamps a disallowed action", async () => {
    const out = await investigateCase(
      c,
      deps(
        script({
          facts: [
            { text: "PayPal still shows this $100.00 payment as UNCLAIMED.", evidenceIds: ["case:status", "case:amount"] },
            { text: "The resident received $250.", evidenceIds: ["case:amount"] },
            { text: "The resident was contacted twice.", evidenceIds: ["made:up"] },
          ],
          hypotheses: [{ text: "They may not have a PayPal account.", evidenceIds: [] }],
          unknowns: ["Whether the resident has seen the email"],
          recommendedAction: "REISSUE",
          actionReason: "send a new one",
          residentMessage: { text: "Hola", englishGloss: "Hello" },
        })
      ),
      "es"
    );
    expect(out.answeredBy).toBe("ai");
    expect(out.facts.map((f) => f.text)).toEqual(["PayPal still shows this $100.00 payment as UNCLAIMED."]);
    expect(out.integrity.droppedFacts).toBe(2);
    expect(out.recommendedAction).toBe("ESCALATE_TO_PERSON"); // REISSUE is not allowed while UNCLAIMED
    expect(out.integrity.clampedAction).toBe(true);
    expect(out.toolCalls.map((t) => t.name)).toContain("get_recovery_rules");
    expect(out.residentMessage.language).toBe("es");
  });

  it("falls back, labelled, when Groq is unavailable — never pretends the AI answered", async () => {
    const boom = (async () => { throw new GroqUnavailable("RATE_LIMITED", "limited"); }) as never;
    const out = await investigateCase(c, deps(boom));
    expect(out.answeredBy).toBe("deterministic");
    expect(out.fallbackReason).toMatch(/RATE_LIMITED/);
    expect(out.facts.length).toBeGreaterThan(0);
    expect(out.unknowns.join(" ")).toMatch(/no record exists/);
  });

  it("a model that skips every tool still gets the server-gathered evidence (marked as server-run)", async () => {
    let n = 0;
    const lazy = (async (o: { jsonSchema?: unknown }) => {
      n++;
      if (o.jsonSchema) return res({ content: JSON.stringify({ facts: [{ text: "PayPal status is UNCLAIMED.", evidenceIds: ["case:status"] }], hypotheses: [], unknowns: [], recommendedAction: "WAIT", actionReason: "ok", residentMessage: { text: "hi", englishGloss: "hi" } }) });
      return res({ content: "I think it is fine" });
    }) as never;
    const out = await investigateCase(c, deps(lazy));
    expect(out.answeredBy).toBe("ai");
    expect(out.toolCalls.every((t) => t.server)).toBe(true);
    expect(out.facts).toHaveLength(1);
    expect(n).toBe(2);
  });

  it("an unknown tool name is rejected and invalid JSON falls back", async () => {
    let n = 0;
    const chat = (async (o: { jsonSchema?: unknown }) => {
      if (o.jsonSchema) return res({ content: "not json" });
      n++;
      return n === 1 ? res({ toolCalls: [toolCall("get_case"), toolCall("send_money")] }) : res({ content: "ok" });
    }) as never;
    const out = await investigateCase(c, deps(chat));
    expect(out.answeredBy).toBe("deterministic");
    expect(out.fallbackReason).toMatch(/BAD_JSON/);
  });

  it("cites PayPal's Agent Toolkit transaction record when the tool is called, and marks it unknown when unavailable", async () => {
    let n = 0;
    const chat = (async (o: { jsonSchema?: unknown }) => {
      if (o.jsonSchema) return res({ content: JSON.stringify({ facts: [{ text: "PayPal booked event T0001 for -100.00 USD.", evidenceIds: ["paypal:transaction"] }], hypotheses: [], unknowns: [], recommendedAction: "WAIT", actionReason: "ok", residentMessage: { text: "hi", englishGloss: "hi" } }) });
      n++;
      return n === 1 ? res({ toolCalls: [toolCall("get_case"), toolCall("get_paypal_transaction_record")] }) : res({ content: "ready" });
    }) as never;
    const withTx = await investigateCase(c, { chat, history: async () => [], transaction: async () => ({ transactionId: "75T85158X6122100W", eventCode: "T0001", status: "S", amount: "-100.00", currency: "USD", initiated: "2026-11-09T17:56:38Z" }) });
    expect(withTx.answeredBy).toBe("ai");
    expect(withTx.facts).toHaveLength(1);
    expect(withTx.evidence.find((e) => e.id === "paypal:transaction")?.text).toMatch(/Agent Toolkit/);

    // the model only called get_case, yet the server ran the transaction tool for it (evidence is not optional)
    expect(withTx.toolCalls.find((t) => t.name === "get_paypal_transaction_record")).toBeDefined();
    n = 0;
    const down = await investigateCase(c, { chat, history: async () => [], transaction: async () => { throw new Error("down"); } });
    expect(down.evidence.find((e) => e.id === "paypal:transaction")).toBeUndefined();
    expect(down.facts).toHaveLength(0); // the fact cited evidence that was never returned, so it is dropped
    n = 0;
    const absent = await investigateCase(c, { chat, history: async () => [], transaction: async () => null });
    expect(absent.integrity.droppedFacts).toBe(1);
  });

  it("allowed actions follow the deterministic rules", () => {
    expect(allowedActions(c)).not.toContain("REISSUE");
    expect(allowedActions({ ...c, status: "RETURNED", claimDaysLeft: null } as ReliefCase)).toContain("REISSUE");
    expect(allowedActions({ ...c, status: "SUCCESS", claimDaysLeft: null } as ReliefCase)).not.toContain("CANCEL_ITEM");
  });

  it("checkClaims: numbers must appear in cited evidence", () => {
    const store = { items: new Map([["e1", { id: "e1", source: "paypal" as const, text: "20 days remain." }]]), add() { return undefined as never; } };
    expect(checkClaims([{ text: "20 days left", evidenceIds: ["e1"] }], store as never, true).kept).toHaveLength(1);
    expect(checkClaims([{ text: "5 days left", evidenceIds: ["e1"] }], store as never, true).kept).toHaveLength(0);
  });
});
