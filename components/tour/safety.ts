/**
 * What the guided tour is allowed to touch. The tour only ever navigates, scrolls, and presses the handful of controls listed here (tabs,
 * view switches, filters, map layers, the simulated rehearsals, and the two read-only AI features). It can never reach a control that moves
 * money, writes a resident's report, refreshes PayPal, or changes data: those are not on the list, and a deny-list backs it up.
 */

/** Exact visible labels the tour may click. Everything else is refused. */
export const ALLOWED_CLICKS = [
  // Payments (AG Grid) — view switches and rule-based filters only
  "Every payment", "Money trail",
  "By stage", "By status", "Flat", "Show unclaimed payments", "Credited but not confirmed", "What needs a person", "Chart $ by status", "Reset", "Show map", "Hide map",
  // Analytics Studio
  "Relief overview", "Treasury & reserve", "Payout recovery", "Accountability", "Ask the AI about this data",
  // Storm Desk (map view + layer chips)
  "Globe", "Gulf", "Tampa Bay 3D", "Clouds", "Radar", "Rain", "Wind", "Warnings",
  // Storm Drill scenarios (read-only)
  "Hurricane Milton (2024)", "Hurricane Helene (2024)", "Hurricane Idalia (2023)",
  // Guided Response (simulated: the route makes no PayPal request and persists nothing)
  "Rehearse all 8 steps",
  // case page + Watch Officer (read-only AI)
  "Investigate", "Ask",
  // Households
  "Recipient Directory", "Appeals Queue",
  // resident portal
  "Enroll Household", "Check Status & Payments", "Check", "Check Case Status",
  // data-source switch (client-side view of the same app)
  "Live Sandbox", "Milton replay",
] as const;

/** Clicks that call the live AI model (free-tier quota, an audit row each). They need the judge's opt-in. */
export const AI_CLICKS: ReadonlySet<string> = new Set(["Investigate", "Ask"]);

/** Typing the tour may do, into fields identified by placeholder / aria-label text. Nothing else can be typed into. */
export const ALLOWED_TYPING = ["Ask about readiness", "Ask the AI Assistant", "Your reference", "6-digit code"] as const;

/** Belt and braces: even if one of these words were ever added to the list by mistake it is refused, except the labelled exceptions below. */
export const DENIED = /refresh|replay|propose|approve|pay\b|pay now|create account|guest|can.t get to it|i received|submit|send|enrol|sign out|continue as|cancel|reissue|resend|donate|subscribe|delete|remove/i;

/** These contain a denied word but are safe: they only switch which data the page shows, or look a payment up. */
const EXCEPTIONS: ReadonlySet<string> = new Set(["milton replay", "live sandbox", "check status & payments", "check case status", "enroll household"]);

export interface ClickCheck {
  ok: boolean;
  reason?: "not_listed" | "denied_word" | "ai_off";
}

const canonical = (l: string) => (ALLOWED_CLICKS as readonly string[]).find((a) => a.toLowerCase() === l.toLowerCase()) ?? l;

export function mayClick(label: string, opts: { ai: boolean }): ClickCheck {
  const l = label.replace(/\s+/g, " ").trim();
  const listed = (ALLOWED_CLICKS as readonly string[]).some((a) => a.toLowerCase() === l.toLowerCase());
  if (!listed) return { ok: false, reason: "not_listed" };
  if (!EXCEPTIONS.has(l.toLowerCase()) && DENIED.test(l)) return { ok: false, reason: "denied_word" };
  if (AI_CLICKS.has(canonical(l)) && !opts.ai) return { ok: false, reason: "ai_off" };
  return { ok: true };
}

export const mayType = (into: string): boolean => (ALLOWED_TYPING as readonly string[]).some((a) => into.toLowerCase().includes(a.toLowerCase()));
