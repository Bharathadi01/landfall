import { describe, it, expect } from "vitest";
import { redactAuditPayload, REDACTED_EMAIL, REDACTED_RECIPIENT } from "@/lib/db/audit-redact";

describe("audit log redaction", () => {
  it("redacts payout receivers but keeps ids, amounts and statuses", () => {
    const payload = {
      method: "POST",
      body: {
        sender_batch_header: { sender_batch_id: "batch_X_t1" },
        items: [
          { receiver: "someone@example.com", recipient_type: "EMAIL", amount: { value: "100.00", currency: "USD" }, sender_item_id: "a:t1:hh_1" },
          { receiver: "+15555550100", recipient_type: "PHONE", amount: { value: "100.00", currency: "USD" }, sender_item_id: "a:t1:hh_2" },
        ],
      },
    };
    const out = redactAuditPayload(payload);
    const items = out.body.items;
    expect(items[0].receiver).toBe(REDACTED_RECIPIENT);
    expect(items[1].receiver).toBe(REDACTED_RECIPIENT);
    expect(items[0].amount).toEqual({ value: "100.00", currency: "USD" });
    expect(items[0].sender_item_id).toBe("a:t1:hh_1");
    expect(out.body.sender_batch_header.sender_batch_id).toBe("batch_X_t1");
    expect(JSON.stringify(out)).not.toContain("someone@example.com");
    expect(JSON.stringify(out)).not.toContain("5555550100");
  });

  it("redacts email-like values anywhere, including inside free text and nested responses", () => {
    const out = redactAuditPayload({
      batch_header: { payout_batch_id: "VTJG3SR5BY56C", batch_status: "PENDING" },
      items: [{ payout_item_id: "ABC", transaction_status: "SUCCESS", payout_item: { receiver: "a.b+c@mail.example.org", note: "Sent to x@y.io today" } }],
      message: "Contact: person@example.com",
    });
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(out.items[0].payout_item.note).toBe(`Sent to ${REDACTED_EMAIL} today`);
    expect(out.items[0].transaction_status).toBe("SUCCESS");
    expect(out.batch_header.payout_batch_id).toBe("VTJG3SR5BY56C");
  });

  it("does not mutate its input and tolerates null, primitives and arrays", () => {
    const input = { receiver: "keep@original.com", list: [1, null, "z@z.com"] };
    const snapshot = JSON.stringify(input);
    redactAuditPayload(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(redactAuditPayload(null)).toBeNull();
    expect(redactAuditPayload(42)).toBe(42);
    expect(redactAuditPayload(["a@b.co"])).toEqual([REDACTED_EMAIL]);
  });
});

describe("spike diagnostics are not exposed", () => {
  it("has no /api/spike route or /spike page that can read audit records", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    expect(existsSync(join(process.cwd(), "app/api/spike/route.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/spike/page.tsx"))).toBe(false);
  });
});
