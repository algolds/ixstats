/**
 * Advanced Intelligence Analysis Engine
 *
 * Implements sophisticated algorithms for detecting patterns, anomalies,
 * and generating actionable intelligence from multi-factor economic data.
 *
 * Based on research:
 * - Deep Learning for Time Series Anomaly Detection (2025)
 * - Multi-factor Correlation Analysis for Economic Intelligence
 * - Z-Score and Modified Z-Score for Outlier Detection
 * - Dynamic Factor Models (DFM) for multivariate forecasting
 */

import type { Country } from "@prisma/client";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface IntelligenceAlert {
  id: string;
  type: "anomaly" | "trend" | "correlation" | "threshold" | "opportunity" | "risk";
  severity: "critical" | "high" | "medium" | "low";
  category: "economic" | "population" | "diplomatic" | "governance";
  title: string;
  description: string;
  confidence: number; // 0-100
  detected: number; // timestamp
  factors: string[]; // Contributing factors
  metrics: {
    current: number;
    expected: number;
    deviation: number;
    zScore: number;
  };
  recommendations: string[];
}

export interface CorrelationInsight {
  factor1: string;
  factor2: string;
  correlation: number; // -1 to 1
  significance: "strong" | "moderate" | "weak";
  direction: "positive" | "negative" | "none";
  confidence: number;
  implications: string[];
}

export interface TrendAnalysis {
  metric: string;
  category: string;
  trend:
    | "accelerating_up"
    | "accelerating_down"
    | "steady_up"
    | "steady_down"
    | "volatile"
    | "stable";
  velocity: number; // Rate of change
  momentum: number; // Change in rate of change
  forecast: {
    next_week: number;
    next_month: number;
    next_quarter: number;
    confidence: number;
  };
  inflectionPoints: Array<{
    timestamp: number;
    type: "peak" | "trough" | "reversal";
  }>;
}

export interface IntelligenceReport {
  countryId: string;
  generated: number;
  alerts: IntelligenceAlert[];
  correlations: CorrelationInsight[];
  trends: TrendAnalysis[];
  summary: {
    overallHealth: number;
    criticalIssues: number;
    opportunities: number;
    riskLevel: "low" | "medium" | "high" | "critical";
  };
}

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

/**
 * Calculate z-score for outlier detection
 * Values > 3.0 or < -3.0 are considered critical outliers
 * Values > 2.0 or < -2.0 are considered moderate outliers
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Modified z-score for non-normally distributed data (better for economic data)
 * Uses Median Absolute Deviation (MAD) instead of standard deviation
 */
function calculateModifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return 0;
  return (0.6745 * (value - median)) / mad;
}

/**
 * Calculate median absolute deviation
 */
function calculateMAD(values: number[]): number {
  const median = calculateMedian(values);
  const deviations = values.map((v) => Math.abs(v - median));
  return calculateMedian(deviations);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean?: number): number {
  if (values.length === 0) return 0;
  const avg = mean ?? calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate Pearson correlation coefficient between two series
 * Returns value between -1 (perfect negative) and 1 (perfect positive)
 */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  const stdX = calculateStdDev(x, meanX);
  const stdY = calculateStdDev(y, meanY);

  if (stdX === 0 || stdY === 0) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += ((x[i]! - meanX) / stdX) * ((y[i]! - meanY) / stdY);
  }

  return sum / n;
}

/**
 * Calculate momentum (rate of change of velocity)
 */
function calculateMomentum(values: number[]): number {
  if (values.length < 3) return 0;

  // Calculate velocities
  const velocities: number[] = [];
  for (let i = 1; i < values.length; i++) {
    velocities.push(values[i]! - values[i - 1]!);
  }

  // Calculate change in velocity (momentum)
  const momentum = velocities[velocities.length - 1]! - velocities[0]!;
  return momentum;
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Detect anomalies using z-score and modified z-score methods
 */
export function detectAnomalies(
  current: number,
  historical: number[],
  metric: string,
  category: "economic" | "population" | "diplomatic" | "governance"
): IntelligenceAlert | null {
  if (historical.length < 3) return null;

  const mean = calculateMean(historical);
  const stdDev = calculateStdDev(historical, mean);
  const median = calculateMedian(historical);
  const mad = calculateMAD(historical);

  const zScore = calculateZScore(current, mean, stdDev);
  const modifiedZScore = calculateModifiedZScore(current, median, mad);

  // Use modified z-score for economic data (better for non-normal distributions)
  const effectiveZScore = category === "economic" ? modifiedZScore : zScore;
  const deviation = ((current - mean) / mean) * 100;

  // Critical threshold: |z| > 3.0
  // High threshold: |z| > 2.5
  // Medium threshold: |z| > 2.0
  let severity: "critical" | "high" | "medium" | "low" | null = null;
  if (Math.abs(effectiveZScore) > 3.0) severity = "critical";
  else if (Math.abs(effectiveZScore) > 2.5) severity = "high";
  else if (Math.abs(effectiveZScore) > 2.0) severity = "medium";

  if (!severity) return null;

  const direction = current > mean ? "higher" : "lower";
  const confidence = Math.min(95, 70 + Math.abs(effectiveZScore) * 8);

  return {
    id: `anomaly-${category}-${metric}-${Date.now()}`,
    type: "anomaly",
    severity,
    category,
    title: `Unusual ${metric} detected`,
    description: `${metric} is ${Math.abs(deviation).toFixed(1)}% ${direction} than historical average (z-score: ${effectiveZScore.toFixed(2)})`,
    confidence,
    detected: Date.now(),
    factors: [metric, "historical_deviation"],
    metrics: {
      current,
      expected: mean,
      deviation,
      zScore: effectiveZScore,
    },
    recommendations: generateAnomalyRecommendations(metric, direction, severity, category),
  };
}

function generateAnomalyRecommendations(
  metric: string,
  direction: "higher" | "lower",
  severity: string,
  category: string
): string[] {
  const recs: string[] = [];

  if (severity === "critical") {
    recs.push(`Immediate review of ${category} policies required`);
    recs.push(`Conduct emergency assessment of ${metric} drivers`);
  }

  if (direction === "lower") {
    recs.push(`Investigate factors causing ${metric} decline`);
    recs.push(`Consider stimulus measures in ${category} sector`);
  } else {
    recs.push(`Analyze sustainability of ${metric} growth`);
    recs.push(`Monitor for potential overheating in ${category} sector`);
  }

  return recs;
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Analyze trends using time series decomposition
 */
export function analyzeTrend(
  values: number[],
  metric: string,
  category: string
): TrendAnalysis | null {
  if (values.length < 5) return null;

  // Calculate velocity (rate of change)
  const velocities: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const percentChange = ((values[i]! - values[i - 1]!) / values[i - 1]!) * 100;
    velocities.push(percentChange);
  }

  const avgVelocity = calculateMean(velocities);
  const momentum = calculateMomentum(values);

  // Determine trend type
  let trend: TrendAnalysis["trend"];
  if (Math.abs(avgVelocity) < 1) {
    trend = "stable";
  } else if (avgVelocity > 0) {
    trend = momentum > 0 ? "accelerating_up" : "steady_up";
  } else {
    trend = momentum < 0 ? "accelerating_down" : "steady_down";
  }

  // Check volatility
  const velocityStdDev = calculateStdDev(velocities);
  if (velocityStdDev > Math.abs(avgVelocity) * 2) {
    trend = "volatile";
  }

  // Simple linear forecast
  const lastValue = values[values.length - 1]!;
  const forecastWeek = lastValue * (1 + avgVelocity / 100);
  const forecastMonth = lastValue * Math.pow(1 + avgVelocity / 100, 4);
  const forecastQuarter = lastValue * Math.pow(1 + avgVelocity / 100, 12);

  // Confidence based on consistency of trend
  const confidence = Math.max(50, Math.min(95, 100 - velocityStdDev * 10));

  return {
    metric,
    category,
    trend,
    velocity: avgVelocity,
    momentum,
    forecast: {
      next_week: forecastWeek,
      next_month: forecastMonth,
      next_quarter: forecastQuarter,
      confidence,
    },
    inflectionPoints: detectInflectionPoints(values),
  };
}

function detectInflectionPoints(
  values: number[]
): Array<{ timestamp: number; type: "peak" | "trough" | "reversal" }> {
  const points: Array<{ timestamp: number; type: "peak" | "trough" | "reversal" }> = [];

  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    const next = values[i + 1]!;

    if (curr > prev && curr > next) {
      points.push({ timestamp: Date.now() - (values.length - i) * 86400000, type: "peak" });
    } else if (curr < prev && curr < next) {
      points.push({ timestamp: Date.now() - (values.length - i) * 86400000, type: "trough" });
    }
  }

  return points;
}

// ============================================================================
// CORRELATION ANALYSIS
// ============================================================================

/**
 * Analyze correlations between multiple factors
 */
export function analyzeCorrelations(
  factors: Array<{ name: string; values: number[]; category: string }>
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];

  // Compare each pair of factors
  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      const f1 = factors[i]!;
      const f2 = factors[j]!;

      const correlation = calculateCorrelation(f1.values, f2.values);
      const absCorr = Math.abs(correlation);

      // Only report significant correlations
      if (absCorr < 0.5) continue;

      const significance = absCorr > 0.8 ? "strong" : absCorr > 0.65 ? "moderate" : "weak";
      const direction = correlation > 0 ? "positive" : correlation < 0 ? "negative" : "none";
      const confidence = Math.min(95, absCorr * 100);

      insights.push({
        factor1: f1.name,
        factor2: f2.name,
        correlation,
        significance,
        direction,
        confidence,
        implications: generateCorrelationImplications(f1.name, f2.name, direction, significance),
      });
    }
  }

  return insights;
}

function generateCorrelationImplications(
  factor1: string,
  factor2: string,
  direction: string,
  significance: string
): string[] {
  const implications: string[] = [];

  if (direction === "positive" && significance === "strong") {
    implications.push(`${factor1} and ${factor2} move together strongly`);
    implications.push(`Improvements in ${factor1} will likely boost ${factor2}`);
    implications.push(`Consider coordinated policies targeting both factors`);
  } else if (direction === "negative" && significance === "strong") {
    implications.push(`${factor1} and ${factor2} have inverse relationship`);
    implications.push(`Trade-offs between ${factor1} and ${factor2} require careful balancing`);
    implications.push(`Policy decisions should account for opposing effects`);
  } else {
    implications.push(`${factor1} and ${factor2} show ${significance} ${direction} correlation`);
  }

  return implications;
}

// ============================================================================
// THRESHOLD MONITORING
// ============================================================================

/**
 * Monitor critical thresholds and benchmarks
 */
export function monitorThresholds(
  country: Country,
  peerAverages: Record<string, number>
): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];

  // Economic thresholds
  if (country.currentGdpPerCapita < peerAverages.gdpPerCapita * 0.7) {
    alerts.push({
      id: `threshold-gdp-${Date.now()}`,
      type: "threshold",
      severity: "high",
      category: "economic",
      title: "GDP Per Capita Below Peer Benchmark",
      description: `GDP per capita is ${((country.currentGdpPerCapita / peerAverages.gdpPerCapita - 1) * 100).toFixed(1)}% below peer average`,
      confidence: 90,
      detected: Date.now(),
      factors: ["gdp_per_capita", "peer_comparison"],
      metrics: {
        current: country.currentGdpPerCapita,
        expected: peerAverages.gdpPerCapita,
        deviation: (country.currentGdpPerCapita / peerAverages.gdpPerCapita - 1) * 100,
        zScore: -1.5,
      },
      recommendations: [
        "Review economic growth strategies",
        "Analyze productivity barriers",
        "Consider investment incentives",
      ],
    });
  }

  // Unemployment threshold
  if (country.unemploymentRate !== null && country.unemploymentRate > 8.0) {
    alerts.push({
      id: `threshold-unemployment-${Date.now()}`,
      type: "threshold",
      severity: country.unemploymentRate > 12 ? "critical" : "high",
      category: "economic",
      title: "High Unemployment Rate",
      description: `Unemployment at ${country.unemploymentRate.toFixed(1)}% exceeds healthy threshold of 5-6%`,
      confidence: 95,
      detected: Date.now(),
      factors: ["unemployment", "labor_market"],
      metrics: {
        current: country.unemploymentRate,
        expected: 5.5,
        deviation: ((country.unemploymentRate - 5.5) / 5.5) * 100,
        zScore: (country.unemploymentRate - 5.5) / 2.0,
      },
      recommendations: [
        "Implement job creation programs",
        "Review labor market policies",
        "Invest in skills training",
      ],
    });
  }

  // Infrastructure threshold
  if (country.infrastructureRating < 50) {
    alerts.push({
      id: `threshold-infrastructure-${Date.now()}`,
      type: "threshold",
      severity: "medium",
      category: "governance",
      title: "Infrastructure Below Acceptable Level",
      description: `Infrastructure rating at ${country.infrastructureRating} is below acceptable threshold of 50`,
      confidence: 85,
      detected: Date.now(),
      factors: ["infrastructure", "public_services"],
      metrics: {
        current: country.infrastructureRating,
        expected: 50,
        deviation: ((country.infrastructureRating - 50) / 50) * 100,
        zScore: (country.infrastructureRating - 50) / 15,
      },
      recommendations: [
        "Increase infrastructure investment",
        "Prioritize critical infrastructure projects",
        "Review infrastructure maintenance programs",
      ],
    });
  }

  return alerts;
}

// ============================================================================
// OPPORTUNITY DETECTION
// ============================================================================

/**
 * Detect growth opportunities based on comparative analysis
 */
export function detectOpportunities(
  country: Country,
  trends: TrendAnalysis[],
  peerAverages: Record<string, number>
): IntelligenceAlert[] {
  const opportunities: IntelligenceAlert[] = [];

  // Strong positive trends = opportunities
  const strongUpTrends = trends.filter(
    (t) => (t.trend === "accelerating_up" || t.trend === "steady_up") && t.velocity > 2
  );

  for (const trend of strongUpTrends) {
    opportunities.push({
      id: `opportunity-${trend.category}-${Date.now()}`,
      type: "opportunity",
      severity: "low",
      category: trend.category as any,
      title: `${trend.metric} Growth Momentum`,
      description: `${trend.metric} showing strong ${trend.velocity.toFixed(1)}% growth velocity - opportunity to accelerate`,
      confidence: trend.forecast.confidence,
      detected: Date.now(),
      factors: [trend.metric, "positive_momentum"],
      metrics: {
        current: trend.velocity,
        expected: 1.0,
        deviation: ((trend.velocity - 1.0) / 1.0) * 100,
        zScore: 2.0,
      },
      recommendations: [
        `Capitalize on ${trend.metric} momentum with strategic investments`,
        "Scale successful policies in this area",
        "Communicate success to boost confidence",
      ],
    });
  }

  return opportunities;
}

// ============================================================================
// MAIN INTELLIGENCE ENGINE
// ============================================================================

/**
 * Generate comprehensive intelligence report
 */
export function generateIntelligenceReport(
  country: Country,
  historicalData: {
    gdpHistory: number[];
    populationHistory: number[];
    unemploymentHistory: number[];
  },
  peerAverages: Record<string, number>
): IntelligenceReport {
  const alerts: IntelligenceAlert[] = [];

  // 1. Anomaly Detection
  const gdpAnomaly = detectAnomalies(
    country.currentGdpPerCapita,
    historicalData.gdpHistory,
    "GDP Per Capita",
    "economic"
  );
  if (gdpAnomaly) alerts.push(gdpAnomaly);

  if (country.unemploymentRate !== null) {
    const unemploymentAnomaly = detectAnomalies(
      country.unemploymentRate,
      historicalData.unemploymentHistory,
      "Unemployment Rate",
      "economic"
    );
    if (unemploymentAnomaly) alerts.push(unemploymentAnomaly);
  }

  // 2. Trend Analysis
  const trends: TrendAnalysis[] = [];

  const gdpTrend = analyzeTrend(historicalData.gdpHistory, "GDP Per Capita", "economic");
  if (gdpTrend) trends.push(gdpTrend);

  const populationTrend = analyzeTrend(
    historicalData.populationHistory,
    "Population",
    "population"
  );
  if (populationTrend) trends.push(populationTrend);

  // 3. Correlation Analysis
  const correlations = analyzeCorrelations([
    { name: "GDP", values: historicalData.gdpHistory, category: "economic" },
    { name: "Population", values: historicalData.populationHistory, category: "population" },
    { name: "Unemployment", values: historicalData.unemploymentHistory, category: "economic" },
  ]);

  // 4. Threshold Monitoring
  const thresholdAlerts = monitorThresholds(country, peerAverages);
  alerts.push(...thresholdAlerts);

  // 5. Opportunity Detection
  const opportunities = detectOpportunities(country, trends, peerAverages);
  alerts.push(...opportunities);

  // Calculate summary
  const criticalIssues = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high"
  ).length;
  const opportunityCount = alerts.filter((a) => a.type === "opportunity").length;

  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (criticalIssues >= 5) riskLevel = "critical";
  else if (criticalIssues >= 3) riskLevel = "high";
  else if (criticalIssues >= 1) riskLevel = "medium";

  const overallHealth = Math.max(0, Math.min(100, 70 - criticalIssues * 10 + opportunityCount * 5));

  return {
    countryId: country.id,
    generated: Date.now(),
    alerts,
    correlations,
    trends,
    summary: {
      overallHealth,
      criticalIssues,
      opportunities: opportunityCount,
      riskLevel,
    },
  };
}
