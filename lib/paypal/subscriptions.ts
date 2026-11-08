import { z } from "zod";
import { paypalFetch } from "./client";

export const CreateProductRequestSchema = z.object({
  name: z.string().default("Landfall Mutual Aid Sustainer"),
  description: z.string().default("Monthly recurring contribution to neighborhood relief fund"),
  type: z.literal("SERVICE").default("SERVICE"),
  category: z.string().default("CHARITY"),
});

export const CreatePlanRequestSchema = z.object({
  product_id: z.string(),
  name: z.string().default("Monthly Mutual Aid Sustainer"),
  billing_cycles: z.array(
    z.object({
      frequency: z.object({
        interval_unit: z.literal("MONTH"),
        interval_count: z.number().default(1),
      }),
      tenure_type: z.literal("REGULAR"),
      sequence: z.number().default(1),
      total_cycles: z.number().default(0), // 0 means infinite
      pricing_scheme: z.object({
        fixed_price: z.object({
          value: z.string(),
          currency_code: z.literal("USD").default("USD"),
        }),
      }),
    })
  ),
  payment_preferences: z.object({
    auto_bill_outstanding: z.boolean().default(true),
    setup_fee_failure_action: z.literal("CONTINUE").default("CONTINUE"),
    payment_failure_threshold: z.number().default(3),
  }),
});

export type CreatePlanRequest = z.input<typeof CreatePlanRequestSchema>;

/**
 * Creates a catalog product for sustainer contributions.
 */
export async function createSustainerProduct(actor = "treasury") {
  return paypalFetch<any>(
    "POST",
    "/v1/catalogs/products",
    CreateProductRequestSchema.parse({}),
    { actor }
  );
}

/**
 * Creates a monthly subscription billing plan.
 */
export async function createSustainerPlan(request: CreatePlanRequest, actor = "treasury") {
  const validated = CreatePlanRequestSchema.parse(request);
  return paypalFetch<any>("POST", "/v1/billing/plans", validated, { actor });
}

/**
 * Retrieves the status and details of a subscription.
 */
export async function getSubscription(subscriptionId: string, actor = "treasury") {
  return paypalFetch<any>("GET", `/v1/billing/subscriptions/${subscriptionId}`, undefined, {
    actor,
  });
}
