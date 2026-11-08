/**
 * STORM PLEDGES & PLEDGE CALLER SERVICE
 * Golden Rule #3: Only the Pledge Caller (code) can charge saved PayPal.
 * Zero AI imports. Pure deterministic charging within strict donor caps.
 */

import { paypalFetch } from "@/lib/paypal/client";

export interface StormPledge {
  id: string;
  donorEmail: string;
  vaultPaymentToken: string;
  amountPerEventCents: number;
  seasonCapCents: number;
  chargedThisSeasonCents: number;
  status: "ACTIVE" | "PAUSED" | "REVOKED";
  createdAt: string;
}

export interface PledgeChargeResult {
  pledgeId: string;
  donorEmail: string;
  amountChargedCents: number;
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface ActivationPledgeCallResult {
  activationId: string;
  totalPledgesEvaluated: number;
  totalChargedCents: number;
  charges: PledgeChargeResult[];
  skippedOverCap: number;
}

/**
 * Evaluates whether a pledge can be charged for the current event.
 */
export function canChargePledge(pledge: StormPledge): {
  eligible: boolean;
  chargeableAmountCents: number;
  reason?: string;
} {
  if (pledge.status !== "ACTIVE") {
    return { eligible: false, chargeableAmountCents: 0, reason: `Pledge status is ${pledge.status}` };
  }

  const remainingCap = pledge.seasonCapCents - pledge.chargedThisSeasonCents;
  if (remainingCap <= 0) {
    return { eligible: false, chargeableAmountCents: 0, reason: "Season cap reached" };
  }

  const chargeAmount = Math.min(pledge.amountPerEventCents, remainingCap);
  return { eligible: true, chargeableAmountCents: chargeAmount };
}

/**
 * Executes a Merchant-Initiated Transaction (MIT) charge against a saved PayPal vault token.
 */
export async function chargeVaultToken({
  vaultToken,
  amountCents,
  donorEmail,
  activationId,
  orderCreator = executeVaultOrder,
}: {
  vaultToken: string;
  amountCents: number;
  donorEmail: string;
  activationId: string;
  orderCreator?: (params: any) => Promise<{ id: string; status: string }>;
}): Promise<{ orderId: string; status: string }> {
  const amountStr = (amountCents / 100).toFixed(2);
  const result = await orderCreator({
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: `pledge_${activationId}`,
        description: `Landfall Anticipatory Aid Pledge - Event ${activationId}`,
        amount: {
          currency_code: "USD",
          value: amountStr,
        },
      },
    ],
    payment_source: {
      token: {
        id: vaultToken,
        type: "PAYMENT_METHOD_TOKEN",
      },
    },
  });

  return { orderId: result.id, status: result.status };
}

async function executeVaultOrder(payload: any): Promise<{ id: string; status: string }> {
  const res = await paypalFetch<any>("POST", "/v2/checkout/orders", payload, {
    actor: "pledge_caller",
  });
  return { id: res.data.id, status: res.data.status };
}

/**
 * Pledge Caller: Executes charges for all eligible active storm pledges upon Tranche 1 activation.
 */
export async function callStormPledgesForActivation({
  activationId,
  pledges,
  isEmergencyStopActive,
  orderCreator,
}: {
  activationId: string;
  pledges: StormPledge[];
  isEmergencyStopActive: boolean;
  orderCreator?: (params: any) => Promise<{ id: string; status: string }>;
}): Promise<ActivationPledgeCallResult> {
  if (isEmergencyStopActive) {
    throw new Error("PLEDGE_CALLER_BLOCKED: Emergency stop is active.");
  }

  let totalCharged = 0;
  let skipped = 0;
  const charges: PledgeChargeResult[] = [];

  for (const pledge of pledges) {
    const check = canChargePledge(pledge);
    if (!check.eligible || check.chargeableAmountCents <= 0) {
      skipped++;
      continue;
    }

    try {
      const chargeRes = await chargeVaultToken({
        vaultToken: pledge.vaultPaymentToken,
        amountCents: check.chargeableAmountCents,
        donorEmail: pledge.donorEmail,
        activationId,
        orderCreator,
      });

      charges.push({
        pledgeId: pledge.id,
        donorEmail: pledge.donorEmail,
        amountChargedCents: check.chargeableAmountCents,
        success: true,
        orderId: chargeRes.orderId,
      });
      totalCharged += check.chargeableAmountCents;
    } catch (err: any) {
      charges.push({
        pledgeId: pledge.id,
        donorEmail: pledge.donorEmail,
        amountChargedCents: check.chargeableAmountCents,
        success: false,
        error: err.message || "Vault charge failed",
      });
    }
  }

  return {
    activationId,
    totalPledgesEvaluated: pledges.length,
    totalChargedCents: totalCharged,
    charges,
    skippedOverCap: skipped,
  };
}
