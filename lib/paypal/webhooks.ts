import { z } from "zod";
import { paypalFetch } from "./client";

export interface WebhookVerificationParams {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: Record<string, unknown>;
}

export const WebhookVerificationResponseSchema = z.object({
  verification_status: z.enum(["SUCCESS", "FAILURE"]),
});

export type WebhookVerificationResponse = z.infer<typeof WebhookVerificationResponseSchema>;

/**
 * Verifies an incoming PayPal webhook signature against the PayPal API.
 */
export async function verifyWebhookSignature(
  params: WebhookVerificationParams,
  actor = "courier"
): Promise<boolean> {
  try {
    const res = await paypalFetch<WebhookVerificationResponse>(
      "POST",
      "/v1/notifications/verify-webhook-signature",
      params,
      {
        schema: WebhookVerificationResponseSchema,
        actor,
      }
    );
    return res.data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("Webhook verification API call failed:", err);
    return false;
  }
}

/**
 * Payout Item Status Precedence Table.
 * Prevents out-of-order webhook events from downgrading a terminal or advanced status.
 * Higher number = higher precedence.
 */
export const PAYOUT_STATUS_PRECEDENCE: Record<string, number> = {
  PENDING: 1,
  PROCESSING: 2,
  HELD: 3,
  BLOCKED: 3,
  UNCLAIMED: 4,
  SUCCESS: 5,
  CANCELED: 5,
  RETURNED: 6,
  REFUNDED: 6,
  DENIED: 6,
  FAILED: 6,
};

/**
 * Checks whether an incoming status should overwrite an existing status.
 * Preserves terminal financial invariants: SUCCESS cannot be overwritten by FAILED,
 * and terminal resolution states (FAILED, RETURNED, REFUNDED) cannot be reverted.
 */
export function shouldUpdatePayoutStatus(
  currentStatus: string | null | undefined,
  incomingStatus: string
): boolean {
  if (!currentStatus) return true;
  const current = currentStatus.toUpperCase();
  const incoming = incomingStatus.toUpperCase();

  // Terminal SUCCESS can only ever transition to REFUNDED or REVERSED
  if (current === "SUCCESS") {
    return incoming === "REFUNDED" || incoming === "REVERSED";
  }

  // Terminal failure states cannot be rolled back or overwritten
  if (current === "FAILED" || current === "DENIED" || current === "CANCELED") {
    return false;
  }

  // Final settlement returns cannot be altered
  if (current === "RETURNED" || current === "REFUNDED" || current === "REVERSED") {
    return false;
  }

  const currentRank = PAYOUT_STATUS_PRECEDENCE[current] ?? 0;
  const incomingRank = PAYOUT_STATUS_PRECEDENCE[incoming] ?? 0;
  return incomingRank >= currentRank;
}

/**
 * Subscription Status Precedence Table.
 * Prevents out-of-order webhook events from rolling back active or terminal subscriptions.
 */
export const SUBSCRIPTION_STATUS_PRECEDENCE: Record<string, number> = {
  APPROVAL_PENDING: 1,
  APPROVED: 2,
  ACTIVE: 3,
  SUSPENDED: 4,
  CANCELLED: 5,
  EXPIRED: 5,
};

/**
 * Checks whether an incoming subscription status should overwrite an existing status.
 */
export function shouldUpdateSubscriptionStatus(
  currentStatus: string | null | undefined,
  incomingStatus: string
): boolean {
  if (!currentStatus) return true;
  const currentRank = SUBSCRIPTION_STATUS_PRECEDENCE[currentStatus.toUpperCase()] ?? 0;
  const incomingRank = SUBSCRIPTION_STATUS_PRECEDENCE[incomingStatus.toUpperCase()] ?? 0;
  return incomingRank >= currentRank;
}

export const PayoutItemDetailsSchema = z.object({
  payout_item_id: z.string(),
  transaction_id: z.string().optional(),
  transaction_status: z.string(), // SUCCESS, UNCLAIMED, RETURNED, FAILED, BLOCKED, etc.
  payout_batch_id: z.string().optional(),
  payout_item_fee: z
    .object({
      currency: z.string(),
      value: z.string(),
    })
    .optional(),
  payout_item: z
    .object({
      recipient_type: z.string().optional(),
      amount: z.object({
        currency: z.string(),
        value: z.string(),
      }),
      receiver: z.string().optional(),
      sender_item_id: z.string().optional(),
    })
    .optional(),
  time_processed: z.string().optional(),
  links: z
    .array(
      z.object({
        href: z.string(),
        rel: z.string(),
        method: z.string().optional(),
      })
    )
    .optional(),
});

export type PayoutItemDetails = z.infer<typeof PayoutItemDetailsSchema>;

/**
 * Traverses a HATEOAS link returned in PayPal payloads or webhook notifications (§2, §3).
 */
export async function fetchHateoasLink<T = unknown>(
  linkHref: string,
  opts?: { schema?: z.ZodType<T>; actor?: string }
): Promise<{ data: T; debugId?: string; status: number }> {
  return paypalFetch<T>("GET", linkHref, undefined, {
    schema: opts?.schema,
    actor: opts?.actor || "courier",
  });
}

/**
 * Fetches item-level settlement details directly from PayPal Payouts API (§2, §3).
 */
export async function fetchPayoutItemDetails(
  payoutItemId: string,
  actor = "courier"
): Promise<{ data: PayoutItemDetails; debugId?: string; status: number }> {
  return paypalFetch<PayoutItemDetails>(
    "GET",
    `/v1/payments/payouts-item/${payoutItemId}`,
    undefined,
    {
      schema: PayoutItemDetailsSchema,
      actor,
    }
  );
}


