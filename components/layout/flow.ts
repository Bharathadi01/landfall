import { I, type IconType } from "@/components/icons";

/**
 * THE ORDER OF THE PRODUCT. One list drives the sidebar, the "next step" footer on every console page, and the guided tour, so
 * they can never disagree. It follows the life of a relief payment, the same order a coordinator lives through a storm:
 *
 *   Command Center   where everything stands, and the one thing that needs you
 *   1 Before landfall   watch the official warning; practise on past storms
 *   2 Decide and pay    rules pick who is paid, two people approve, PayPal sends it
 *   3 Did it land?      follow every payment past PayPal's "SUCCESS" to the household's own answer
 */
export interface FlowPage {
  href: string;
  label: string;
  /** One line: what this page is for, in plain words. Shown under the page title and in the sidebar tooltip. */
  purpose: string;
  icon: IconType;
  /** Technology the page is built on, shown quietly in the sidebar so judges can find PayPal, AG Grid and the AI. */
  tag?: "PayPal" | "AG Grid" | "AG Studio" | "AI" | "Live";
}

export interface FlowGroup {
  /** Short stage name. `null` for the home item. */
  stage: string | null;
  /** The question this stage answers. */
  question?: string;
  pages: FlowPage[];
}

export const FLOW: FlowGroup[] = [
  {
    stage: null,
    pages: [
      { href: "/console/war-room", label: "Command Center", purpose: "Where every payment stands, and what needs a person now.", icon: I.dashboard },
    ],
  },
  {
    stage: "Before landfall",
    question: "Who is in the storm’s path?",
    pages: [
      { href: "/console/sentinel", label: "Storm Desk", purpose: "Official warnings, live, over the homes enrolled for relief.", icon: I.radar, tag: "Live" },
      { href: "/console/rehearsal", label: "Storm Drill", purpose: "Practise the whole response on real past hurricanes. Nothing is paid.", icon: I.lab },
    ],
  },
  {
    stage: "Decide and pay",
    question: "Who gets paid, and who agreed?",
    pages: [
      { href: "/console/golden-flow", label: "Guided Response", purpose: "From warning to PayPal payout in eight steps, rehearsed safely.", icon: I.flow },
      { href: "/console/proposals", label: "Approvals", purpose: "Nothing moves money until two different people approve it.", icon: I.twoKeyApproval, tag: "PayPal" },
      { href: "/console/recipients", label: "Households", purpose: "Who is enrolled, what was checked, and their appeals.", icon: I.household },
    ],
  },
  {
    stage: "Did it land?",
    question: "Did the money reach each family?",
    pages: [
      { href: "/console/payments", label: "Payments", purpose: "Every PayPal payment, past “SUCCESS” to the household’s own answer.", icon: I.payout, tag: "AG Grid" },
      { href: "/console/watch-officer", label: "AI Watch Officer", purpose: "Ask why. The AI reads the evidence and cites it; it can never pay.", icon: I.aiAdvisor, tag: "AI" },
      { href: "/console/studio", label: "Analytics Studio", purpose: "Explore every relief dollar, or ask the data a question.", icon: I.chart, tag: "AG Studio" },
    ],
  },
];

export const FLOW_PAGES: FlowPage[] = FLOW.flatMap((g) => g.pages);

export function flowIndex(pathname: string): number {
  if (pathname.startsWith("/console/cases/")) return FLOW_PAGES.findIndex((p) => p.href === "/console/payments");
  return FLOW_PAGES.findIndex((p) => p.href === pathname);
}

export function flowPage(pathname: string): FlowPage | undefined {
  const i = flowIndex(pathname);
  return i >= 0 ? FLOW_PAGES[i] : undefined;
}

export function flowStage(pathname: string): FlowGroup | undefined {
  const p = flowPage(pathname);
  return p ? FLOW.find((g) => g.pages.includes(p)) : undefined;
}

export function nextFlowPage(pathname: string): FlowPage | undefined {
  const i = flowIndex(pathname);
  return i >= 0 && i < FLOW_PAGES.length - 1 ? FLOW_PAGES[i + 1] : undefined;
}
