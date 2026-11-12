/**
 * The guided tour as DATA, in the order of the product itself: the public site from top to bottom, the door, the Command Center, then the
 * three stages of a response exactly as the sidebar lists them (Before landfall → Decide and pay → Did it land?), then the resident's side and
 * what is real. Each chapter is one page and walks it top to bottom; each section frames one thing on screen and says what it is.
 * A section may press allow-listed controls (see ./safety.ts). Every chapter carries a provenance badge so a judge always knows whether this is
 * real Sandbox data, a live public feed, a live AI run, replay data or a simulation.
 */
export type Badge = "REAL_SANDBOX" | "LIVE_FEED" | "LIVE_AI" | "REPLAY" | "SIMULATED" | "NOTE";

export const BADGE_LABEL: Record<Badge, string> = {
  REAL_SANDBOX: "Real PayPal Sandbox",
  LIVE_FEED: "Live public feeds",
  LIVE_AI: "Live AI",
  REPLAY: "Replay data",
  SIMULATED: "Simulated",
  NOTE: "About the demo",
};

export interface Target {
  /** CSS selector (first visible match). */
  css?: string;
  /** Visible text the element contains (deepest visible match). */
  text?: string;
  /** Match the text exactly (the whole element text), not as a substring. */
  exact?: boolean;
  /** Use this many levels up from the matched element. */
  up?: number;
}

export type Action =
  | { click: string; waitText?: string[]; waitCss?: string; waitGone?: string; timeoutMs?: number }
  | { type: { into: string; text: string; enter?: boolean }; waitText?: string[]; timeoutMs?: number }
  | { expandRow: true }
  | { fillResident: true }
  | { wait: number };

export interface Section {
  caption: string;
  /** Shown instead of `caption` when the judge switched the live AI off. */
  captionNoAi?: string;
  /** What to frame. No target = the top of the page (nothing is spotlit). */
  target?: Target;
  actions?: Action[];
  /** Dwell time once everything is in place (scaled by the tour speed). */
  ms?: number;
  /** This section calls the live AI model, so it only runs when the judge opted in. */
  ai?: boolean;
  /** Override the chapter's badge for this section. */
  badge?: Badge;
}

export interface Chapter {
  id: string;
  title: string;
  /** Which part of the product this chapter belongs to (shown in the outline and the dock). */
  part: "The public site" | "Command Center" | "Before landfall" | "Decide and pay" | "Did it land?" | "The resident" | "The demo";
  badge: Badge;
  /** Where to be. A function resolves it at run time (for example, "the first unclaimed payment"). */
  route: string | (() => Promise<string | null>);
  /** Wait for this before starting. */
  ready?: Target;
  sections: Section[];
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

const H1 = { css: "h1" };

export const CHAPTERS: Chapter[] = [
  /* ── the public site, top to bottom ─────────────────────── */
  {
    id: "home",
    title: "Why Landfall exists",
    part: "The public site",
    badge: "LIVE_FEED",
    route: "/",
    ready: H1,
    sections: [
      { target: H1, caption: "When an official hurricane warning is issued, Landfall turns it into cash for the families in its path: decided by rules, checked by AI, approved by two people, paid through PayPal. The globe is live NASA satellite imagery.", ms: 7500 },
      { target: { css: "#gap" }, caption: "The problem: aid often arrives weeks after the storm, and a payment “credited” to an account is not the same as help a family can use. Every figure links to its source.", ms: 7000 },
      { target: { css: "#how" }, caption: "How it works, on the clock: warn, decide, check, approve, pay, and then confirm with the family. As you scroll, each step lights up.", ms: 6500 },
      { target: { css: "#how-it-works ol li:last-child" }, caption: "The last step is the one most systems skip: PayPal’s “SUCCESS” is not the finish line. Landfall asks the household until they answer.", ms: 6500 },
      { target: { css: "#assure" }, caption: "Beyond “paid”: five facts about every payment, each with who said it. PayPal’s word and the family’s word are never merged.", ms: 6500 },
      { target: { css: "#give" }, caption: "Money in: donors give through PayPal’s own checkout, once or monthly (Sandbox play money). The tour never pays; try the PayPal or card button yourself.", ms: 7000 },
      { target: { css: "#studio-h" }, caption: "Every payment lives in an AG Grid, and Analytics Studio (AG Studio) lets anyone explore the relief data or ask it a question.", ms: 6000 },
      { target: { css: "#safe" }, caption: "Safety by design: rules decide money, the AI cannot move it, and two different people approve the exact plan.", ms: 6500 },
    ],
  },
  {
    id: "door",
    title: "The door: choose a seat",
    part: "The public site",
    badge: "NOTE",
    route: "/signin",
    ready: H1,
    sections: [
      { target: H1, caption: "Inside is the relief console. Three fictional seats: a coordinator, a finance director and a read-only judge. The server enforces each role on every request, so a read-only seat genuinely cannot move money.", ms: 7000 },
      { target: { css: "[data-testid=signin-judge-viewer]" }, caption: "The tour signs you in as the read-only Judge. To try the two-person rule yourself later, approve as Dana, then as Sam.", ms: 5500 },
    ],
  },

  /* ── the console's home ─────────────────────────────────── */
  {
    id: "command",
    title: "Command Center",
    part: "Command Center",
    badge: "REAL_SANDBOX",
    route: "/console/war-room",
    ready: H1,
    sections: [
      { target: H1, caption: "The console opens on one question: what needs a person right now? These are real PayPal Sandbox payments.", ms: 6000 },
      { target: { css: "[data-testid=response-path]" }, caption: "A relief response has three stages, and the sidebar follows them: before landfall, decide and pay, and did it land.", ms: 6000 },
      { target: { text: "Where each payment is" , up: 2 }, caption: "Where each payment is, in five facts. PayPal’s “SUCCESS” means credited to an account; it is not proof the family can use it. That gap is called out in words.", ms: 7500 },
      { target: { css: "#needs-person" , up: 2 }, caption: "What needs a person, ranked by stated rules. Each row has one clear next step, and opens the payment where the AI can investigate.", ms: 6500 },
      { target: { css: "#the-fund", up: 2 }, caption: "The fund: what is free to send, the protected reserve that is never spent, and what has gone to PayPal, from the ledger.", ms: 6000 },
    ],
  },

  /* ── 1 · before landfall ────────────────────────────────── */
  {
    id: "storm-desk",
    title: "Storm Desk",
    part: "Before landfall",
    badge: "LIVE_FEED",
    route: "/console/sentinel",
    ready: { css: "canvas" },
    sections: [
      { target: { css: "section[aria-label='Live weather globe']" }, caption: "Official warnings, live: the National Hurricane Center, the National Weather Service, NASA satellite clouds and radar. Homes are clustered, so no one’s exact address is shown.", ms: 7000 },
      { target: { css: "section[aria-label='Live weather globe']" }, actions: [{ click: "Tampa Bay 3D" }, { wait: 2500 }], caption: "Tampa Bay in 3D, with live radar, warning shapes and household clusters.", ms: 5500 },
      { target: { css: "section[aria-label='Live weather globe']" }, actions: [{ click: "Wind" }, { wait: 1600 }, { click: "Wind" }, { wait: 800 }], caption: "Each layer switches on and off: clouds, radar, rain, wind, warnings and households.", ms: 4500 },
      { target: { css: "section[aria-label='Live weather globe']" }, actions: [{ click: "Globe" }, { wait: 2500 }], caption: "Zoom out to the whole globe.", ms: 4000 },
      { target: { css: "#alerts-h", up: 3 }, caption: "Every active official alert, and for the one selected, plainly: where it applies, what it would trigger, and that two people must approve before any payout. Code tests who is inside; the AI never does.", ms: 8000 },
      { target: { css: "#ground-h" }, caption: "Conditions at the fund: the community funds, the nearest official weather station, and the next eight hours.", ms: 5500 },
    ],
  },
  {
    id: "storm-drill",
    title: "Storm Drill",
    part: "Before landfall",
    badge: "SIMULATED",
    route: "/console/rehearsal",
    ready: H1,
    sections: [
      { target: H1, caption: "Practise on real past hurricanes before the next one. A safe simulation: nothing is sent to PayPal.", ms: 5500 },
      { target: { css: "#scen-h", up: 2 }, actions: [{ click: "Hurricane Helene (2024)" }, { wait: 1200 }], caption: "Pick a storm and one of seven stress tests (shortfalls, false alarms, failed payouts) and the whole drill re-runs on it.", ms: 6000 },
      { target: { css: "#exp-h", up: 1 }, caption: "Who is in the warning area, who is paid first, and who waits for review.", ms: 5500 },
      { target: { css: "#lad-h", up: 2 }, caption: "Can the fund pay before the storm? Cash at PayPal, minus a protected reserve that is never spent.", ms: 6000 },
      { target: { css: "#appr-h", up: 1 }, caption: "The two-person approval, rehearsed. Real approvals happen on the Approvals page.", ms: 5000 },
      { target: { css: "#rec-h", up: 2 }, caption: "And the receipt: what was sent, the PayPal fees, what reached families, and an audit hash.", ms: 5000 },
    ],
  },

  /* ── 2 · decide and pay ─────────────────────────────────── */
  {
    id: "guided",
    title: "Guided Response",
    part: "Decide and pay",
    badge: "SIMULATED",
    route: "/console/golden-flow",
    ready: H1,
    sections: [
      { target: H1, caption: "From donation to doorstep in eight steps. A safe rehearsal: no PayPal request is made.", ms: 4500 },
      { actions: [{ click: "Rehearse all 8 steps", waitText: ["8 of 8 complete"], timeoutMs: 25000 }], target: { text: "of 8 complete", up: 1 }, caption: "Money in, the reserve check, the warning, who is exposed, who gets paid, two approvals, the PayPal payout and the proof. Choose any step to see its evidence.", ms: 8000 },
    ],
  },
  {
    id: "approvals",
    title: "Approvals",
    part: "Decide and pay",
    badge: "REAL_SANDBOX",
    route: "/console/proposals",
    ready: H1,
    sections: [
      { target: { css: "ol[aria-label='How an approval works']" }, caption: "Nothing moves money until two different people approve the exact plan, one of them from Finance. Then the Treasurer, which is code and not AI, sends it once.", ms: 8000 },
      { target: { css: "#queue-h" }, caption: "Each proposal shows its two approval slots filling in. As a read-only judge you can look, not approve.", ms: 5500 },
    ],
  },
  {
    id: "households",
    title: "Households",
    part: "Decide and pay",
    badge: "REPLAY",
    route: "/console/recipients",
    ready: H1,
    sections: [
      { actions: [{ click: "Milton replay" }, { wait: 2500 }], target: { css: "[role=tablist][aria-label='Households views']" }, caption: "The household directory, shown on the Milton replay data. Personal details stay encrypted unless someone opens them, and that is logged.", ms: 7000 },
      { actions: [{ click: "Appeals Queue" }, { wait: 1500 }], target: { css: "[role=tablist][aria-label='Households views']" }, caption: "Residents can appeal any decision; this is where a coordinator sees them.", ms: 5000 },
      { actions: [{ click: "Recipient Directory" }, { wait: 600 }, { click: "Live Sandbox" }, { wait: 1500 }], caption: "Back to the live Sandbox data.", ms: 2500, badge: "REAL_SANDBOX" },
    ],
  },

  /* ── 3 · did it land? ───────────────────────────────────── */
  {
    id: "payments",
    title: "Payments, in AG Grid",
    part: "Did it land?",
    badge: "REAL_SANDBOX",
    route: "/console/payments",
    ready: { css: ".ag-row" },
    sections: [
      { target: { css: "section[aria-label='Relief delivery cases']" }, caption: "Every PayPal payment in one AG Grid Enterprise table: grouping, master–detail evidence, set filters, a live status bar, charts and export.", ms: 6500 },
      { target: { css: "section[aria-label='Relief delivery cases']" }, actions: [{ click: "By status" }, { wait: 1200 }], caption: "Grouped by PayPal’s own status: credited, unclaimed, returned. A batch can say SUCCESS while its items say otherwise.", ms: 6000 },
      { target: { css: "section[aria-label='Relief delivery cases']" }, actions: [{ click: "Show unclaimed payments" }, { wait: 1200 }], caption: "One click filters to what is unclaimed. These quick filters are rules, not AI.", ms: 5000 },
      { target: { css: ".ag-root-wrapper" }, actions: [{ expandRow: true }, { wait: 1500 }], caption: "Each row opens its evidence chain: the obligation, the approvals, the PayPal item, any webhook, the ledger and what the resident has said.", ms: 7000 },
      { target: { css: "section[aria-label='Relief delivery cases']" }, actions: [{ click: "Show map" }, { wait: 2500 }], caption: "The grid talks to a map: select a payment and the globe flies to its zone; click a cluster and the grid filters to it.", ms: 6000 },
      { actions: [{ click: "Chart $ by status" }, { wait: 1500 }], target: { text: "Dollars by PayPal status", up: 3 }, caption: "Dollars by PayPal status, charted from the same rows with AG Grid’s integrated charts.", ms: 5500 },
      { actions: [{ click: "Reset" }, { wait: 600 }, { click: "Hide map" }, { wait: 400 }, { click: "Money trail" }, { wait: 1800 }], target: { css: "[role=tablist][aria-label='Payments views']" }, caption: "The money trail: where every dollar sits, how one payment is traced from donor to proof, and the tests behind the safety claims.", ms: 7000 },
    ],
  },
  {
    id: "case",
    title: "One payment, investigated by AI",
    part: "Did it land?",
    badge: "REAL_SANDBOX",
    route: firstCaseRoute,
    ready: { text: "Investigate with AI" },
    sections: [
      { target: H1, caption: "One payment: who it is for, what PayPal says, and how many days are left to claim it.", ms: 5500 },
      { target: { css: "#ev-h", up: 1 }, caption: "Its evidence, each piece marked present, missing or not expected, and who reported it. Missing evidence is shown as missing, never assumed.", ms: 7000 },
      { ai: true, target: { css: "[data-testid=case-officer]" }, actions: [{ click: "Investigate", waitText: ["What the evidence shows"], timeoutMs: 45000 }], caption: "A live model reads the evidence and asks PayPal for the live status and its own transaction record, through PayPal’s Agent Toolkit. It cites every fact, marks guesses as unconfirmed, and drafts a message to the resident. A person decides.", captionNoAi: "Live AI is off for this tour. “Investigate” lets a model read the evidence and ask PayPal for the live status; it cites every fact, marks guesses as unconfirmed and drafts a message to the resident. A person decides.", ms: 10000, badge: "LIVE_AI" },
      { target: { css: "[data-testid=recovery-panel]" }, caption: "What the recovery rules allow right now. Cancelling or re-sending an unclaimed payment is refused while it is still claimable.", ms: 6500 },
    ],
  },
  {
    id: "watch-officer",
    title: "AI Watch Officer",
    part: "Did it land?",
    badge: "LIVE_AI",
    route: "/console/watch-officer",
    ready: H1,
    sections: [
      { target: { css: "[data-testid=wo-ask]" }, caption: "Ask why. The answer comes only from server evidence; the AI cannot invent amounts or call anything that moves money.", ms: 5000 },
      { ai: true, actions: [{ type: { into: "Ask about readiness", text: "What is our verified funding gap and how much cash is available?" } }, { click: "Ask", waitGone: "[data-testid=wo-working]", timeoutMs: 60000 }], target: { css: "[data-testid=wo-answer]" }, caption: "The answer, drawn as a draft with a dashed edge, because that is what it is: advice for a person. It says which model wrote it and how long it took.", captionNoAi: "Live AI is off for this tour. A question typed here is answered below, drawn as a draft and labelled with the model that wrote it.", ms: 8000, badge: "LIVE_AI" },
      { target: { css: "#wo-facts", up: 2 }, caption: "What it found, with a citation on every fact. Press a citation and the evidence it rests on lights up on the right.", ms: 6500 },
      { target: { css: "[aria-label='The evidence the AI read']" }, caption: "The numbers and sources it was allowed to read: storm, households, treasury, policy, payouts and reconciliation.", ms: 5500 },
    ],
  },
  {
    id: "studio",
    title: "Analytics Studio, on AG Studio",
    part: "Did it land?",
    badge: "REPLAY",
    route: "/console/studio",
    ready: { css: ".ag-root-wrapper" },
    sections: [
      { target: { css: "[data-testid=studio-data-line]" }, caption: "Analytics Studio, built on AG Studio, over the Milton replay so every widget has a full evidence chain. Click any chart and the whole board filters.", ms: 6500 },
      { actions: [{ click: "Treasury & reserve" }, { wait: 1800 }], caption: "Treasury and reserve: the protected reserve against the policy floor.", ms: 5000 },
      { actions: [{ click: "Payout recovery" }, { wait: 1800 }], caption: "Payout recovery: unresolved value by PayPal status and age, a lifecycle timeline, and the evidence chain for any payment, in custom widgets.", ms: 6000 },
      { actions: [{ click: "Accountability" }, { wait: 1800 }], caption: "Accountability: grievances, the resident roster with personal details protected, and approvals.", ms: 5000 },
      { ai: true, actions: [{ click: "Ask the AI about this data" }, { wait: 1500 }, { type: { into: "Ask the AI Assistant", text: "Which payments are unclaimed?", enter: true }, waitText: ["unclaimed", "Unclaimed", "UNCLAIMED"], timeoutMs: 45000 }], caption: "Ask the Studio agent in plain English. It queries the data itself, can only read and rearrange this board, and has no tool that moves money.", captionNoAi: "Live AI is off for this tour. “Ask the AI about this data” opens an agent that answers by querying the data itself; it can only read and rearrange the board and has no tool that moves money.", ms: 8500, badge: "LIVE_AI" },
    ],
  },

  /* ── the resident ───────────────────────────────────────── */
  {
    id: "resident",
    title: "The resident’s side",
    part: "The resident",
    badge: "REAL_SANDBOX",
    route: "/r/enroll",
    ready: H1,
    sections: [
      { target: H1, caption: "Residents get their own plain-language page, in English, Spanish, Vietnamese and Haitian Creole. Enrolling takes five short steps.", ms: 5500 },
      { actions: [{ click: "Check Status & Payments" }, { wait: 800 }, { fillResident: true }, { click: "Check", waitText: ["waiting for you to claim", "claim", "Sent to PayPal"], timeoutMs: 20000 }], target: { text: "Check my payment" }, caption: "A resident enters a reference and a six-digit code and sees their own payment in plain words. What they report is saved as “reported by you”, never as PayPal’s confirmation.", ms: 9000 },
    ],
  },
  {
    id: "appeals",
    title: "Report a problem",
    part: "The resident",
    badge: "REAL_SANDBOX",
    route: "/r/complaints",
    ready: H1,
    sections: [
      { target: H1, caption: "Residents can report a problem or appeal a decision, with a reply promised within 24 hours.", ms: 5500 },
      { actions: [{ click: "Check Case Status" }, { wait: 1000 }], caption: "And later check where their case stands. The tour submits nothing.", ms: 4500 },
    ],
  },

  /* ── what is real ───────────────────────────────────────── */
  {
    id: "judge-card",
    title: "What is real, and what is not",
    part: "The demo",
    badge: "NOTE",
    route: "/judges",
    ready: H1,
    sections: [
      { target: { text: "Resident test households" }, caption: "The judge test card: fictional households with their codes, so anyone can try the resident side.", ms: 5500 },
      { target: { text: "What is real, and what is not" }, caption: "Sandbox is PayPal play money, replay data is always labelled, and the AI never moves money. Every relief payment deserves an answer.", ms: 7500 },
    ],
  },
];

export const TOTAL_SECTIONS = CHAPTERS.reduce((n, c) => n + c.sections.length, 0);
export const PARTS = Array.from(new Set(CHAPTERS.map((c) => c.part)));
