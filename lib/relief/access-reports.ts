/**
 * Resident access reports — "I received it" / "I can't access it".
 *
 * Append-only, recipient-reported evidence. It never changes PayPal's provider status and is
 * never upgraded to provider-verified. Stored in memory for this deployment (a demo store that
 * resets on restart); swap `store` for a table when you are ready to persist.
 */
import { z } from "zod";
import { RELIEF_CASES, buildReliefCases, caseRefFor, type AccessReport, type ReliefCase } from "./cases";

export const AccessReportInput = z
  .object({
    caseRef: z.string().min(3).max(120),
    kind: z.enum(["RECEIVED", "CANT_ACCESS"]),
    reason: z.enum(["NO_PAYPAL_ACCOUNT", "CANT_SIGN_IN", "NO_PHONE", "LANGUAGE", "OTHER"]).optional(),
  })
  .refine((v) => v.kind !== "CANT_ACCESS" || !!v.reason, { message: "reason is required when kind is CANT_ACCESS", path: ["reason"] });

const g = globalThis as unknown as { __landfallAccessReports?: AccessReport[] };
const store: AccessReport[] = (g.__landfallAccessReports ??= []);

export function listAccessReports(): AccessReport[] {
  return [...store];
}

export function resetAccessReports(): void {
  store.length = 0;
}

/** Accepts a household id (hh_tbw_002) or a full case ref and returns the canonical case ref, if it exists. */
export function resolveCaseRef(input: string): string | null {
  const trimmed = input.trim();
  const direct = RELIEF_CASES.find((c) => c.caseRef === trimmed || c.householdRef === trimmed || c.itemId === trimmed);
  if (direct) return direct.caseRef;
  const viaHousehold = RELIEF_CASES.find((c) => caseRefFor(trimmed) === c.caseRef);
  return viaHousehold?.caseRef ?? null;
}

export function addAccessReport(input: z.infer<typeof AccessReportInput>): { ok: true; report: AccessReport } | { ok: false; error: string } {
  const ref = resolveCaseRef(input.caseRef);
  if (!ref) return { ok: false, error: "Unknown case reference" };
  return { ok: true, report: recordAccessReport(ref, input) };
}

/** Append a report for a case reference the CALLER has already resolved and authorised (replay or live). */
export function recordAccessReport(
  caseRef: string,
  input: Pick<z.infer<typeof AccessReportInput>, "kind" | "reason">,
  extra: Partial<Pick<AccessReport, "channel" | "language" | "transcript" | "translation">> = {}
): AccessReport {
  const report: AccessReport = {
    caseRef,
    kind: input.kind,
    reason: input.kind === "CANT_ACCESS" ? input.reason : undefined,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  store.push(report);
  return report;
}

export function casesWithReports(): ReliefCase[] {
  return buildReliefCases(listAccessReports());
}

/** Plain-language, resident-facing view of one case. No internal evidence, no other households. */
export function residentView(caseRef: string) {
  const c = casesWithReports().find((x) => x.caseRef === caseRef);
  if (!c) return null;
  return residentViewOf(c);
}

/** The same plain-language view for ANY case (replay or live Sandbox). */
export function residentViewOf(c: ReliefCase) {
  const money = Number.isInteger(c.amountUsd) ? `$${c.amountUsd}` : `$${c.amountUsd.toFixed(2)}`;
  let plain: string;
  let tone: "good" | "info" | "warn" | "bad" = "info";
  if (c.barrier) {
    plain = "You told us you can’t get to this money. A coordinator will contact you — you don’t need to do anything else.";
    tone = "warn";
  } else if (c.status === "SUCCESS" && c.stagesReached.CONFIRMED) {
    plain = `Done. PayPal credited ${money} and you confirmed you have it.`;
    tone = "good";
  } else if (c.status === "SUCCESS") {
    plain = `PayPal says ${money} was credited to your account. Please tell us whether you can use it.`;
  } else if (c.status === "UNCLAIMED") {
    plain = `We sent ${money}, but it is waiting for you to claim it with PayPal. You have ${c.claimDaysLeft} days left. If you can’t claim it, tell us below.`;
    tone = "warn";
  } else if (c.status === "PENDING") {
    plain = `Your ${money} is being processed by PayPal. Nothing is needed from you yet.`;
  } else if (c.status === "ONHOLD" || c.status === "BLOCKED") {
    plain = `PayPal is reviewing your ${money} payment. A coordinator is following up — you don’t need to do anything.`;
    tone = "warn";
  } else if (c.status === "FAILED") {
    plain = "Your payment didn’t go through and no money left the fund. A coordinator will contact you to fix it.";
    tone = "bad";
  } else if (c.status === "RETURNED") {
    plain = "Your payment was returned to the fund before it was claimed. A coordinator will contact you about getting it to you.";
    tone = "bad";
  } else {
    plain = "A coordinator is reviewing your payment and will contact you.";
    tone = "warn";
  }
  return {
    caseRef: c.caseRef,
    householdRef: c.householdRef,
    name: c.resident,
    zone: c.zone,
    amountUsd: c.amountUsd,
    wallet: c.wallet,
    paypalStatus: c.status,
    stage: c.stage,
    steps: Object.entries(c.stagesReached).map(([key, reached]) => ({ key, reached })),
    claimDaysLeft: c.claimDaysLeft,
    plainStatus: plain,
    tone,
    barrier: c.barrier ?? null,
    canReport: c.status === "SUCCESS" || c.status === "UNCLAIMED" || !!c.barrier,
    dataOrigin: c.origin,
  };
}

/**
 * Merge reports loaded from the database into the in-memory view (de-duplicated). The memory store is the
 * read model every case build uses; the database is the durable copy (see access-reports.server.ts).
 */
export function ingestAccessReports(rows: AccessReport[]): void {
  const seen = new Set(store.map((r) => `${r.caseRef}|${r.kind}|${r.createdAt}`));
  for (const r of rows) {
    const k = `${r.caseRef}|${r.kind}|${r.createdAt}`;
    if (!seen.has(k)) {
      store.push(r);
      seen.add(k);
    }
  }
  store.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
