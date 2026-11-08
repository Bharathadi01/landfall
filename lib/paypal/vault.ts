import { z } from "zod";
import { paypalFetch } from "./client";

export const CreateSetupTokenRequestSchema = z.object({
  payment_source: z.object({
    paypal: z.object({
      usage_type: z.literal("MERCHANT"),
      customer_type: z.literal("CONSUMER").default("CONSUMER"),
      experience_context: z
        .object({
          brand_name: z.string().default("Landfall Mutual Aid"),
          return_url: z.string(),
          cancel_url: z.string(),
        })
        .optional(),
    }),
  }),
});

export type CreateSetupTokenRequest = z.input<typeof CreateSetupTokenRequestSchema>;

export const SetupTokenResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
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

export type SetupTokenResponse = z.infer<typeof SetupTokenResponseSchema>;

export const CreatePaymentTokenRequestSchema = z.object({
  payment_source: z.object({
    token: z.object({
      id: z.string(),
      type: z.literal("SETUP_TOKEN"),
    }),
  }),
});

export const PaymentTokenResponseSchema = z.object({
  id: z.string(),
  customer: z.object({ id: z.string().optional() }).optional(),
  status: z.string().optional(),
  payment_source: z.record(z.any()).optional(),
});

export type PaymentTokenResponse = z.infer<typeof PaymentTokenResponseSchema>;

/**
 * Creates a Vault v3 Setup Token to save PayPal payment method without purchase.
 */
export async function createVaultSetupToken(
  request: CreateSetupTokenRequest,
  actor = "pledge_engine"
): Promise<{ data: SetupTokenResponse; status: number; debugId?: string }> {
  const validated = CreateSetupTokenRequestSchema.parse(request);
  return paypalFetch<SetupTokenResponse>(
    "POST",
    "/v3/vault/setup-tokens",
    validated,
    {
      schema: SetupTokenResponseSchema,
      actor,
    }
  );
}

/**
 * Exchanges an approved Setup Token for a permanent Vault v3 Payment Token.
 */
export async function exchangeSetupTokenForPaymentToken(
  setupTokenId: string,
  actor = "pledge_engine"
): Promise<{ data: PaymentTokenResponse; status: number; debugId?: string }> {
  const payload = {
    payment_source: {
      token: {
        id: setupTokenId,
        type: "SETUP_TOKEN",
      },
    },
  };

  return paypalFetch<PaymentTokenResponse>(
    "POST",
    "/v3/vault/payment-tokens",
    payload,
    {
      schema: PaymentTokenResponseSchema,
      actor,
    }
  );
}
