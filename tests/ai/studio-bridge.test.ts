import { RELIEF_CASES } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";
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
    const zoneA = RELIEF_CASES.filter((c) => c.zone.includes("Zone A"));
    const zoneAUsd = zoneA.reduce((t, c) => t + c.amountUsd, 0);
    expect(cmd.agentResponse).toContain(`${zoneA.length} households`);
    expect(cmd.agentResponse).toContain("$" + zoneAUsd.toLocaleString("en-US"));
    expect(cmd.agentResponse).toContain("$" + TREASURY.allocatable.toLocaleString("en-US"));
    expect(cmd.agentResponse).toContain("protected reserve");
  });

  it("answers case-centric questions with filters on real columns and computed counts", () => {
    const unclaimed = interpretStudioQuery("Show unclaimed payments");
    expect(unclaimed.type).toBe("FILTER_GRID");
    expect(unclaimed.filters?.[0]).toMatchObject({ column: "payoutStatus", value: "UNCLAIMED" });
    expect(unclaimed.agentResponse).toContain("Do not send again");

    const held = interpretStudioQuery("which payments are on hold?");
    expect(held.filters?.[0]).toMatchObject({ column: "payoutStatus", value: "ONHOLD" });

    const unconfirmed = interpretStudioQuery("Credited but not confirmed");
    expect(unconfirmed.filters?.[0]).toMatchObject({ column: "nextActionKey", value: "ASK_RECIPIENT_TO_CONFIRM" });
    expect(unconfirmed.agentResponse).toContain("not proof the household can use it");

    const people = interpretStudioQuery("what needs a person");
    expect(people.filters?.[0]).toMatchObject({ column: "needsPerson", value: "YES" });
  });

  it("the suggested 'Sort households by priority tier' prompt actually sorts", () => {
    const cmd = interpretStudioQuery("Sort households by priority tier");
    expect(cmd.type).toBe("SORT_GRID");
    expect(cmd.sortColumn).toBe("priorityTier");
  });
});
