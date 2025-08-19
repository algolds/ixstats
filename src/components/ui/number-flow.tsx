"use client";

import NumberFlow from '@number-flow/react';
import { cn } from "~/lib/utils";

interface NumberFlowDisplayProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  format?: 'default' | 'currency' | 'population' | 'percentage';
  duration?: number;
  trend?: 'up' | 'down' | 'stable';
}

// Format helpers
const formatters = {
  currency: (value: number, decimals = 0) => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value),
  
  population: (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
  },

  percentage: (value: number, decimals = 1) => `${value.toFixed(decimals)}%`,
  
  default: (value: number, decimals = 0) => value.toFixed(decimals)
};

export function NumberFlowDisplay({ 
  value, 
  className, 
  prefix = '', 
  suffix = '', 
  decimalPlaces = 0,
  format = 'default',
  duration = 1000,
  trend
}: NumberFlowDisplayProps) {
  // Apply format-specific transformations
  let displayValue = value;
  let displaySuffix = suffix;
  let displayPrefix = prefix;

  if (format === 'currency' && !prefix) {
    displayPrefix = '$';
  }

  if (format === 'percentage' && !suffix) {
    displaySuffix = '%';
  }

  // For population and currency, we might want to scale the value
  if (format === 'population') {
    if (value >= 1e9) {
      displayValue = value / 1e9;
      displaySuffix = 'B';
      decimalPlaces = Math.max(decimalPlaces, 2);
    } else if (value >= 1e6) {
      displayValue = value / 1e6;
      displaySuffix = 'M';
      decimalPlaces = Math.max(decimalPlaces, 1);
    } else if (value >= 1e3) {
      displayValue = value / 1e3;
      displaySuffix = 'K';
      decimalPlaces = Math.max(decimalPlaces, 1);
    }
  }

  if (format === 'currency') {
    if (value >= 1e12) {
      displayValue = value / 1e12;
      displaySuffix = 'T';
      decimalPlaces = Math.max(decimalPlaces, 1);
    } else if (value >= 1e9) {
      displayValue = value / 1e9;
      displaySuffix = 'B';
      decimalPlaces = Math.max(decimalPlaces, 1);
    } else if (value >= 1e6) {
      displayValue = value / 1e6;
      displaySuffix = 'M';
      decimalPlaces = Math.max(decimalPlaces, 1);
    } else if (value >= 1e3) {
      displayValue = value / 1e3;
      displaySuffix = 'K';
      decimalPlaces = Math.max(decimalPlaces, 1);
    }
  }

  const trendClasses = {
    up: 'text-green-500',
    down: 'text-red-500',
    stable: 'text-gray-500'
  };

  return (
    <span className={cn(
      "font-variant-numeric tabular-nums font-medium",
      trend && trendClasses[trend],
      className
    )}>
      {displayPrefix}
      <NumberFlow 
        value={displayValue}
        format={{
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }}
        transformTiming={{
          duration: duration,
          easing: "ease-out"
        }}
      />
      {displaySuffix}
    </span>
  );
}

// Legacy compatibility - alias AnimatedNumber to NumberFlowDisplay
export const AnimatedNumber = NumberFlowDisplay;

// Export default as the main component
export default NumberFlowDisplay;