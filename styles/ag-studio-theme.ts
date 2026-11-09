import { themeQuartz, colorSchemeDark } from "ag-grid-community";
import type { AgChartThemeOverrides } from "ag-charts-community";

/**
 * LANDFALL × AG — one theme for AG Studio, AG Grid and AG Charts.
 *
 * The chart palette encodes Landfall's colour meaning, so a Studio chart reads the same
 * as every other screen: teal = relief cash, blue = PayPal, violet = AI, amber = reserve,
 * coral = storm. Built with AG's official Theming APIs (studioTheme.withParams / themeQuartz.withParams).
 */

export const LANDFALL = {
  canvas: "#05070C",
  surface: "#0C111B",
  surface2: "#121825",
  surface3: "#1A2131",
  line: "#202838",
  lineStrong: "#303A4E",
  ink: "#EEF2F8",
  ink2: "#A3AEC2",
  ink3: "#6E7A91",
  accent: "#2DD4BF",
  accentStrong: "#5EEAD4",
  paypal: "#54A0FF",
  ai: "#A78BFA",
  amber: "#FBBF54",
  storm: "#FF7A59",
  danger: "#FF6378",
  font: "var(--font-geist-sans), Geist, Inter, system-ui, sans-serif",
  mono: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace",
} as const;

/** Ordered by meaning — relief first, then PayPal, reserve, AI, storm. */
export const LANDFALL_PALETTE = [
  LANDFALL.accent,
  LANDFALL.paypal,
  LANDFALL.amber,
  LANDFALL.ai,
  LANDFALL.storm,
  "#38BDF8",
  "#F472B6",
  "#A3E635",
];

/* ── AG Grid (standalone grids) ───────────────────────────── */

export const landfallGridTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "rgba(12,17,27,0.0)",
  foregroundColor: LANDFALL.ink,
  textColor: LANDFALL.ink,
  subtleTextColor: LANDFALL.ink3,
  accentColor: LANDFALL.accent,
  borderColor: "rgba(255,255,255,0.07)",
  chromeBackgroundColor: "rgba(255,255,255,0.02)",
  headerBackgroundColor: "rgba(255,255,255,0.03)",
  headerTextColor: LANDFALL.ink3,
  headerFontFamily: LANDFALL.mono,
  headerFontSize: 10.5,
  headerFontWeight: 500,
  rowBorder: { color: "rgba(255,255,255,0.05)" },
  headerRowBorder: { color: "rgba(255,255,255,0.08)" },
  wrapperBorder: false,
  oddRowBackgroundColor: "rgba(255,255,255,0.012)",
  rowHoverColor: "rgba(45,212,191,0.06)",
  selectedRowBackgroundColor: "rgba(45,212,191,0.12)",
  fontFamily: LANDFALL.font,
  fontSize: 13,
  rowHeight: 46,
  headerHeight: 42,
  spacing: 7,
  menuBackgroundColor: LANDFALL.surface2,
  inputBackgroundColor: "rgba(0,0,0,0.3)",
  inputBorder: { color: "rgba(255,255,255,0.1)" },
  browserColorScheme: "dark",
});

/* ── AG Charts (standalone charts) ────────────────────────── */

export const landfallChartTheme = {
  baseTheme: "ag-default-dark",
  palette: { fills: LANDFALL_PALETTE, strokes: LANDFALL_PALETTE },
  params: {
    fontFamily: LANDFALL.font,
    backgroundColor: "transparent",
    foregroundColor: LANDFALL.ink,
    textColor: LANDFALL.ink,
    subtleTextColor: LANDFALL.ink3,
    axisColor: "rgba(255,255,255,0.12)",
    gridLineColor: "rgba(255,255,255,0.06)",
    chromeBackgroundColor: LANDFALL.surface2,
  },
  overrides: {
    common: {
      background: { fill: "transparent" },
      legend: { item: { label: { color: LANDFALL.ink2, fontSize: 12 } } },
    },
  } satisfies AgChartThemeOverrides,
} as const;

/* ── AG Studio ────────────────────────────────────────────── */

/**
 * Parameters for `studioTheme.withParams(...)`. Kept as a plain object so the
 * (client-only) ag-studio import stays inside the component that renders Studio.
 */
export const landfallStudioParams = {
  // shared
  browserColorScheme: "dark",
  backgroundColor: LANDFALL.surface,
  foregroundColor: LANDFALL.ink,
  textColor: LANDFALL.ink,
  subtleTextColor: LANDFALL.ink3,
  accentColor: LANDFALL.accent,
  borderColor: "rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontFamily: LANDFALL.font,
  fontSize: 13,
  iconColor: LANDFALL.ink2,
  rowHoverColor: "rgba(45,212,191,0.06)",
  menuBackgroundColor: LANDFALL.surface2,
  menuTextColor: LANDFALL.ink,
  menuSeparatorColor: "rgba(255,255,255,0.06)",
  tooltipBackgroundColor: LANDFALL.surface3,
  tooltipTextColor: LANDFALL.ink,
  scrollbarThumbColor: "rgba(255,255,255,0.14)",
  scrollbarTrackColor: "transparent",
  toggleButtonOnBackgroundColor: LANDFALL.accent,
  toggleButtonOffBackgroundColor: LANDFALL.surface3,

  // studio chrome
  studioWrapperBackgroundColor: "transparent",
  studioWrapperBorder: false,
  studioPanelContainerBackgroundColor: "rgba(12,17,27,0.82)",
  studioPanelContainerBorder: { color: "rgba(255,255,255,0.07)" },
  studioPanelContainerBorderRadius: 16,
  studioPanelDividerColor: "rgba(255,255,255,0.06)",
  studioPanelDividerActiveColor: LANDFALL.accent,
  studioPanelHeaderFontFamily: LANDFALL.font,
  studioPanelHeaderFontWeight: 600,
  studioPanelGroupBackgroundColor: "rgba(255,255,255,0.025)",
  studioPanelSectionBorderColor: "rgba(255,255,255,0.06)",
  studioFormLabelColor: LANDFALL.ink2,
  studioToggleButtonActiveBackgroundColor: "rgba(45,212,191,0.14)",
  studioToggleButtonActiveBorderColor: LANDFALL.accent,
  studioToggleButtonActiveColor: LANDFALL.accentStrong,
  studioIconButtonHoverBackgroundColor: "rgba(255,255,255,0.06)",
  studioIconButtonHoverColor: LANDFALL.ink,
  studioPopupBackgroundColor: LANDFALL.surface2,
  studioPopupTitleBarBackgroundColor: LANDFALL.surface3,
  studioPopupTitleBarTextColor: LANDFALL.ink,

  // AI panel — violet = AI, everywhere in Landfall
  studioAiPanelWidth: 360,
  studioAiPanelButtonHoverBackgroundColor: "rgba(167,139,250,0.12)",
  studioAiPanelRichTextAccentBackgroundColor: "rgba(167,139,250,0.14)",
  studioAiPanelInputMessageBackgroundColor: "rgba(167,139,250,0.10)",

  // canvas
  studioCanvasBackgroundColor: "transparent",
  studioCanvasBorder: false,
  studioCanvasGridLineColor: "rgba(255,255,255,0.04)",
  studioCanvasFontFamily: LANDFALL.font,
  studioCanvasPadding: 4,

  // widgets = glass cards
  studioWidgetBackgroundColor: "rgba(18,24,37,0.72)",
  studioWidgetBorder: { color: "rgba(255,255,255,0.08)" },
  studioWidgetBorderRadius: 16,
  studioWidgetPadding: 14,
  studioWidgetShadow: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 18px 40px -18px rgba(0,0,0,0.8)",
  studioWidgetSelectedBorderColor: LANDFALL.accent,
  studioWidgetResizeBorderColor: LANDFALL.accent,
  studioWidgetToolbarBackgroundColor: LANDFALL.surface3,
  studioWidgetToolbarButtonColor: LANDFALL.ink2,
  studioWidgetTitleFontFamily: LANDFALL.font,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: LANDFALL.ink,
  studioWidgetSubtitleFontFamily: LANDFALL.font,
  studioWidgetSubtitleTextColor: LANDFALL.ink3,
  studioWidgetCaptionTextColor: LANDFALL.ink3,
  studioWidgetLoadingOverlayBackgroundColor: "rgba(12,17,27,0.6)",
  studioWidgetNoDataOverlayBackgroundColor: "rgba(12,17,27,0.6)",
  studioValueWidgetFontSize: 34,
  studioLinearGaugeLabelColor: LANDFALL.ink2,
  studioRangeInputFillColor: LANDFALL.accent,
  studioRangeInputRailColor: LANDFALL.surface3,
  valueChangeUpColor: LANDFALL.accent,
  valueChangeDownColor: LANDFALL.danger,

  // grids inside Studio
  gridBrowserColorScheme: "dark",
  gridAccentColor: LANDFALL.accent,
  gridFontFamily: LANDFALL.font,
  gridHeaderFontFamily: LANDFALL.mono,
  gridHeaderFontSize: 10.5,
  gridHeaderFontWeight: 500,
  gridHeaderTextColor: LANDFALL.ink3,
  gridHeaderBackgroundColor: "rgba(255,255,255,0.03)",
  gridDataBackgroundColor: "transparent",
  gridOddRowBackgroundColor: "rgba(255,255,255,0.015)",
  gridCellTextColor: LANDFALL.ink,
  gridRowBorder: { color: "rgba(255,255,255,0.05)" },
  gridHeaderRowBorder: { color: "rgba(255,255,255,0.08)" },
  gridRowHoverColor: "rgba(45,212,191,0.06)",
  gridRowHeight: 40,
  gridWrapperBorder: false,

  // charts inside Studio
  chartFontFamily: LANDFALL.font,
  chartTextColor: LANDFALL.ink,
  chartSubtleTextColor: LANDFALL.ink3,
  chartAxisLabelColor: LANDFALL.ink3,
  chartAxisLineColor: "rgba(255,255,255,0.12)",
  chartGridLineColor: "rgba(255,255,255,0.06)",
  chartLegendLabelColor: LANDFALL.ink2,
  chartTooltipBackgroundColor: LANDFALL.surface3,
  chartTooltipTextColor: LANDFALL.ink,
  chartTooltipBorder: { color: "rgba(255,255,255,0.1)" },
  chartSeriesLabelOutsideTextColor: LANDFALL.ink2,
  chartSeriesLabelInsideTextColor: "#03130F",
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
