// src/lib/chart-utils.ts
// Enhanced chart utilities with robust number formatting and safety checks
// FIXED: GDP percentage formatting issues

/**
 * Safely format a number as population with appropriate scale
 */
export function formatPopulation(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // Handle extreme values that might cause scientific notation
  if (value < 0) {
    return "0";
  }

  // Cap extremely large values to prevent overflow display issues
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
 * FIXED: Handle potential currency symbols from Excel parsing
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // Handle extreme values that might cause scientific notation
  if (value < 0) {
    return "$0";
  }

  // Cap extremely large values to prevent overflow display issues
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
 * Safely format a percentage value
 * FIXED: Properly handle percentage conversion and already-percentage values
 * @param value The number to format
 * @param decimals Number of decimal places to show
 * @param isAlreadyPercentage If true, assumes value is already in percentage form (not decimal)
 */
export function formatPercentage(
  value: number | null | undefined, 
  decimals: number = 2,
  isAlreadyPercentage: boolean = false
): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // FIXED: Apply percentage conversion only if needed
  const percentValue = isAlreadyPercentage ? value : value * 100;
  
  // Cap extreme percentage values
  const cappedValue = Math.min(Math.max(percentValue, -999), 9999);
  
  return `${cappedValue.toFixed(decimals)}%`;
}

/**
 * FIXED: New function specifically for GDP growth rates
 * Handles GDP growth rates that come from Excel as percentages
 */
export function formatGdpGrowthRate(value: number | null | undefined): string {
  return formatPercentage(value, 2, true); // Already in percentage form
}

/**
 * FIXED: New function specifically for population growth rates
 * Handles population growth rates that come from Excel as percentages
 */
export function formatPopulationGrowthRate(value: number | null | undefined): string {
  return formatPercentage(value, 2, true); // Already in percentage form
}

/**
 * FIXED: Parse numeric value from potentially formatted Excel data
 * Removes currency symbols, percentage signs, commas, etc.
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
 * FIXED: Parse percentage value from Excel (could be decimal or percentage)
 * Excel sometimes exports percentages as decimals (0.05) or as percentages (5%)
 */
export function parseExcelPercentage(value: any): number | null {
  const cleaned = parseExcelNumber(value);
  if (cleaned === null) return null;
  
  // If the value is very small (< 1), it's likely a decimal representation
  // If it's larger, it's likely already a percentage
  // This is a heuristic based on typical growth rates
  if (Math.abs(cleaned) < 1) {
    return cleaned * 100; // Convert decimal to percentage
  } else {
    return cleaned; // Already a percentage
  }
}

/**
 * Format a density value (population or economic per km²)
 */
export function formatDensity(value: number | null | undefined, unit: string = "/km²"): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  if (value < 0) {
    return `0${unit}`;
  }

  // Cap extremely large density values
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
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value == null || !isFinite(value) || isNaN(value)) {
    return "N/A";
  }

  // Cap extremely large values
  if (value > 1e15) {
    return "> 1,000,000,000,000,000";
  }

  return value.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * FIXED: Format growth rate as a percentage with color coding info
 * Assumes input is already in percentage form
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

  // FIXED: Input is already in percentage form
  const formatted = `${value.toFixed(2)}%`;

  if (value > 0.1) {
    return {
      formatted,
      color: "text-green-600",
      icon: "up"
    };
  } else if (value < -0.1) {
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

  // Cap extremely large values
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
 * Validate if a number is reasonable for display (not infinite, not NaN, not extremely large)
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
 * FIXED: Handle Excel-formatted numbers with currency/percentage symbols
 */
export function safeNumber(value: any, fallback: number = 0): number {
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