"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "~/lib/utils";

interface NumberFlowDisplayProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  format?:
    | "default"
    | "currency"
    | "population"
    | "percentage"
    | "financial"
    | "compact"
    | "decimal";
  duration?: number;
  trend?: "up" | "down" | "stable";
  locale?: string;
  useGrouping?: boolean;
}

// Enhanced format helpers with proper locale support
const formatNumber = (value: number, options: Intl.NumberFormatOptions, locale = "en-US") => {
  return new Intl.NumberFormat(locale, options).format(value);
};

const formatters = {
  currency: (value: number, decimals = 2, locale = "en-US") =>
    formatNumber(
      value,
      {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      },
      locale
    ),

  financial: (value: number, decimals = 2, locale = "en-US") =>
    formatNumber(
      value,
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      },
      locale
    ),

  population: (value: number, locale = "en-US") => {
    if (value >= 1e9) {
      return (
        formatNumber(
          value / 1e9,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
          locale
        ) + "B"
      );
    }
    if (value >= 1e6) {
      return (
        formatNumber(
          value / 1e6,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "M"
      );
    }
    if (value >= 1e3) {
      return (
        formatNumber(
          value / 1e3,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "K"
      );
    }
    return formatNumber(value, { useGrouping: true }, locale);
  },

  compact: (value: number, locale = "en-US") => {
    if (value >= 1e12) {
      return (
        formatNumber(
          value / 1e12,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "T"
      );
    }
    if (value >= 1e9) {
      return (
        formatNumber(
          value / 1e9,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "B"
      );
    }
    if (value >= 1e6) {
      return (
        formatNumber(
          value / 1e6,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "M"
      );
    }
    if (value >= 1e3) {
      return (
        formatNumber(
          value / 1e3,
          {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
          locale
        ) + "K"
      );
    }
    return formatNumber(value, { useGrouping: true }, locale);
  },

  percentage: (value: number, decimals = 1, locale = "en-US") =>
    formatNumber(
      value,
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      },
      locale
    ) + "%",

  decimal: (value: number, decimals = 2, locale = "en-US") =>
    formatNumber(
      value,
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      },
      locale
    ),

  default: (value: number, decimals = 0, locale = "en-US") =>
    formatNumber(
      value,
      {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: true,
      },
      locale
    ),
};

export function NumberFlowDisplay({
  value,
  className,
  prefix = "",
  suffix = "",
  decimalPlaces,
  format = "default",
  duration = 1000,
  trend,
  locale = "en-US",
  useGrouping = true,
}: NumberFlowDisplayProps) {
  // Ensure value is a valid number
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0;

  // Auto-determine decimal places based on format if not specified
  const autoDecimalPlaces =
    decimalPlaces ??
    (format === "currency"
      ? 2
      : format === "financial"
        ? 2
        : format === "decimal"
          ? 2
          : format === "percentage"
            ? 1
            : format === "population" || format === "compact"
              ? 1
              : 0);

  // Apply format-specific transformations
  let displayValue = safeValue;
  let displaySuffix = suffix;
  let displayPrefix = prefix;
  let formattedValue = "";

  // Handle different formatting types
  switch (format) {
    case "currency":
      if (safeValue >= 1e12) {
        displayValue = safeValue / 1e12;
        displaySuffix = "T";
        formattedValue = formatters.financial(displayValue, Math.max(autoDecimalPlaces, 1), locale);
        displayPrefix = "$";
      } else if (safeValue >= 1e9) {
        displayValue = safeValue / 1e9;
        displaySuffix = "B";
        formattedValue = formatters.financial(displayValue, Math.max(autoDecimalPlaces, 1), locale);
        displayPrefix = "$";
      } else if (safeValue >= 1e6) {
        displayValue = safeValue / 1e6;
        displaySuffix = "M";
        formattedValue = formatters.financial(displayValue, Math.max(autoDecimalPlaces, 1), locale);
        displayPrefix = "$";
      } else {
        formattedValue = formatters.currency(safeValue, autoDecimalPlaces, locale);
        displayPrefix = "";
        displaySuffix = "";
      }
      break;

    case "financial":
      formattedValue = formatters.financial(safeValue, autoDecimalPlaces, locale);
      break;

    case "population":
      formattedValue = formatters.population(safeValue, locale);
      displayPrefix = "";
      displaySuffix = "";
      break;

    case "compact":
      formattedValue = formatters.compact(safeValue, locale);
      displayPrefix = "";
      displaySuffix = "";
      break;

    case "percentage":
      formattedValue = formatters.percentage(safeValue, autoDecimalPlaces, locale);
      displayPrefix = "";
      displaySuffix = "";
      break;

    case "decimal":
      formattedValue = formatters.decimal(safeValue, autoDecimalPlaces, locale);
      break;

    default:
      formattedValue = formatters.default(safeValue, autoDecimalPlaces, locale);
      break;
  }

  const trendClasses = {
    up: "text-green-500",
    down: "text-red-500",
    stable: "text-gray-500",
  };

  return (
    <span
      className={cn(
        "font-variant-numeric font-medium tabular-nums",
        trend && trendClasses[trend],
        className
      )}
    >
      {/* For complex formats, show the formatted value directly */}
      {(format === "currency" && safeValue < 1e6) ||
      format === "population" ||
      format === "compact" ||
      format === "percentage" ? (
        <span>{formattedValue}</span>
      ) : (
        <>
          {displayPrefix}
          <NumberFlow
            value={displayValue}
            format={{
              minimumFractionDigits:
                format === "currency" && safeValue >= 1e6
                  ? Math.max(autoDecimalPlaces, 1)
                  : autoDecimalPlaces,
              maximumFractionDigits:
                format === "currency" && safeValue >= 1e6
                  ? Math.max(autoDecimalPlaces, 1)
                  : autoDecimalPlaces,
              useGrouping: useGrouping,
            }}
            transformTiming={{
              duration: duration,
              easing: "ease-out",
            }}
            locales={locale}
          />
          {displaySuffix}
        </>
      )}
    </span>
  );
}

// Legacy compatibility - alias AnimatedNumber to NumberFlowDisplay
export const AnimatedNumber = NumberFlowDisplay;

// Convenience exports for common formats
export const CurrencyFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="currency" />
);

export const PercentageFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="percentage" />
);

export const PopulationFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="population" />
);

export const FinancialFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="financial" />
);

export const CompactFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="compact" />
);

// Export default as the main component
export default NumberFlowDisplay;
