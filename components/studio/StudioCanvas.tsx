"use client";

import React, { useCallback, useMemo } from "react";
import { AgStudio, createWidgets } from "ag-studio-react";
import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  AgStudioModuleRegistry,
  createAiHarness,
  studioTheme,
  type AgReportState,
} from "ag-studio";

// The Studio Agent Framework panel is an opt-in module.
AgStudioModuleRegistry.registerModules([AgStudioAiModule]);
import { GroqStudioLlmAdapter } from "@/lib/ai/watch-officer/studio-adapter";
import { landfallStudioParams } from "@/styles/ag-studio-theme";
import { studioSources, STUDIO_PROMPT_STARTERS } from "@/lib/studio/landfall-studio-data";
import { SolvencyWidget, SOLVENCY_WIDGET_TYPE } from "./SolvencyWidget";

const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (licenseKey) {
  try {
    AgStudioLicenseManager.setLicenseKey(licenseKey);
  } catch {
    /* continue unlicensed (watermark) */
  }
}

/** Landfall theme applied through AG Studio's official Theming API. */
const LANDFALL_STUDIO_THEME = (studioTheme as any).withParams(landfallStudioParams);

/** Relief Solvency custom widget, registered alongside AG's built-ins under a "Landfall" menu group. */
const widgetsConfig = (defaults: any) =>
  (createWidgets as any)({
    additionalTypes: [
      {
        id: SOLVENCY_WIDGET_TYPE,
        label: "Relief Solvency",
        icon: {
          url:
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
              "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232DD4BF' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='8' stroke-opacity='.3'/><path d='M12 4a8 8 0 0 1 8 8'/></svg>"
            ).replace(/%25/g, "%"),
        },
        dataMapping: {
          value: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
          target: { type: "field", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true },
        },
        form: (params: any) =>
          params.createDefaults({
            dataMappingItems: [
              { key: "value", label: "Available" },
              { key: "target", label: "Needed" },
            ],
          }),
        comp: SolvencyWidget,
        defaultSize: { width: 420, height: 170 },
        minSize: { width: 300, height: 140 },
        ai: {
          description:
            "Landfall Relief Solvency gauge. Compares cash available to pay (value) with relief owed to households in the warning area (target) and states whether everyone can be paid.",
        },
      },
    ],
    menu: [...(defaults?.menu ?? []), { label: "Landfall", widgetIds: [SOLVENCY_WIDGET_TYPE] }],
  });

const INITIAL_STATE: AgReportState = {
  version: "3.1.0",
  selectedPageId: "relief",
  pages: [
    {
      id: "relief",
      widgets: {
        "f-tier": {
          type: "button-filter",
          format: { title: { text: "Priority tier", enabled: false } },
          dataMapping: { value: [{ id: "households.priority_tier" }] },
        },
        "kpi-households": {
          type: "value",
          format: { title: { text: "Households", enabled: true } },
          dataMapping: { value: [{ id: "households.households", aggregation: "sum" }] },
        },
        "kpi-relief": {
          type: "value",
          format: { title: { text: "Relief owed", enabled: true } },
          dataMapping: { value: [{ id: "households.grant_usd", aggregation: "sum" }] },
        },
        "kpi-reserve": {
          type: "value",
          format: { title: { text: "Reserve", enabled: true } },
          dataMapping: { value: [{ id: "solvency.reserve_usd", aggregation: "sum" }] },
        },
        "w-solvency": {
          type: SOLVENCY_WIDGET_TYPE,
          format: { title: { text: "Can we pay everyone?", enabled: true } },
          dataMapping: {
            value: [{ id: "solvency.allocatable_usd", aggregation: "sum" }],
            target: [{ id: "solvency.required_usd", aggregation: "sum" }],
          },
        },
        "c-treasury": {
          type: "bar-chart-grouped",
          format: { title: { text: "Where the money sits", enabled: true } },
          dataMapping: {
            categoryKey: [{ id: "treasury.bucket" }],
            valueKey: [{ id: "treasury.amount_usd", aggregation: "sum" }],
          },
        },
        "c-tiers": {
          type: "donut-chart",
          format: { title: { text: "Who needs help first", enabled: true } },
          dataMapping: {
            categoryKey: [{ id: "households.tier_label" }],
            valueKey: [{ id: "households.households", aggregation: "sum" }],
          },
        },
        "c-funnel": {
          type: "cone-funnel-chart",
          format: { title: { text: "From warning to payout", enabled: true } },
          dataMapping: {
            categoryKey: [{ id: "funnel.stage" }],
            valueKey: [{ id: "funnel.households", aggregation: "sum" }],
          },
        },
        "g-households": {
          type: "grid",
          format: { title: { text: "Household relief queue", enabled: true }, style: { columnAutoSize: true } },
          dataMapping: {
            cols: [
              { id: "households.household_id" },
              { id: "households.tier_label" },
              { id: "households.zone" },
              { id: "households.exposure" },
              { id: "households.payout_channel" },
              { id: "households.grant_usd" },
            ],
          },
        },
      },
      widgetLayout: {
        "f-tier": { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 4 },
        "kpi-households": { xTrack: 0, yTrack: 4, xSpan: 5, ySpan: 10 },
        "kpi-relief": { xTrack: 5, yTrack: 4, xSpan: 5, ySpan: 10 },
        "kpi-reserve": { xTrack: 10, yTrack: 4, xSpan: 5, ySpan: 10 },
        "w-solvency": { xTrack: 15, yTrack: 4, xSpan: 9, ySpan: 10 },
        "c-treasury": { xTrack: 0, yTrack: 14, xSpan: 8, ySpan: 16 },
        "c-tiers": { xTrack: 8, yTrack: 14, xSpan: 8, ySpan: 16 },
        "c-funnel": { xTrack: 16, yTrack: 14, xSpan: 8, ySpan: 16 },
        "g-households": { xTrack: 0, yTrack: 30, xSpan: 24, ySpan: 17 },
      },
    },
  ],
} as any;

export default function StudioCanvas({ mode }: { mode: "view" | "edit" }) {
  const data = useMemo(() => ({ sources: studioSources }), []);

  // Studio Agent Framework: AG's built-in agents, routed through Landfall's read-only adapter.
  const ai = useCallback(
    ({ api }: { api: any }) =>
      createAiHarness(api, {
        adapter: new GroqStudioLlmAdapter(),
        primary: "lead",
        promptStarters: STUDIO_PROMPT_STARTERS,
      } as any),
    []
  );

  return (
    <AgStudio
      {...({
        data,
        initialState: INITIAL_STATE,
        mode,
        theme: LANDFALL_STUDIO_THEME,
        widgets: widgetsConfig,
        ai,
        panels: {
          view: { right: [] },
          edit: { left: ["ai"], right: ["edit"] },
        },
        style: { width: "100%", height: "100%" },
      } as any)}
    />
  );
}
