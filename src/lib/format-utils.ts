/**
 * Global Formatting Utilities for IxStats
 *
 * Provides consistent number, currency, and data formatting across the entire application.
 * All formatting functions automatically scale to K/M/B/T for better readability.
 * Supports both ISO 4217 currency codes and custom currencies.
 */

// ISO 4217 currency codes for validation
const ISO_CURRENCY_CODES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "SEK",
  "NZD",
  "MXN",
  "SGD",
  "HKD",
  "NOK",
  "TRY",
  "RUB",
  "INR",
  "BRL",
  "ZAR",
  "KRW",
  "PLN",
  "TWD",
  "THB",
  "DKK",
  "CZK",
  "HUF",
  "ILS",
  "CLP",
  "PHP",
  "AED",
  "COP",
  "SAR",
  "MYR",
  "RON",
  "BGN",
  "HRK",
  "ISK",
  "UAH",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "LBP",
  "EGP",
  "MAD",
  "TND",
  "DZD",
  "LYD",
  "SDG",
  "ETB",
  "KES",
  "UGX",
  "TZS",
  "ZMW",
  "BWP",
  "SZL",
  "LSL",
  "NAD",
  "MUR",
  "SCR",
  "KMF",
  "DJF",
  "RWF",
  "BIF",
  "CDF",
  "AOA",
  "XAF",
  "XOF",
  "XPF",
]);

// Custom currency configurations
interface CustomCurrency {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
}

const CUSTOM_CURRENCIES: Record<string, CustomCurrency> = {
  Taler: { code: "Taler", symbol: "₮", name: "Taler", decimalPlaces: 2 },
  Crown: { code: "Crown", symbol: "©", name: "Crown", decimalPlaces: 2 },
  Mark: { code: "Mark", symbol: "ℳ", name: "Mark", decimalPlaces: 2 },
  Ducat: { code: "Ducat", symbol: "₫", name: "Ducat", decimalPlaces: 2 },
  Guilder: { code: "Guilder", symbol: "ƒ", name: "Guilder", decimalPlaces: 2 },
  Pound: { code: "Pound", symbol: "£", name: "Pound", decimalPlaces: 2 },
  Franc: { code: "Franc", symbol: "₣", name: "Franc", decimalPlaces: 2 },
  Lira: { code: "Lira", symbol: "₤", name: "Lira", decimalPlaces: 2 },
  Peso: { code: "Peso", symbol: "₱", name: "Peso", decimalPlaces: 2 },
  Real: { code: "Real", symbol: "R$", name: "Real", decimalPlaces: 2 },
};

/**
 * Check if a currency code is a valid ISO 4217 code
 */
function isISOCurrency(currency: string): boolean {
  return ISO_CURRENCY_CODES.has(currency.toUpperCase());
}

/**
 * Get custom currency configuration
 */
function getCustomCurrency(currency: string): CustomCurrency | null {
  return CUSTOM_CURRENCIES[currency] || null;
}

/**
 * Format currency with custom currency support
 */
function formatCustomCurrency(
  amount: number,
  currency: string,
  forceDecimals: boolean = false
): string {
  const customCurrency = getCustomCurrency(currency);
  if (!customCurrency) {
    // Fallback to generic custom currency
    return `${currency} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: forceDecimals ? 2 : 0,
      maximumFractionDigits: forceDecimals ? 2 : 0,
    })}`;
  }

  const absAmount = Math.abs(amount);
  const decimals = forceDecimals ? 2 : customCurrency.decimalPlaces;

  if (absAmount >= 1e12) {
    const scaled = amount / 1e12;
    return `${customCurrency.symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}T`;
  } else if (absAmount >= 1e9) {
    const scaled = amount / 1e9;
    return `${customCurrency.symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`;
  } else if (absAmount >= 1e6) {
    const scaled = amount / 1e6;
    return `${customCurrency.symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  } else if (absAmount >= 1e3) {
    const scaled = amount / 1e3;
    return `${customCurrency.symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  } else {
    return `${customCurrency.symbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: forceDecimals ? 2 : 0,
      maximumFractionDigits: forceDecimals ? 2 : 0,
    })}`;
  }
}

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
  currency: string = "USD",
  forceDecimals: boolean = false
): string {
  // Handle custom currencies
  if (!isISOCurrency(currency)) {
    return formatCustomCurrency(amount, currency, forceDecimals);
  }

  const absAmount = Math.abs(amount);

  try {
    if (absAmount >= 1e12) {
      // Trillions
      return (
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(amount / 1e12) + "T"
      );
    } else if (absAmount >= 1e9) {
      // Billions
      return (
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(amount / 1e9) + "B"
      );
    } else if (absAmount >= 1e6) {
      // Millions
      return (
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(amount / 1e6) + "M"
      );
    } else if (absAmount >= 1e3) {
      // Thousands
      return (
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(amount / 1e3) + "K"
      );
    } else {
      // Less than 1000
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: forceDecimals ? 2 : 0,
        maximumFractionDigits: forceDecimals ? 2 : 0,
      }).format(amount);
    }
  } catch (error) {
    // Fallback to custom currency formatting if Intl.NumberFormat fails
    console.warn(
      `Failed to format currency ${currency}, falling back to custom formatting:`,
      error
    );
    return formatCustomCurrency(amount, currency, forceDecimals);
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
    return (num / 1e12).toFixed(decimals) + "T";
  } else if (absNum >= 1e9) {
    return (num / 1e9).toFixed(decimals) + "B";
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(decimals) + "M";
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(decimals) + "K";
  } else {
    return num.toLocaleString("en-US", {
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
  return (value * 100).toFixed(decimals) + "%";
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
  return value.toFixed(decimals) + "%";
}

/**
 * Format number with fixed decimals and commas (no K/M/B/T, just comma-separated)
 *
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number with commas
 *
 * @example
 * formatNumberWithDecimals(1234567) → "1,234,567"
 * formatNumberWithDecimals(123.456, 2) → "123.46"
 */
export function formatNumberWithDecimals(num: number, decimals: number = 0): string {
  return num.toLocaleString("en-US", {
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
  return num.toLocaleString("en-US", {
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
export function formatExactCurrency(amount: number, currency: string = "USD"): string {
  // Handle custom currencies
  if (!isISOCurrency(currency)) {
    const customCurrency = getCustomCurrency(currency);
    if (customCurrency) {
      return `${customCurrency.symbol}${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    } else {
      return `${currency} ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    // Fallback to custom currency formatting if Intl.NumberFormat fails
    console.warn(
      `Failed to format exact currency ${currency}, falling back to custom formatting:`,
      error
    );
    const customCurrency = getCustomCurrency(currency);
    if (customCurrency) {
      return `${customCurrency.symbol}${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    } else {
      return `${currency} ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }
  }
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
  return isAlreadyPercent ? formatPercent(value, decimals) : formatPercentage(value, decimals);
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

  if (absNum >= 1e12) return "T";
  if (absNum >= 1e9) return "B";
  if (absNum >= 1e6) return "M";
  if (absNum >= 1e3) return "K";
  return "";
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

  if (absNum >= 1e12) return { value: num / 1e12, suffix: "T" };
  if (absNum >= 1e9) return { value: num / 1e9, suffix: "B" };
  if (absNum >= 1e6) return { value: num / 1e6, suffix: "M" };
  if (absNum >= 1e3) return { value: num / 1e3, suffix: "K" };
  return { value: num, suffix: "" };
}

/**
 * Get all available currency codes (ISO + custom)
 */
export function getAvailableCurrencies(): string[] {
  return [...ISO_CURRENCY_CODES, ...Object.keys(CUSTOM_CURRENCIES)];
}

/**
 * Get currency information
 */
export function getCurrencyInfo(currency: string): {
  isISO: boolean;
  symbol?: string;
  name?: string;
} {
  if (isISOCurrency(currency)) {
    return { isISO: true };
  }

  const customCurrency = getCustomCurrency(currency);
  if (customCurrency) {
    return {
      isISO: false,
      symbol: customCurrency.symbol,
      name: customCurrency.name,
    };
  }

  return { isISO: false };
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): boolean {
  return isISOCurrency(currency) || getCustomCurrency(currency) !== null;
}

/**
 * Safe currency formatting with fallback
 */
export function safeFormatCurrency(
  amount: number,
  currency: string = "USD",
  forceDecimals: boolean = false,
  fallbackCurrency: string = "USD"
): string {
  // If currency is invalid, use fallback immediately
  if (!isValidCurrency(currency)) {
    console.warn(`Invalid currency ${currency}, using fallback ${fallbackCurrency}`);
    return formatCurrency(amount, fallbackCurrency, forceDecimals);
  }

  try {
    return formatCurrency(amount, currency, forceDecimals);
  } catch (error) {
    console.warn(
      `Currency formatting failed for ${currency}, using fallback ${fallbackCurrency}:`,
      error
    );
    return formatCurrency(amount, fallbackCurrency, forceDecimals);
  }
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
  if (typeof input === "number") {
    return input;
  }

  // Remove currency symbols, spaces, and convert to uppercase
  const cleaned = input.replace(/[$€£¥,\s]/g, "").toUpperCase();

  // Check for suffix multipliers
  const suffixMultipliers: Record<string, number> = {
    K: 1e3,
    M: 1e6,
    B: 1e9,
    T: 1e12,
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

/**
 * Format number with compact notation (K/M/B/T) using Intl.NumberFormat
 * Provides null/undefined safety with configurable fallback
 *
 * @param value - The number to format
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @returns Formatted compact number string
 *
 * @example
 * formatCompactNumber(1234567) → "1.2M"
 * formatCompactNumber(null) → "N/A"
 * formatCompactNumber(5000, "Unknown") → "5K"
 */
export function formatCompactNumber(value: number | null | undefined, fallback = "N/A"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format currency with compact notation (K/M/B/T) using Intl.NumberFormat
 * Provides null/undefined safety with configurable fallback
 *
 * @param value - The currency amount to format
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @param currency - ISO 4217 currency code (default: "USD")
 * @returns Formatted compact currency string
 *
 * @example
 * formatCompactCurrency(1234567) → "$1.2M"
 * formatCompactCurrency(null) → "N/A"
 * formatCompactCurrency(5000, "Unknown", "EUR") → "€5K"
 */
export function formatCompactCurrency(
  value: number | null | undefined,
  fallback = "N/A",
  currency = "USD"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  // Handle custom currencies
  if (!isISOCurrency(currency)) {
    const customCurrency = getCustomCurrency(currency);
    if (customCurrency) {
      const absValue = Math.abs(value);
      if (absValue >= 1e12) {
        return `${customCurrency.symbol}${(value / 1e12).toFixed(1)}T`;
      } else if (absValue >= 1e9) {
        return `${customCurrency.symbol}${(value / 1e9).toFixed(1)}B`;
      } else if (absValue >= 1e6) {
        return `${customCurrency.symbol}${(value / 1e6).toFixed(1)}M`;
      } else if (absValue >= 1e3) {
        return `${customCurrency.symbol}${(value / 1e3).toFixed(1)}K`;
      } else {
        return `${customCurrency.symbol}${value.toFixed(0)}`;
      }
    }
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch (error) {
    console.warn(`Failed to format compact currency ${currency}:`, error);
    return formatCompactNumber(value, fallback);
  }
}

/**
 * Format time duration in years
 * Provides null/undefined safety with configurable fallback
 *
 * @param value - The number of years
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @returns Formatted years string
 *
 * @example
 * formatYears(5.5) → "5.5 yrs"
 * formatYears(null) → "N/A"
 * formatYears(10.2, "Unknown") → "10.2 yrs"
 */
export function formatYears(value: number | null | undefined, fallback = "N/A"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${value.toFixed(1)} yrs`;
}

/**
 * Format time duration in hours
 * Provides null/undefined safety with configurable fallback
 *
 * @param value - The number of hours
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @returns Formatted hours string
 *
 * @example
 * formatHours(40.5) → "40.5 hrs"
 * formatHours(null) → "N/A"
 * formatHours(35.0, "Unknown") → "35.0 hrs"
 */
export function formatHours(value: number | null | undefined, fallback = "N/A"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${value.toFixed(1)} hrs`;
}

/**
 * Format percentage with automatic normalization
 * Intelligently handles both decimal (0.15) and percentage (15) inputs
 * Provides null/undefined safety with configurable fallback
 *
 * @param value - The percentage value (auto-normalized if <= 1)
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @param digits - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentWithNormalization(0.155) → "15.5%"
 * formatPercentWithNormalization(15.5) → "15.5%"
 * formatPercentWithNormalization(null) → "N/A"
 * formatPercentWithNormalization(0.155, "N/A", 2) → "15.50%"
 */
export function formatPercentWithNormalization(
  value: number | null | undefined,
  fallback = "N/A",
  digits = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(digits)}%`;
}

/**
 * Format population numbers with appropriate scaling
 * Optimized for demographic data visualization
 *
 * @param population - The population number to format
 * @param fallback - Fallback string for null/undefined/NaN values (default: "N/A")
 * @returns Formatted population string
 *
 * @example
 * formatPopulation(1234567) → "1.2M"
 * formatPopulation(5678) → "5.7K"
 * formatPopulation(null) → "N/A"
 */
export function formatPopulation(population: number | null | undefined, fallback = "N/A"): string {
  if (population === null || population === undefined || Number.isNaN(population)) {
    return fallback;
  }
  const absPopulation = Math.abs(population);
  if (absPopulation >= 1e6) {
    return `${(population / 1e6).toFixed(1)}M`;
  }
  if (absPopulation >= 1e3) {
    return `${(population / 1e3).toFixed(1)}K`;
  }
  return population.toFixed(0);
}
