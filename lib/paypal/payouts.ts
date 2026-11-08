import { z } from "zod";
import { paypalFetch } from "./client";

export const PayoutItemRequestSchema = z.object({
  recipient_type: z.enum(["EMAIL", "PHONE", "PAYPAL_ID"]).default("EMAIL"),
  amount: z.object({
    value: z.string().regex(/^\d+\.\d{2}$/, "Amount must be a 2-decimal USD string (e.g. '1.00')"),
    currency: z.literal("USD").default("USD"),
  }),
  receiver: z.string().min(1),
  note: z.string().max(280).default("Landfall Mutual Aid Emergency Support"),
  sender_item_id: z.string().min(1),
  recipient_wallet: z.enum(["PAYPAL", "Venmo", "VENMO"]).default("PAYPAL"),
});

export type PayoutItemRequest = z.infer<typeof PayoutItemRequestSchema>;

export const CreatePayoutBatchRequestSchema = z.object({
  sender_batch_header: z.object({
    sender_batch_id: z.string().min(1).max(30),
    email_subject: z.string().default("You have received Landfall anticipatory emergency aid"),
    email_message: z
      .string()
      .default("Funds have been disbursed to your account before the storm peaks."),
  }),
  items: z.array(PayoutItemRequestSchema).min(1).max(15000),
});

export type CreatePayoutBatchRequest = z.input<typeof CreatePayoutBatchRequestSchema>;

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

export const CreatePayoutBatchResponseSchema = z.object({
  batch_header: PayoutBatchHeaderResponseSchema,
  links: z
    .array(
      z.object({
        href: z.string(),
        rel: z.string(),
        method: z.string(),
      })
    )
    .optional(),
});

export type CreatePayoutBatchResponse = z.infer<typeof CreatePayoutBatchResponseSchema>;

export const PayoutItemDetailsSchema = z.object({
  payout_item_id: z.string(),
  transaction_id: z.string().optional(),
  transaction_status: z.string(), // SUCCESS, UNCLAIMED, RETURNED, FAILED, BLOCKED, HELD, REFUNDED, CANCELED, DENIED
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
  links: z.array(z.any()).optional(),
});

export type GetPayoutBatchResponse = z.infer<typeof GetPayoutBatchResponseSchema>;

/**
 * Creates a batch payout in PayPal Sandbox.
 * Enforces `sender_batch_id` idempotency.
 */
export async function createPayoutBatch(
  request: CreatePayoutBatchRequest,
  actor = "treasurer"
): Promise<{ data: CreatePayoutBatchResponse; debugId?: string; status: number }> {
  // Validate request
  const validated = CreatePayoutBatchRequestSchema.parse(request);

  return paypalFetch<CreatePayoutBatchResponse>(
    "POST",
    "/v1/payments/payouts",
    validated,
    {
      schema: CreatePayoutBatchResponseSchema,
      requestId: validated.sender_batch_header.sender_batch_id,
      actor,
    }
  );
}

/**
 * Retrieves the details and current items of a payout batch.
 */
export async function getPayoutBatch(
  payoutBatchId: string,
  actor = "treasurer"
): Promise<{ data: GetPayoutBatchResponse; debugId?: string; status: number }> {
  return paypalFetch<GetPayoutBatchResponse>(
    "GET",
    `/v1/payments/payouts/${payoutBatchId}`,
    undefined,
    {
      schema: GetPayoutBatchResponseSchema,
      actor,
    }
  );
}

/**
 * Retrieves a single payout item by PayPal payout_item_id.
 */
export async function getPayoutItem(
  payoutItemId: string,
  actor = "treasurer"
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

/**
 * Cancels an UNCLAIMED payout item, returning the funds to the fund balance.
 */
export async function cancelPayoutItem(
  payoutItemId: string,
  actor = "treasurer"
): Promise<{ data: PayoutItemDetails; debugId?: string; status: number }> {
  return paypalFetch<PayoutItemDetails>(
    "POST",
    `/v1/payments/payouts-item/${payoutItemId}/cancel`,
    undefined,
    {
      schema: PayoutItemDetailsSchema,
      actor,
    }
  );
}
