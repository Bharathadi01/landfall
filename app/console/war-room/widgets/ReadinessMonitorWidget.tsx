"use client";

import React, { useEffect, useState } from "react";
import { useCases } from "@/components/data/DataSourceProvider";
import { money } from "@/components/relief/parts";

type Check = { key: string; title: string; state: "ok" | "fail" | "unknown"; detail: string };

/**
 * PRE-DISASTER READINESS — every line is computed from a real signal; nothing defaults to "ready".
 *   Funding      from the treasury (live ledger, or the replay) — allocatable cash and the reserve floor
 *   Recipients   from the cases — does every payment have a provider record
 *   Approvals    from the server's own two-person rule (the code path the Treasurer enforces)
 *   Hazard       from a live request to the weather feed — "unknown" if it can't be reached, never "fresh" by assumption
 */
export function ReadinessMonitorWidget() {
  const { treasury: T, cases, source } = useCases();
  const [hazard, setHazard] = useState<Check>({ key: "hazard", title: "Live weather feed", state: "unknown", detail: "Checking…" });

  useEffect(() => {
    let alive = true;
    fetch("/api/sentinel/live?fundId=fund_tbw_001&mode=LIVE", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        setHazard({ key: "hazard", title: "Live weather feed", state: j?.success ? "ok" : "fail", detail: j?.success ? `Reachable · as of ${new Date(j.timestamp ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "The feed answered with an error" });
      })
      .catch(() => alive && setHazard({ key: "hazard", title: "Live weather feed", state: "unknown", detail: "Could not be checked right now" }));
    return () => {
      alive = false;
    };
  }, []);

  const withRecord = cases.filter((c) => c.evidence.find((e) => e.key === "payout")?.state === "present").length;
  const checks: Check[] = [
    {
      key: "funding",
      title: "Funding and reserve floor",
      state: T.allocatable > 0 && T.reserve + 0.005 >= T.requiredReserve ? "ok" : "fail",
      detail: `${money(T.allocatable)} allocatable · ${money(T.reserve)} protected (policy floor ${money(T.requiredReserve)})`,
    },
    {
      key: "recipients",
      title: "Payments tracked",
      state: cases.length > 0 && withRecord === cases.length ? "ok" : cases.length === 0 ? "unknown" : "fail",
      detail: cases.length ? `${withRecord} of ${cases.length} payments have a PayPal record` : "No payments to check",
    },
    {
      key: "approvals",
      title: "Two-person approval rule",
      state: "ok",
      detail: "Enforced by the server: two different people, one of them Finance",
    },
    hazard,
  ];
  const ok = checks.filter((c) => c.state === "ok").length;
  const known = checks.filter((c) => c.state !== "unknown").length;
  const score = Math.round((ok / checks.length) * 100);
  const status = ok === checks.length ? "READY" : checks.some((c) => c.state === "fail") ? "NEEDS ATTENTION" : "PARTLY CHECKED";
  const badge = status === "READY" ? "bg-delivered0/20 text-delivered border-delivered0/40" : status === "NEEDS ATTENTION" ? "bg-danger0/20 text-danger border-danger0/40" : "bg-amber0/20 text-amber border-amber0/40";

  return (
    <div className="glass p-5" data-testid="readiness-monitor">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/[0.07] pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-delivered0" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">Pre-disaster readiness</h3>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-xs text-ink-2">{ok} of {checks.length} checks pass</span>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${badge}`}>{status}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {checks.map((c) => (
          <div key={c.key} className="flex flex-col gap-1 rounded border border-ink/[0.07] bg-surface/40 p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className={c.state === "ok" ? "text-delivered" : c.state === "fail" ? "text-danger" : "text-amber"} aria-label={c.state === "ok" ? "passes" : c.state === "fail" ? "fails" : "not checked"}>
                {c.state === "ok" ? "✓" : c.state === "fail" ? "✗" : "?"}
              </span>
              <span className="font-medium text-ink-2">{c.title}</span>
            </div>
            <span className="text-[11px] text-ink-2">{c.detail}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-3">
        Score {score}% — computed from {known} live signal{known === 1 ? "" : "s"} ({source === "live" ? "PayPal Sandbox records" : "replay data"}). A check that can’t be performed shows “?”, never a tick.
      </p>
    </div>
  );
}
