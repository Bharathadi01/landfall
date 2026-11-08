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
 */
export function shouldUpdatePayoutStatus(
  currentStatus: string | null | undefined,
  incomingStatus: string
): boolean {
  if (!currentStatus) return true;
  const currentRank = PAYOUT_STATUS_PRECEDENCE[currentStatus.toUpperCase()] ?? 0;
  const incomingRank = PAYOUT_STATUS_PRECEDENCE[incomingStatus.toUpperCase()] ?? 0;
  return incomingRank >= currentRank;
}
