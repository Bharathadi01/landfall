/**
 * Which data a request sees: LIVE SANDBOX (real PayPal records Landfall stored) or MILTON REPLAY (synthetic).
 * The choice is explicit (cookie `lf_source`) and, when not chosen, automatic: live if any stored PayPal payment exists.
 * Everything downstream — grid, KPIs, resident status, AI — receives the same ReliefCase shape either way.
 */
import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payoutItemRecords } from "@/lib/db/schema";
import { buildReliefCases, summarizeCases, type ReliefCase } from "./cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";
import { listAccessReports } from "./access-reports";
import { hydrateAccessReports } from "./access-reports.server";
import { getLiveSnapshot, type LiveSnapshot } from "./live-cases.server";
import { householdFromRef } from "@/lib/auth/resident-code";

export type Source = "live" | "replay";
export const SOURCE_COOKIE = "lf_source";

let auto: { at: number; live: boolean } | null = null;
export async function liveAvailable(now = Date.now()): Promise<boolean> {
  if (auto && now - auto.at < 20_000) return auto.live;
  let live = false;
  try {
    const [row] = await db.select({ n: count() }).from(payoutItemRecords);
    live = Number(row?.n ?? 0) > 0;
  } catch {
    live = false;
  }
  auto = { at: now, live };
  return live;
}
export function _resetSourceCacheForTests() {
  auto = null;
}

export async function pickSource(cookieValue?: string | null): Promise<Source> {
  if (cookieValue === "replay") return "replay";
  if (cookieValue === "live") return (await liveAvailable()) ? "live" : "replay";
  return (await liveAvailable()) ? "live" : "replay";
}

export interface Snapshot {
  source: Source;
  cases: ReliefCase[];
  summary: ReturnType<typeof summarizeCases>;
  treasury: LiveSnapshot["treasury"] | typeof TREASURY;
  batches: LiveSnapshot["batches"];
  lastSyncedAt: string | null;
  availableSources: { live: boolean; replay: true };
}

export async function loadSnapshot(source: Source): Promise<Snapshot> {
  await hydrateAccessReports();
  const reports = listAccessReports();
  const liveOk = await liveAvailable();
  if (source === "live" && liveOk) {
    const live = await getLiveSnapshot(reports);
    const summary = summarizeCases(live.cases);
    return { source: "live", cases: live.cases, summary: { ...summary, treasury: live.treasury as never }, treasury: live.treasury, batches: live.batches, lastSyncedAt: live.lastSyncedAt, availableSources: { live: true, replay: true } };
  }
  const cases = buildReliefCases(reports);
  return { source: "replay", cases, summary: summarizeCases(cases), treasury: TREASURY, batches: [], lastSyncedAt: null, availableSources: { live: liveOk, replay: true } };
}

/** Find one case by household id, case ref, or item id — within the chosen source. */
export function findCaseIn(cases: ReliefCase[], ref: string): ReliefCase | null {
  const r = ref.trim();
  if (!r) return null;
  const hh = householdFromRef(r);
  return (
    cases.find((c) => c.caseRef === r || c.itemId === r || c.householdRef === r) ??
    (hh ? cases.find((c) => c.householdRef === hh) ?? null : null)
  );
}

/** Live cases WITH the residents' stored reports applied (barrier, "reported received"), exactly as the case list shows them. */
export async function loadLiveCasesWithReports(): Promise<ReliefCase[]> {
  await hydrateAccessReports();
  return (await getLiveSnapshot(listAccessReports())).cases;
}
