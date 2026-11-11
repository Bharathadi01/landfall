/**
 * Where a household's money is sent. Receivers are server-side configuration only: they are never stored in a case,
 * never returned by any API, and never shown in a proposal (the UI shows "payout route configured: yes/no").
 *
 * SANDBOX_RECEIVERS = JSON object { "hh_live_001": "sandbox-personal-account@example.com", ... }
 */
export function receiverFor(householdId: string, env: Record<string, string | undefined> = process.env): string | null {
  try {
    const map = JSON.parse(env.SANDBOX_RECEIVERS ?? "{}") as Record<string, string>;
    const v = map[householdId];
    return typeof v === "string" && v.includes("@") ? v : null;
  } catch {
    return null;
  }
}

export function hasReceiver(householdId: string, env: Record<string, string | undefined> = process.env): boolean {
  return receiverFor(householdId, env) !== null;
}
