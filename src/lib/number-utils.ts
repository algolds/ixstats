/**
 * Utility functions for consistent number formatting across IxStats
 * This ensures all numeric displays use NumberFlow for animated transitions
 */

export type NumberFormat = 'default' | 'currency' | 'population' | 'percentage' | 'compact';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface NumberDisplayConfig {
  value: number;
  format?: NumberFormat;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  trend?: TrendDirection;
  duration?: number;
  className?: string;
}

/**
 * Standard formatting configurations for common number types
 */
export const NUMBER_FORMATS: Record<NumberFormat, Partial<NumberDisplayConfig>> = {
  default: {
    decimalPlaces: 0,
    duration: 1000
  },
  currency: {
    prefix: '$',
    decimalPlaces: 0,
    duration: 1000
  },
  population: {
    decimalPlaces: 1,
    duration: 1200
  },
  percentage: {
    suffix: '%',
    decimalPlaces: 1,
    duration: 800
  },
  compact: {
    decimalPlaces: 1,
    duration: 1000
  }
};

/**
 * Intelligent format detection based on value patterns
 */
export function detectNumberFormat(value: number, context?: string): NumberFormat {
  const contextLower = context?.toLowerCase() || '';
  
  // Check for percentage indicators
  if (contextLower.includes('percent') || contextLower.includes('rate') || contextLower.includes('%')) {
    return 'percentage';
  }
  
  // Check for currency indicators
  if (contextLower.includes('gdp') || contextLower.includes('income') || contextLower.includes('revenue') || contextLower.includes('$')) {
    return 'currency';
  }
  
  // Check for population indicators
  if (contextLower.includes('population') || contextLower.includes('people') || contextLower.includes('citizens')) {
    return 'population';
  }
  
  // Large numbers get compact format
  if (value >= 1000) {
    return 'compact';
  }
  
  return 'default';
}

/**
 * Apply intelligent scaling and formatting based on value magnitude
 */
export function processNumberForDisplay(value: number, format: NumberFormat) {
  let processedValue = value;
  let autoSuffix = '';
  let autoDecimalPlaces = 0;

  switch (format) {
    case 'currency':
      if (value >= 1e12) {
        processedValue = value / 1e12;
        autoSuffix = 'T';
        autoDecimalPlaces = 1;
      } else if (value >= 1e9) {
        processedValue = value / 1e9;
        autoSuffix = 'B';
        autoDecimalPlaces = 1;
      } else if (value >= 1e6) {
        processedValue = value / 1e6;
        autoSuffix = 'M';
        autoDecimalPlaces = 1;
      } else if (value >= 1e3) {
        processedValue = value / 1e3;
        autoSuffix = 'K';
        autoDecimalPlaces = 1;
      }
      break;

    case 'population':
      if (value >= 1e9) {
        processedValue = value / 1e9;
        autoSuffix = 'B';
        autoDecimalPlaces = 2;
      } else if (value >= 1e6) {
        processedValue = value / 1e6;
        autoSuffix = 'M';
        autoDecimalPlaces = 1;
      } else if (value >= 1e3) {
        processedValue = value / 1e3;
        autoSuffix = 'K';
        autoDecimalPlaces = 1;
      }
      break;

    case 'compact':
      if (value >= 1e9) {
        processedValue = value / 1e9;
        autoSuffix = 'B';
        autoDecimalPlaces = 1;
      } else if (value >= 1e6) {
        processedValue = value / 1e6;
        autoSuffix = 'M';
        autoDecimalPlaces = 1;
      } else if (value >= 1e3) {
        processedValue = value / 1e3;
        autoSuffix = 'K';
        autoDecimalPlaces = 1;
      }
      break;
  }

  return {
    value: processedValue,
    suffix: autoSuffix,
    decimalPlaces: autoDecimalPlaces
  };
}

/**
 * Create a complete config for NumberFlow display
 */
export function createNumberConfig(
  value: number,
  options: Partial<NumberDisplayConfig> = {}
): NumberDisplayConfig {
  const format = options.format || 'default';
  const baseConfig = NUMBER_FORMATS[format];
  const processed = processNumberForDisplay(value, format);

  return {
    value: processed.value,
    format,
    prefix: options.prefix || baseConfig.prefix || '',
    suffix: options.suffix || processed.suffix || baseConfig.suffix || '',
    decimalPlaces: options.decimalPlaces ?? processed.decimalPlaces ?? baseConfig.decimalPlaces ?? 0,
    trend: options.trend,
    duration: options.duration || baseConfig.duration || 1000,
    className: options.className || ''
  };
}

/**
 * Quick helpers for common use cases
 */
export const quickFormat = {
  currency: (value: number, options?: Partial<NumberDisplayConfig>) => 
    createNumberConfig(value, { ...options, format: 'currency' }),
  
  population: (value: number, options?: Partial<NumberDisplayConfig>) => 
    createNumberConfig(value, { ...options, format: 'population' }),
  
  percentage: (value: number, options?: Partial<NumberDisplayConfig>) => 
    createNumberConfig(value, { ...options, format: 'percentage' }),
  
  growth: (value: number, options?: Partial<NumberDisplayConfig>) => 
    createNumberConfig(value, { 
      ...options, 
      format: 'percentage',
      trend: value > 0 ? 'up' : value < 0 ? 'down' : 'stable'
    }),
  
  compact: (value: number, options?: Partial<NumberDisplayConfig>) => 
    createNumberConfig(value, { ...options, format: 'compact' })
};