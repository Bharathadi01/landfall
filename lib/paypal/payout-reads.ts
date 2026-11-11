import { z } from "zod";
import { paypalFetch } from "./client";

/**
 * READ-ONLY PayPal Payouts calls.
 *
 * Deliberately separate from `payouts.ts` (which can create and cancel payouts and may only be
 * imported by lib/treasurer, see tests/arch/boundary.test.ts). Everything in this file is a GET, so
 * status refresh and reporting code can use it without being able to move money.
 */

export const PayoutBatchHeaderResponseSchema = z.object({
  payout_batch_id: z.string(),
  batch_status: z.string(),
  sender_batch_header: z.object({
    sender_batch_id: z.string(),
    email_subject: z.string().optional(),
  }),
  amount: z
    .object({
      currency: z.string(),
      value: z.string(),
    })
    .optional(),
  fees: z
    .object({
      currency: z.string(),
      value: z.string(),
    })
    .optional(),
  time_created: z.string().optional(),
  time_completed: z.string().optional(),
});

export const PayoutItemDetailsSchema = z.object({
  payout_item_id: z.string(),
  transaction_id: z.string().optional(),
  // PayPal enum: SUCCESS, FAILED, PENDING, UNCLAIMED, RETURNED, ONHOLD, BLOCKED, REFUNDED, REVERSED.
  // Kept a string so an unexpected value is flagged by lib/payouts/status.ts instead of failing the whole response.
  transaction_status: z.string(),
  payout_item_fee: z
    .object({
      currency: z.string(),
      value: z.string(),
    })
    .optional(),
  payout_batch_id: z.string().optional(),
  payout_item: z
    .object({
      recipient_type: z.string(),
      amount: z.object({
        currency: z.string(),
        value: z.string(),
      }),
      note: z.string().optional(),
      receiver: z.string(),
      sender_item_id: z.string().optional(),
      recipient_wallet: z.string().optional(),
    })
    .optional(),
  time_processed: z.string().optional(),
  links: z.array(z.any()).optional(),
});

export type PayoutItemDetails = z.infer<typeof PayoutItemDetailsSchema>;

export const GetPayoutBatchResponseSchema = z.object({
  batch_header: PayoutBatchHeaderResponseSchema,
  items: z.array(PayoutItemDetailsSchema).optional(),
  // Present when the request sets total_required=true. Without these, a batch larger than one page is silently truncated.
  total_items: z.number().int().optional(),
  total_pages: z.number().int().optional(),
  links: z.array(z.any()).optional(),
});

export type GetPayoutBatchResponse = z.infer<typeof GetPayoutBatchResponseSchema>;

export interface GetPayoutBatchOptions {
  /** 1-based page number (PayPal: min 0 / max 1000, default 1). */
  page?: number;
  /** Items per page (PayPal max 1000). */
  pageSize?: number;
  /** Ask PayPal to include total_items / total_pages. Required to know whether more pages exist. */
  totalRequired?: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Retrieves the details and current items of a payout batch (one page).
 * GET /v1/payments/payouts/{id}. Use `refreshPayoutBatch` (lib/payouts/refresh.ts) to walk every page and persist.
 */
export async function getPayoutBatch(
  payoutBatchId: string,
  actor = "treasurer",
  opts: GetPayoutBatchOptions = {}
): Promise<{ data: GetPayoutBatchResponse; debugId?: string; status: number }> {
  if (!ID_PATTERN.test(payoutBatchId)) {
    throw new Error("Invalid payout batch id");
  }
  const qs = new URLSearchParams();
  if (opts.page !== undefined) qs.set("page", String(opts.page));
  if (opts.pageSize !== undefined) qs.set("page_size", String(opts.pageSize));
  if (opts.totalRequired) qs.set("total_required", "true");
  const query = qs.toString();
  return paypalFetch<GetPayoutBatchResponse>(
    "GET",
    `/v1/payments/payouts/${payoutBatchId}${query ? `?${query}` : ""}`,
    undefined,
    {
      schema: GetPayoutBatchResponseSchema,
      actor,
    }
  );
}

/**
 * Retrieves a single payout item by PayPal payout_item_id.
 * GET /v1/payments/payouts-item/{payout_item_id}.
 */
export async function getPayoutItem(
  payoutItemId: string,
  actor = "treasurer"
): Promise<{ data: PayoutItemDetails; debugId?: string; status: number }> {
  if (!ID_PATTERN.test(payoutItemId)) {
    throw new Error("Invalid payout item id");
  }
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
