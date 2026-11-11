import crypto from "node:crypto";
import { computePlanHash, type PayoutPlan, type PlanItem } from "@/lib/treasurer/index";
import type { CancelPayload, PayoutPayload } from "./types";

/** Stable JSON (sorted keys) so the same facts always hash the same, whoever built them. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

export const sha256Hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Hash that two people approve for a cancellation. */
export function hashCancelPayload(p: CancelPayload): string {
  return sha256Hex(canonicalJson(p));
}

export type ReceiverResolver = (householdId: string) => string | null;

/**
 * Build the Treasurer's PayoutPlan from an approved payload. The plan hash covers each item's receiver, so if the
 * server-side payout route for a household changes after approval the hash no longer matches and execution is refused.
 */
export function buildPlanFromPayload(planId: string, payload: PayoutPayload, receiverFor: ReceiverResolver): { plan: PayoutPlan; missing: string[] } {
  const missing: string[] = [];
  const items: PlanItem[] = payload.items.map((i) => {
    const receiver = receiverFor(i.householdId);
    if (!receiver) missing.push(i.householdId);
    return { householdId: i.householdId, recipientType: "EMAIL", receiver: receiver ?? "", amountCents: i.amountCents, currency: i.currency, note: i.note };
  });
  const base = {
    id: planId,
    activationId: payload.activationId,
    tranche: payload.tranche,
    items,
    totalAmountCents: payload.totalAmountCents,
    totalFeesCents: payload.totalFeesCents,
    createdAt: "1970-01-01T00:00:00.000Z", // not part of the hash; fixed so the plan is reproducible
  };
  const planHash = computePlanHash(base);
  return { plan: { ...base, state: "approved_2", planHash }, missing };
}
