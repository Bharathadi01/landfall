import { themeQuartz, colorSchemeLight } from "ag-grid-community";
import type { AgChartThemeOverrides } from "ag-charts-community";

/**
 * LANDFALL × AG — one theme for AG Studio, AG Grid and AG Charts, on the "refuge" palette (see styles/design-tokens.css).
 *
 * Colour carries the same meaning as on every other screen: refuge green = the action and "you are here", leaf green = reached the
 * family, PayPal blue = PayPal says so, amber = waiting on someone, brick = failed. Charts series follow that order.
 * Built with AG's official Theming APIs (studioTheme.withParams / themeQuartz.withParams).
 */

export const LANDFALL = {
  canvas: "#F6F3EC",
  surface: "#FFFFFF",
  surface2: "#F0ECE3",
  surface3: "#E6E1D6",
  line: "#E1DBCF",
  lineStrong: "#B0A796",
  ink: "#18221E",
  ink2: "#343D39",
  ink3: "#525A56",
  accent: "#0E6B50",
  accentStrong: "#0A5640",
  sun: "#E8A33D",
  money: "#18221E",
  delivered: "#268C54",
  paypal: "#005EB8",
  ai: "#68706B",
  amber: "#B07012",
  storm: "#46504B",
  danger: "#B42318",
  font: "var(--font-ui), 'Public Sans', system-ui, sans-serif",
  mono: "var(--font-data), 'Overpass Mono', ui-monospace, monospace",
} as const;

/** Ordered by meaning: reached, PayPal, the action colour, waiting, then calm neutrals. */
export const LANDFALL_PALETTE = [
  LANDFALL.delivered,
  LANDFALL.paypal,
  LANDFALL.accent,
  LANDFALL.amber,
  "#7A9A8C",
  LANDFALL.sun,
  "#9C8F7A",
  LANDFALL.danger,
];

/* ── AG Grid (standalone grids) ───────────────────────────── */

export const landfallGridTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  backgroundColor: LANDFALL.surface,
  foregroundColor: LANDFALL.ink,
  textColor: LANDFALL.ink,
  subtleTextColor: LANDFALL.ink3,
  accentColor: LANDFALL.accent,
  borderColor: LANDFALL.line,
  chromeBackgroundColor: LANDFALL.surface,
  headerBackgroundColor: "#FAF8F3",
  headerTextColor: LANDFALL.ink3,
  headerFontFamily: LANDFALL.font,
  headerFontSize: 12.5,
  headerFontWeight: 600,
  rowBorder: { color: LANDFALL.line },
  headerRowBorder: { color: LANDFALL.line },
  wrapperBorder: false,
  oddRowBackgroundColor: "#FCFBF8",
  rowHoverColor: "rgba(14,107,80,0.05)",
  selectedRowBackgroundColor: "rgba(14,107,80,0.10)",
  fontFamily: LANDFALL.font,
  fontSize: 14,
  rowHeight: 48,
  headerHeight: 44,
  spacing: 7,
  borderRadius: 6,
  wrapperBorderRadius: 0,
  cellHorizontalPaddingScale: 1.1,
  iconSize: 15,
  menuBackgroundColor: LANDFALL.surface,
  inputBackgroundColor: LANDFALL.surface,
  inputBorder: { color: LANDFALL.lineStrong },
  browserColorScheme: "light",
});

/* ── AG Charts (standalone charts) ────────────────────────── */

export const landfallChartTheme = {
  baseTheme: "ag-default",
  palette: { fills: LANDFALL_PALETTE, strokes: LANDFALL_PALETTE },
  params: {
    fontFamily: "system-ui, sans-serif",
    backgroundColor: "transparent",
    foregroundColor: LANDFALL.ink,
    textColor: LANDFALL.ink,
    subtleTextColor: LANDFALL.ink3,
    gridLineColor: "rgba(24,34,30,0.07)",
    chromeBackgroundColor: LANDFALL.surface2,
  },
  overrides: {
    common: {
      background: { fill: "transparent" },
      legend: { item: { label: { color: LANDFALL.ink2, fontSize: 12 } } },
    },
  } satisfies AgChartThemeOverrides,
} as const;

/**
 * AG Charts and Studio charts draw on a <canvas>, which cannot resolve CSS variables. Read the real (next/font) family
 * names from the page at call time instead. Server-side we fall back to system fonts; charts only render in the browser.
 */
export function agCanvasFonts(): { ui: string; mono: string } {
  const fallback = { ui: "system-ui, sans-serif", mono: "ui-monospace, monospace" };
  if (typeof window === "undefined") return fallback;
  const cs = getComputedStyle(document.documentElement);
  const ui = cs.getPropertyValue("--font-ui").trim();
  const mono = cs.getPropertyValue("--font-data").trim();
  return { ui: ui ? `${ui}, system-ui, sans-serif` : fallback.ui, mono: mono ? `${mono}, ui-monospace, monospace` : fallback.mono };
}

/** Landfall chart theme with the real font family resolved for canvas rendering. */
export function chartTheme() {
  return { ...landfallChartTheme, params: { ...landfallChartTheme.params, fontFamily: agCanvasFonts().ui } };
}

/* ── AG Studio ────────────────────────────────────────────── */

/**
 * Parameters for `studioTheme.withParams(...)`. Kept as a plain object so the
 * (client-only) ag-studio import stays inside the component that renders Studio.
 */
export const landfallStudioParams = {
  // shared
  browserColorScheme: "light",
  backgroundColor: LANDFALL.surface,
  foregroundColor: LANDFALL.ink,
  textColor: LANDFALL.ink,
  subtleTextColor: LANDFALL.ink3,
  accentColor: LANDFALL.accent,
  borderColor: LANDFALL.line,
  borderRadius: 6,
  fontFamily: LANDFALL.font,
  fontSize: 14,
  iconColor: LANDFALL.ink2,
  rowHoverColor: "rgba(14,107,80,0.05)",
  menuBackgroundColor: LANDFALL.surface,
  menuTextColor: LANDFALL.ink,
  menuSeparatorColor: LANDFALL.line,
  tooltipBackgroundColor: LANDFALL.ink,
  tooltipTextColor: LANDFALL.surface,
  scrollbarThumbColor: "rgba(24,34,30,0.18)",
  scrollbarTrackColor: "transparent",
  toggleButtonOnBackgroundColor: LANDFALL.accent,
  toggleButtonOffBackgroundColor: LANDFALL.surface3,

  // studio chrome
  studioWrapperBackgroundColor: "transparent",
  studioWrapperBorder: false,
  studioPanelContainerBackgroundColor: LANDFALL.surface,
  studioPanelContainerBorder: { color: LANDFALL.line },
  studioPanelContainerBorderRadius: 8,
  studioPanelDividerColor: LANDFALL.line,
  studioPanelDividerActiveColor: LANDFALL.accent,
  studioPanelHeaderFontFamily: LANDFALL.font,
  studioPanelHeaderFontWeight: 600,
  studioPanelGroupBackgroundColor: "#FAF8F3",
  studioPanelSectionBorderColor: LANDFALL.line,
  studioFormLabelColor: LANDFALL.ink2,
  studioToggleButtonActiveBackgroundColor: "rgba(14,107,80,0.10)",
  studioToggleButtonActiveBorderColor: LANDFALL.accent,
  studioToggleButtonActiveColor: LANDFALL.accentStrong,
  studioIconButtonHoverBackgroundColor: "rgba(24,34,30,0.06)",
  studioIconButtonHoverColor: LANDFALL.ink,
  studioPopupBackgroundColor: LANDFALL.surface,
  studioPopupTitleBarBackgroundColor: LANDFALL.surface2,
  studioPopupTitleBarTextColor: LANDFALL.ink,

  // AI panel: neutral, a draft for a person
  studioAiPanelWidth: 360,
  studioAiPanelButtonHoverBackgroundColor: "rgba(24,34,30,0.06)",
  studioAiPanelRichTextAccentBackgroundColor: "rgba(14,107,80,0.08)",
  studioAiPanelInputMessageBackgroundColor: "#F0ECE3",

  // canvas
  studioCanvasBackgroundColor: "transparent",
  studioCanvasBorder: false,
  studioCanvasGridLineColor: "rgba(24,34,30,0.05)",
  studioCanvasFontFamily: LANDFALL.font,
  studioCanvasPadding: 4,

  // widgets = white cards on paper
  studioWidgetBackgroundColor: LANDFALL.surface,
  studioWidgetBorder: { color: LANDFALL.line },
  studioWidgetBorderRadius: 8,
  studioWidgetPadding: 14,
  studioWidgetShadow: "0 1px 2px rgba(60,48,30,0.06)",
  studioWidgetSelectedBorderColor: LANDFALL.accent,
  studioWidgetResizeBorderColor: LANDFALL.accent,
  studioWidgetToolbarBackgroundColor: LANDFALL.surface2,
  studioWidgetToolbarButtonColor: LANDFALL.ink2,
  studioWidgetTitleFontFamily: LANDFALL.font,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: LANDFALL.ink,
  studioWidgetSubtitleFontFamily: LANDFALL.font,
  studioWidgetSubtitleTextColor: LANDFALL.ink3,
  studioWidgetCaptionTextColor: LANDFALL.ink3,
  studioWidgetLoadingOverlayBackgroundColor: "rgba(255,255,255,0.7)",
  studioWidgetNoDataOverlayBackgroundColor: "rgba(255,255,255,0.7)",
  studioValueWidgetFontSize: 34,
  studioLinearGaugeLabelColor: LANDFALL.ink2,
  studioRangeInputFillColor: LANDFALL.accent,
  studioRangeInputRailColor: LANDFALL.surface3,
  valueChangeUpColor: LANDFALL.delivered,
  valueChangeDownColor: LANDFALL.danger,

  // grids inside Studio
  gridBrowserColorScheme: "light",
  gridAccentColor: LANDFALL.accent,
  gridFontFamily: LANDFALL.font,
  gridHeaderFontFamily: LANDFALL.font,
  gridHeaderFontSize: 12.5,
  gridHeaderFontWeight: 600,
  gridHeaderTextColor: LANDFALL.ink3,
  gridHeaderBackgroundColor: "#FAF8F3",
  gridDataBackgroundColor: "transparent",
  gridOddRowBackgroundColor: "#FCFBF8",
  gridCellTextColor: LANDFALL.ink,
  gridRowBorder: { color: LANDFALL.line },
  gridHeaderRowBorder: { color: LANDFALL.line },
  gridRowHoverColor: "rgba(14,107,80,0.05)",
  gridRowHeight: 40,
  gridWrapperBorder: false,

  // charts inside Studio
  chartFontFamily: LANDFALL.font,
  chartTextColor: LANDFALL.ink,
  chartSubtleTextColor: LANDFALL.ink3,
  chartAxisLabelColor: LANDFALL.ink3,
  chartAxisLineColor: "rgba(24,34,30,0.16)",
  chartGridLineColor: "rgba(24,34,30,0.07)",
  chartLegendLabelColor: LANDFALL.ink2,
  chartTooltipBackgroundColor: LANDFALL.surface,
  chartTooltipTextColor: LANDFALL.ink,
  chartTooltipBorder: { color: LANDFALL.line },
  chartSeriesLabelOutsideTextColor: LANDFALL.ink2,
  chartSeriesLabelInsideTextColor: "#FFFFFF",
  chartAccentColor: LANDFALL.accent,
  chartPaletteFills1Color: LANDFALL_PALETTE[0],
  chartPaletteFills2Color: LANDFALL_PALETTE[1],
  chartPaletteFills3Color: LANDFALL_PALETTE[2],
  chartPaletteFills4Color: LANDFALL_PALETTE[3],
  chartPaletteFills5Color: LANDFALL_PALETTE[4],
  chartPaletteFills6Color: LANDFALL_PALETTE[5],
  chartPaletteFills7Color: LANDFALL_PALETTE[6],
  chartPaletteFills8Color: LANDFALL_PALETTE[7],
  chartPaletteStrokes1Color: LANDFALL_PALETTE[0],
  chartPaletteStrokes2Color: LANDFALL_PALETTE[1],
  chartPaletteStrokes3Color: LANDFALL_PALETTE[2],
  chartPaletteStrokes4Color: LANDFALL_PALETTE[3],
  chartPaletteStrokes5Color: LANDFALL_PALETTE[4],
  chartPaletteStrokes6Color: LANDFALL_PALETTE[5],
  chartPaletteStrokes7Color: LANDFALL_PALETTE[6],
  chartPaletteStrokes8Color: LANDFALL_PALETTE[7],
} as const;

// Backwards-compatible aliases for existing imports.
export const fieldAtlasTheme = landfallGridTheme;
export const landfallDarkTheme = landfallGridTheme;
