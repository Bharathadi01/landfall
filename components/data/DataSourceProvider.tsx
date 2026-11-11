"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildReliefCases, summarizeCases, attentionQueue, type ReliefCase } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";

/**
 * One place the console reads its cases from. LIVE SANDBOX = real PayPal records Landfall stored;
 * MILTON REPLAY = a synthetic scenario. Every screen that shows money, status or a case reads this, so a number
 * can never come from one source on one screen and the other source on the next.
 */
export type Source = "live" | "replay";

type Summary = ReturnType<typeof summarizeCases>;
export interface BatchInfo {
  paypalBatchId: string;
  status: string;
  amountUsd: number | null;
  feeUsd: number | null;
  lastSyncedAt: string | null;
  lastSyncSource: string | null;
  lastSyncError: string | null;
  itemCount: number | null;
}

export interface Treasury {
  total: number;
  available: number;
  reserve: number;
  policyFloorPct: number;
  requiredReserve: number;
  reserveHeadroom: number;
  paidOut: number;
  inFlight: number;
  needsReissue: number;
  allocatable: number;
}

export interface DataValue {
  status: "loading" | "ready" | "error";
  source: Source;
  cases: ReliefCase[];
  summary: Summary;
  queue: ReliefCase[];
  treasury: Treasury;
  batches: BatchInfo[];
  lastSyncedAt: string | null;
  liveAvailable: boolean;
  error: string | null;
  setSource: (s: Source) => void;
  /** Re-read the stored records (cheap). */
  reload: () => Promise<void>;
  /** Ask PayPal (read-only GET) for the latest status of recorded batches, then reload. Staff only. */
  refreshFromPayPal: () => Promise<{ ok: boolean; changed: number; message: string }>;
}

const replayCases = () => buildReliefCases([]);
function initial(): DataValue {
  const cases = replayCases();
  return {
    status: "loading",
    source: "replay",
    cases,
    summary: summarizeCases(cases),
    queue: attentionQueue(cases, 3),
    treasury: TREASURY as unknown as Treasury,
    batches: [],
    lastSyncedAt: null,
    liveAvailable: false,
    error: null,
    setSource: () => {},
    reload: async () => {},
    refreshFromPayPal: async () => ({ ok: false, changed: 0, message: "Not ready" }),
  };
}

const Ctx = createContext<DataValue>(initial());
export const useCases = () => useContext(Ctx);

const COOKIE = "lf_source";
const writeCookie = (s: Source) => {
  try {
    document.cookie = `${COOKIE}=${s}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } catch {
    /* cookies blocked: the choice just lasts for this page */
  }
};
const readCookie = (): Source | null => {
  try {
    const m = document.cookie.match(/(?:^|; )lf_source=(live|replay)/);
    return m ? (m[1] as Source) : null;
  } catch {
    return null;
  }
};

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<DataValue, "setSource" | "reload" | "refreshFromPayPal">>(() => {
    const { setSource: _a, reload: _b, refreshFromPayPal: _c, ...rest } = initial();
    return rest;
  });
  const sourceRef = useRef<Source | null>(null);

  const load = useCallback(async (explicit?: Source) => {
    const want = explicit ?? readCookie() ?? undefined;
    try {
      const res = await fetch(`/api/cases${want ? `?source=${want}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const cases: ReliefCase[] = j.cases;
      sourceRef.current = j.source;
      setState({
        status: "ready",
        source: j.source,
        cases,
        summary: j.summary,
        queue: attentionQueue(cases, 3),
        treasury: j.treasury,
        batches: j.batches ?? [],
        lastSyncedAt: j.lastSyncedAt ?? null,
        liveAvailable: !!j.availableSources?.live,
        error: null,
      });
    } catch {
      // Never leave a screen blank: fall back to the labelled replay and say why.
      const cases = replayCases();
      sourceRef.current = "replay";
      setState({
        status: "error",
        source: "replay",
        cases,
        summary: summarizeCases(cases),
        queue: attentionQueue(cases, 3),
        treasury: TREASURY as unknown as Treasury,
        batches: [],
        lastSyncedAt: null,
        liveAvailable: false,
        error: "Live records are unavailable right now; showing the Milton replay.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setSource = useCallback(
    (s: Source) => {
      writeCookie(s);
      setState((prev) => ({ ...prev, status: "loading" }));
      void load(s);
    },
    [load]
  );

  const refreshFromPayPal = useCallback(async () => {
    try {
      const res = await fetch("/api/payouts/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) return { ok: false, changed: 0, message: "Your role can't refresh from PayPal. Sign in as the coordinator or finance director." };
      if (res.status === 429) return { ok: false, changed: 0, message: "Too many refreshes — wait a minute." };
      const results: Array<{ ok: boolean; skipped?: string; changes?: unknown[]; error?: string }> = j.refreshed ?? [];
      const changed = results.reduce((t, r) => t + (r.changes?.length ?? 0), 0);
      await load(sourceRef.current ?? undefined);
      if (!res.ok && !results.length) return { ok: false, changed: 0, message: "PayPal could not be reached. Stored records are unchanged." };
      const failed = results.filter((r) => !r.ok).length;
      return {
        ok: failed === 0,
        changed,
        message: failed ? `Refreshed with ${failed} problem${failed > 1 ? "s" : ""}; stored statuses were not changed for those.` : changed ? `PayPal reported ${changed} change${changed > 1 ? "s" : ""}.` : results.every((r) => r.skipped) ? "Already up to date (refreshed moments ago)." : "No changes since the last refresh.",
      };
    } catch {
      return { ok: false, changed: 0, message: "Could not reach the server." };
    }
  }, [load]);

  const value = useMemo<DataValue>(() => ({ ...state, setSource, reload: () => load(sourceRef.current ?? undefined), refreshFromPayPal }), [state, setSource, load, refreshFromPayPal]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
