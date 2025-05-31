// src/lib/chart-utils.ts
// Utility functions for chart data processing and formatting

import { IxTime } from "./ixtime";

// Chart color palettes
export const CHART_COLORS = {
  primary: [
    "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", 
    "#ec4899", "#14b8a6", "#f59e0b", "#ef4444"
  ],
  economic: {
    Advanced: "#22c55e",    // Green
    Developed: "#3b82f6",   // Blue  
    Emerging: "#f59e0b",    // Orange
    Developing: "#ef4444",  // Red
  },
  population: {
    Massive: "#7c3aed",     // Purple
    Large: "#2563eb",       // Blue
    Medium: "#059669",      // Green
    Small: "#d97706",       // Orange
    Micro: "#dc2626",       // Red
  }
};

// Data formatting utilities
export class ChartDataFormatter {
  static formatPopulation(value: number): string {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  }

  static formatCurrency(value: number): string {
    if (value >= 1000000000000) return `$${(value / 1000000000000).toFixed(1)}T`;
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  }

  static formatPercentage(value: number, decimals: number = 2): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  static formatDensity(value: number, unit: string = "km²"): string {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K/${unit}`;
    return `${value.toFixed(1)}/${unit}`;
  }

  static formatGrowthRate(value: number): string {
    const percentage = value * 100;
    const sign = percentage >= 0 ? "+" : "";
    return `${sign}${percentage.toFixed(2)}%`;
  }

  static formatArea(value: number): string {
    return `${value.toLocaleString()} km²`;
  }

  static formatGameYear(ixTime: number): string {
    return `Year ${IxTime.getCurrentGameYear(ixTime)}`;
  }

  static formatIxTimeShort(ixTime: number): string {
    const date = new Date(ixTime);
    return date.toLocaleDateString();
  }
}

// Chart data processing utilities
export class ChartDataProcessor {
  // Smooth data for better visualization
  static smoothData(data: Array<{ixTimeTimestamp: number, [key: string]: any}>, windowSize: number = 3): typeof data {
    if (data.length <= windowSize) return data;
    
    const smoothed = [...data];
    const numericKeys = this.getNumericKeys(data[0] || {});
    
    for (let i = Math.floor(windowSize / 2); i < data.length - Math.floor(windowSize / 2); i++) {
      const window = data.slice(i - Math.floor(windowSize / 2), i + Math.floor(windowSize / 2) + 1);
      
      numericKeys.forEach(key => {
        const values = window.map(point => point[key]).filter(val => typeof val === 'number');
        if (values.length > 0) {
          smoothed[i] = {
            ...smoothed[i]!,
            [key]: values.reduce((sum, val) => sum + val, 0) / values.length
          };
        }
      });
    }
    
    return smoothed;
  }

  // Resample data to specific intervals
  static resampleData(
    data: Array<{ixTimeTimestamp: number, [key: string]: any}>, 
    targetPoints: number
  ): typeof data {
    if (data.length <= targetPoints) return data;
    
    const sortedData = [...data].sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
    const step = Math.floor(sortedData.length / targetPoints);
    
    return sortedData.filter((_, index) => index % step === 0);
  }

  // Calculate moving averages
  static addMovingAverage(
    data: Array<{[key: string]: any}>, 
    field: string, 
    window: number = 5,
    outputField?: string
  ): typeof data {
    const result = [...data];
    const output = outputField || `${field}MA`;
    
    for (let i = 0; i < result.length; i++) {
      const start = Math.max(0, i - window + 1);
      const values = result.slice(start, i + 1)
        .map(point => point[field])
        .filter(val => typeof val === 'number');
      
      if (values.length > 0) {
        result[i] = {
          ...result[i],
          [output]: values.reduce((sum, val) => sum + val, 0) / values.length
        };
      }
    }
    
    return result;
  }

  // Calculate growth rates
  static addGrowthRates(
    data: Array<{ixTimeTimestamp: number, [key: string]: any}>, 
    field: string,
    outputField?: string
  ): typeof data {
    const result = [...data];
    const output = outputField || `${field}Growth`;
    
    for (let i = 1; i < result.length; i++) {
      const current = result[i]![field];
      const previous = result[i-1]![field];
      
      if (typeof current === 'number' && typeof previous === 'number' && previous !== 0) {
        const timeSpan = IxTime.getYearsElapsed(result[i-1]!.ixTimeTimestamp, result[i]!.ixTimeTimestamp);
        const growthRate = timeSpan > 0 ? Math.pow(current / previous, 1 / timeSpan) - 1 : 0;
        
        result[i] = {
          ...result[i]!,
          [output]: growthRate
        };
      }
    }
    
    return result;
  }

  // Normalize data for comparison
  static normalizeData(
    data: Array<{[key: string]: any}>, 
    fields: string[],
    method: 'minmax' | 'zscore' = 'minmax'
  ): typeof data {
    const result = [...data];
    
    fields.forEach(field => {
      const values = data.map(point => point[field]).filter(val => typeof val === 'number');
      
      if (values.length === 0) return;
      
      if (method === 'minmax') {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        
        if (range > 0) {
          result.forEach((point, index) => {
            if (typeof point[field] === 'number') {
              result[index] = {
                ...result[index],
                [`${field}Normalized`]: (point[field] - min) / range
              };
            }
          });
        }
      } else if (method === 'zscore') {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 0) {
          result.forEach((point, index) => {
            if (typeof point[field] === 'number') {
              result[index] = {
                ...result[index],
                [`${field}Normalized`]: (point[field] - mean) / stdDev
              };
            }
          });
        }
      }
    });
    
    return result;
  }

  // Get numeric keys from data object
  private static getNumericKeys(obj: Record<string, any>): string[] {
    return Object.keys(obj).filter(key => 
      key !== 'ixTimeTimestamp' && 
      key !== 'formattedDate' && 
      key !== 'gameYear' &&
      typeof obj[key] === 'number'
    );
  }

  // Calculate correlation between two data series
  static calculateCorrelation(
    data: Array<{[key: string]: any}>, 
    field1: string, 
    field2: string
  ): number {
    const pairs = data
      .map(point => [point[field1], point[field2]])
      .filter(([x, y]) => typeof x === 'number' && typeof y === 'number') as [number, number][];
    
    if (pairs.length < 2) return 0;
    
    const n = pairs.length;
    const sumX = pairs.reduce((sum, [x]) => sum + x, 0);
    const sumY = pairs.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = pairs.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumX2 = pairs.reduce((sum, [x]) => sum + x * x, 0);
    const sumY2 = pairs.reduce((sum, [, y]) => sum + y * y, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Generate trend line data
  static generateTrendLine(
    data: Array<{ixTimeTimestamp: number, [key: string]: any}>, 
    field: string
  ): Array<{ixTimeTimestamp: number, trend: number}> {
    const points = data
      .map((point, index) => [index, point[field]])
      .filter(([, y]) => typeof y === 'number') as [number, number][];
    
    if (points.length < 2) return [];
    
    // Simple linear regression
    const n = points.length;
    const sumX = points.reduce((sum, [x]) => sum + x, 0);
    const sumY = points.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumX2 = points.reduce((sum, [x]) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return data.map((point, index) => ({
      ixTimeTimestamp: point.ixTimeTimestamp,
      trend: slope * index + intercept
    }));
  }
}

// Chart theme utilities
export class ChartThemeUtils {
  static getThemeColors(theme: 'light' | 'dark') {
    return {
      grid: theme === 'dark' ? '#374151' : '#e5e7eb',
      text: theme === 'dark' ? '#9ca3af' : '#6b7280',
      axis: theme === 'dark' ? '#6b7280' : '#9ca3af',
      background: theme === 'dark' ? '#1f2937' : '#ffffff',
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        color: theme === 'dark' ? '#f9fafb' : '#111827',
      },
    };
  }

  static getResponsiveMargin(width: number) {
    if (width < 400) return { top: 5, right: 5, left: 10, bottom: 5 };
    if (width < 800) return { top: 10, right: 15, left: 20, bottom: 10 };
    return { top: 20, right: 30, left: 20, bottom: 20 };
  }

  static getFontSize(width: number) {
    if (width < 400) return 10;
    if (width < 800) return 12;
    return 14;
  }
}

// Export utility functions
export const formatPopulation = ChartDataFormatter.formatPopulation;
export const formatCurrency = ChartDataFormatter.formatCurrency;
export const formatPercentage = ChartDataFormatter.formatPercentage;
export const formatGrowthRate = ChartDataFormatter.formatGrowthRate;