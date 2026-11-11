import { z } from "zod";
import { paypalFetch } from "./client";

export const BalancesResponseSchema = z.object({
  balances: z.array(
    z.object({
      currency: z.string(),
      primary: z.boolean().optional(),
      total_balance: z.object({
        currency_code: z.string(),
        value: z.string(),
      }),
      available_balance: z
        .object({
          currency_code: z.string(),
          value: z.string(),
        })
        .optional(),
      withheld_balance: z
        .object({
          currency_code: z.string(),
          value: z.string(),
        })
        .optional(),
    })
  ),
  as_of_time: z.string().optional(),
});

export type BalancesResponse = z.infer<typeof BalancesResponseSchema>;

export const TransactionDetailSchema = z.object({
  transaction_info: z.object({
    paypal_account_id: z.string().optional(),
    transaction_id: z.string(),
    transaction_event_code: z.string().optional(),
    transaction_initiation_date: z.string().optional(),
    transaction_updated_date: z.string().optional(),
    transaction_amount: z.object({
      currency_code: z.string(),
      value: z.string(),
    }),
    fee_amount: z
      .object({
        currency_code: z.string(),
        value: z.string(),
      })
      .optional(),
    transaction_status: z.string().optional(),
    bank_reference_id: z.string().optional(),
  }),
  payer_info: z
    .object({
      account_id: z.string().optional(),
      email_address: z.string().optional(),
      payer_name: z
        .object({
          given_name: z.string().optional(),
          surname: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const TransactionsResponseSchema = z.object({
  transaction_details: z.array(TransactionDetailSchema).optional().default([]),
  account_number: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  last_refresh_time: z.string().optional(),
  page: z.number().optional(),
  total_items: z.number().optional(),
  total_pages: z.number().optional(),
  links: z.array(z.object({ href: z.string(), rel: z.string(), method: z.string() })).optional(),
});

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

/**
 * Retrieves the PayPal account balances.
 */
export async function getAccountBalances(
  actor = "allocator"
): Promise<{ availableUsd: number; totalUsd: number; raw: BalancesResponse }> {
  // No fallback: if PayPal cannot be reached or refuses the call, this throws. It used to return a
  // made-up $5,000.00 balance, which let a reconciliation compare the ledger with invented provider data.
  const res = await paypalFetch<BalancesResponse>(
    "GET",
    "/v1/reporting/balances?currency_code=USD",
    undefined,
    {
      schema: BalancesResponseSchema,
      actor,
    }
  );

  const usdBalance = res.data.balances.find((b) => b.currency === "USD") || res.data.balances[0];
  const available = usdBalance?.available_balance?.value
    ? parseFloat(usdBalance.available_balance.value)
    : parseFloat(usdBalance?.total_balance?.value || "0");
  const total = parseFloat(usdBalance?.total_balance?.value || "0");

  return { availableUsd: available, totalUsd: total, raw: res.data };
}

/**
 * Lists PayPal transactions for a given date window.
 */
export async function listTransactions({
  startDate,
  endDate,
  actor = "treasury",
}: {
  startDate: string;
  endDate: string;
  actor?: string;
}): Promise<TransactionsResponse> {
  const url = `/v1/reporting/transactions?start_date=${encodeURIComponent(
    startDate
  )}&end_date=${encodeURIComponent(endDate)}&fields=transaction_info,payer_info&page_size=100`;

  const res = await paypalFetch<TransactionsResponse>("GET", url, undefined, {
    schema: TransactionsResponseSchema as z.ZodType<TransactionsResponse>,
    actor,
  });

  return res.data;
}

