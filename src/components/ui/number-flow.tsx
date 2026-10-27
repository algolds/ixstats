"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "~/lib/utils/cn";
import { getCurrencyInfo, safeFormatCurrency } from "~/lib/utils/format-utils";

type NumberFlowFormat =
  "default" | "currency" | "population" | "percentage" | "financial" | "compact" | "decimal";

interface NumberFlowDisplayProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  format?: NumberFlowFormat;
  duration?: number;
  trend?: "up" | "down" | "stable";
  locale?: string;
  useGrouping?: boolean;
  currency?: string;
}

const DEFAULT_DECIMALS: Record<NumberFlowFormat, number> = {
  currency: 2,
  financial: 2,
  decimal: 2,
  percentage: 2,
  population: 1,
  compact: 1,
  default: 0,
};

/** [lower bound, suffix, fraction digits], largest first. */
type Scale = readonly [number, string, number];
const POPULATION_SCALES: Scale[] = [
  [1e9, "B", 2],
  [1e6, "M", 1],
  [1e3, "K", 1],
];
const COMPACT_SCALES: Scale[] = [
  [1e12, "T", 1],
  ...POPULATION_SCALES.map(([l, s]): Scale => [l, s, 1]),
];
const CURRENCY_SCALES: Scale[] = [
  [1e12, "T", 1],
  [1e9, "B", 1],
  [1e6, "M", 1],
];

const formatDigits = (value: number, locale: string, min: number, max = min) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: min, maximumFractionDigits: max }).format(
    value
  );

/** Scaled "1.2M" text; values below the smallest scale (and negatives) are plain grouped numbers. */
function formatScaled(value: number, locale: string, scales: Scale[]): string {
  const scale = scales.find(([limit]) => value >= limit);
  return scale
    ? formatDigits(value / scale[0], locale, scale[2]) + scale[1]
    : new Intl.NumberFormat(locale, { useGrouping: true }).format(value);
}

/** Formats rendered as static text rather than an animated flow; null for the animated ones. */
function formatStatic(
  format: NumberFlowFormat,
  value: number,
  locale: string,
  decimals: number,
  currency: string
): string | null {
  switch (format) {
    case "population":
      return formatScaled(value, locale, POPULATION_SCALES);
    case "compact":
      return formatScaled(value, locale, COMPACT_SCALES);
    case "percentage":
      return formatDigits(value, locale, decimals) + "%";
    case "currency":
      return value < 1e6 ? safeFormatCurrency(value, currency, decimals > 0) : null;
    default:
      return null;
  }
}

const TREND_CLASSES = {
  up: "text-green",
  down: "text-red",
  stable: "text-label-secondary",
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
  currency = "USD",
}: NumberFlowDisplayProps) {
  const safeValue = typeof value === "number" && !isNaN(value) ? value : 0;
  const decimals = decimalPlaces ?? DEFAULT_DECIMALS[format];

  const staticText = formatStatic(format, safeValue, locale, decimals, currency);

  // Large currency amounts flow as a scaled number (1.2B) behind the currency symbol
  const currencyScale =
    format === "currency" ? CURRENCY_SCALES.find(([limit]) => safeValue >= limit) : undefined;
  const info = currencyScale ? getCurrencyInfo(currency) : undefined;
  const flowPrefix = info ? info.symbol || info.name || currency : prefix;
  const flowSuffix = currencyScale ? currencyScale[1] : suffix;
  const flowValue = currencyScale ? safeValue / currencyScale[0] : safeValue;
  const flowDigits = currencyScale ? Math.max(decimals, 1) : decimals;

  return (
    <span
      className={cn(
        "font-variant-numeric font-medium tabular-nums",
        trend && TREND_CLASSES[trend],
        className
      )}
    >
      {staticText !== null ? (
        <span>{staticText}</span>
      ) : (
        <>
          {flowPrefix}
          <NumberFlow
            value={flowValue}
            format={{
              minimumFractionDigits: flowDigits,
              maximumFractionDigits: flowDigits,
              useGrouping: useGrouping,
            }}
            transformTiming={{ duration: duration, easing: "ease-out" }}
            locales={locale}
          />
          {flowSuffix}
        </>
      )}
    </span>
  );
}

// Convenience exports for common formats
export const CurrencyFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="currency" />
);

export const PercentageFlow = (props: Omit<NumberFlowDisplayProps, "format">) => (
  <NumberFlowDisplay {...props} format="percentage" />
);
