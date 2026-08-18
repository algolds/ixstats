// Chart Components Index
// Comprehensive data visualization library with glass physics integration

// Base Chart Components
export { GlassChart, chartTheme } from "./GlassChart";

// Recharts Integration
export { GlassBarChart, GlassLineChart, GlassPieChart } from "./RechartsIntegration";

export {
  GlassNumberPicker,
  GlassDial,
  GlassToggle,
  GlassSlider,
} from "../interactive-controls";

// Chart Type Definitions
export type ChartTheme = "default" | "gold" | "blue" | "emerald" | "purple";
export type ChartDepth = "base" | "elevated" | "modal";
export type ChartBlur = "light" | "medium" | "heavy";
export type ControlSize = "sm" | "md" | "lg";

// Re-export theme utilities
export {
  chartColorPalette,
  getChartColor,
  generateChartColors,
  getButtonColors,
  getTextColors,
  getBackgroundColors,
  getBorderColors,
} from "~/lib/builder";
