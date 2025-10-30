// Intelligence Briefing Components - Modular exports
// Central export file for all intelligence briefing components

// Core Components
export { VitalityMetricsPanel } from "./VitalityMetricsPanel";
export type { VitalityMetricsPanelProps } from "./VitalityMetricsPanel";

export { CountryMetricsGrid } from "./CountryMetricsGrid";
export type { CountryMetricsGridProps } from "./CountryMetricsGrid";

export { WikiIntegrationPanel } from "./WikiIntegrationPanel";
export type { WikiIntegrationPanelProps } from "./WikiIntegrationPanel";

// Summary Components
export {
  IntelligenceAlerts,
  CountryInformationDisplay,
  IntelligenceHeader,
} from "./IntelligenceSummary";
export type {
  IntelligenceAlertsProps,
  CountryInformationDisplayProps,
  IntelligenceHeaderProps,
} from "./IntelligenceSummary";

// Status Indicators
export {
  ClassificationBadge,
  StatusBadge,
  TrendIndicator,
  StabilityIndicator,
} from "./StatusIndicators";
export type {
  ClassificationBadgeProps,
  StatusBadgeProps,
  TrendIndicatorProps,
  StabilityIndicatorProps,
} from "./StatusIndicators";

// Chart Components
export {
  IntelligenceLineChart,
  IntelligenceBarChart,
  IntelligenceAreaChart,
  IntelligenceRadarChart,
  IntelligenceMultiLineChart,
} from "./charts/IntelligenceCharts";
export type {
  BaseChartProps,
  LineChartProps,
  BarChartProps,
  AreaChartProps,
  RadarChartProps,
  MultiLineChartProps,
} from "./charts/IntelligenceCharts";

// Types
export type {
  VitalityMetric,
  CountryMetric,
  IntelligenceAlert,
  CountryInformation,
  WikiSection,
  WikiIntelligenceData,
  CountryData,
  ClearanceLevel,
  TrendDirection,
  StatusLevel,
  ImportanceLevel,
} from "./types";

// Constants
export {
  CLASSIFICATION_STYLES,
  STATUS_STYLES,
  IMPORTANCE_STYLES,
  TIER_SCORE_MAP,
  ECONOMIC_TIER_DATA,
  POPULATION_TIER_DATA,
} from "./constants";

// Utilities
export {
  getTrendIcon,
  getTrendColor,
  getStatusFromValue,
  hasAccess,
  parseWikiContent,
} from "./utils";
