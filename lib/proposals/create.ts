/**
 * BUILD A PROPOSAL from a request. Everything that matters is derived on the SERVER from stored PayPal records and the
 * deterministic recovery gate; the request only says what the coordinator wants to ask for.
 *
 * Nothing here moves money. It produces a proposal that still needs two server-verified approvals.
 */
import { z } from "zod";
import type { ReliefCase } from "@/lib/relief/case-types";
import { recoveryOptionsForCase } from "@/lib/recovery/decision";
import { householdFromRef } from "@/lib/auth/resident-code";
import { canonicalJson, hashCancelPayload, sha256Hex } from "./payload";
import { buildPlanFromPayload, planIdFor } from "./payload";
import { checkPayoutCaps, FEE_ESTIMATE_PER_ITEM_CENTS } from "./policy";
import { receiverFor as defaultReceiver } from "./receivers";
import type { CancelPayload, PayoutPayload, ProposalKind, ProposalPayload } from "./types";
import { LIVE_CASE_PREFIX } from "@/lib/relief/live-cases.server";

export const CreateProposalInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CANCEL_ITEM"), caseRef: z.string().min(3).max(160), reason: z.string().max(280).optional() }),
  z.object({ kind: z.literal("REISSUE"), caseRef: z.string().min(3).max(160) }),
  z.object({
    kind: z.literal("NEW_PAYOUT"),
    items: z.array(z.object({ householdId: z.string().regex(/^hh_[a-z0-9_]+$/i), amountCents: z.number().int().positive(), note: z.string().max(140).optional() })).min(1).max(20),
    tranche: z.union([z.literal(1), z.literal(2)]).optional(),
  }),
]);
export type CreateProposalInputT = z.infer<typeof CreateProposalInput>;

export interface CreateDeps {
  loadLiveCases: () => Promise<ReliefCase[]>;
  activeHouseholds: (ids: string[]) => Promise<Set<string>>;
  receiverFor?: (hh: string) => string | null;
}

export type Built =
  | { ok: true; kind: ProposalKind; payload: ProposalPayload; payloadHash: string; idempotencyKey: string; targetSenderItemId?: string; parentSenderItemId?: string }
  | { ok: false; status: number; error: string; message: string };

const fail = (status: number, error: string, message: string): Built => ({ ok: false, status, error, message });

const reportedReceived = (c: ReliefCase) => c.evidence.some((e) => e.key === "recipient" && /reported they received it/.test(e.detail));

function findCase(cases: ReliefCase[], ref: string): ReliefCase | undefined {
  const r = ref.trim();
  const hh = householdFromRef(r);
  return cases.find((c) => c.caseRef === r || c.itemId === r) ?? (hh ? cases.find((c) => c.householdRef === hh) : undefined);
}

export async function buildProposal(input: CreateProposalInputT, deps: CreateDeps): Promise<Built> {
  const receiverFor = deps.receiverFor ?? ((hh: string) => defaultReceiver(hh));

  if (input.kind === "CANCEL_ITEM") {
    const c = findCase(await deps.loadLiveCases(), input.caseRef);
    if (!c || c.origin !== "SANDBOX_LIVE") return fail(404, "case_not_found", "Live cases only: switch to Live Sandbox and pick a real payment.");
    const opt = recoveryOptionsForCase({ status: c.status, claimDaysLeft: c.claimDaysLeft, barrier: c.barrier ?? null, reportedReceived: reportedReceived(c) }).find((o) => o.kind === "CANCEL_ITEM")!;
    if (!opt.allowed) return fail(422, "not_allowed", opt.reason);
    if (!c.caseRef.startsWith(LIVE_CASE_PREFIX) || c.itemId === c.caseRef.slice(LIVE_CASE_PREFIX.length)) {
      return fail(422, "no_provider_item", "PayPal has not reported an item id for this payment yet. Refresh from PayPal first.");
    }
    const payload: CancelPayload = {
      kind: "CANCEL_ITEM",
      senderItemId: c.caseRef.slice(LIVE_CASE_PREFIX.length),
      paypalItemId: c.itemId,
      paypalBatchId: c.batchId,
      amountCents: Math.round(c.amountUsd * 100),
      currency: "USD",
      reason: input.reason?.trim() || opt.reason,
    };
    const payloadHash = hashCancelPayload(payload);
    return { ok: true, kind: "CANCEL_ITEM", payload, payloadHash, idempotencyKey: `CANCEL_ITEM:${payload.paypalItemId}:${payloadHash.slice(0, 16)}`, targetSenderItemId: payload.senderItemId };
  }

  // payouts (NEW_PAYOUT / REISSUE)
  let items: Array<{ householdId: string; amountCents: number; note: string }>;
  let parent: ReliefCase | undefined;
  const cases = await deps.loadLiveCases();

  if (input.kind === "REISSUE") {
    parent = findCase(cases, input.caseRef);
    if (!parent || parent.origin !== "SANDBOX_LIVE") return fail(404, "case_not_found", "Live cases only: switch to Live Sandbox and pick a real payment.");
    const opt = recoveryOptionsForCase({ status: parent.status, claimDaysLeft: parent.claimDaysLeft, barrier: parent.barrier ?? null, reportedReceived: reportedReceived(parent) }).find((o) => o.kind === "REISSUE")!;
    if (!opt.allowed) return fail(422, "not_allowed", opt.reason);
    items = [{ householdId: parent.householdRef, amountCents: Math.round(parent.amountUsd * 100), note: "Replacement relief payment" }];
  } else {
    items = input.items.map((i) => ({ householdId: i.householdId.toLowerCase(), amountCents: i.amountCents, note: i.note?.trim() || "Landfall relief payment" }));
    const dup = new Set<string>();
    for (const i of items) {
      if (dup.has(i.householdId)) return fail(422, "duplicate_household", `${i.householdId} appears twice in this proposal.`);
      dup.add(i.householdId);
    }
  }

  const capError = checkPayoutCaps(items);
  if (capError) return fail(422, "cap_exceeded", capError);
  const noRoute = items.filter((i) => !receiverFor(i.householdId)).map((i) => i.householdId);
  if (noRoute.length) return fail(422, "no_payout_route", `No payout route is configured for ${noRoute.join(", ")}. Add it to SANDBOX_RECEIVERS on the server.`);
  const active = await deps.activeHouseholds(items.map((i) => i.householdId));
  if (active.size) return fail(409, "duplicate_blocked", `${[...active].join(", ")} already has a payment in flight or unclaimed. Sending again would be a duplicate.`);

  const totalAmountCents = items.reduce((t, i) => t + i.amountCents, 0);
  const tranche = input.kind === "NEW_PAYOUT" ? input.tranche ?? 1 : 1;
  const key = sha256Hex(canonicalJson({ kind: input.kind, tranche, parent: parent?.caseRef ?? null, items: [...items].sort((a, b) => a.householdId.localeCompare(b.householdId)) }));
  const payload: PayoutPayload = {
    kind: input.kind,
    activationId: `lf${key.slice(0, 10)}`,
    tranche,
    items: items.map((i) => ({ householdId: i.householdId, amountCents: i.amountCents, currency: "USD", note: i.note })),
    totalAmountCents,
    totalFeesCents: items.length * FEE_ESTIMATE_PER_ITEM_CENTS,
    parentSenderItemId: parent ? parent.caseRef.slice(LIVE_CASE_PREFIX.length) : undefined,
  };
  // Approved hash = the Treasurer's plan hash (covers receivers), so it can only execute exactly as approved.
  const { plan, missing } = buildPlanFromPayload(planIdFor(payload), payload, receiverFor);
  if (missing.length) return fail(422, "no_payout_route", `No payout route is configured for ${missing.join(", ")}.`);
  return { ok: true, kind: input.kind, payload, payloadHash: plan.planHash, idempotencyKey: `${input.kind}:${key}`, parentSenderItemId: payload.parentSenderItemId };
}
