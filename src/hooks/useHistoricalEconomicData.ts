// src/hooks/useHistoricalEconomicData.ts
/**
 * Historical Economic Data Hook
 *
 * Custom React hook for managing historical economic data state, filtering,
 * transformations, and event management.
 *
 * @module useHistoricalEconomicData
 */

import { useState, useMemo, useCallback } from "react";
import { IxTime } from "~/lib/ixtime";
import type {
  HistoricalDataPoint,
  EconomicEvent,
  ChartDataPoint,
  EventMarker,
  EconomicTrend,
  VolatilityMetrics,
  ExportFormat,
  AggregationPeriod,
} from "~/lib/historical-economic-data-transformers";
import {
  transformHistoricalGdpData,
  calculateGrowthRates,
  detectEconomicTrends,
  calculateVolatility,
  comparePeriodsData,
  generateForecastData,
  aggregateDataByPeriod,
  calculateCyclicalPatterns,
  exportToTimeSeries,
} from "~/lib/historical-economic-data-transformers";

/**
 * Time range option
 */
export type TimeRange = "1Y" | "5Y" | "10Y" | "ALL";

/**
 * Metric type for display
 */
export type MetricType = "gdp" | "population" | "unemployment";

/**
 * View mode
 */
export type ViewMode = "timeline" | "events" | "analysis";

/**
 * Hook configuration
 */
interface UseHistoricalEconomicDataConfig {
  countryId: string;
  countryName: string;
  historicalData: HistoricalDataPoint[];
  totalPopulation: number;
  isEditable?: boolean;
}

/**
 * Hook return type
 */
interface UseHistoricalEconomicDataReturn {
  // View state
  view: ViewMode;
  setView: (view: ViewMode) => void;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;

  // Filter state
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (range: TimeRange) => void;
  selectedEventType: string;
  setSelectedEventType: (type: string) => void;
  selectedSeverity: string;
  setSelectedSeverity: (severity: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedMetric: MetricType;
  setSelectedMetric: (metric: MetricType) => void;

  // Modal state
  isAddingEvent: boolean;
  setIsAddingEvent: (adding: boolean) => void;

  // Computed data
  filteredData: HistoricalDataPoint[];
  allEvents: EconomicEvent[];
  chartData: ChartDataPoint[];
  eventMarkers: EventMarker[];
  economicHealthTrend: EconomicTrend;
  volatilityMetrics: VolatilityMetrics;

  // Utility functions
  getMetricValue: (point: ChartDataPoint) => number;
  formatMetricValue: (value: number) => string;
  getMetricColor: () => string;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Export
  handleExport: (format: ExportFormat) => void;
}

/**
 * Custom hook for managing historical economic data
 *
 * @param config - Hook configuration
 * @returns Historical data state and utilities
 *
 * @example
 * const historical = useHistoricalEconomicData({
 *   countryId: '123',
 *   countryName: 'Example Country',
 *   historicalData: dataPoints,
 *   totalPopulation: 1000000,
 *   isEditable: false,
 * });
 */
export function useHistoricalEconomicData({
  countryId,
  countryName,
  historicalData,
  totalPopulation,
  isEditable = false,
}: UseHistoricalEconomicDataConfig): UseHistoricalEconomicDataReturn {
  // View state
  const [view, setView] = useState<ViewMode>("timeline");
  const [editMode, setEditMode] = useState(false);

  // Filter state
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("5Y");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("gdp");

  // Modal state
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Filter historical data based on time range
  const filteredData = useMemo(() => {
    const now = IxTime.getCurrentIxTime();
    let startTime = now;

    switch (selectedTimeRange) {
      case "1Y":
        startTime = IxTime.addYears(now, -1);
        break;
      case "5Y":
        startTime = IxTime.addYears(now, -5);
        break;
      case "10Y":
        startTime = IxTime.addYears(now, -10);
        break;
      case "ALL":
        startTime = 0;
        break;
    }

    return historicalData.filter((point) => point.timestamp >= startTime);
  }, [historicalData, selectedTimeRange]);

  // Get all events from filtered data with filters applied
  const allEvents = useMemo(() => {
    const events: EconomicEvent[] = [];
    filteredData.forEach((point) => {
      events.push(...point.events);
    });

    return events
      .filter((event) => {
        if (selectedEventType !== "all" && event.type !== selectedEventType) return false;
        if (selectedSeverity !== "all" && event.severity !== selectedSeverity) return false;
        if (
          searchQuery &&
          !event.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !event.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredData, selectedEventType, selectedSeverity, searchQuery]);

  // Transform data for charts
  const chartData = useMemo(() => {
    return transformHistoricalGdpData(filteredData);
  }, [filteredData]);

  // Calculate event markers for visualization
  const eventMarkers = useMemo(() => {
    const markers: EventMarker[] = [];

    filteredData.forEach((point) => {
      point.events.forEach((event) => {
        let value = 0;
        switch (selectedMetric) {
          case "gdp":
            value = point.gdpPerCapita;
            break;
          case "population":
            value = point.population;
            break;
          case "unemployment":
            value = point.unemploymentRate;
            break;
        }
        markers.push({
          timestamp: event.timestamp,
          value,
          event,
        });
      });
    });

    return markers;
  }, [filteredData, selectedMetric]);

  // Calculate economic health trend
  const economicHealthTrend = useMemo(() => {
    return detectEconomicTrends(chartData, 3, 3);
  }, [chartData]);

  // Calculate volatility metrics
  const volatilityMetrics = useMemo(() => {
    if (selectedMetric === "gdp") {
      return calculateVolatility(chartData, "gdpPerCapita");
    } else if (selectedMetric === "unemployment") {
      return calculateVolatility(chartData, "unemploymentRate");
    }
    return {
      standardDeviation: 0,
      coefficientOfVariation: 0,
      volatilityLevel: "low" as const,
    };
  }, [chartData, selectedMetric]);

  // Get metric value from chart point
  const getMetricValue = useCallback(
    (point: ChartDataPoint): number => {
      switch (selectedMetric) {
        case "gdp":
          return point.gdpPerCapita;
        case "population":
          return point.population;
        case "unemployment":
          return point.unemploymentRate;
      }
    },
    [selectedMetric]
  );

  // Format metric value for display
  const formatMetricValue = useCallback(
    (value: number): string => {
      switch (selectedMetric) {
        case "gdp":
          return `$${(value / 1000).toFixed(1)}k`;
        case "population":
          return value >= 1000000
            ? `${(value / 1000000).toFixed(2)}M`
            : `${(value / 1000).toFixed(1)}k`;
        case "unemployment":
          return `${value.toFixed(1)}%`;
      }
    },
    [selectedMetric]
  );

  // Get metric color
  const getMetricColor = useCallback((): string => {
    switch (selectedMetric) {
      case "gdp":
        return "#10b981";
      case "population":
        return "#3b82f6";
      case "unemployment":
        return "#ef4444";
    }
  }, [selectedMetric]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedEventType("all");
    setSelectedSeverity("all");
    setSearchQuery("");
    setSelectedTimeRange("5Y");
  }, []);

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return selectedEventType !== "all" || selectedSeverity !== "all" || searchQuery !== "";
  }, [selectedEventType, selectedSeverity, searchQuery]);

  // Export data handler
  const handleExport = useCallback(
    (format: ExportFormat) => {
      const exportData = exportToTimeSeries(chartData, format);
      const blob = new Blob([exportData], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${countryName}-economic-history-${selectedTimeRange}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [chartData, countryName, selectedTimeRange]
  );

  return {
    // View state
    view,
    setView,
    editMode,
    setEditMode,

    // Filter state
    selectedTimeRange,
    setSelectedTimeRange,
    selectedEventType,
    setSelectedEventType,
    selectedSeverity,
    setSelectedSeverity,
    searchQuery,
    setSearchQuery,
    selectedMetric,
    setSelectedMetric,

    // Modal state
    isAddingEvent,
    setIsAddingEvent,

    // Computed data
    filteredData,
    allEvents,
    chartData,
    eventMarkers,
    economicHealthTrend,
    volatilityMetrics,

    // Utility functions
    getMetricValue,
    formatMetricValue,
    getMetricColor,
    clearFilters,
    hasActiveFilters,

    // Export
    handleExport,
  };
}
