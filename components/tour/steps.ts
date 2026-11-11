/**
 * The guided tour as DATA: where to go, what to highlight, which (allow-listed) controls to press, and what to say.
 * Every caption carries a provenance badge so a judge always knows whether they are looking at real Sandbox data,
 * a live public feed, a live AI run, replay data, or a simulation.
 */
export type Badge = "REAL_SANDBOX" | "LIVE_FEED" | "LIVE_AI" | "REPLAY" | "SIMULATED" | "NOTE";

export const BADGE_LABEL: Record<Badge, string> = {
  REAL_SANDBOX: "Real PayPal Sandbox",
  LIVE_FEED: "Live public feeds",
  LIVE_AI: "Live AI",
  REPLAY: "Replay data",
  SIMULATED: "Simulated",
  NOTE: "Note",
};

export interface Target {
  /** CSS selector (first visible match). */
  css?: string;
  /** Visible text the element contains (deepest visible match). */
  text?: string;
  /** Match the text exactly (the whole element text), not as a substring. */
  exact?: boolean;
  /** Highlight this many levels up from the matched element (e.g. a card instead of its heading). */
  up?: number;
}

export type Action =
  | { click: string; waitText?: string[]; waitCss?: string; timeoutMs?: number }
  | { wait: number };

export interface Step {
  id: string;
  title: string;
  caption: string;
  /** Shown instead of `caption` when the judge switched the live AI off for this tour. */
  captionNoAi?: string;
  badge: Badge;
  /** Where to be. A function resolves it at run time (for example, "the first unclaimed payment"). */
  route?: string | (() => Promise<string | null>);
  target?: Target;
  /** Wait for this before showing the step (the page's own content). */
  ready?: Target;
  actions?: Action[];
  /** Minimum time to leave the step on screen once everything is ready. */
  ms: number;
  /** This step calls the live AI model when the judge has opted in. */
  ai?: boolean;
}

/** The first unclaimed live Sandbox payment (or any payment) in the data source the judge is looking at. */
async function firstCaseRoute(): Promise<string | null> {
  try {
    const r = await fetch("/api/cases", { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { cases?: Array<{ caseRef: string; status: string; origin?: string }> };
    const cs = j.cases ?? [];
    const pick = cs.find((c) => c.status === "UNCLAIMED" && c.origin === "SANDBOX_LIVE") ?? cs.find((c) => c.status === "UNCLAIMED") ?? cs[0];
    return pick ? `/console/cases/${encodeURIComponent(pick.caseRef)}` : null;
  } catch {
    return null;
  }
}

export const STEPS: Step[] = [
  {
    id: "question",
    title: "The question",
    badge: "REAL_SANDBOX",
    route: "/console/war-room",
    ready: { css: "h1" },
    target: { text: "PayPal SUCCESS means credited" },
    caption: "PayPal says a payout batch is SUCCESS. But did each household actually get the money? Landfall keeps two facts apart: PayPal credited it, and the resident confirmed it.",
    ms: 6500,
  },
  {
    id: "money",
    title: "Where the money is",
    badge: "REAL_SANDBOX",
    route: "/console/war-room",
    target: { text: "Cash in PayPal account" },
    caption: "Cash comes from the ledger, posted from PayPal's own statuses. A protected reserve is kept back and cannot be spent.",
    ms: 6000,
  },
  {
    id: "donation",
    title: "Money in",
    badge: "REAL_SANDBOX",
    route: "/",
    ready: { css: "#paypal" },
    target: { css: "#paypal .glass-strong" },
    caption: "Donors pay through PayPal's own checkout (Sandbox, play money). The tour never pays: try the PayPal or card button yourself.",
    ms: 7500,
  },
  {
    id: "storm",
    title: "Who is in the storm's path",
    badge: "LIVE_FEED",
    route: "/console/sentinel",
    ready: { css: "canvas" },
    actions: [{ click: "Tampa Bay 3D" }, { wait: 2600 }],
    target: { css: "canvas" },
    caption: "Official warnings, live: the National Hurricane Center, the National Weather Service, NASA satellite and radar. Homes are clustered, so no one's exact address is shown.",
    ms: 8000,
  },
  {
    id: "guided",
    title: "From warning to payout",
    badge: "SIMULATED",
    route: "/console/golden-flow",
    ready: { css: "h1" },
    actions: [{ click: "Rehearse all 8 steps", waitText: ["8 of 8 complete"], timeoutMs: 25000 }],
    target: { text: "Who gets paid" },
    caption: "Eight steps from donation to doorstep: rules decide who is paid, AI checks, two people approve. This is a safe rehearsal: no PayPal request is made.",
    ms: 6500,
  },
  {
    id: "cases",
    title: "Every payment has its own answer",
    badge: "REAL_SANDBOX",
    route: "/console/war-room",
    ready: { css: "h1" },
    actions: [{ click: "Cases", waitCss: ".ag-row" }, { click: "By status" }, { wait: 900 }, { click: "Show unclaimed payments" }],
    target: { css: ".ag-root-wrapper" },
    caption: "Grouped by PayPal's own status and filtered to what is unclaimed. Each row opens its evidence chain: PayPal batch and item, ledger entry, webhook, resident confirmation. Batch SUCCESS is not “everyone was paid”.",
    ms: 8500,
  },
  {
    id: "case",
    title: "One payment, in detail",
    badge: "REAL_SANDBOX",
    route: firstCaseRoute,
    ready: { text: "Investigate with AI" },
    target: { text: "Evidence", exact: true, up: 1 },
    caption: "Seven pieces of evidence, each marked present, missing or not expected, and what the recovery rules allow right now.",
    ms: 6500,
  },
  {
    id: "case-ai",
    title: "The AI Case Officer",
    badge: "LIVE_AI",
    ai: true,
    actions: [{ click: "Investigate", waitText: ["What the evidence shows"], timeoutMs: 45000 }],
    target: { text: "What the evidence shows" },
    caption: "A live model reads the stored evidence and asks PayPal for the item's current status. It cites every fact, labels guesses as unconfirmed, and can only suggest what the rules allow. A person decides.",
    captionNoAi: "Live AI is off for this tour. On this page, “Investigate” lets a model read the stored evidence and ask PayPal for the item's live status; it cites every fact, labels guesses as unconfirmed, and can only suggest what the rules allow. A person decides.",
    ms: 9500,
  },
  {
    id: "watch",
    title: "The AI Watch Officer",
    badge: "LIVE_AI",
    ai: true,
    route: "/console/watch-officer",
    ready: { css: "h1" },
    actions: [{ click: "Run the Watch Officer", waitText: ["AI · openai", "OFFLINE"], timeoutMs: 45000 }],
    target: { text: "4-Quadrant Evidence Workspace" },
    caption: "A briefing that separates verified facts from hypotheses and unknowns, and lists the human action required. An AI that explains, never one that pays.",
    captionNoAi: "Live AI is off for this tour. “Run the Watch Officer” produces a briefing that separates verified facts from hypotheses and unknowns and lists the human action required. An AI that explains, never one that pays.",
    ms: 8500,
  },
  {
    id: "settlement",
    title: "Settlement view",
    badge: "REPLAY",
    route: "/console/war-room",
    ready: { css: "h1" },
    actions: [{ click: "Settlement proof" }, { wait: 800 }],
    target: { text: "PayPal End-to-End Money Path Explorer" },
    caption: "This storyline is a labelled replay of Hurricane Milton (2024): fictional people and dates. It shows how a payment is traced, not this fund's payments.",
    ms: 7000,
  },
  {
    id: "approvals",
    title: "Two people, not one",
    badge: "REAL_SANDBOX",
    route: "/console/proposals",
    ready: { css: "h1" },
    target: { text: "Nothing moves money until two different people" },
    caption: "Nothing moves money until two different people approve the exact action, one of them from Finance. The Treasurer then runs it once. As a judge you can look, not approve.",
    ms: 7000,
  },
  {
    id: "resident",
    title: "The resident's side",
    badge: "REAL_SANDBOX",
    route: "/r/enroll",
    ready: { css: "h1" },
    actions: [{ click: "Check Status & Payments" }, { wait: 700 }],
    target: { text: "Check my payment" },
    caption: "A resident enters a reference and a six-digit code (on the judge card) and sees their own payment in plain words. What they report is saved as “reported by you”, never as PayPal's confirmation.",
    ms: 7500,
  },
  {
    id: "close",
    title: "What is real, and what is not",
    badge: "NOTE",
    route: "/judges",
    ready: { css: "h1" },
    target: { text: "What is real, and what is not" },
    caption: "Sandbox is PayPal play money, replay data is labelled, and the AI never moves money. Every relief payment deserves an answer.",
    ms: 7500,
  },
];
