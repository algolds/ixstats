"use client";

import React from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MousePointerClick,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Map,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * Enhanced tooltip content for metric cards
 * Shows current value, trend, comparison data, and "click for details" hint
 */
export interface EnhancedMetricTooltipProps {
  /** Metric title */
  title: string;
  /** Current metric value (formatted) */
  value: string | number;
  /** Raw numeric value for comparisons */
  rawValue?: number;
  /** Trend direction and percentage */
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    isPositive?: boolean;
  };
  /** Brief description of the metric */
  description?: string;
  /** Comparison with global and regional averages */
  comparison?: {
    global?: number;
    regional?: number;
    globalLabel?: string;
    regionalLabel?: string;
  };
  /** Child element to wrap with tooltip */
  children: React.ReactNode;
  /** Additional class name for tooltip content */
  className?: string;
  /** Side for tooltip placement */
  side?: "top" | "right" | "bottom" | "left";
  /** Disable the "click for details" hint */
  hideClickHint?: boolean;
  /** Custom unit for comparison values */
  unit?: string;
}

/**
 * Format a number with appropriate notation
 */
function formatComparisonValue(value: number | undefined, unit?: string): string {
  if (value === undefined || !isFinite(value)) return "N/A";

  const formatted = value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    notation: Math.abs(value) >= 1000000 ? "compact" : "standard",
  });

  return unit ? `${formatted}${unit}` : formatted;
}

/**
 * Get comparison indicator (better/worse than average)
 */
function getComparisonIndicator(
  rawValue: number | undefined,
  compareValue: number | undefined,
  higherIsBetter = true
): "better" | "worse" | "similar" | "unknown" {
  if (rawValue === undefined || compareValue === undefined) return "unknown";

  const percentDiff = ((rawValue - compareValue) / compareValue) * 100;

  if (Math.abs(percentDiff) < 5) return "similar";

  const isBetter = higherIsBetter ? rawValue > compareValue : rawValue < compareValue;
  return isBetter ? "better" : "worse";
}

/**
 * Trend icon component
 */
function TrendIcon({
  direction,
  value,
  isPositive,
}: {
  direction: "up" | "down" | "stable";
  value?: number;
  isPositive?: boolean;
}) {
  const icons = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  const Icon = icons[direction];
  const positive = isPositive !== undefined ? isPositive : direction === "up";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        positive ? "text-green-600 dark:text-green-500" : direction === "stable" ? "text-muted-foreground" : "text-red-600 dark:text-red-500"
      )}
    >
      <Icon className="h-3 w-3" />
      {value !== undefined && (
        <span>
          {value > 0 ? "+" : ""}
          {value.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

/**
 * Comparison row component
 */
function ComparisonRow({
  label,
  icon: Icon,
  value,
  rawValue,
  compareValue,
  unit,
  higherIsBetter = true,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  rawValue?: number;
  compareValue?: number;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const indicator = getComparisonIndicator(rawValue, compareValue, higherIsBetter);

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {value}
        {indicator === "better" && (
          <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-500" />
        )}
        {indicator === "worse" && (
          <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-500" />
        )}
      </span>
    </div>
  );
}

/**
 * EnhancedMetricTooltip - Enhanced tooltip for metric cards
 *
 * Shows detailed information on hover including:
 * - Current value with trend indicator
 * - Brief description
 * - Global and regional comparison
 * - "Click for detailed analysis" hint
 *
 * @example
 * ```tsx
 * <EnhancedMetricTooltip
 *   title="GDP per Capita"
 *   value="$45,000"
 *   rawValue={45000}
 *   trend={{ direction: "up", value: 2.3 }}
 *   description="Gross Domestic Product divided by population"
 *   comparison={{ global: 42000, regional: 38000 }}
 * >
 *   <MetricCard ... />
 * </EnhancedMetricTooltip>
 * ```
 */
export function EnhancedMetricTooltip({
  title,
  value,
  rawValue,
  trend,
  description,
  comparison,
  children,
  className,
  side = "top",
  hideClickHint = false,
  unit,
}: EnhancedMetricTooltipProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          "w-64 p-0 overflow-hidden",
          "bg-background/95 backdrop-blur-xl",
          "border border-border/50 shadow-xl",
          className
        )}
        sideOffset={8}
      >
        <motion.div
          initial={{ opacity: 0, y: side === "top" ? 5 : -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Header with title and value */}
          <div className="border-b border-border/30 bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">{title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold">{value}</span>
                  {trend && (
                    <TrendIcon
                      direction={trend.direction}
                      value={trend.value}
                      isPositive={trend.isPositive}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-3 space-y-3">
            {/* Description */}
            {description && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {description}
              </p>
            )}

            {/* Comparison section */}
            {comparison && (comparison.global !== undefined || comparison.regional !== undefined) && (
              <div className="space-y-1.5 pt-1 border-t border-border/30">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium mb-2">
                  Comparison
                </p>
                {comparison.global !== undefined && (
                  <ComparisonRow
                    label={comparison.globalLabel || "Global Avg"}
                    icon={Globe}
                    value={formatComparisonValue(comparison.global, unit)}
                    rawValue={rawValue}
                    compareValue={comparison.global}
                    unit={unit}
                  />
                )}
                {comparison.regional !== undefined && (
                  <ComparisonRow
                    label={comparison.regionalLabel || "Regional Avg"}
                    icon={Map}
                    value={formatComparisonValue(comparison.regional, unit)}
                    rawValue={rawValue}
                    compareValue={comparison.regional}
                    unit={unit}
                  />
                )}
              </div>
            )}

            {/* Click hint */}
            {!hideClickHint && (
              <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/30">
                <MousePointerClick className="h-3 w-3 text-primary/60" />
                <span className="text-[10px] text-primary/60 font-medium">
                  Click for detailed analysis
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </TooltipContent>
    </Tooltip>
  );
}

export default EnhancedMetricTooltip;
