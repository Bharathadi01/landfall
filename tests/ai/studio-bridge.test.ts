import { describe, it, expect } from "vitest";
import { interpretStudioQuery } from "@/lib/ai/watch-officer/studio-bridge";

describe("Studio Agent Framework Bridge (§3, §4, §5)", () => {
  it("interprets Tier 1 medical device filter queries", () => {
    const cmd = interpretStudioQuery("show medical device households");
    expect(cmd.type).toBe("FILTER_GRID");
    expect(cmd.filters?.[0].column).toBe("priorityTier");
    expect(cmd.filters?.[0].value).toBe(1);
    expect(cmd.agentResponse).toContain("Tier 1");
  });

  it("interprets Tier 2 elderly living alone queries", () => {
    const cmd = interpretStudioQuery("filter to elderly living alone");
    expect(cmd.type).toBe("FILTER_GRID");
    expect(cmd.filters?.[0].column).toBe("priorityTier");
    expect(cmd.filters?.[0].value).toBe(2);
    expect(cmd.agentResponse).toContain("Tier 2");
  });

  it("interprets Zone A evacuation surge queries", () => {
    const cmd = interpretStudioQuery("show surge zone a residents");
    expect(cmd.type).toBe("FILTER_GRID");
    expect(cmd.filters?.[0].column).toBe("zone");
    expect(cmd.filters?.[0].value).toBe("Zone A");
  });

  it("interprets reset and clear filter queries", () => {
    const cmd = interpretStudioQuery("reset all filters");
    expect(cmd.type).toBe("RESET_FILTERS");
  });

  it("interprets priority sorting queries", () => {
    const cmd = interpretStudioQuery("sort by tier");
    expect(cmd.type).toBe("SORT_GRID");
    expect(cmd.sortColumn).toBe("priorityTier");
    expect(cmd.sortDirection).toBe("asc");
  });

  it("interprets scenario simulation queries", () => {
    const cmd = interpretStudioQuery("simulate constrained reserve scenario");
    expect(cmd.type).toBe("SIMULATE_SCENARIO");
    expect(cmd.scenarioId).toBe("CONSTRAINED_RESERVE");
  });

  it("provides informative guidance for general questions", () => {
    const cmd = interpretStudioQuery("what can you do?");
    expect(cmd.type).toBe("INFO");
    expect(cmd.agentResponse).toContain("Landfall Watch Officer");
  });

  it("handles competition signature query: highest-risk zone and compares required assistance to allocatable funds", () => {
    const cmd = interpretStudioQuery(
      "Show me the households in the highest-risk zone and compare the required assistance against currently allocatable funds"
    );
    expect(cmd.type).toBe("FILTER_GRID");
    expect(cmd.filters?.[0].column).toBe("zone");
    expect(cmd.filters?.[0].value).toBe("Zone A");
    expect(cmd.agentResponse).toContain("$401.00");
    expect(cmd.agentResponse).toContain("$650.00");
    expect(cmd.agentResponse).toContain("100% immediate coverage");
  });
});

