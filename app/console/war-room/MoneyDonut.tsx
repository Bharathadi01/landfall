"use client";

import React, { useMemo } from "react";
import { AgCharts } from "ag-charts-react";
import { type AgChartOptions, ModuleRegistry, AllCommunityModule } from "ag-charts-community";
import { chartTheme } from "@/styles/ag-studio-theme";
import { money } from "@/components/relief/parts";

ModuleRegistry.registerModules([AllCommunityModule]);

/** "Where the money sits" donut. Its own file so AG Charts loads after the Command Center's numbers are already on screen. */
export default function MoneyDonut({ allocatable, reserve, sent, total }: { allocatable: number; reserve: number; sent: number; total: number }) {
  const options = useMemo<AgChartOptions>(
    () =>
      ({
        theme: chartTheme(),
        height: 240,
        data: [
          { bucket: "Ready to allocate", amount: allocatable },
          { bucket: "Protected reserve", amount: reserve },
          { bucket: "Sent to PayPal", amount: sent },
        ],
        series: [
          {
            type: "donut",
            angleKey: "amount",
            legendItemKey: "bucket",
            innerRadiusRatio: 0.72,
            fills: ["#268C54", "#B07012", "#005EB8"],
            strokes: ["#FFFFFF", "#FFFFFF", "#FFFFFF"],
            strokeWidth: 3,
            cornerRadius: 6,
            innerLabels: [
              { text: money(total), fontSize: 24, fontWeight: 600, color: "#18221E" },
              { text: "received in all", fontSize: 12, color: "#525A56", spacing: 6 },
            ],
            tooltip: { renderer: (p: any) => ({ heading: p.datum.bucket, data: [{ label: "Amount", value: money(p.datum.amount) }] }) },
          },
        ],
        legend: { enabled: false },
        padding: { top: 4, bottom: 4 },
      }) as any,
    [allocatable, reserve, sent, total]
  );
  return <AgCharts options={options} />;
}
