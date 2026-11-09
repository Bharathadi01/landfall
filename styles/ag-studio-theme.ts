import { themeQuartz } from "ag-grid-community";

/**
 * FIELD ATLAS AG GRID & AG STUDIO 3.1.0 THEME
 * 
 * Built with the official AG Grid v36 & AG Studio Theming API.
 * Integrates seamlessly with the Field Atlas light-first editorial design system,
 * eliminating all legacy CSS variables and ensuring 100% visual harmony with
 * embedded AG Studio analytical workspaces, grids, and charts.
 */
export const fieldAtlasTheme = themeQuartz.withParams({
  backgroundColor: "#FFFEFA", // Paper
  foregroundColor: "#192A24", // Deep ink
  headerBackgroundColor: "#ECEAE2", // Surface muted
  headerTextColor: "#58665F", // Secondary ink
  borderColor: "#DEDCD3", // Border
  rowBorder: { color: "#EBE9E1" },
  headerRowBorder: { color: "#DEDCD3" },
  oddRowBackgroundColor: "#FFFEFA",
  rowHoverColor: "rgba(224, 238, 231, 0.45)", // Evergreen light soft hover
  selectedRowBackgroundColor: "rgba(224, 238, 231, 0.75)", // Evergreen selected
  accentColor: "#175B47", // Evergreen primary accent
  chromeBackgroundColor: "#F4F2EC", // Canvas
  fontSize: 12.5,
  fontFamily: "var(--font-sans, system-ui, sans-serif)",
});

// Backwards compatibility alias
export const landfallDarkTheme = fieldAtlasTheme;

