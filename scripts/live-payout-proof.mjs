// $1 x 2 Sandbox payout through the app's own API, as three different people. Usage: node scripts/live-payout-proof.mjs <baseUrl> <pin>
import { chromium } from "playwright";
const base = process.argv[2].replace(/\/$/, ""); const pin = process.argv[3]; const H = { Origin: base };
const b = await chromium.launch();
const mk = async (persona) => { const c = await b.newContext(); const r = await c.request.post(base + "/api/auth/session", { data: { persona }, headers: H }); if (!r.ok()) throw new Error("signin " + persona); return c; };
const dana = await mk("dana-ortiz"), sam = await mk("sam-patel"), judge = await mk("judge-viewer");
const body = { kind: "NEW_PAYOUT", items: [{ householdId: "hh_live_001", amountCents: 100 }, { householdId: "hh_live_002", amountCents: 100 }] };
let r = await judge.request.post(base + "/api/proposals", { data: body, headers: H }); console.log("viewer proposes:", r.status());
r = await dana.request.post(base + "/api/proposals", { data: body, headers: H }); const pj = await r.json(); console.log("Dana proposes:", r.status(), pj.message ?? pj.proposal?.status);
if (!r.ok()) process.exit(1);
const id = pj.proposal.id; console.log("proposal", id, "hash", pj.proposal.payloadHash.slice(0, 16) + "…");
r = await dana.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H }); let j = await r.json(); console.log("Dana approves:", r.status(), "executed:", j.executed, "needs:", JSON.stringify(j.proposal?.needs));
r = await sam.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H }); j = await r.json();
console.log("Sam approves:", r.status(), "executed:", j.executed, "ok:", j.ok, "|", j.message);
console.log("status:", j.proposal?.status, JSON.stringify(j.proposal?.result ?? {}).slice(0, 300));
// duplicate protection: the same households again must be refused while payments are in flight
r = await dana.request.post(base + "/api/proposals", { data: body, headers: H }); const again = await r.json(); console.log("same payout again:", r.status(), again.error ?? again.proposal?.status);
await b.close();
