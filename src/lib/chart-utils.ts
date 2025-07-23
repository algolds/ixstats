// src/lib/chart-utils.ts
// FIXED: Consistent percentage and number formatting

/**
 * Safely format a number as population with appropriate scale
 */
export function formatPopulation(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value < 0) {
    return "0";
  }

  if (value > 1e15) {
    return "> 1,000T";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e12) {
    return `${(value / 1e12).toFixed(1)}T`;
  } else if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  } else {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
}

/**
 * Safely format a number as currency with appropriate scale
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value < 0) {
    return "$0";
  }

  if (value > 1e15) {
    return "> $1,000T";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`;
  } else if (absValue >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  } else if (absValue >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  } else if (absValue >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  } else {
    return `$${value.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  }
}

/**
 * FIXED: Format growth rates from decimal to percentage
 * @param value The decimal growth rate (e.g., 0.005 for 0.5%)
 * @param decimals Number of decimal places to show
 */
export function formatGrowthRateFromDecimal(
  value: number | null | undefined, 
  decimals = 2
): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // Convert decimal to percentage (0.005 → 0.5%)
  const percentValue = value * 100;
  
  // Cap extreme percentage values
  const cappedValue = Math.min(Math.max(percentValue, -999), 9999);
  
  return `${cappedValue.toFixed(decimals)}%`;
}

/**
 * FIXED: Format GDP growth rates specifically
 * Assumes input is in decimal form (0.005 for 0.5%)
 */
export function formatGdpGrowthRate(value: number | null | undefined): string {
  return formatGrowthRateFromDecimal(value, 2);
}

/**
 * FIXED: Format population growth rates specifically  
 * Assumes input is in decimal form (0.01 for 1%)
 */
export function formatPopulationGrowthRate(value: number | null | undefined): string {
  return formatGrowthRateFromDecimal(value, 2);
}

/**
 * Legacy percentage formatter - assumes value is already in percentage form
 * @param value The number to format (already as percentage, e.g., 0.5 for 0.5%)
 * @param decimals Number of decimal places to show
 */
export function formatPercentage(
  value: number | null | undefined, 
  decimals = 2
): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // Value is already in percentage form
  const cappedValue = Math.min(Math.max(value, -999), 9999);
  
  return `${cappedValue.toFixed(decimals)}%`;
}

/**
 * Parse numeric value from potentially formatted Excel data
 */
export function parseExcelNumber(value: any): number | null {
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }
  
  if (typeof value === 'string') {
    // Remove common Excel formatting: $, %, commas, spaces
    const cleaned = value.replace(/[$,%\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isFinite(parsed) ? parsed : null;
  }
  
  return null;
}

/**
 * Parse percentage value from Excel (handles both decimal and percentage formats)
 */
export function parseExcelPercentage(value: any): number | null {
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }
  
  if (typeof value === 'string') {
    const hasPercent = value.includes('%');
    const cleaned = value.replace(/[%$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (!isFinite(parsed)) return null;
    
    if (hasPercent) {
      // Convert percentage to decimal (50% → 0.5)
      return parsed / 100;
    } else {
      // Assume it's already decimal or determine by magnitude
      return parsed > 1 ? parsed / 100 : parsed;
    }
  }
  
  return null;
}

/**
 * Format a density value (population or economic per km²)
 */
export function formatDensity(value: number | null | undefined, unit = "/km²"): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value < 0) {
    return `0${unit}`;
  }

  if (value > 1e12) {
    return `> 1T${unit}`;
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B${unit}`;
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M${unit}`;
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K${unit}`;
  } else if (absValue >= 1) {
    return `${value.toFixed(1)}${unit}`;
  } else if (absValue >= 0.01) {
    return `${value.toFixed(2)}${unit}`;
  } else {
    return `< 0.01${unit}`;
  }
}

/**
 * Format a raw number without currency or scale indicators
 */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value > 1e15) {
    return "> 1,000,000,000,000,000";
  }

  return value.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * FIXED: Format growth rate with color coding info
 * Assumes input is in decimal form (0.005 for 0.5%)
 */
export function formatGrowthRate(value: number | null | undefined): {
  formatted: string;
  color: string;
  icon: "up" | "down" | "neutral";
} {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return {
      formatted: "N/A",
      color: "text-muted-foreground",
      icon: "neutral"
    };
  }

  // Convert decimal to percentage for display
  const percentValue = value * 100;
  const formatted = `${percentValue.toFixed(2)}%`;

  if (percentValue > 0.1) {
    return {
      formatted,
      color: "text-green-600",
      icon: "up"
    };
  } else if (percentValue < -0.1) {
    return {
      formatted,
      color: "text-red-600",
      icon: "down"
    };
  } else {
    return {
      formatted,
      color: "text-gray-500",
      icon: "neutral"
    };
  }
}

/**
 * Format time duration in a human-readable way
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return "N/A";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)}m`;
  } else if (seconds < 86400) {
    return `${(seconds / 3600).toFixed(1)}h`;
  } else {
    return `${(seconds / 86400).toFixed(1)}d`;
  }
}

/**
 * Format a large number with automatic scale detection
 */
export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value < 0) {
    return "0";
  }

  if (value > 1e15) {
    return "> 1,000T";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e12) {
    return `${(value / 1e12).toFixed(2)}T`;
  } else if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  } else {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

/**
 * Validate if a number is reasonable for display
 */
export function isValidDisplayNumber(value: any): value is number {
  return typeof value === 'number' && 
         isFinite(value) && 
         !isNaN(value) && 
         value >= 0 && 
         value < 1e15;
}

/**
 * Safe number conversion with fallback
 */
export function safeNumber(value: any, fallback = 0): number {
  if (typeof value === 'number' && isValidDisplayNumber(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseExcelNumber(value);
    if (parsed !== null && isValidDisplayNumber(parsed)) {
      return parsed;
    }
  }
  
  return fallback;
}

/**
 * Chart-friendly number formatter that ensures clean axis labels
 */
export function formatChartNumber(value: number): string {
  if (!isValidDisplayNumber(value)) {
    return "0";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(0)}B`;
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(0)}M`;
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(0)}K`;
  } else {
    return value.toFixed(0);
  }
}

/**
 * FIXED: Format growth rate as percentage for display
 * This is the main function components should use for growth rate display
 * Assumes input is already in percentage form (6.59 for 6.59%)
 */
export function displayGrowthRate(percentageValue: number | null | undefined): string {
  if (percentageValue == null || !isFinite(percentageValue) || isNaN(percentageValue)) {
    return "N/A";
  }
  
  // Value is already in percentage form, just format it
  // Cap extreme values for display
  const cappedPercentage = Math.min(Math.max(percentageValue, -999), 999);
  
  return `${cappedPercentage.toFixed(2)}%`;
}

/**
 * FIXED: Get growth icon based on decimal value
 */
export function getGrowthIcon(decimalValue: number | null | undefined): "up" | "down" | "neutral" {
  if (decimalValue == null || !isFinite(decimalValue) || isNaN(decimalValue)) {
    return "neutral";
  }
  
  // Convert to percentage for threshold comparison
  const percentage = decimalValue * 100;
  
  if (percentage > 0.1) return "up";
  if (percentage < -0.1) return "down";
  return "neutral";
}

/**
 * FIXED: Get growth color based on decimal value  
 */
export function getGrowthColor(decimalValue: number | null | undefined): string {
  if (decimalValue == null || !isFinite(decimalValue) || isNaN(decimalValue)) {
    return "text-muted-foreground";
  }
  
  // Convert to percentage for threshold comparison  
  const percentage = decimalValue * 100;
  
  if (percentage > 0.1) return "text-green-600";
  if (percentage < -0.1) return "text-red-600";
  return "text-gray-500";
}

function smartNormalizeGrowthRate(value: number | null | undefined, fallback = 3.0): number {
  if (!value || !isFinite(value)) return fallback;
  
  // If the value is extremely large (> 100%), it's likely incorrectly stored
  // and needs to be divided by 100
  if (Math.abs(value) > 100) {
    return value / 100;
  }
  
  // Otherwise, the value is reasonable as-is
  return value;
}