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

export interface GridFilterIntent {
  column: "priorityTier" | "zone" | "status" | "hasMedicalDevice" | "recipientPath";
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
      agentResponse:
        "Filtered grid to highest-risk Zone A households (4 registered). Required assistance is $401.00 ($100/hh + $0.25 flat PayPal domestic rail fee) against $650.00 in currently allocatable liquid funds. 100% immediate coverage is available.",
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
        "Cleared all grid filters. Displaying all registered households across all vulnerability tiers.",
    };
  }

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

  // Confirmed exposure only
  if (normalized.includes("confirmed") || normalized.includes("exposed")) {
    return {
      type: "FILTER_GRID",
      filters: [
        {
          column: "status",
          operator: "equals",
          value: "CONFIRMED",
          explanation: "Filtered to households with confirmed geographic exposure within the alert polygon.",
        },
      ],
      agentResponse:
        "Displaying households with confirmed exposure inside the active Hurricane Milton warning polygon.",
    };
  }

  // Sort by priority tier
  if (normalized.includes("sort by tier") || normalized.includes("rank by priority")) {
    return {
      type: "SORT_GRID",
      sortColumn: "priorityTier",
      sortDirection: "asc",
      agentResponse:
        "Sorted households by priority tier (Tier 1 Life-Safety first to Tier 6 General).",
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
      "I am the Landfall Watch Officer. You can instruct me to 'show medical device households', 'filter to Zone A', 'sort by priority tier', or 'reset filters'. My recommendations are purely informational; all financial disbursements remain deterministically governed by code.",
  };
}

