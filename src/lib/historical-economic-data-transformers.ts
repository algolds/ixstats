// src/lib/historical-economic-data-transformers.ts
/**
 * Historical Economic Data Transformers
 *
 * Pure functions for transforming and analyzing historical economic time-series data.
 * Handles GDP trends, growth calculations, volatility metrics, and forecast projections.
 *
 * @module historical-economic-data-transformers
 */

import { IxTime } from "~/lib/ixtime";

/**
 * Economic event that impacts historical data
 */
export interface EconomicEvent {
  id: string;
  timestamp: number;
  type: "dm_input" | "policy_change" | "economic_shift" | "external_event";
  category: string;
  title: string;
  description: string;
  impact: {
    gdp?: number;
    population?: number;
    employment?: number;
    sector?: string;
  };
  duration?: number;
  severity: "minor" | "moderate" | "major" | "critical";
  source: "dm" | "system" | "player";
  isActive: boolean;
}

/**
 * Single historical data point
 */
export interface HistoricalDataPoint {
  timestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  unemploymentRate: number;
  inflationRate: number;
  events: EconomicEvent[];
}

/**
 * Transformed chart data point
 */
export interface ChartDataPoint {
  timestamp: number;
  date: string;
  gameYear: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  unemploymentRate: number;
  inflationRate: number;
  eventsCount: number;
  hasEvent: boolean;
  uniqueKey: string;
}

/**
 * Event marker for chart visualization
 */
export interface EventMarker {
  timestamp: number;
  value: number;
  event: EconomicEvent;
}

/**
 * Economic trend analysis result
 */
export interface EconomicTrend {
  trend: "improving" | "declining" | "stable";
  value: number;
}

/**
 * Volatility metrics
 */
export interface VolatilityMetrics {
  standardDeviation: number;
  coefficientOfVariation: number;
  volatilityLevel: "low" | "moderate" | "high";
}

/**
 * Period comparison data
 */
export interface PeriodComparison {
  period1Avg: number;
  period2Avg: number;
  change: number;
  changePercent: number;
}

/**
 * Forecast data point
 */
export interface ForecastDataPoint {
  timestamp: number;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

/**
 * Cyclical pattern detection result
 */
export interface CyclicalPattern {
  cycleLength: number;
  peaks: number[];
  troughs: number[];
  amplitude: number;
}

/**
 * Time series aggregation period
 */
export type AggregationPeriod = "daily" | "monthly" | "quarterly" | "yearly";

/**
 * Export format type
 */
export type ExportFormat = "csv" | "json";

/**
 * Transforms raw historical data into chart-ready format with metadata
 *
 * @param rawData - Array of historical data points
 * @returns Array of transformed chart data points with unique keys
 *
 * @example
 * const chartData = transformHistoricalGdpData(historicalPoints);
 */
export function transformHistoricalGdpData(rawData: HistoricalDataPoint[]): ChartDataPoint[] {
  return rawData.map((point, index) => ({
    timestamp: point.timestamp,
    date: IxTime.formatIxTime(point.timestamp),
    gameYear: IxTime.getCurrentGameYear(point.timestamp),
    population: point.population,
    gdpPerCapita: point.gdpPerCapita,
    totalGdp: point.totalGdp,
    unemploymentRate: point.unemploymentRate,
    inflationRate: point.inflationRate,
    eventsCount: point.events.length,
    hasEvent: point.events.length > 0,
    uniqueKey: `${IxTime.getCurrentGameYear(point.timestamp)}-${point.timestamp}-${index}`,
  }));
}

/**
 * Calculates year-over-year growth rates for a time series
 *
 * @param timeSeries - Array of chart data points
 * @param metric - Which metric to calculate growth for
 * @returns Array of growth rates (same length, first value is 0)
 *
 * @example
 * const growthRates = calculateGrowthRates(chartData, 'gdpPerCapita');
 */
export function calculateGrowthRates(
  timeSeries: ChartDataPoint[],
  metric: keyof Pick<ChartDataPoint, "gdpPerCapita" | "population" | "totalGdp"> = "gdpPerCapita"
): number[] {
  if (timeSeries.length < 2) return [0];

  const growthRates: number[] = [0]; // First period has no previous value

  for (let i = 1; i < timeSeries.length; i++) {
    const current = timeSeries[i]![metric] as number;
    const previous = timeSeries[i - 1]![metric] as number;

    if (previous === 0) {
      growthRates.push(0);
    } else {
      const growth = ((current - previous) / previous) * 100;
      growthRates.push(growth);
    }
  }

  return growthRates;
}

/**
 * Applies moving average smoothing to time series data
 *
 * @param data - Array of numerical values
 * @param windowSize - Size of moving average window (default: 3)
 * @returns Smoothed data array
 *
 * @example
 * const smoothed = smoothTimeSeriesData(values, 5);
 */
export function smoothTimeSeriesData(data: number[], windowSize: number = 3): number[] {
  if (data.length < windowSize) return [...data];

  const smoothed: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const window = data.slice(start, end);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    smoothed.push(avg);
  }

  return smoothed;
}

/**
 * Detects economic trends in time series data
 *
 * @param timeSeries - Array of chart data points
 * @param recentPeriods - Number of recent periods to analyze (default: 3)
 * @param olderPeriods - Number of older periods to compare against (default: 3)
 * @returns Economic trend analysis with direction and magnitude
 *
 * @example
 * const trend = detectEconomicTrends(chartData, 3, 3);
 */
export function detectEconomicTrends(
  timeSeries: ChartDataPoint[],
  recentPeriods: number = 3,
  olderPeriods: number = 3
): EconomicTrend {
  if (timeSeries.length < recentPeriods + olderPeriods) {
    return { trend: "stable", value: 0 };
  }

  const recent = timeSeries.slice(-recentPeriods);
  const older = timeSeries.slice(-(recentPeriods + olderPeriods), -recentPeriods);

  if (recent.length === 0 || older.length === 0) {
    return { trend: "stable", value: 0 };
  }

  const recentAvg = recent.reduce((sum, point) => sum + point.gdpPerCapita, 0) / recent.length;
  const olderAvg = older.reduce((sum, point) => sum + point.gdpPerCapita, 0) / older.length;

  if (olderAvg === 0) return { trend: "stable", value: 0 };

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (Math.abs(change) < 1) {
    return { trend: "stable", value: change };
  }

  return { trend: change > 0 ? "improving" : "declining", value: change };
}

/**
 * Calculates volatility metrics for a time series
 *
 * @param timeSeries - Array of chart data points
 * @param metric - Which metric to analyze for volatility
 * @returns Volatility metrics including standard deviation and classification
 *
 * @example
 * const volatility = calculateVolatility(chartData, 'gdpPerCapita');
 */
export function calculateVolatility(
  timeSeries: ChartDataPoint[],
  metric: keyof Pick<ChartDataPoint, "gdpPerCapita" | "unemploymentRate"> = "gdpPerCapita"
): VolatilityMetrics {
  if (timeSeries.length < 2) {
    return {
      standardDeviation: 0,
      coefficientOfVariation: 0,
      volatilityLevel: "low",
    };
  }

  const values = timeSeries.map((point) => point[metric] as number);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  const coefficientOfVariation = mean !== 0 ? (standardDeviation / mean) * 100 : 0;

  let volatilityLevel: "low" | "moderate" | "high" = "low";
  if (coefficientOfVariation > 15) {
    volatilityLevel = "high";
  } else if (coefficientOfVariation > 5) {
    volatilityLevel = "moderate";
  }

  return {
    standardDeviation,
    coefficientOfVariation,
    volatilityLevel,
  };
}

/**
 * Compares two time periods for economic analysis
 *
 * @param period1 - First period data points
 * @param period2 - Second period data points
 * @param metric - Which metric to compare
 * @returns Period comparison with averages and changes
 *
 * @example
 * const comparison = comparePeriodsData(recentData, olderData, 'gdpPerCapita');
 */
export function comparePeriodsData(
  period1: ChartDataPoint[],
  period2: ChartDataPoint[],
  metric: keyof Pick<
    ChartDataPoint,
    "gdpPerCapita" | "population" | "unemploymentRate"
  > = "gdpPerCapita"
): PeriodComparison {
  if (period1.length === 0 || period2.length === 0) {
    return {
      period1Avg: 0,
      period2Avg: 0,
      change: 0,
      changePercent: 0,
    };
  }

  const period1Avg =
    period1.reduce((sum, point) => sum + (point[metric] as number), 0) / period1.length;
  const period2Avg =
    period2.reduce((sum, point) => sum + (point[metric] as number), 0) / period2.length;

  const change = period1Avg - period2Avg;
  const changePercent = period2Avg !== 0 ? (change / period2Avg) * 100 : 0;

  return {
    period1Avg,
    period2Avg,
    change,
    changePercent,
  };
}

/**
 * Generates simple forecast projection based on historical trend
 *
 * @param historical - Historical data points
 * @param periods - Number of periods to forecast
 * @param metric - Which metric to forecast
 * @returns Array of forecast data points with confidence intervals
 *
 * @example
 * const forecast = generateForecastData(chartData, 12, 'gdpPerCapita');
 */
export function generateForecastData(
  historical: ChartDataPoint[],
  periods: number,
  metric: keyof Pick<ChartDataPoint, "gdpPerCapita" | "population"> = "gdpPerCapita"
): ForecastDataPoint[] {
  if (historical.length < 2 || periods <= 0) return [];

  // Calculate linear trend
  const values = historical.map((point) => point[metric] as number);
  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);

  const sumX = xValues.reduce((sum, x) => sum + x, 0);
  const sumY = values.reduce((sum, y) => sum + y, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i]!, 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate standard error for confidence interval
  const residuals = values.map((y, i) => y - (slope * i + intercept));
  const squaredResiduals = residuals.map((r) => r * r);
  const standardError = Math.sqrt(squaredResiduals.reduce((sum, r) => sum + r, 0) / (n - 2));

  const lastTimestamp = historical[historical.length - 1]!.timestamp;
  const timestampIncrement =
    historical.length > 1
      ? historical[historical.length - 1]!.timestamp - historical[historical.length - 2]!.timestamp
      : 86400000; // Default to 1 day

  const forecast: ForecastDataPoint[] = [];

  for (let i = 1; i <= periods; i++) {
    const x = n + i - 1;
    const predictedValue = slope * x + intercept;
    const confidenceMargin =
      1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(x - sumX / n, 2) / sumX2);

    forecast.push({
      timestamp: lastTimestamp + timestampIncrement * i,
      predictedValue: Math.max(0, predictedValue),
      confidenceInterval: {
        lower: Math.max(0, predictedValue - confidenceMargin),
        upper: predictedValue + confidenceMargin,
      },
    });
  }

  return forecast;
}

/**
 * Aggregates data by specified time period
 *
 * @param data - Array of chart data points
 * @param period - Aggregation period
 * @returns Aggregated data points
 *
 * @example
 * const monthlyData = aggregateDataByPeriod(dailyData, 'monthly');
 */
export function aggregateDataByPeriod(
  data: ChartDataPoint[],
  period: AggregationPeriod
): ChartDataPoint[] {
  if (data.length === 0) return [];
  if (period === "daily") return data;

  const groupedData = new Map<string, ChartDataPoint[]>();

  data.forEach((point) => {
    let key: string;

    switch (period) {
      case "monthly":
        key = `${point.gameYear}-${Math.floor((IxTime.getMonthFromTimestamp(point.timestamp) - 1) / 1)}`;
        break;
      case "quarterly":
        key = `${point.gameYear}-Q${Math.floor((IxTime.getMonthFromTimestamp(point.timestamp) - 1) / 3) + 1}`;
        break;
      case "yearly":
        key = `${point.gameYear}`;
        break;
      default:
        key = `${point.timestamp}`;
    }

    if (!groupedData.has(key)) {
      groupedData.set(key, []);
    }
    groupedData.get(key)!.push(point);
  });

  const aggregated: ChartDataPoint[] = [];

  groupedData.forEach((points, key) => {
    const avgPoint: ChartDataPoint = {
      timestamp: points[0]!.timestamp,
      date: points[0]!.date,
      gameYear: points[0]!.gameYear,
      population: points.reduce((sum, p) => sum + p.population, 0) / points.length,
      gdpPerCapita: points.reduce((sum, p) => sum + p.gdpPerCapita, 0) / points.length,
      totalGdp: points.reduce((sum, p) => sum + p.totalGdp, 0) / points.length,
      unemploymentRate: points.reduce((sum, p) => sum + p.unemploymentRate, 0) / points.length,
      inflationRate: points.reduce((sum, p) => sum + p.inflationRate, 0) / points.length,
      eventsCount: points.reduce((sum, p) => sum + p.eventsCount, 0),
      hasEvent: points.some((p) => p.hasEvent),
      uniqueKey: key,
    };
    aggregated.push(avgPoint);
  });

  return aggregated.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Detects cyclical patterns in economic data
 *
 * @param data - Array of chart data points
 * @param metric - Which metric to analyze for cycles
 * @returns Cyclical pattern information
 *
 * @example
 * const pattern = calculateCyclicalPatterns(chartData, 'gdpPerCapita');
 */
export function calculateCyclicalPatterns(
  data: ChartDataPoint[],
  metric: keyof Pick<ChartDataPoint, "gdpPerCapita" | "unemploymentRate"> = "gdpPerCapita"
): CyclicalPattern {
  if (data.length < 4) {
    return {
      cycleLength: 0,
      peaks: [],
      troughs: [],
      amplitude: 0,
    };
  }

  const values = data.map((point) => point[metric] as number);
  const peaks: number[] = [];
  const troughs: number[] = [];

  // Detect peaks and troughs
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1]!;
    const current = values[i]!;
    const next = values[i + 1]!;

    if (current > prev && current > next) {
      peaks.push(i);
    } else if (current < prev && current < next) {
      troughs.push(i);
    }
  }

  // Calculate average cycle length
  let cycleLength = 0;
  if (peaks.length > 1) {
    const peakIntervals = peaks.slice(1).map((peak, i) => peak - peaks[i]!);
    cycleLength = peakIntervals.reduce((sum, interval) => sum + interval, 0) / peakIntervals.length;
  } else if (troughs.length > 1) {
    const troughIntervals = troughs.slice(1).map((trough, i) => trough - troughs[i]!);
    cycleLength =
      troughIntervals.reduce((sum, interval) => sum + interval, 0) / troughIntervals.length;
  }

  // Calculate amplitude
  const peakValues = peaks.map((i) => values[i]!);
  const troughValues = troughs.map((i) => values[i]!);
  const maxPeak = peakValues.length > 0 ? Math.max(...peakValues) : 0;
  const minTrough = troughValues.length > 0 ? Math.min(...troughValues) : 0;
  const amplitude = maxPeak - minTrough;

  return {
    cycleLength: Math.round(cycleLength),
    peaks,
    troughs,
    amplitude,
  };
}

/**
 * Exports time series data to specified format
 *
 * @param data - Array of chart data points
 * @param format - Export format ('csv' or 'json')
 * @param metric - Which metric to export
 * @returns Formatted string for download
 *
 * @example
 * const csvData = exportToTimeSeries(chartData, 'csv', 'gdpPerCapita');
 */
export function exportToTimeSeries(
  data: ChartDataPoint[],
  format: ExportFormat,
  metric?: keyof Pick<
    ChartDataPoint,
    "gdpPerCapita" | "population" | "unemploymentRate" | "totalGdp"
  >
): string {
  if (format === "json") {
    if (metric) {
      const filtered = data.map((point) => ({
        timestamp: point.timestamp,
        date: point.date,
        gameYear: point.gameYear,
        value: point[metric],
      }));
      return JSON.stringify(filtered, null, 2);
    }
    return JSON.stringify(data, null, 2);
  }

  // CSV format
  if (metric) {
    const headers = ["Timestamp", "Date", "Game Year", metric];
    const rows = data.map((point) =>
      [point.timestamp, point.date, point.gameYear, point[metric]].join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }

  const headers = [
    "Timestamp",
    "Date",
    "Game Year",
    "Population",
    "GDP per Capita",
    "Total GDP",
    "Unemployment Rate",
    "Inflation Rate",
    "Events Count",
  ];
  const rows = data.map((point) =>
    [
      point.timestamp,
      point.date,
      point.gameYear,
      point.population,
      point.gdpPerCapita,
      point.totalGdp,
      point.unemploymentRate,
      point.inflationRate,
      point.eventsCount,
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
