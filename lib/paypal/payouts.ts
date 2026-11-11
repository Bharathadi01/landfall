import { z } from "zod";
import { paypalFetch } from "./client";
import { PayoutBatchHeaderResponseSchema, PayoutItemDetailsSchema, type PayoutItemDetails } from "./payout-reads";

// Read-only calls live in ./payout-reads (importable outside lib/treasurer). Re-exported here so
// existing imports (scripts, tests) keep working.
export * from "./payout-reads";

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
