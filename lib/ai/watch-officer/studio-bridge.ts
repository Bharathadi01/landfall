/**
 * STUDIO AGENT FRAMEWORK BRIDGE (§3, §4, §5)
 * Integrates Watch Officer operational intelligence with AG Grid War Room.
 * Translates natural-language operational queries into declarative AG Grid filter/sort models.
 *
 * Invariants:
 * - Read-only view manipulations only (filters, column sorting, highlight rows).
 * - ZERO mutation of financial state, policy engine, or recipient data.
 * - Does not call PayPal Payouts or approve payout plans.
 */

import { RELIEF_CASES } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";

const usd0 = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const caseStats = (pred: (c: (typeof RELIEF_CASES)[number]) => boolean) => {
  const rows = RELIEF_CASES.filter(pred);
  return { n: rows.length, usd: rows.reduce((t, c) => t + c.amountUsd, 0) };
};

export interface GridFilterIntent {
  column: "priorityTier" | "zone" | "status" | "hasMedicalDevice" | "recipientPath" | "payoutStatus" | "nextActionKey" | "needsPerson";
  operator: "equals" | "contains" | "in" | "lessThanOrEqual";
  value: any;
  explanation: string;
}

export interface StudioAgentCommand {
  type: "FILTER_GRID" | "RESET_FILTERS" | "SORT_GRID" | "SIMULATE_SCENARIO" | "INFO";
  filters?: GridFilterIntent[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  scenarioId?: "BASELINE" | "CONSTRAINED_RESERVE" | "PRIORITY_TIER_FOCUS";
  agentResponse: string;
}

export const STUDIO_SUGGESTED_PROMPTS = [
  "Show me the households in the highest-risk zone and compare the required assistance against currently allocatable funds",
  "Focus on Tier 1 life-safety medical device households",
  "Filter to Coastal Surge Evacuation Zone A",
  "Simulate reduced reserve buffer scenario",
  "Filter to confirmed disaster exposure only",
  "Sort households by priority tier",
  "Reset all grid filters",
] as const;

/**
 * Deterministic query parser for Studio Agent commands when Groq Free Plan is in fallback,
 * or as a post-processor for natural-language agent instructions.
 */
export function interpretStudioQuery(query: string): StudioAgentCommand {
  const normalized = query.toLowerCase().trim();

  // Complex multi-intent query: "Show me the households in the highest-risk zone and compare the required assistance against currently allocatable funds"
  if (
    (normalized.includes("highest") && (normalized.includes("zone") || normalized.includes("risk"))) ||
    (normalized.includes("compare") && (normalized.includes("allocatable") || normalized.includes("assistance"))) ||
    (normalized.includes("highest-risk") && normalized.includes("assistance"))
  ) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "zone",
          operator: "contains",
          value: "Zone A",
          explanation: "Filtered to highest-risk Coastal Surge Evacuation Zone A households.",
        },
      ],
      agentResponse: (() => {
        const z = caseStats((c) => c.zone.includes("Zone A"));
        return `Filtered to Zone A, the highest-risk coastal zone: ${z.n} households, ${usd0(z.usd)} approved (already sent to PayPal). Allocatable cash remaining is ${usd0(TREASURY.allocatable)} after the ${usd0(TREASURY.reserve)} protected reserve — ${(TREASURY.allocatable / Math.max(z.usd, 1)).toFixed(1)}× the value of Zone A's grants.`;
      })(),
    };
  }

  // Reset filter commands
  if (
    normalized.includes("reset") ||
    normalized.includes("clear") ||
    normalized.includes("show all") ||
    normalized.includes("all households")
  ) {
    return {
      type: "RESET_FILTERS",
      agentResponse:
        "Cleared all grid filters. Showing every case.",
    };
  }

  // Case-centric questions (Relief Delivery Assurance)
  const statusIntent = (kw: RegExp, status: string, plain: string, advice: string) => {
    if (!kw.test(normalized)) return null;
    const st = caseStats((c) => c.status === status);
    return {
      type: "FILTER_GRID" as const,
      filters: [{ column: "payoutStatus" as const, operator: "equals" as const, value: status, explanation: plain }],
      agentResponse: `${st.n} ${plain} (${usd0(st.usd)}). ${advice}`,
    } satisfies StudioAgentCommand;
  };
  if (/(credited|success).*(not|un).*confirm|(not|un)confirmed|awaiting confirmation|resident.*confirm/.test(normalized)) {
    const g = caseStats((c) => c.nextAction.safeAction === "ASK_RECIPIENT_TO_CONFIRM");
    return {
      type: "FILTER_GRID",
      filters: [{ column: "nextActionKey", operator: "equals", value: "ASK_RECIPIENT_TO_CONFIRM", explanation: "PayPal credited, resident has not confirmed." }],
      agentResponse: `${g.n} payment${g.n === 1 ? "" : "s"} (${usd0(g.usd)}) PayPal credited but the resident has not confirmed. SUCCESS means credited to the account — not proof the household can use it.`,
    };
  }
  if (/(needs? (a )?person|follow.?up|need attention|needs? attention|open case)/.test(normalized)) {
    const p = caseStats((c) => c.nextAction.needsPerson && c.openIssue);
    return {
      type: "FILTER_GRID",
      filters: [{ column: "needsPerson", operator: "equals", value: "YES", explanation: "Cases that need a human follow-up." }],
      agentResponse: `${p.n} cases (${usd0(p.usd)}) need a person. None of them should trigger a second payout.`,
    };
  }
  const byStatus =
    statusIntent(/unclaimed/, "UNCLAIMED", "unclaimed payment(s)", "Help the resident claim it; PayPal auto-returns after 30 days. Do not send again.") ||
    statusIntent(/(on.?hold|\bheld\b|onhold)/, "ONHOLD", "payment(s) on PayPal hold", "Escalate to PayPal support; do not resend.") ||
    statusIntent(/failed/, "FAILED", "failed payout(s)", "Funds were not sent; fix the route, then a new two-key plan.") ||
    statusIntent(/returned/, "RETURNED", "returned payout(s)", "Confirm the ledger reflects the return before any new approval.") ||
    statusIntent(/pending/, "PENDING", "pending payout(s)", "PayPal sends no item webhook for PENDING — poll, don't resubmit.");
  if (byStatus) return byStatus;

  // Medical device / Tier 1 focus
  if (
    normalized.includes("medical") ||
    normalized.includes("oxygen") ||
    normalized.includes("device") ||
    normalized.includes("tier 1")
  ) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "priorityTier",
          operator: "equals",
          value: 1,
          explanation: "Filtered to Tier 1: Life-safety critical households with active medical devices.",
        },
      ],
      agentResponse:
        "Focusing view on Tier 1 households (life-sustaining medical equipment dependent, e.g. oxygen concentrators).",
    };
  }

  // Elderly alone / Tier 2 focus
  if (
    normalized.includes("elderly") ||
    normalized.includes("senior") ||
    normalized.includes("living alone") ||
    normalized.includes("tier 2")
  ) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "priorityTier",
          operator: "equals",
          value: 2,
          explanation: "Filtered to Tier 2: Elderly residents living alone.",
        },
      ],
      agentResponse:
        "Focusing view on Tier 2 households: Senior citizens (65+) living alone in the evacuation corridor.",
    };
  }

  // Disability / Tier 3 focus
  if (
    normalized.includes("disabilit") ||
    normalized.includes("mobility") ||
    normalized.includes("tier 3")
  ) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "priorityTier",
          operator: "equals",
          value: 3,
          explanation: "Filtered to Tier 3: Households with documented disability or mobility impairment.",
        },
      ],
      agentResponse:
        "Focusing view on Tier 3 households with mobility impairments or registered disabilities.",
    };
  }

  // Surge Zone A / Evacuation focus
  if (
    normalized.includes("zone a") ||
    normalized.includes("surge") ||
    normalized.includes("evacuation zone")
  ) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "zone",
          operator: "contains",
          value: "Zone A",
          explanation: "Filtered to households in Coastal Surge Evacuation Zone A.",
        },
      ],
      agentResponse:
        "Filtered grid to households in coastal Zone A, subject to mandatory storm surge evacuation.",
    };
  }

  // Exposure
  if (normalized.includes("exposed") || normalized.includes("exposure")) {
    return {
      type: "RESET_FILTERS",
      agentResponse: `All ${RELIEF_CASES.length} cases are for households inside the Hurricane Milton warning area, so no filter is needed. Cleared filters.`,
    };
  }

  // Sort by priority tier
  if (/(sort|rank|order).*(priority|tier)/.test(normalized)) {
    return {
      type: "SORT_GRID",
      sortColumn: "priorityTier",
      sortDirection: "asc",
      agentResponse:
        "Sorted cases by priority tier (Tier 1 medical-device households first).",
    };
  }

  // Scenario simulation commands
  if (normalized.includes("simulate") || normalized.includes("constrained") || normalized.includes("what if")) {
    const scenarioId = normalized.includes("constrained")
      ? "CONSTRAINED_RESERVE"
      : normalized.includes("tier")
      ? "PRIORITY_TIER_FOCUS"
      : "BASELINE";
    return {
      type: "SIMULATE_SCENARIO",
      scenarioId,
      agentResponse: `Switching scenario simulation model to ${scenarioId}. Recalculating allocatable liquidity and coverage percentage.`,
    };
  }

  // Default informational response
  return {
    type: "INFO",
    agentResponse:
      "I am the Landfall Watch Officer. You can ask me to 'show medical device households', 'filter to Zone A', 'show unclaimed payments', 'credited but not confirmed', 'sort by priority tier', or 'reset filters'. My recommendations are purely informational; all financial disbursements remain deterministically governed by code.",
  };
}

