// Real Sandbox recovery through the app's own API, as three different people. Usage: node scripts/live-recovery-proof.mjs <baseUrl> <householdId> <pin>
import { chromium, request } from "playwright";
const base = process.argv[2].replace(/\/$/, "");
const hh = process.argv[3];
const pin = process.argv[4];
const H = { Origin: base };
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const mk = async (persona) => { const c = await b.newContext(); const r = await c.request.post(base + "/api/auth/session", { data: { persona }, headers: H }); if (!r.ok()) throw new Error("signin " + persona); return c; };

// 1) the resident (code from the public judge card) reports they cannot claim it
const judges = await (await (await b.newContext()).request.get(base + "/judges")).text();
const m = judges.match(new RegExp(hh + "[\\s\\S]{0,500}?(\\d{6})"));
if (!m) throw new Error("no resident code for " + hh + " on /judges");
const rc = await b.newContext();
let r = await rc.request.post(base + "/api/resident/session", { data: { ref: hh, code: m[1] }, headers: H });
log("resident session:", r.status());
r = await rc.request.post(base + "/api/recipients/access-report", { data: { caseRef: hh, kind: "CANT_ACCESS", reason: "NO_PAYPAL_ACCOUNT" }, headers: H });
log("resident report:", r.status());

// 2) Dana proposes the cancel (the server re-checks the deterministic rules)
const dana = await mk("dana-ortiz");
const cases = await (await dana.request.get(base + "/api/cases")).json();
const c = cases.cases.find((x) => x.householdRef === hh);
log("case before:", c.status, "claimDaysLeft", c.claimDaysLeft, "barrier", c.barrier);
r = await dana.request.post(base + "/api/proposals", { data: { kind: "CANCEL_ITEM", caseRef: c.caseRef }, headers: H });
const pj = await r.json();
log("propose:", r.status(), pj.message ?? pj.proposal?.status);
if (!r.ok()) process.exit(1);
const id = pj.proposal.id;

// 3) wrong PIN is refused; Dana approves; a viewer is refused; Dana cannot approve twice; Sam (finance) approves and the Treasurer executes
r = await dana.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin: "000000" }, headers: H });
log("wrong PIN:", r.status());
r = await dana.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H });
let j = await r.json(); log("Dana approves:", r.status(), "executed:", j.executed, "needs:", JSON.stringify(j.proposal?.needs));
r = await dana.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H });
j = await r.json(); log("Dana again:", r.status(), "duplicate:", j.duplicate, "executed:", j.executed);
const judge = await mk("judge-viewer");
r = await judge.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H });
log("viewer approve:", r.status());
const sam = await mk("sam-patel");
r = await sam.request.post(base + `/api/proposals/${id}/approve`, { data: { method: "DEMO_KEY", pin }, headers: H });
j = await r.json(); log("Sam approves:", r.status(), "executed:", j.executed, "ok:", j.ok, "|", j.message);
log("proposal status:", j.proposal?.status, JSON.stringify(j.proposal?.result ?? {}).slice(0, 200));

// 4) what the app shows now
const after = await (await dana.request.get(base + "/api/cases")).json();
const a = after.cases.find((x) => x.householdRef === hh);
log("case after:", a.status, "| stage", a.stage, "| treasury available", after.treasury?.available, "inFlight", after.treasury?.inFlight);
const rec = await (await dana.request.get(base + "/api/treasury/reconcile")).json();
log("reconcile:", rec.status, "ledger", rec.ledgerBalanceCents, "paypal", rec.paypalBalanceCents, "diff", rec.discrepancyCents);
await b.close();
