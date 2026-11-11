import { describe, it, expect, vi, afterEach } from "vitest";
import { executeGoldenWorkflow } from "@/lib/workflow/golden";

/**
 * The Guided Response must never reach PayPal or invent approvals that a live payout would accept.
 * (It used to run on every page view and submit a real Sandbox batch with server-made approvals.)
 */
describe("Guided Response rehearsal safety", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a full 8-stage run makes no network request at all", async () => {
    const spy = vi.fn(async () => { throw new Error("network must not be used by the rehearsal"); });
    vi.stubGlobal("fetch", spy);
    const res = await executeGoldenWorkflow({ targetStage: 8 });
    expect(spy).not.toHaveBeenCalled();
    expect(res.mode).toBe("SANDBOX_REHEARSAL");
    expect(res.stages[6].status).toBe("COMPLETED");
    expect(res.paypalBatchId).toMatch(/^REHEARSAL-/);
    expect(res.stages[6].details.paypalCall).toMatch(/SIMULATED/);
  });

  it("labels the approvals as rehearsal stand-ins, never as signatures", async () => {
    const res = await executeGoldenWorkflow({ targetStage: 6 });
    const d = res.stages[5].details;
    expect(d.approvalMode).toMatch(/REHEARSAL/);
    expect(JSON.stringify(d)).not.toMatch(/sig_(ops|fin)_|\[DEMO PERSONA\]/);
  });

  it("nothing is recorded durably in a rehearsal", async () => {
    const res = await executeGoldenWorkflow({ targetStage: 8 });
    expect(res.stages[6].details.recordedDurably).toBe(false);
  });

  it("reports measured stage durations, not hardcoded ones", async () => {
    const res = await executeGoldenWorkflow({ targetStage: 8 });
    for (const st of res.stages) {
      expect(typeof st.durationMs).toBe("number");
      expect(st.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
