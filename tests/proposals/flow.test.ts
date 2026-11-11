import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { actionApprovals, payoutItemRecords } from "@/lib/db/schema";
import { applyItemObservation, recordBatchCreation } from "@/lib/payouts/store";
import { getAccountBalance } from "@/lib/ledger/index";
import { createProposal, addApproval, getProposal, rejectProposal } from "@/lib/proposals/store";
import { executeProposal } from "@/lib/proposals/execute";
import { hashCancelPayload } from "@/lib/proposals/payload";
import type { CancelPayload } from "@/lib/proposals/types";

/** DB-backed (TEST_DATABASE_URL only). PayPal is a fake: nothing leaves the process. */
const run = process.env.LANDFALL_DB_TESTS ? describe : describe.skip;
const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

async function unclaimedItem() {
  const tag = uid();
  const senderItemId = `act_${tag}:t1:hh_tbw_${tag.toLowerCase()}`;
  const paypalBatchId = `B${tag}`;
  const paypalItemId = `I${tag}`;
  await recordBatchCreation({ paypalBatchId, senderBatchId: `batch_${tag}`, planId: `imported:${tag}`, status: "SUCCESS", items: [{ senderItemId, amountCents: 10000, currency: "USD" }] });
  await applyItemObservation({ senderItemId, paypalItemId, paypalBatchId, transactionId: `T${tag}`, rawStatus: "UNCLAIMED", amountCents: 10000, currency: "USD", source: "refresh" });
  const payload: CancelPayload = { kind: "CANCEL_ITEM", senderItemId, paypalItemId, paypalBatchId, amountCents: 10000, currency: "USD", reason: "test" };
  return { tag, senderItemId, paypalItemId, payload };
}

const propose = (payload: CancelPayload, proposedBy = "dana-ortiz") =>
  createProposal({ kind: "CANCEL_ITEM", payload, payloadHash: hashCancelPayload(payload), targetSenderItemId: payload.senderItemId, proposedBy, idempotencyKey: `CANCEL_ITEM:${payload.paypalItemId}:${hashCancelPayload(payload).slice(0, 16)}` });

const dana = (hash: string) => ({ approverId: "dana-ortiz", approverName: "Dana Ortiz", role: "coordinator" as const, method: "DEMO_KEY" as const, payloadHash: hash });
const sam = (hash: string) => ({ approverId: "sam-patel", approverName: "Sam Patel", role: "finance" as const, method: "DEMO_KEY" as const, payloadHash: hash });

const fakeCancel = (calls: { get: number; cancel: number }, current = "UNCLAIMED") => ({
  getItem: async () => (calls.get++, { data: { transaction_status: current, transaction_id: "T1" } as never }),
  cancel: async () => (calls.cancel++, { data: { transaction_status: "RETURNED", transaction_id: "T1" } as never }),
});

run("propose → two approvals → Treasurer executes (cancel unclaimed)", () => {
  it("idempotent proposal; second distinct approver executes exactly once; ledger returns the funds once", async () => {
    const it1 = await unclaimedItem();
    const first = await propose(it1.payload);
    const again = await propose(it1.payload);
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.proposal.id).toBe(first.proposal.id);

    const id = first.proposal.id;
    const h = first.proposal.payloadHash;
    const before = { cash: await getAccountBalance("paypal_available"), unclaimed: await getAccountBalance("payout_unclaimed") };

    // one approval is not enough, and the same person twice is still one
    const a1 = await addApproval(id, dana(h));
    expect(a1.ok && a1.becameApproved).toBe(false);
    const a1b = await addApproval(id, dana(h));
    expect(a1b.ok && a1b.duplicate).toBe(true);
    expect((await db.select().from(actionApprovals).where(eq(actionApprovals.proposalId, id))).length).toBe(1);
    const early = await executeProposal(id, { cancel: fakeCancel({ get: 0, cancel: 0 }) });
    expect(early.ran).toBe(false);

    const a2 = await addApproval(id, sam(h));
    expect(a2.ok && a2.becameApproved).toBe(true);

    const calls = { get: 0, cancel: 0 };
    const [r1, r2] = await Promise.all([executeProposal(id, { cancel: fakeCancel(calls) }), executeProposal(id, { cancel: fakeCancel(calls) })]);
    expect([r1, r2].filter((r) => r.ran).length).toBe(1);
    expect(calls.cancel).toBe(1);

    const done = await getProposal(id);
    expect(done?.status).toBe("EXECUTED");
    const [item] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, it1.senderItemId));
    expect(item.status).toBe("RETURNED");
    expect((await getAccountBalance("paypal_available")) - before.cash).toBe(10000);
    expect((await getAccountBalance("payout_unclaimed")) - before.unclaimed).toBe(-10000);

    // PayPal later sends the RETURNED webhook for the same item: it must not post again
    await applyItemObservation({ paypalItemId: it1.paypalItemId, rawStatus: "RETURNED", source: "webhook", eventId: `WH-${it1.tag}` });
    expect((await getAccountBalance("paypal_available")) - before.cash).toBe(10000);
    expect((await getAccountBalance("payout_unclaimed")) - before.unclaimed).toBe(-10000);

    // and once executed, nobody can approve or run it again
    expect((await addApproval(id, dana(h))).ok).toBe(false);
    expect((await executeProposal(id, { cancel: fakeCancel(calls) })).ran).toBe(false);
    expect(calls.cancel).toBe(1);
  });

  it("refuses to cancel when PayPal now says the resident already claimed it, and updates the case instead", async () => {
    const it2 = await unclaimedItem();
    const { proposal } = await propose(it2.payload);
    const h = proposal.payloadHash;
    await addApproval(proposal.id, dana(h));
    await addApproval(proposal.id, sam(h));
    const calls = { get: 0, cancel: 0 };
    const before = await getAccountBalance("paypal_available");
    const r = await executeProposal(proposal.id, { cancel: fakeCancel(calls, "SUCCESS") });
    expect(r.ran && r.ok).toBe(false);
    expect(calls.cancel).toBe(0);
    expect((await getProposal(proposal.id))?.status).toBe("FAILED");
    const [item] = await db.select().from(payoutItemRecords).where(eq(payoutItemRecords.senderItemId, it2.senderItemId));
    expect(item.status).toBe("SUCCESS");
    expect(await getAccountBalance("paypal_available")).toBe(before);
  });

  it("an approval for a different payload hash, or on a rejected proposal, is refused", async () => {
    const it3 = await unclaimedItem();
    const { proposal } = await propose(it3.payload);
    const bad = await addApproval(proposal.id, dana("f".repeat(64)));
    expect(!bad.ok && bad.error).toBe("PAYLOAD_MISMATCH");
    expect(await rejectProposal(proposal.id)).toBe(true);
    const late = await addApproval(proposal.id, dana(proposal.payloadHash));
    expect(!late.ok && late.error).toBe("NOT_OPEN");
  });

  it("a PayPal outage leaves the ledger untouched and marks the proposal FAILED (never retried automatically)", async () => {
    const it4 = await unclaimedItem();
    const { proposal } = await propose(it4.payload);
    await addApproval(proposal.id, dana(proposal.payloadHash));
    await addApproval(proposal.id, sam(proposal.payloadHash));
    const before = await getAccountBalance("paypal_available");
    const r = await executeProposal(proposal.id, { cancel: { getItem: async () => { throw new Error("ECONNRESET"); }, cancel: async () => { throw new Error("must not be called"); } } });
    expect(r.ran && r.ok).toBe(false);
    expect((await getProposal(proposal.id))?.status).toBe("FAILED");
    expect(await getAccountBalance("paypal_available")).toBe(before);
  });
});
