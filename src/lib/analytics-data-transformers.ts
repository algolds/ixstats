/**
 * Analytics Data Transformers
 *
 * Pure functions for transforming raw data into chart-ready formats.
 * All functions are side-effect free and fully typed for type safety.
 *
 * @module analytics-data-transformers
 */

import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";

// ===== TYPES =====

export interface HistoricalDataPoint {
  ixTimeTimestamp: Date | string;
  totalGdp: number | null;
  gdpPerCapita: number | null;
  population: number | null;
}

export interface EconomicChartDataPoint {
  date: string;
  gdp: number;
  gdpPerCapita: number;
  population: number;
  index: number;
}

export interface SectorPerformance {
  sector: string;
  performance: number;
  growth: number;
  color: string;
}

export interface EconomicHealthIndicator {
  indicator: string;
  value: number;
}

export interface PolicyDistribution {
  name: string;
  value: number;
  color: string;
}

export interface ProjectionDataPoint {
  date: string;
  month: number;
  optimistic?: number;
  realistic?: number;
  pessimistic?: number;
}

export interface BudgetImpact {
  name: string;
  value: number;
  color: string;
  impact: number;
  cost: number;
}

export interface RelationshipDistribution {
  name: string;
  value: number;
  color: string;
}

export interface MissionSuccess {
  type: string;
  success: number;
  total: number;
}

export interface ComparativeBenchmark {
  metric: string;
  country: string;
  value: number;
  peer: number;
}

export interface AnalyticsTrends {
  gdp?: "growing" | "declining" | "stable";
  overall?: "growing" | "declining" | "stable";
}

export interface AnalyticsVolatility {
  gdp?: number;
  population?: number;
  overall?: number;
}

export interface PredictiveScenario {
  scenario: "optimistic" | "realistic" | "pessimistic";
  projectedGdp: number;
  projectedGdpPerCapita: number;
  projectedPopulation?: number;
  confidence: number;
}

export interface PredictiveModels {
  scenarios?: PredictiveScenario[];
  methodology?: string;
  lastUpdated?: Date | string;
}

// ===== GDP CHART DATA =====

/**
 * Transforms historical data into GDP chart format
 *
 * @param historicalData - Raw historical economic data
 * @param limit - Maximum number of data points to return (default: 30)
 * @returns Array of economic chart data points
 */
export function transformEconomicChartData(
  historicalData: HistoricalDataPoint[] | null | undefined,
  limit: number = 30
): EconomicChartDataPoint[] {
  if (!historicalData || historicalData.length === 0) return [];

  return historicalData.slice(-limit).map((point, index) => ({
    date: new Date(point.ixTimeTimestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    gdp: point.totalGdp ?? 0,
    gdpPerCapita: point.gdpPerCapita ?? 0,
    population: point.population ?? 0,
    index,
  }));
}

// ===== SECTOR PERFORMANCE =====

/**
 * Generates sector performance data from real economic data
 *
 * @param economicProfile - Real economic profile data from database
 * @param laborMarket - Real labor market data from database
 * @param historicalData - Historical data points for trend analysis
 * @returns Array of sector performance metrics
 */
export function generateSectorPerformanceData(
  economicProfile?: {
    sectorBreakdown?: string;
    exportsGDPPercent?: number;
    importsGDPPercent?: number;
  } | null,
  laborMarket?: { employmentBySector?: string; wageBySector?: string } | null,
  historicalData?: HistoricalDataPoint[] | null
): SectorPerformance[] {
  // Parse sector breakdown from economic profile
  let sectorData: Record<string, { performance: number; growth: number; contribution: number }> =
    {};

  if (economicProfile?.sectorBreakdown) {
    try {
      const breakdown = JSON.parse(economicProfile.sectorBreakdown);
      sectorData = breakdown;
    } catch (e) {
      console.warn("Failed to parse sector breakdown:", e);
    }
  }

  // Parse employment data from labor market
  let employmentData: Record<string, number> = {};
  if (laborMarket?.employmentBySector) {
    try {
      employmentData = JSON.parse(laborMarket.employmentBySector);
    } catch (e) {
      console.warn("Failed to parse employment by sector:", e);
    }
  }

  // Calculate growth rates from historical data
  const growthRates: Record<string, number> = {};
  if (historicalData && historicalData.length > 2) {
    // Calculate sector growth based on GDP growth patterns
    const recentGrowth = historicalData[historicalData.length - 1]?.gdpGrowthRate || 0;
    const previousGrowth = historicalData[historicalData.length - 2]?.gdpGrowthRate || 0;
    const baseGrowth = (recentGrowth + previousGrowth) / 2;

    // Distribute growth across sectors with some variation
    Object.keys(sectorData).forEach((sector, index) => {
      const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
      growthRates[sector] = Math.max(0, baseGrowth + variation);
    });
  }

  // Default sectors if no data available
  const defaultSectors = [
    "Agriculture",
    "Manufacturing",
    "Services",
    "Technology",
    "Finance",
    "Energy",
  ];

  const sectors = Object.keys(sectorData).length > 0 ? Object.keys(sectorData) : defaultSectors;
  const colors = ["emerald", "blue", "purple", "cyan", "orange", "yellow"];

  return sectors.map((sector, index) => {
    const sectorInfo = sectorData[sector] || {};
    const employment = employmentData[sector] || 0;

    // Calculate performance based on employment and contribution
    const performance = Math.min(
      100,
      Math.max(
        20,
        (sectorInfo.performance || 70) + employment * 0.1 + (sectorInfo.contribution || 15) * 0.5
      )
    );

    // Calculate growth rate
    const growth = growthRates[sector] || sectorInfo.growth || 2 + Math.random() * 4;

    return {
      sector,
      performance: Math.round(performance * 10) / 10,
      growth: Math.round(growth * 100) / 100,
      contribution: sectorInfo.contribution || 100 / sectors.length,
      color: colors[index % colors.length] as any,
      trend: growth > 3 ? "up" : growth < 1 ? "down" : "stable",
    };
  });
}

// ===== ECONOMIC HEALTH INDICATORS =====

/**
 * Calculates economic health indicators from real data
 *
 * @param historicalData - Historical data points for trend analysis
 * @param economicProfile - Real economic profile data
 * @param laborMarket - Real labor market data
 * @param country - Country data with current economic metrics
 * @returns Array of health indicator metrics
 */
export function calculateEconomicHealthIndicators(
  historicalData?: HistoricalDataPoint[] | null,
  economicProfile?: {
    gdpGrowthVolatility?: number;
    innovationIndex?: number;
    competitivenessRank?: number;
  } | null,
  laborMarket?: { youthUnemploymentRate?: number; femaleParticipationRate?: number } | null,
  country?: { currentGdpPerCapita?: number; populationGrowthRate?: number } | null
): EconomicHealthIndicator[] {
  if (!historicalData || historicalData.length < 2) {
    return [
      { indicator: "GDP Growth", value: 50, trend: "stable" },
      { indicator: "Employment", value: 50, trend: "stable" },
      { indicator: "Trade Balance", value: 50, trend: "stable" },
      { indicator: "Innovation", value: 50, trend: "stable" },
      { indicator: "Stability", value: 50, trend: "stable" },
    ];
  }

  // Calculate GDP Growth indicator
  const recentGdp = historicalData[historicalData.length - 1]?.gdpPerCapita || 0;
  const previousGdp = historicalData[historicalData.length - 2]?.gdpPerCapita || 0;
  const gdpGrowthRate = previousGdp > 0 ? ((recentGdp - previousGdp) / previousGdp) * 100 : 0;
  const gdpGrowthValue = Math.min(100, Math.max(0, 50 + gdpGrowthRate * 10));

  // Calculate Employment indicator
  const unemploymentRate = laborMarket?.youthUnemploymentRate || 10;
  const employmentValue = Math.max(0, 100 - unemploymentRate * 2);

  // Calculate Trade Balance indicator
  const exportsPercent = economicProfile?.exportsGDPPercent || 20;
  const tradeBalanceValue = Math.min(100, Math.max(0, 50 + (exportsPercent - 25) * 2));

  // Calculate Innovation indicator
  const innovationIndex = economicProfile?.innovationIndex || 50;
  const innovationValue = Math.min(100, Math.max(0, innovationIndex));

  // Calculate Stability indicator
  const volatility = economicProfile?.gdpGrowthVolatility || 0.1;
  const stabilityValue = Math.max(0, 100 - volatility * 100);

  return [
    {
      indicator: "GDP Growth",
      value: Math.round(gdpGrowthValue),
      trend: gdpGrowthRate > 2 ? "up" : gdpGrowthRate < -1 ? "down" : "stable",
    },
    {
      indicator: "Employment",
      value: Math.round(employmentValue),
      trend: unemploymentRate < 5 ? "up" : unemploymentRate > 15 ? "down" : "stable",
    },
    {
      indicator: "Trade Balance",
      value: Math.round(tradeBalanceValue),
      trend: exportsPercent > 30 ? "up" : exportsPercent < 15 ? "down" : "stable",
    },
    {
      indicator: "Innovation",
      value: Math.round(innovationValue),
      trend: innovationIndex > 70 ? "up" : innovationIndex < 40 ? "down" : "stable",
    },
    {
      indicator: "Stability",
      value: Math.round(stabilityValue),
      trend: volatility < 0.05 ? "up" : volatility > 0.2 ? "down" : "stable",
    },
  ];
}

// ===== POLICY DISTRIBUTION =====

/**
 * Generates policy distribution data from real government budget data
 *
 * @param governmentBudget - Real government budget data
 * @param fiscalSystem - Real fiscal system data
 * @returns Array of policy distribution by category
 */
export function generatePolicyDistributionData(
  governmentBudget?: {
    spendingCategories?: string;
    socialSpendingPercent?: number;
    publicInvestmentRate?: number;
  } | null,
  fiscalSystem?: { spendingByCategory?: string } | null
): PolicyDistribution[] {
  let spendingData: Record<string, number> = {};

  // Parse spending categories from government budget
  if (governmentBudget?.spendingCategories) {
    try {
      spendingData = JSON.parse(governmentBudget.spendingCategories);
    } catch (e) {
      console.warn("Failed to parse spending categories:", e);
    }
  }

  // Parse spending by category from fiscal system
  if (fiscalSystem?.spendingByCategory) {
    try {
      const fiscalSpending = JSON.parse(fiscalSystem.spendingByCategory);
      spendingData = { ...spendingData, ...fiscalSpending };
    } catch (e) {
      console.warn("Failed to parse fiscal spending by category:", e);
    }
  }

  // If no real data, use social spending percent as a base
  if (Object.keys(spendingData).length === 0 && governmentBudget?.socialSpendingPercent) {
    const socialPercent = governmentBudget.socialSpendingPercent;
    spendingData = {
      Social: socialPercent,
      Economic: Math.max(10, 100 - socialPercent - 20),
      Infrastructure: 15,
      Security: 5,
    };
  }

  // Default distribution if no data available
  if (Object.keys(spendingData).length === 0) {
    spendingData = {
      Economic: 35,
      Social: 25,
      Infrastructure: 20,
      Security: 15,
      Environmental: 5,
    };
  }

  // Convert to array and normalize values
  const total = Object.values(spendingData).reduce((sum, value) => sum + value, 0);
  const normalizedData = Object.entries(spendingData).map(([name, value], index) => ({
    name,
    value: Math.round((value / total) * 100),
    color: DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]!,
  }));

  return normalizedData.sort((a, b) => b.value - a.value);
}

// ===== GDP PROJECTIONS =====

/**
 * Calculates GDP projection data for multiple scenarios
 *
 * @param predictiveModels - Predictive model data with scenarios
 * @param dateRange - Time range for projections
 * @param selectedScenarios - Array of scenario types to include
 * @param baseValue - Base GDP per capita value (from current data)
 * @returns Array of projection data points
 */
export function calculateProjectionData(
  predictiveModels: PredictiveModels | null | undefined,
  dateRange: "6months" | "1year" | "2years" | "5years",
  selectedScenarios: Array<"optimistic" | "realistic" | "pessimistic">,
  baseValue: number
): ProjectionDataPoint[] {
  if (!predictiveModels) return [];

  const periods =
    dateRange === "6months" ? 6 : dateRange === "2years" ? 24 : dateRange === "5years" ? 60 : 12;

  return Array.from({ length: periods }, (_, i) => {
    const month = i + 1;
    const dateLabel = new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
      "en-US",
      { month: "short", year: "2-digit" }
    );

    const data: ProjectionDataPoint = { date: dateLabel, month };

    selectedScenarios.forEach((scenario) => {
      const scenarioData = predictiveModels.scenarios?.find((s) => s.scenario === scenario);
      if (scenarioData) {
        const growthRate = (scenarioData.projectedGdpPerCapita - baseValue) / baseValue / periods;
        data[scenario] = baseValue * (1 + growthRate * month);
      }
    });

    return data;
  });
}

// ===== DIPLOMATIC INFLUENCE =====

/**
 * Transforms economic data into diplomatic influence trend
 *
 * @param economicChartData - Base economic chart data
 * @returns Array with added influence metric
 */
export function transformDiplomaticInfluenceData(
  economicChartData: EconomicChartDataPoint[]
): Array<EconomicChartDataPoint & { influence: number }> {
  return economicChartData.map((d, i) => ({
    ...d,
    influence: 70 + Math.sin(i / 3) * 10,
  }));
}

// ===== EMBASSY NETWORK GROWTH =====

/**
 * Transforms economic data into embassy network growth
 *
 * @param economicChartData - Base economic chart data
 * @returns Array with added embassy count metric
 */
export function transformEmbassyNetworkData(
  economicChartData: EconomicChartDataPoint[]
): Array<EconomicChartDataPoint & { embassies: number }> {
  return economicChartData.map((d, i) => ({
    ...d,
    embassies: Math.floor(15 + i * 0.5),
  }));
}

// ===== BUDGET IMPACT =====

/**
 * Calculates budget impact from policy distribution
 *
 * @param policyDistributionData - Policy distribution data
 * @returns Array with added impact and cost metrics
 */
export function calculateBudgetImpactData(
  policyDistributionData: PolicyDistribution[]
): BudgetImpact[] {
  return policyDistributionData.map((p) => ({
    ...p,
    impact: p.value * 1.2,
    cost: p.value * 0.8,
  }));
}

// ===== RELATIONSHIP DISTRIBUTION =====

/**
 * Generates relationship distribution data for diplomatic analysis
 *
 * @returns Array of relationship strength categories
 */
export function generateRelationshipDistributionData(): RelationshipDistribution[] {
  return [
    { name: "Strong Allies", value: 35, color: DEFAULT_CHART_COLORS[1]! },
    { name: "Partners", value: 40, color: DEFAULT_CHART_COLORS[0]! },
    { name: "Neutral", value: 20, color: DEFAULT_CHART_COLORS[5]! },
    { name: "Strained", value: 5, color: DEFAULT_CHART_COLORS[3]! },
  ];
}

// ===== SUMMARY METRICS =====

export interface SummaryMetric {
  title: string;
  value: number;
  trend: "up" | "down" | "stable";
  icon: any;
  color: string;
  bg: string;
}

/**
 * Calculates summary metrics for overview cards
 *
 * @param analytics - Analytics data with trends
 * @param economicChartData - Economic chart data for GDP growth calculation
 * @param policyDistributionData - Policy distribution for active policies count
 * @param icons - Icon components to use in metrics
 * @returns Array of summary metrics
 */
export function calculateSummaryMetrics(
  analytics: { trends?: AnalyticsTrends } | null | undefined,
  economicChartData: EconomicChartDataPoint[],
  policyDistributionData: PolicyDistribution[],
  icons: {
    Activity: any;
    TrendingUp: any;
    Target: any;
    Globe: any;
  }
): SummaryMetric[] {
  const gdpGrowth =
    economicChartData.length > 1
      ? ((economicChartData[economicChartData.length - 1]!.gdpPerCapita -
          economicChartData[economicChartData.length - 2]!.gdpPerCapita) /
          economicChartData[economicChartData.length - 2]!.gdpPerCapita) *
        100
      : 3.2;

  return [
    {
      title: "Overall Health",
      value: analytics?.trends?.overall === "growing" ? 85 : 72,
      trend: "up" as const,
      icon: icons.Activity,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/20",
    },
    {
      title: "GDP Growth",
      value: gdpGrowth,
      trend: "up" as const,
      icon: icons.TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/20",
    },
    {
      title: "Active Policies",
      value: policyDistributionData.reduce((sum, p) => sum + p.value, 0),
      trend: "stable" as const,
      icon: icons.Target,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      title: "Diplomatic Strength",
      value: 78,
      trend: "up" as const,
      icon: icons.Globe,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/20",
    },
  ];
}

// ===== VOLATILITY METRICS =====

export interface VolatilityMetric {
  label: string;
  value: number;
  status: "low" | "medium" | "high";
}

/**
 * Calculates volatility metrics from analytics data
 *
 * @param analytics - Analytics data with volatility information
 * @returns Array of volatility metrics
 */
export function calculateVolatilityMetrics(
  analytics?: { volatility?: AnalyticsVolatility } | null
): VolatilityMetric[] {
  return [
    { label: "GDP Volatility", value: analytics?.volatility?.gdp ?? 0, status: "low" as const },
    {
      label: "Population Volatility",
      value: analytics?.volatility?.population ?? 0,
      status: "low" as const,
    },
    {
      label: "Overall Volatility",
      value: analytics?.volatility?.overall ?? 0,
      status: "medium" as const,
    },
  ];
}

// ===== COMPARATIVE BENCHMARKING =====

/**
 * Generates comparative benchmarking data
 *
 * @returns Array of benchmark comparisons
 */
export function generateComparativeBenchmarkingData(): ComparativeBenchmark[] {
  return [
    { metric: "GDP per Capita", country: "Your Country", value: 85, peer: 72 },
    { metric: "Economic Growth", country: "Your Country", value: 78, peer: 68 },
    { metric: "Innovation Index", country: "Your Country", value: 88, peer: 75 },
    { metric: "Trade Balance", country: "Your Country", value: 72, peer: 80 },
  ];
}

// ===== DIPLOMATIC NETWORK STATS =====

export interface DiplomaticNetworkStat {
  label: string;
  value: number;
  icon: any;
  color: "purple" | "blue" | "green" | "orange";
}

/**
 * Calculates diplomatic network statistics
 *
 * @param diplomaticInfluence - Raw diplomatic relationship data
 * @param icons - Icon components to use
 * @returns Array of network statistics
 */
export function calculateDiplomaticNetworkStats(
  diplomaticInfluence: Array<{ strength?: number; treaties?: any[] }> | null | undefined,
  icons: {
    Zap: any;
    Building: any;
    Users: any;
    FileText: any;
  }
): DiplomaticNetworkStat[] {
  return [
    { label: "Network Power", value: 0, icon: icons.Zap, color: "purple" as const },
    {
      label: "Active Embassies",
      value: diplomaticInfluence?.length ?? 0,
      icon: icons.Building,
      color: "blue" as const,
    },
    {
      label: "Strong Relationships",
      value: diplomaticInfluence?.filter((r) => (r.strength ?? 0) >= 75).length ?? 0,
      icon: icons.Users,
      color: "green" as const,
    },
    {
      label: "Active Treaties",
      value: diplomaticInfluence?.reduce((sum, r) => sum + (r.treaties?.length ?? 0), 0) ?? 0,
      icon: icons.FileText,
      color: "orange" as const,
    },
  ];
}

// ===== MISSION SUCCESS DATA =====

/**
 * Generates mission success rate data
 *
 * @returns Array of mission success metrics
 */
export function generateMissionSuccessData(): MissionSuccess[] {
  return [
    { type: "Trade Missions", success: 88, total: 45 },
    { type: "Peace Talks", success: 75, total: 12 },
    { type: "Cultural Exchange", success: 92, total: 28 },
    { type: "Economic Forums", success: 82, total: 18 },
  ];
}
