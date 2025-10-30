/**
 * useAnalyticsDashboard Hook
 *
 * Encapsulates all data fetching, state management, and memoized transformations
 * for the Analytics Dashboard component.
 *
 * @module useAnalyticsDashboard
 */

import { useState, useMemo, useCallback } from "react";
import { Activity, TrendingUp, Target, Globe, Zap, Building, Users, FileText } from "lucide-react";
import { api } from "~/trpc/react";
import { exportDataToCSV, exportChartToPDF, exportDashboardReport } from "~/lib/export-utils";
import { toast } from "sonner";
import {
  transformEconomicChartData,
  generateSectorPerformanceData,
  calculateEconomicHealthIndicators,
  generatePolicyDistributionData,
  calculateProjectionData,
  transformDiplomaticInfluenceData,
  transformEmbassyNetworkData,
  calculateBudgetImpactData,
  generateRelationshipDistributionData,
  calculateSummaryMetrics,
  calculateVolatilityMetrics,
  generateComparativeBenchmarkingData,
  calculateDiplomaticNetworkStats,
  generateMissionSuccessData,
  type HistoricalDataPoint,
  type AnalyticsTrends,
  type AnalyticsVolatility,
} from "~/lib/analytics-data-transformers";

// ===== TYPES =====

export type DateRange = "6months" | "1year" | "2years" | "5years";
export type Scenario = "optimistic" | "realistic" | "pessimistic";
export type ActiveSection = "overview" | "economic" | "policy" | "diplomatic" | "forecasting";

type NormalizedAnalytics = {
  trends?: AnalyticsTrends;
  volatility?: AnalyticsVolatility;
};

interface UseAnalyticsDashboardProps {
  countryId: string;
}

// ===== HOOK =====

export function useAnalyticsDashboard({ countryId }: UseAnalyticsDashboardProps) {
  // ===== STATE =====
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [dateRange, setDateRange] = useState<DateRange>("1year");
  const [selectedScenarios, setSelectedScenarios] = useState<Scenario[]>(["realistic"]);
  const [showDataTable, setShowDataTable] = useState(false);

  // ===== API QUERIES =====
  const [analyticsError, setAnalyticsError] = useState(false);
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery({ countryId }, { enabled: !!countryId });

  const { data: policyEffectiveness } = api.unifiedIntelligence.getPolicyEffectiveness.useQuery(
    { countryId, category: "all" },
    { enabled: !!countryId, retry: false, onError: () => setAnalyticsError(true) }
  );

  const { data: diplomaticInfluence } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: predictiveModels } = api.unifiedIntelligence.getPredictiveModels.useQuery(
    {
      countryId,
      timeframe:
        dateRange === "6months"
          ? "6_months"
          : dateRange === "2years"
            ? "2_years"
            : dateRange === "5years"
              ? "5_years"
              : "1_year",
      scenarios: selectedScenarios,
    },
    { enabled: !!countryId, retry: false, onError: () => setAnalyticsError(true) }
  );

  const { data: analytics } = api.unifiedIntelligence.getAdvancedAnalytics.useQuery(
    { countryId },
    { enabled: !!countryId, retry: false, onError: () => setAnalyticsError(true) }
  );

  // Fetch real economic data
  const { data: economicProfile } = api.economics.getEconomicProfile.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: laborMarket } = api.economics.getLaborMarket.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: fiscalSystem } = api.economics.getFiscalSystem.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: governmentBudget } = api.economics.getGovernmentBudget.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: country } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  const normalizedHistoricalData = useMemo<HistoricalDataPoint[]>(() => {
    if (!Array.isArray(historicalData)) {
      return [];
    }

    // Calculate date range filter
    const now = Date.now();
    const dateRangeMs =
      {
        "6months": 6 * 30 * 24 * 60 * 60 * 1000,
        "1year": 365 * 24 * 60 * 60 * 1000,
        "2years": 2 * 365 * 24 * 60 * 60 * 1000,
        "5years": 5 * 365 * 24 * 60 * 60 * 1000,
      }[dateRange] || 365 * 24 * 60 * 60 * 1000;

    const startTime = now - dateRangeMs;

    return historicalData
      .filter((point: any) => {
        const pointTime =
          typeof point.ixTimeTimestamp === "number"
            ? point.ixTimeTimestamp
            : new Date(point.ixTimeTimestamp).getTime();
        return pointTime >= startTime;
      })
      .map((point: any) => ({
        ixTimeTimestamp:
          typeof point.ixTimeTimestamp === "number"
            ? new Date(point.ixTimeTimestamp).toISOString()
            : (point.ixTimeTimestamp ?? new Date().toISOString()),
        totalGdp: point.totalGdp ?? null,
        gdpPerCapita: point.gdpPerCapita ?? null,
        population: point.population ?? null,
      }));
  }, [historicalData, dateRange]);

  const normalizeTrend = (value: unknown): NonNullable<AnalyticsTrends["gdp"]> => {
    if (value === "growing" || value === "declining" || value === "stable") {
      return value;
    }
    return "stable";
  };

  const normalizedAnalytics = useMemo<NormalizedAnalytics | null>(() => {
    if (!analytics) return null;

    const trends = analytics.trends ?? {};
    const volatility = analytics.volatility ?? {};

    return {
      ...analytics,
      trends: {
        gdp: normalizeTrend(trends.gdp),
        overall: normalizeTrend(trends.overall),
      },
      volatility: {
        gdp: typeof volatility.gdp === "number" ? volatility.gdp : 0,
        population: typeof volatility.population === "number" ? volatility.population : 0,
        overall: typeof volatility.overall === "number" ? volatility.overall : 0,
      },
    };
  }, [analytics]);

  // ===== MEMOIZED DATA TRANSFORMATIONS =====

  const economicChartData = useMemo(
    () => transformEconomicChartData(normalizedHistoricalData),
    [normalizedHistoricalData]
  );

  const sectorPerformanceData = useMemo(
    () => generateSectorPerformanceData(economicProfile, laborMarket, normalizedHistoricalData),
    [economicProfile, laborMarket, normalizedHistoricalData]
  );

  const economicHealthIndicators = useMemo(
    () =>
      calculateEconomicHealthIndicators(
        normalizedHistoricalData,
        economicProfile,
        laborMarket,
        country
      ),
    [normalizedHistoricalData, economicProfile, laborMarket, country]
  );

  const policyDistributionData = useMemo(
    () => generatePolicyDistributionData(governmentBudget, fiscalSystem),
    [governmentBudget, fiscalSystem]
  );

  const projectionData = useMemo(() => {
    const baseValue =
      economicChartData.length > 0
        ? economicChartData[economicChartData.length - 1]!.gdpPerCapita
        : 50000;

    return calculateProjectionData(predictiveModels, dateRange, selectedScenarios, baseValue);
  }, [predictiveModels, dateRange, selectedScenarios, economicChartData]);

  const diplomaticInfluenceData = useMemo(
    () => transformDiplomaticInfluenceData(economicChartData),
    [economicChartData]
  );

  const embassyNetworkData = useMemo(
    () => transformEmbassyNetworkData(economicChartData),
    [economicChartData]
  );

  const budgetImpactData = useMemo(
    () => calculateBudgetImpactData(policyDistributionData),
    [policyDistributionData]
  );

  const relationshipDistributionData = useMemo(() => generateRelationshipDistributionData(), []);

  const summaryMetrics = useMemo(
    () =>
      calculateSummaryMetrics(
        normalizedAnalytics ?? undefined,
        economicChartData,
        policyDistributionData,
        { Activity, TrendingUp, Target, Globe }
      ),
    [normalizedAnalytics, economicChartData, policyDistributionData]
  );

  const volatilityMetrics = useMemo(
    () => calculateVolatilityMetrics(normalizedAnalytics ?? undefined),
    [normalizedAnalytics]
  );

  const comparativeBenchmarkingData = useMemo(() => generateComparativeBenchmarkingData(), []);

  const diplomaticNetworkStats = useMemo(
    () => calculateDiplomaticNetworkStats(diplomaticInfluence, { Zap, Building, Users, FileText }),
    [diplomaticInfluence]
  );

  const missionSuccessData = useMemo(() => generateMissionSuccessData(), []);

  // ===== FORMAT HELPERS =====

  const formatCurrency = useCallback((value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  const formatPercent = useCallback((value: number) => `${value.toFixed(1)}%`, []);

  // ===== EXPORT FUNCTIONS =====

  const exportToCSV = useCallback(
    (data: any[], filename: string, headerMap?: Record<string, string>) => {
      try {
        if (headerMap) {
          const processedData = data.map((row: Record<string, any>) => {
            const transformedRow: Record<string, any> = {};
            Object.keys(row).forEach((key: string) => {
              const newKey = headerMap[key] ?? key;
              transformedRow[newKey] = row[key];
            });
            return transformedRow;
          });
          exportDataToCSV(processedData, filename);
        } else {
          exportDataToCSV(data, filename);
        }
        toast.success(`Exported ${filename}.csv successfully`);
      } catch (error) {
        console.error("Error exporting to CSV:", error);
        toast.error("Failed to export CSV");
      }
    },
    []
  );

  const exportToPDF = useCallback(async (chartId: string, chartName: string) => {
    try {
      await exportChartToPDF(chartId, `analytics-${chartName}`, {
        title: chartName,
        orientation: "landscape",
      });
      toast.success(`Exported ${chartName} to PDF successfully`);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export PDF");
    }
  }, []);

  const exportAllCharts = useCallback(async () => {
    try {
      const charts: Array<{ id: string; title: string; description?: string }> = [];

      // Add charts based on active section
      if (activeSection === "overview") {
        charts.push(
          {
            id: "gdp-trend-chart",
            title: "GDP Per Capita Trend",
            description: "Historical GDP per capita performance",
          },
          {
            id: "economic-health-chart",
            title: "Economic Health Indicators",
            description: "Multi-dimensional health metrics",
          }
        );
      } else if (activeSection === "economic") {
        charts.push(
          {
            id: "sector-performance-chart",
            title: "Sector Performance Breakdown",
            description: "GDP contribution by sector",
          },
          {
            id: "sector-growth-chart",
            title: "Sector Growth Rates",
            description: "Annual growth percentage by sector",
          }
        );
      } else if (activeSection === "policy") {
        charts.push(
          {
            id: "policy-distribution-chart",
            title: "Policy Category Distribution",
            description: "Active policies by category",
          },
          {
            id: "budget-impact-chart",
            title: "Budget Impact Analysis",
            description: "Financial impact of policies",
          }
        );
      } else if (activeSection === "diplomatic") {
        charts.push(
          {
            id: "diplomatic-influence-chart",
            title: "Diplomatic Influence Over Time",
            description: "Global standing trends",
          },
          {
            id: "relationship-distribution-chart",
            title: "Relationship Strength Distribution",
            description: "Quality of relationships",
          }
        );
      } else if (activeSection === "forecasting") {
        charts.push({
          id: "gdp-projections-chart",
          title: "GDP Per Capita Projections",
          description: `Projected growth over ${dateRange}`,
        });
      }

      if (charts.length === 0) {
        toast.error("No charts available to export");
        return;
      }

      await exportDashboardReport(charts, `analytics-report-${activeSection}-${Date.now()}`, {
        reportTitle: `Analytics Dashboard Report - ${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}`,
        orientation: "landscape",
      });

      toast.success("Exported all charts to PDF successfully");
    } catch (error) {
      console.error("Error exporting all charts:", error);
      toast.error("Failed to export report");
    }
  }, [activeSection, dateRange]);

  // ===== EVENT HANDLERS =====

  const handleDateRangeChange = useCallback((value: string) => {
    setDateRange(value as DateRange);
  }, []);

  const handleShowDataTableToggle = useCallback(() => {
    setShowDataTable((prev) => !prev);
  }, []);

  const handleSectionChange = useCallback((value: string) => {
    setActiveSection(value as ActiveSection);
  }, []);

  const handleScenarioToggle = useCallback((scenario: Scenario) => {
    setSelectedScenarios((prev) =>
      prev.includes(scenario) ? prev.filter((s) => s !== scenario) : [...prev, scenario]
    );
  }, []);

  // ===== RETURN INTERFACE =====

  return {
    // State
    activeSection,
    dateRange,
    selectedScenarios,
    showDataTable,

    // Loading (only block on core historical data)
    isLoading: historicalLoading,

    // Chart Data
    economicChartData,
    sectorPerformanceData,
    economicHealthIndicators,
    policyDistributionData,
    projectionData,
    diplomaticInfluenceData,
    embassyNetworkData,
    budgetImpactData,
    relationshipDistributionData,

    // Metrics
    summaryMetrics,
    volatilityMetrics,
    comparativeBenchmarkingData,
    diplomaticNetworkStats,
    missionSuccessData,

    // Raw Data (for specific use cases)
    policyEffectiveness,
    predictiveModels,
    historicalData,
    analyticsError,

    // Formatters
    formatCurrency,
    formatPercent,

    // Export Functions
    exportToCSV,
    exportToPDF,
    exportAllCharts,

    // Event Handlers
    handleDateRangeChange,
    handleShowDataTableToggle,
    handleSectionChange,
    handleScenarioToggle,
  };
}
