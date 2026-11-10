"use client";

import React, { useEffect, useState } from "react";
import { TREASURY } from "@/lib/studio/landfall-studio-data";

export const RESERVE_GUARDRAIL_WIDGET_TYPE = "landfall-reserve-guardrail";

export function ReserveGuardrailWidget(props: any) {
  const { widgetApi, dataMapping } = props;
  const [data, setData] = useState<{
    reserve: number;
    total: number;
    requiredFloor: number;
    headroom: number;
    ratio: number;
    status: string;
  }>({
    reserve: TREASURY.reserve,
    total: TREASURY.total,
    requiredFloor: TREASURY.requiredReserve,
    headroom: TREASURY.reserveHeadroom,
    ratio: 35.1,
    status: "Within policy",
  });

  const reserveField = dataMapping?.reserve?.[0];
  const totalField = dataMapping?.total?.[0];

  useEffect(() => {
    let cancelled = false;
    if (!widgetApi || !reserveField) return;

    const fieldsToFetch = [reserveField];
    if (totalField) fieldsToFetch.push(totalField);

    widgetApi
      .getData({ fields: fieldsToFetch })
      .then((res: any) => {
        if (cancelled || res?.replaced) return;
        const row = res?.results?.rows?.[0] ?? {};
        const reserve = Number(row[reserveField.id] ?? TREASURY.reserve);
        const total = Number(totalField ? row[totalField.id] ?? TREASURY.total : TREASURY.total);
        const requiredFloor = Math.round(total * 0.3);
        const headroom = reserve - requiredFloor;
        const ratio = total > 0 ? (reserve / total) * 100 : 0;
        const status = headroom >= 0 ? "Within policy" : "Below policy";
        setData({ reserve, total, requiredFloor, headroom, ratio, status });
      })
      .catch(() => {
        /* retain fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [widgetApi, reserveField, totalField]);

  const isCompliant = data.headroom >= 0;
  const statusColor = isCompliant ? "#2DD4BF" : "#FF6378";
  const pctFloor = 30;
  const currentPct = Math.min(100, Math.max(0, data.ratio));
  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div
      data-testid="reserve-guardrail-widget"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        padding: "8px 12px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#EEF2F8",
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6E7A91", fontFamily: "var(--font-geist-mono)" }}>
            Protected Reserve vs 30% Floor
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "#FBBF54" }}>
              {fmt(data.reserve)}
            </span>
            <span style={{ fontSize: 13, color: "#A3AEC2" }}>
              ({data.ratio.toFixed(1)}% of total {fmt(data.total)})
            </span>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}44`,
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
          {isCompliant ? "Within policy · 30% Floor Met" : "Warning · Below Floor"}
        </div>
      </div>

      {/* Segmented Meter Bar with Threshold Marker */}
      <div style={{ margin: "14px 0 8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6E7A91", marginBottom: 6 }}>
          <span>0%</span>
          <span style={{ color: "#FBBF54", fontWeight: 600 }}>Policy floor: 30% ({fmt(data.requiredFloor)})</span>
          <span>100%</span>
        </div>

        <div
          style={{
            position: "relative",
            height: 12,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 6,
            overflow: "visible",
          }}
        >
          {/* Active Fill */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${currentPct}%`,
              background: `linear-gradient(90deg, #FBBF54 0%, ${statusColor} 100%)`,
              borderRadius: 6,
              transition: "width 600ms cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: `0 0 10px ${statusColor}44`,
            }}
          />

          {/* 30% Policy Floor Needle Marker */}
          <div
            style={{
              position: "absolute",
              left: `${pctFloor}%`,
              top: -4,
              bottom: -4,
              width: 3,
              background: "#EEF2F8",
              borderRadius: 2,
              boxShadow: "0 0 6px rgba(0,0,0,0.6)",
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* Bottom Metrics Pill Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          background: "rgba(255, 255, 255, 0.025)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 8,
          padding: "6px 10px",
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: "#6E7A91", textTransform: "uppercase" }}>Required Floor</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF2F8" }}>{fmt(data.requiredFloor)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9.5, color: "#6E7A91", textTransform: "uppercase" }}>Current Headroom</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: data.headroom >= 0 ? "#5EEAD4" : "#FF6378" }}>
            +{fmt(data.headroom)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9.5, color: "#6E7A91", textTransform: "uppercase" }}>Policy Rule</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#A3AEC2" }}>Deterministic 30%</div>
        </div>
        <div>
          <div style={{ fontSize: 9.5, color: "#6E7A91", textTransform: "uppercase" }}>Last Calculation</div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "#54A0FF" }}>18:30:00 UTC (Replay)</div>
        </div>
      </div>
    </div>
  );
}

