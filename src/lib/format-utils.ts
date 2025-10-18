/**
 * Global Formatting Utilities for IxStats
 *
 * Provides consistent number, currency, and data formatting across the entire application.
 * All formatting functions automatically scale to K/M/B/T for better readability.
 */

/**
 * Format currency with automatic scaling (K/M/B/T)
 *
 * @param amount - The currency amount to format
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @param forceDecimals - Force showing decimals even for small amounts
 * @returns Formatted currency string with K/M/B/T suffix
 *
 * @example
 * formatCurrency(1234) → "$1.2K"
 * formatCurrency(5678900000) → "$5.7B"
 * formatCurrency(1200000000000) → "$1.2T"
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  forceDecimals: boolean = false
): string {
  const absAmount = Math.abs(amount);

  if (absAmount >= 1e12) {
    // Trillions
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1e12) + 'T';
  } else if (absAmount >= 1e9) {
    // Billions
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1e9) + 'B';
  } else if (absAmount >= 1e6) {
    // Millions
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1e6) + 'M';
  } else if (absAmount >= 1e3) {
    // Thousands
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount / 1e3) + 'K';
  } else {
    // Less than 1000
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: forceDecimals ? 2 : 0,
      maximumFractionDigits: forceDecimals ? 2 : 0,
    }).format(amount);
  }
}

/**
 * Format plain numbers with automatic scaling (K/M/B/T)
 *
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with K/M/B/T suffix
 *
 * @example
 * formatNumber(1234) → "1.2K"
 * formatNumber(5678900) → "5.7M"
 * formatNumber(125000) → "125.0K"
 */
export function formatNumber(num: number, decimals: number = 1): string {
  const absNum = Math.abs(num);

  if (absNum >= 1e12) {
    return (num / 1e12).toFixed(decimals) + 'T';
  } else if (absNum >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  } else {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }
}

/**
 * Format percentage with optional decimal places
 *
 * @param value - The decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(0.155) → "15.5%"
 * formatPercentage(0.8, 0) → "80%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format percentage from raw percentage value (already multiplied by 100)
 *
 * @param value - The percentage value (e.g., 15 for 15%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(15.5) → "15.5%"
 * formatPercent(80, 0) → "80%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + '%';
}

/**
 * Format compact number (no K/M/B/T, just comma-separated)
 *
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number with commas
 *
 * @example
 * formatCompactNumber(1234567) → "1,234,567"
 * formatCompactNumber(123.456, 2) → "123.46"
 */
export function formatCompactNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format large number with full precision and commas (no scaling)
 * Useful when exact values are needed
 *
 * @param num - The number to format
 * @returns Formatted number with commas
 *
 * @example
 * formatExactNumber(1234567890) → "1,234,567,890"
 */
export function formatExactNumber(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format currency with full precision (no scaling)
 * Useful for exact financial displays
 *
 * @param amount - The currency amount to format
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @returns Formatted currency string without scaling
 *
 * @example
 * formatExactCurrency(1234567890) → "$1,234,567,890"
 */
export function formatExactCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a ratio or decimal as a percentage
 * Handles both decimal (0.15) and percentage (15) inputs
 *
 * @param value - The value to format
 * @param isAlreadyPercent - Whether the value is already a percentage (default: false)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatRatio(0.155) → "15.5%"
 * formatRatio(15.5, true) → "15.5%"
 */
export function formatRatio(
  value: number,
  isAlreadyPercent: boolean = false,
  decimals: number = 1
): string {
  return isAlreadyPercent
    ? formatPercent(value, decimals)
    : formatPercentage(value, decimals);
}

/**
 * Get the appropriate scaling suffix for a number
 *
 * @param num - The number to get suffix for
 * @returns The scaling suffix ('K', 'M', 'B', 'T', or '')
 *
 * @example
 * getNumberSuffix(1234) → "K"
 * getNumberSuffix(5678900) → "M"
 */
export function getNumberSuffix(num: number): string {
  const absNum = Math.abs(num);

  if (absNum >= 1e12) return 'T';
  if (absNum >= 1e9) return 'B';
  if (absNum >= 1e6) return 'M';
  if (absNum >= 1e3) return 'K';
  return '';
}

/**
 * Get the scaled value without formatting
 *
 * @param num - The number to scale
 * @returns Object with scaled value and suffix
 *
 * @example
 * getScaledValue(1234567) → { value: 1.2, suffix: 'M' }
 */
export function getScaledValue(num: number): { value: number; suffix: string } {
  const absNum = Math.abs(num);
  const sign = num < 0 ? -1 : 1;

  if (absNum >= 1e12) return { value: (num / 1e12), suffix: 'T' };
  if (absNum >= 1e9) return { value: (num / 1e9), suffix: 'B' };
  if (absNum >= 1e6) return { value: (num / 1e6), suffix: 'M' };
  if (absNum >= 1e3) return { value: (num / 1e3), suffix: 'K' };
  return { value: num, suffix: '' };
}

/**
 * Parse user input into a number, handling various formats
 * Supports: "1.5M", "50k", "1,000,000", "1500", "$50k", etc.
 *
 * @param input - The string input to parse
 * @returns Parsed number or NaN if invalid
 *
 * @example
 * parseNumberInput("1.5M") → 1500000
 * parseNumberInput("50k") → 50000
 * parseNumberInput("1,000,000") → 1000000
 * parseNumberInput("$25.5k") → 25500
 */
export function parseNumberInput(input: string | number): number {
  // If already a number, return it
  if (typeof input === 'number') {
    return input;
  }

  // Remove currency symbols, spaces, and convert to uppercase
  const cleaned = input.replace(/[$€£¥,\s]/g, '').toUpperCase();

  // Check for suffix multipliers
  const suffixMultipliers: Record<string, number> = {
    'K': 1e3,
    'M': 1e6,
    'B': 1e9,
    'T': 1e12,
  };

  // Extract number and suffix
  const match = cleaned.match(/^(-?[\d.]+)([KMBT])?$/);

  if (!match) {
    // Try parsing as plain number
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? NaN : parsed;
  }

  const [, numStr, suffix] = match;
  const baseNum = parseFloat(numStr!);

  if (isNaN(baseNum)) {
    return NaN;
  }

  // Apply multiplier if suffix exists
  const multiplier = suffix ? suffixMultipliers[suffix] || 1 : 1;
  return baseNum * multiplier;
}
