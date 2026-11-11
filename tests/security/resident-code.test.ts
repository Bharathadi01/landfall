import { describe, it, expect, beforeEach } from "vitest";
import { householdFromRef, residentCode, verifyResidentCode, _resetResidentLockoutsForTests } from "@/lib/auth/resident-code";

const ENV = { SESSION_SECRET: "unit-test-secret-0123456789abcdef", NODE_ENV: "test" };

describe("resident access codes", () => {
  beforeEach(() => _resetResidentLockoutsForTests());

  it("extracts the household from every reference style", () => {
    expect(householdFromRef("hh_tbw_002")).toBe("hh_tbw_002");
    expect(householdFromRef("milton-2024:t1:hh_tbw_002")).toBe("hh_tbw_002");
    expect(householdFromRef("TBW:HU.W:0009:t1:HH_TBW_005")).toBe("hh_tbw_005");
    expect(householdFromRef("item_milton_002")).toBeNull();
  });
  it("codes are 6 digits, stable, per-household, and depend on the server secret and epoch", async () => {
    const a = await residentCode("hh_tbw_002", ENV);
    expect(a).toMatch(/^\d{6}$/);
    expect(await residentCode("hh_tbw_002", ENV)).toBe(a);
    expect(await residentCode("hh_tbw_003", ENV)).not.toBe(a);
    expect(await residentCode("hh_tbw_002", { ...ENV, SESSION_SECRET: "a-different-secret-0123456789abcd" })).not.toBe(a);
    expect(await residentCode("hh_tbw_002", { ...ENV, RESIDENT_CODE_EPOCH: "2" })).not.toBe(a);
  });
  it("accepts the right code (with spaces) and rejects others", async () => {
    const code = await residentCode("hh_tbw_002", ENV);
    expect((await verifyResidentCode("hh_tbw_002", code, 1, ENV)).ok).toBe(true);
    expect((await verifyResidentCode("hh_tbw_002", `${code.slice(0, 3)} ${code.slice(3)}`, 2, ENV)).ok).toBe(true);
    const wrong = code === "000000" ? "000001" : "000000";
    expect((await verifyResidentCode("hh_tbw_002", wrong, 3, ENV)).ok).toBe(false);
    // a code for one household never works for another
    expect((await verifyResidentCode("hh_tbw_003", code, 4, ENV)).ok).toBe(false);
  });
  it("locks a household after repeated wrong codes, even for the right code, then recovers", async () => {
    const code = await residentCode("hh_tbw_004", ENV);
    const wrong = code === "123456" ? "654321" : "123456";
    const t = 1_000_000;
    for (let i = 0; i < 6; i++) await verifyResidentCode("hh_tbw_004", wrong, t + i, ENV);
    const locked = await verifyResidentCode("hh_tbw_004", code, t + 10, ENV);
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    expect((await verifyResidentCode("hh_tbw_004", code, t + 16 * 60_000, ENV)).ok).toBe(true);
  });
});
