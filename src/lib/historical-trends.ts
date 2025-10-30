/**
 * Historical Trend Analysis Utilities
 * Calculates trends and patterns from historical economic and government data
 */

export interface TrendPoint {
  timestamp: Date;
  value: number;
  metric: string;
}

export interface TrendAnalysis {
  trend: "improving" | "declining" | "stable" | "volatile";
  changePercent: number;
  confidence: number;
  direction: "up" | "down" | "flat";
  velocity: number; // Rate of change
  volatility: number; // Standard deviation
}

/**
 * Analyzes trend from a series of data points
 */
export function analyzeTrend(points: TrendPoint[]): TrendAnalysis {
  if (points.length < 2) {
    return {
      trend: "stable",
      changePercent: 0,
      confidence: 0,
      direction: "flat",
      velocity: 0,
      volatility: 0,
    };
  }

  // Sort by timestamp
  const sortedPoints = points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Calculate linear regression for trend
  const n = sortedPoints.length;
  const values = sortedPoints.map((p) => p.value);
  const timeIndices = sortedPoints.map((_, i) => i);

  // Calculate means
  const meanTime = timeIndices.reduce((sum, t) => sum + t, 0) / n;
  const meanValue = values.reduce((sum, v) => sum + v, 0) / n;

  // Calculate slope (trend direction and strength)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (timeIndices[i] - meanTime) * (values[i] - meanValue);
    denominator += Math.pow(timeIndices[i] - meanTime, 2);
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;

  // Calculate correlation coefficient (confidence)
  let sumSquaredDiffs = 0;
  let sumSquaredTimeDeviations = 0;

  for (let i = 0; i < n; i++) {
    sumSquaredDiffs += Math.pow(values[i] - meanValue, 2);
    sumSquaredTimeDeviations += Math.pow(timeIndices[i] - meanTime, 2);
  }

  const correlation =
    sumSquaredDiffs === 0 || sumSquaredTimeDeviations === 0
      ? 0
      : numerator / Math.sqrt(sumSquaredDiffs * sumSquaredTimeDeviations);

  // Calculate volatility (standard deviation)
  const volatility = Math.sqrt(sumSquaredDiffs / n);
  const normalizedVolatility = volatility / meanValue; // Coefficient of variation

  // Calculate percentage change from first to last
  const firstValue = sortedPoints[0].value;
  const lastValue = sortedPoints[n - 1].value;
  const changePercent = firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  // Determine trend classification
  let trend: TrendAnalysis["trend"];

  if (normalizedVolatility > 0.15) {
    trend = "volatile";
  } else if (Math.abs(slope) < 0.01 * meanValue) {
    trend = "stable";
  } else if (slope > 0) {
    trend = "improving";
  } else {
    trend = "declining";
  }

  return {
    trend,
    changePercent,
    confidence: Math.abs(correlation),
    direction: slope > 0.01 ? "up" : slope < -0.01 ? "down" : "flat",
    velocity: slope,
    volatility: normalizedVolatility,
  };
}

/**
 * Generate synthetic historical data points for a country
 * This simulates historical trends based on current country state
 */
export function generateHistoricalDataPoints(
  currentValue: number,
  metric: string,
  periods: number = 12,
  baseGrowthRate: number = 0.02
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const now = new Date();

  // Start from 12 months ago
  let value = currentValue;

  for (let i = periods - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000); // 30 days per period

    // Add some realistic variation
    const growthVariation = (Math.random() - 0.5) * 0.04; // ±2% variation
    const monthlyGrowth = baseGrowthRate / 12 + growthVariation;

    if (i < periods - 1) {
      value = value / (1 + monthlyGrowth); // Work backwards from current value
    }

    points.push({
      timestamp,
      value: Math.max(0, value),
      metric,
    });
  }

  return points.reverse();
}

/**
 * Calculate economic performance trend for a country
 */
export function calculateEconomicTrend(
  gdp: number,
  gdpGrowthRate: number,
  populationGrowthRate: number
): TrendAnalysis {
  // Generate historical GDP per capita data
  const gdpPerCapitaHistory = generateHistoricalDataPoints(
    gdp,
    "gdp_per_capita",
    12,
    gdpGrowthRate - populationGrowthRate // Net per capita growth
  );

  return analyzeTrend(gdpPerCapitaHistory);
}

/**
 * Calculate diplomatic relations trend
 */
export function calculateDiplomaticTrend(
  currentInfluence: number,
  tradeStrength: number,
  allianceStrength: number
): TrendAnalysis {
  // Base diplomatic growth on trade and alliance strength
  const diplomaticGrowthRate = (tradeStrength + allianceStrength) / 1000;

  const diplomaticHistory = generateHistoricalDataPoints(
    currentInfluence,
    "diplomatic_influence",
    12,
    diplomaticGrowthRate
  );

  return analyzeTrend(diplomaticHistory);
}

/**
 * Calculate government approval trend
 */
export function calculateGovernmentTrend(
  currentApproval: number,
  economicPerformance: number,
  diplomaticStanding: number
): TrendAnalysis {
  // Government approval tends to correlate with economic performance
  const approvalGrowthRate = (economicPerformance - 50) / 1000; // -5% to +5% based on performance

  const approvalHistory = generateHistoricalDataPoints(
    currentApproval,
    "government_approval",
    12,
    approvalGrowthRate
  );

  return analyzeTrend(approvalHistory);
}

/**
 * Format trend for display in intelligence components
 */
export function formatTrendForIntelligence(analysis: TrendAnalysis): {
  description: string;
  color: string;
  icon: string;
  actionable: boolean;
} {
  const { trend, changePercent, confidence } = analysis;

  let description: string;
  let color: string;
  let icon: string;
  let actionable: boolean;

  switch (trend) {
    case "improving":
      description = `Improving trend (+${changePercent.toFixed(1)}%) with ${(confidence * 100).toFixed(0)}% confidence`;
      color = "text-green-600";
      icon = "TrendingUp";
      actionable = false;
      break;

    case "declining":
      description = `Declining trend (${changePercent.toFixed(1)}%) with ${(confidence * 100).toFixed(0)}% confidence`;
      color = "text-red-600";
      icon = "TrendingDown";
      actionable = true;
      break;

    case "volatile":
      description = `Volatile pattern (${Math.abs(changePercent).toFixed(1)}% variation) - requires monitoring`;
      color = "text-orange-600";
      icon = "Activity";
      actionable = true;
      break;

    case "stable":
    default:
      description = `Stable trend (${changePercent.toFixed(1)}% change) with ${(confidence * 100).toFixed(0)}% confidence`;
      color = "text-blue-600";
      icon = "Minus";
      actionable = false;
      break;
  }

  return { description, color, icon, actionable };
}
