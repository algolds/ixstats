import type React from "react";

/**
 * Tab configuration for metric detail modals
 */
export interface MetricModalTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

import type { TimeRange } from "~/types/ixtime";
export type { TimeRange };

/**
 * Chart type options for data visualization
 */
export type ChartType = "line" | "area" | "bar" | "composed";

/**
 * Time range configuration with labels
 */
export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "4y", label: "4 Years" },
  { value: "5y", label: "5 Years" },
  { value: "20y", label: "20 Years" },
  { value: "all", label: "All time" },
];

/**
 * Chart type configuration with labels
 */
export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bar", label: "Bar" },
  { value: "composed", label: "Composed" },
];

/** Recharts `<Tooltip contentStyle>` shared by every metric chart. */
export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-surface-elevated)",
  color: "var(--color-label)",
  borderColor: "var(--color-separator)",
  borderRadius: "8px",
} as const;
