import { z } from "zod";
import { paypalFetch } from "./client";

export const CreateOrderRequestSchema = z.object({
  intent: z.literal("CAPTURE").default("CAPTURE"),
  purchase_units: z.array(
    z.object({
      reference_id: z.string().optional().default("default"),
      custom_id: z.string().optional(), // fund_id
      description: z.string().default("Donation to Landfall Emergency Mutual Aid Fund"),
      amount: z.object({
        currency_code: z.literal("USD").default("USD"),
        value: z.string().regex(/^\d+\.\d{2}$/, "Amount must be a 2-decimal USD string"),
      }),
    })
  ),
});

export type CreateOrderRequest = z.input<typeof CreateOrderRequestSchema>;

export const OrderResponseSchema = z.object({
  id: z.string(),
  status: z.string(), // CREATED, SAVED, APPROVED, VOIDED, COMPLETED, PAYER_ACTION_REQUIRED
  intent: z.string().optional(),
  purchase_units: z.array(z.any()).optional(),
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

export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export const CaptureOrderResponseSchema = z.object({
  id: z.string(),
  status: z.string(), // COMPLETED, etc.
  payment_source: z.any().optional(),
  purchase_units: z
    .array(
      z.object({
        reference_id: z.string().optional(),
        payments: z
          .object({
            captures: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.string(),
                  amount: z.object({
                    currency_code: z.string(),
                    value: z.string(),
                  }),
                  final_capture: z.boolean().optional(),
                  create_time: z.string().optional(),
                  update_time: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
  payer: z
    .object({
      name: z.any().optional(),
      email_address: z.string().optional(),
      payer_id: z.string().optional(),
    })
    .optional(),
  links: z.array(z.any()).optional(),
});

export type CaptureOrderResponse = z.infer<typeof CaptureOrderResponseSchema>;

/**
 * Creates an Orders v2 order for donations.
 */
export async function createOrder(
  amountUsd: string,
  fundId?: string,
  actor = "donor"
): Promise<{ data: OrderResponse; debugId?: string; status: number }> {
  const payload: CreateOrderRequest = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: fundId,
        description: "Donation to Landfall Emergency Mutual Aid Fund",
        amount: {
          currency_code: "USD",
          value: amountUsd,
        },
      },
    ],
  };

  return paypalFetch<OrderResponse>("POST", "/v2/checkout/orders", payload, {
    schema: OrderResponseSchema,
    actor,
  });
}

/**
 * Captures an approved Orders v2 order.
 */
export async function captureOrder(
  orderId: string,
  actor = "donor"
): Promise<{ data: CaptureOrderResponse; debugId?: string; status: number }> {
  return paypalFetch<CaptureOrderResponse>(
    "POST",
    `/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      schema: CaptureOrderResponseSchema,
      actor,
    }
  );
}
