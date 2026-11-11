/**
 * What the guided tour is allowed to touch. The tour only ever navigates, scrolls, highlights and clicks the handful of
 * controls listed here (tabs, view switches, filters, the simulated rehearsal and the two read-only AI buttons). It can never reach
 * a control that moves money, writes a resident's report, refreshes PayPal, or changes data: those are not on the list.
 */

/** Exact visible labels the tour may click. Everything else is refused. */
export const ALLOWED_CLICKS = [
  "Cases",
  "By status",
  "Show unclaimed payments",
  "Tampa Bay 3D",
  "Settlement proof",
  "Check Status & Payments",
  "Rehearse all 8 steps", // simulated rehearsal: the route makes no PayPal request and persists nothing
  "Investigate", // read-only AI investigation of one payment
  "Run the Watch Officer", // read-only AI briefing
] as const;

/** Clicks that call the live AI model (free-tier quota, an audit row each). They need the judge's opt-in. */
export const AI_CLICKS: ReadonlySet<string> = new Set(["Investigate", "Run the Watch Officer"]);

/** Belt and braces: even if a label were ever added to the list by mistake, these words are always refused. */
export const DENIED = /refresh|replay|propose|approve|pay\b|pay now|create account|guest|can.t get to it|i received|submit|send|enrol|sign out|continue as|cancel|reissue|resend|donate|subscribe|delete|remove/i;

export interface ClickCheck {
  ok: boolean;
  reason?: "not_listed" | "denied_word" | "ai_off";
}

export function mayClick(label: string, opts: { ai: boolean }): ClickCheck {
  const l = label.replace(/\s+/g, " ").trim();
  const listed = (ALLOWED_CLICKS as readonly string[]).some((a) => a.toLowerCase() === l.toLowerCase());
  if (!listed) return { ok: false, reason: "not_listed" };
  if (DENIED.test(l)) return { ok: false, reason: "denied_word" };
  if (AI_CLICKS.has(canonical(l)) && !opts.ai) return { ok: false, reason: "ai_off" };
  return { ok: true };
}

const canonical = (l: string) => (ALLOWED_CLICKS as readonly string[]).find((a) => a.toLowerCase() === l.toLowerCase()) ?? l;
