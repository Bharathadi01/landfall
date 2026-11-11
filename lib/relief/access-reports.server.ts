/**
 * Durable copy of resident reports (server only). Writes are fail-soft: if the database is unreachable the
 * report still takes effect in this process (and is flagged unsaved) instead of being lost on the spot.
 */
import { db } from "@/lib/db/client";
import { accessReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ingestAccessReports } from "./access-reports";
import type { AccessReport } from "./case-types";

let lastHydrate = 0;
const HYDRATE_EVERY_MS = 15_000;

export async function hydrateAccessReports(force = false, now = Date.now()): Promise<void> {
  if (!force && now - lastHydrate < HYDRATE_EVERY_MS) return;
  lastHydrate = now;
  try {
    const rows = await db.select().from(accessReports).orderBy(desc(accessReports.createdAt)).limit(2000);
    ingestAccessReports(
      rows.map((r) => ({
        caseRef: r.caseRef,
        kind: r.kind,
        reason: (r.reason ?? undefined) as AccessReport["reason"],
        createdAt: r.createdAt.toISOString(),
        channel: r.channel,
        language: r.language ?? undefined,
        transcript: r.transcript ?? undefined,
        translation: r.translation ?? undefined,
      }))
    );
  } catch {
    /* database unavailable: keep serving what is in memory */
  }
}

export async function persistAccessReport(r: AccessReport & { classifier?: unknown }): Promise<boolean> {
  try {
    await db.insert(accessReports).values({
      caseRef: r.caseRef,
      kind: r.kind,
      reason: r.reason ?? null,
      channel: r.channel ?? "web",
      language: r.language ?? null,
      transcript: r.transcript ?? null,
      translation: r.translation ?? null,
      classifier: r.classifier ?? null,
      createdAt: new Date(r.createdAt),
    });
    return true;
  } catch (err) {
    if (!process.env.VITEST) console.error("[access-reports] could not persist report", err instanceof Error ? err.message : err);
    return false;
  }
}
