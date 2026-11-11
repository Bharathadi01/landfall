/**
 * PayPal Agent Toolkit (official, `@paypal/agent-toolkit`) — READ-ONLY use.
 *
 * Only ONE action is enabled: `transactions.list` (PayPal's Transaction Search). Every write action (orders, payouts,
 * invoices, subscriptions, refunds…) is left disabled, so even a fully compromised prompt cannot move money through
 * it. The arguments are built here, on the server, from a stored transaction id — the model never supplies them.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";

export const TOOLKIT_ACTIONS = { transactions: { list: true } } as const;

export interface ToolkitTransaction {
  transactionId: string;
  eventCode: string;
  status: string;
  amount: string;
  currency: string;
  initiated: string;
}

type Runner = Pick<PayPalAgentToolkit, "handleToolCall">;

let toolkit: Runner | null = null;
function getToolkit(): Runner {
  if (!toolkit) {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured");
    toolkit = new PayPalAgentToolkit({ clientId, clientSecret, configuration: { actions: TOOLKIT_ACTIONS as never, context: { sandbox: (process.env.PAYPAL_ENV ?? "sandbox") !== "live" } } });
  }
  return toolkit;
}

const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z");

/** Look up one transaction by id via the toolkit's list_transactions (31-day search window, per PayPal's rules). */
export async function lookupTransaction(transactionId: string, runner: Runner = getToolkit(), now = new Date()): Promise<ToolkitTransaction | null> {
  if (!/^[A-Z0-9]{10,24}$/i.test(transactionId)) throw new Error("Invalid transaction id");
  const out = await runner.handleToolCall({
    id: "landfall_lookup",
    type: "function",
    function: { name: "list_transactions", arguments: JSON.stringify({ transaction_id: transactionId, start_date: iso(new Date(now.getTime() - 30 * 86_400_000)), end_date: iso(now), page_size: 5 }) },
  } as never);
  const body = typeof out.content === "string" ? out.content : JSON.stringify(out.content);
  let parsed: { transaction_details?: Array<{ transaction_info?: Record<string, any> }> };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The toolkit returned something that was not JSON");
  }
  const info = parsed.transaction_details?.find((t) => t.transaction_info?.transaction_id === transactionId)?.transaction_info;
  if (!info) return null;
  return {
    transactionId,
    eventCode: String(info.transaction_event_code ?? ""),
    status: String(info.transaction_status ?? ""),
    amount: String(info.transaction_amount?.value ?? ""),
    currency: String(info.transaction_amount?.currency_code ?? ""),
    initiated: String(info.transaction_initiation_date ?? ""),
  };
}
