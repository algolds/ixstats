// Chart configuration and common settings
// Extracted from EnhancedIntelligenceBriefing.tsx

export const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#6366f1",
  accent: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#6b7280",
};

export const CHART_DEFAULTS = {
  animationDuration: 300,
  strokeWidth: 2,
  dotSize: 4,
  gridStroke: "rgba(156, 163, 175, 0.1)",
  tooltipBackground: "rgba(17, 24, 39, 0.95)",
  tooltipBorder: "rgba(59, 130, 246, 0.3)",
};

export const getChartMargin = (compact = false) => ({
  top: compact ? 10 : 20,
  right: compact ? 10 : 20,
  bottom: compact ? 30 : 40,
  left: compact ? 40 : 60,
});

export const commonChartProps = {
  animationDuration: CHART_DEFAULTS.animationDuration,
  margin: getChartMargin(),
};

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
  color?: string;
}

export interface TimeSeriesDataPoint extends ChartDataPoint {
  timestamp: number;
  date?: string;
}

export interface MultiSeriesDataPoint {
  name: string;
  [key: string]: string | number;
}
