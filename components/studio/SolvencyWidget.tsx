"use client";

import React, { useEffect, useState } from "react";

/**
 * LANDFALL CUSTOM AG STUDIO WIDGET — "Relief Solvency"
 *
 * Registered with AG Studio via `createWidgets({ additionalTypes })`. Reads two numeric fields
 * through Studio's own data engine (`widgetApi.getData`), so it respects page filters and
 * cross-filters like any built-in widget. Shows whether allocatable cash covers the relief
 * owed to households in the warning area — the single most important question before landfall.
 */
export function SolvencyWidget(props: any) {
  const { widgetApi, dataMapping } = props;
  const [vals, setVals] = useState<{ value: number; target: number } | null>(null);

  const valueField = dataMapping?.value?.[0];
  const targetField = dataMapping?.target?.[0];

  useEffect(() => {
    let cancelled = false;
    if (!widgetApi || !valueField || !targetField) return;
    widgetApi
      .getData({ fields: [valueField, targetField] })
      .then((res: any) => {
        if (cancelled || res?.replaced) return;
        const row = res?.results?.rows?.[0] ?? {};
        const ordered = Object.values(row).filter((v) => typeof v === "number") as number[];
        const value = Number(row[valueField.id] ?? ordered[0] ?? 0);
        const target = Number(row[targetField.id] ?? ordered[1] ?? 0);
        setVals({ value, target });
      })
      .catch(() => !cancelled && setVals(null));
    return () => {
      cancelled = true;
    };
  }, [widgetApi, valueField, targetField]);

  if (!valueField || !targetField) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#525A56", fontSize: 12 }}>
        Map “Available” and “Needed” to see solvency.
      </div>
    );
  }

  const value = vals?.value ?? 0;
  const target = vals?.target ?? 0;
  const ratio = target > 0 ? value / target : 0;
  const pct = Math.min(1, ratio);
  const covered = ratio >= 1;
  const color = covered ? "#268C54" : ratio >= 0.6 ? "#B07012" : "#B42318";
  const R = 44;
  const C = 2 * Math.PI * R;
  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: "100%", padding: "4px 6px", fontFamily: "var(--font-geist-sans), system-ui" }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="lf-solv" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={covered ? "#0E6B50" : color} />
            <stop offset="100%" stopColor={covered ? "#343D39" : color} />
          </linearGradient>
        </defs>
        <circle cx="56" cy="56" r={R} stroke="rgba(24,34,30,0.07)" strokeWidth="10" fill="none" />
        <circle
          cx="56"
          cy="56"
          r={R}
          stroke="url(#lf-solv)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C * pct} ${C}`}
          transform="rotate(-90 56 56)"
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
        <text x="56" y="53" textAnchor="middle" fill="#18221E" fontSize="20" fontWeight="650" style={{ letterSpacing: "-0.03em" }}>
          {target > 0 ? `${ratio.toFixed(1)}×` : "—"}
        </text>
        <text x="56" y="70" textAnchor="middle" fill="#525A56" fontSize="9.5" style={{ letterSpacing: "0.08em" }}>
          COVERAGE
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div>
          <div style={{ fontSize: 12, color: "#525A56", fontFamily: "var(--font-geist-sans)" }}>
            Available to pay
          </div>
          <div style={{ fontSize: 22, fontWeight: 650, color: "#0E6B50", letterSpacing: "-0.03em" }}>{fmt(value)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#525A56", fontFamily: "var(--font-geist-sans)" }}>
            Owed to households
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#18221E" }}>{fmt(target)}</div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            color,
            background: `${color}1A`,
            border: `1px solid ${color}55`,
            borderRadius: 999,
            padding: "4px 9px",
          }}
        >
          {covered ? "Everyone can be paid" : "Shortfall — waitlist by priority"}
        </div>
      </div>
    </div>
  );
}

export const SOLVENCY_WIDGET_TYPE = "landfall-solvency";
