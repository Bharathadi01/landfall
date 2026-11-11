import { investigateCase } from "@/lib/ai/case-officer";
const c: any = {
  origin: "SANDBOX_LIVE", caseRef: "sandbox:act_x:t1:hh_tbw_003", itemId: "ITEM3", batchId: "B1", householdRef: "hh_tbw_003", amountUsd: 100, status: "UNCLAIMED", claimDaysLeft: 20,
  nextAction: { safeAction: "SEND_REMINDER", plain: "Remind the resident to claim.", needsPerson: false, reason: "Unclaimed for 10 days." },
  evidenceCount: { present: 1, applicable: 2 },
  evidence: [
    { key: "provider", title: "PayPal status", state: "present", provenance: "PROVIDER", detail: "UNCLAIMED, PayPal sent a claim link" },
    { key: "recipient", title: "Resident's answer", state: "missing", provenance: "RECIPIENT_REPORTED", detail: "No answer yet" },
  ],
};
investigateCase(c, { history: async () => [{ observedAt: "2026-11-01T10:00:00Z", status: "UNCLAIMED", source: "import" }], liveItem: async () => ({ status: "UNCLAIMED" }) }, "es").then((r) => console.log(JSON.stringify({ ...r, evidence: r.evidence.length }, null, 1))).catch((e) => console.error("ERR", e));
