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

export const CreateSubscriptionRequestSchema = z.object({
  plan_id: z.string(),
  subscriber: z
    .object({
      name: z.object({ given_name: z.string(), surname: z.string() }).optional(),
      email_address: z.string().email(),
    })
    .optional(),
  application_context: z
    .object({
      brand_name: z.string().default("Landfall Mutual Aid"),
      locale: z.string().default("en-US"),
      shipping_preference: z.literal("NO_SHIPPING").default("NO_SHIPPING"),
      user_action: z.literal("SUBSCRIBE_NOW").default("SUBSCRIBE_NOW"),
      return_url: z.string(),
      cancel_url: z.string(),
    })
    .optional(),
});

export type CreateSubscriptionRequest = z.input<typeof CreateSubscriptionRequestSchema>;

export interface PayPalProductResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  category?: string;
  create_time?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalPlanResponse {
  id: string;
  product_id: string;
  name: string;
  status: string;
  description?: string;
  create_time?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalSubscriptionResponse {
  id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  status_update_time?: string;
  plan_id: string;
  start_time?: string;
  quantity?: string;
  shipping_amount?: { currency_code: string; value: string };
  subscriber?: {
    email_address?: string;
    payer_id?: string;
    name?: { given_name?: string; surname?: string };
  };
  billing_info?: {
    outstanding_balance?: { currency_code: string; value: string };
    cycle_executions?: Array<{
      tenure_type: string;
      sequence: number;
      cycles_completed: number;
      cycles_remaining: number;
      total_cycles: number;
    }>;
    last_payment?: {
      amount: { currency_code: string; value: string };
      time: string;
    };
    next_billing_time?: string;
    failed_payments_count?: number;
  };
  create_time?: string;
  update_time?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

/**
 * Creates a catalog product for sustainer contributions.
 */
export async function createSustainerProduct(actor = "treasury"): Promise<PayPalProductResponse> {
  const res = await paypalFetch<PayPalProductResponse>(
    "POST",
    "/v1/catalogs/products",
    CreateProductRequestSchema.parse({}),
    { actor }
  );
  return res.data;
}

/**
 * Creates a monthly subscription billing plan.
 */
export async function createSustainerPlan(
  request: CreatePlanRequest,
  actor = "treasury"
): Promise<PayPalPlanResponse> {
  const validated = CreatePlanRequestSchema.parse(request);
  const res = await paypalFetch<PayPalPlanResponse>("POST", "/v1/billing/plans", validated, { actor });
  return res.data;
}

/**
 * Creates a donor subscription instance for approval.
 */
export async function createSubscription(
  request: CreateSubscriptionRequest,
  actor = "treasury"
): Promise<PayPalSubscriptionResponse> {
  const validated = CreateSubscriptionRequestSchema.parse(request);
  const res = await paypalFetch<PayPalSubscriptionResponse>("POST", "/v1/billing/subscriptions", validated, {
    actor,
  });
  return res.data;
}

/**
 * Retrieves the status and details of a subscription.
 */
export async function getSubscription(
  subscriptionId: string,
  actor = "treasury"
): Promise<PayPalSubscriptionResponse> {
  const res = await paypalFetch<PayPalSubscriptionResponse>(
    "GET",
    `/v1/billing/subscriptions/${subscriptionId}`,
    undefined,
    { actor }
  );
  return res.data;
}

/**
 * Cancels an active donor subscription.
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string,
  actor = "treasury"
): Promise<void> {
  await paypalFetch<void>(
    "POST",
    `/v1/billing/subscriptions/${subscriptionId}/cancel`,
    { reason },
    { actor }
  );
}

/**
 * Suspends an active donor subscription.
 */
export async function suspendSubscription(
  subscriptionId: string,
  reason: string,
  actor = "treasury"
): Promise<void> {
  await paypalFetch<void>(
    "POST",
    `/v1/billing/subscriptions/${subscriptionId}/suspend`,
    { reason },
    { actor }
  );
}
