import type { LucideIcon } from "lucide-react";
import { BarChart3, LineChart, Globe, Info } from "lucide-react";

/**
 * Tab configuration for metric detail modals
 */
export interface MetricModalTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Base props for all metric detail modals
 */
export interface BaseMetricModalProps {
  /** Modal open state */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Country ID for data fetching */
  countryId: string;
  /** Country name for display */
  countryName?: string;
  /** Callback to refresh data */
  onRefresh?: () => void;
}

/**
 * Time range options for historical charts
 */
export type TimeRange = "3m" | "6m" | "1y" | "2y" | "5y" | "all";

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
  { value: "5y", label: "5 Years" },
  { value: "all", label: "All Time" },
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

/**
 * Standard tab configuration for metric modals
 */
export const STANDARD_TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "trends", label: "Trends", icon: LineChart },
  { id: "comparison", label: "Comparison", icon: Globe },
  { id: "details", label: "Details", icon: Info },
];

/**
 * Stat card data for overview tab
 */
export interface StatCardData {
  id: string;
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    isPositive?: boolean;
  };
  color?: string;
  description?: string;
}

/**
 * Comparison data structure
 */
export interface ComparisonData {
  /** This country's value */
  value: number;
  /** Global average */
  globalAverage: number;
  /** Regional average */
  regionalAverage?: number;
  /** Percentile rank (0-100) */
  percentile?: number;
  /** Ranking position */
  rank?: number;
  /** Total countries in ranking */
  totalCountries?: number;
}

/**
 * Historical data point for charts
 */
export interface HistoricalDataPoint {
  date: string;
  timestamp: number;
  value: number;
  [key: string]: any;
}
