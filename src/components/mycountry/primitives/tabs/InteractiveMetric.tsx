"use client";

import React, { useState } from "react";
import { safeFormatCurrency } from "~/lib/format-utils";
import { motion, AnimatePresence } from "motion/react";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronUp,
  Info,
  ExternalLink,
} from "lucide-react";

export interface InteractiveMetricProps {
  value: number;
  label: string;
  format?: "number" | "currency" | "percent" | "compact";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  tooltip?: string;
  icon?: LucideIcon;
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    isPositive?: boolean;
  };
  expandedContent?: React.ReactNode;
  onClick?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  color?: "default" | "green" | "blue" | "purple" | "red" | "amber";
  animate?: boolean;
  className?: string;
  currency?: string;
}

// Format value based on format type with null safety
function formatValue(
  value: number | undefined | null,
  format: InteractiveMetricProps["format"],
  decimals: number,
  currency: string = "USD"
): string {
  if (value == null || !isFinite(value)) return "0";
  switch (format) {
    case "currency":
      return safeFormatCurrency(value, currency, decimals > 0);
    case "percent":
      return `${value.toFixed(decimals)}%`;
    case "compact":
      return value.toLocaleString("en-US", {
        notation: "compact",
        maximumFractionDigits: decimals,
      });
    default:
      return value.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
      });
  }
}

// Color configurations
const colorConfig = {
  default: {
    text: "text-foreground",
    bg: "hover:bg-muted/50",
    icon: "text-muted-foreground",
  },
  green: {
    text: "text-green-600 dark:text-green-400",
    bg: "hover:bg-green-50 dark:hover:bg-green-900/20",
    icon: "text-green-500",
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
    icon: "text-blue-500",
  },
  purple: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
    icon: "text-purple-500",
  },
  red: {
    text: "text-red-600 dark:text-red-400",
    bg: "hover:bg-red-50 dark:hover:bg-red-900/20",
    icon: "text-red-500",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
    icon: "text-amber-500",
  },
};

// Size configurations
const sizeConfig = {
  sm: {
    value: "text-lg",
    label: "text-xs",
    icon: "h-3 w-3",
    gap: "gap-1",
  },
  md: {
    value: "text-2xl",
    label: "text-sm",
    icon: "h-4 w-4",
    gap: "gap-1.5",
  },
  lg: {
    value: "text-3xl",
    label: "text-base",
    icon: "h-5 w-5",
    gap: "gap-2",
  },
  xl: {
    value: "text-4xl",
    label: "text-lg",
    icon: "h-6 w-6",
    gap: "gap-2",
  },
};

/**
 * InteractiveMetric - A metric display with animations, tooltips, and optional expansion
 */
export function InteractiveMetric({
  value,
  label,
  format = "number",
  decimals = 1,
  prefix = "",
  suffix = "",
  description,
  tooltip,
  icon: Icon,
  trend,
  expandedContent,
  onClick,
  size = "md",
  color = "default",
  animate = true,
  className = "",
  currency = "USD",
}: InteractiveMetricProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const colors = colorConfig[color];
  const sizes = sizeConfig[size];
  const isClickable = !!onClick || !!expandedContent;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (expandedContent) {
      setIsExpanded(!isExpanded);
    }
  };

  // Trend display
  const TrendDisplay = () => {
    if (!trend) return null;

    const icons = {
      up: TrendingUp,
      down: TrendingDown,
      stable: Minus,
    };

    const TrendIcon = icons[trend.direction];
    const isPositive = trend.isPositive !== undefined ? trend.isPositive : trend.direction === "up";

    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium",
          isPositive ? "text-green-500" : "text-red-500"
        )}
      >
        <TrendIcon className="h-3 w-3" />
        {trend.value !== undefined && (
          <span>
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
        )}
      </span>
    );
  };

  const content = (
    <motion.div
      className={cn(
        "rounded-lg p-2 transition-all",
        isClickable && cn("cursor-pointer", colors.bg),
        className
      )}
      onClick={handleClick}
      whileHover={isClickable ? { scale: 1.02 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
    >
      <div className={cn("flex items-start", sizes.gap)}>
        {Icon && <Icon className={cn(sizes.icon, colors.icon, "mt-1 shrink-0")} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className={cn(sizes.label, "text-muted-foreground font-medium")}>{label}</span>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {expandedContent && (
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="text-muted-foreground h-3 w-3" />
              </motion.span>
            )}
          </div>

          <div className={cn("flex items-baseline gap-2", sizes.gap)}>
            <span className={cn(sizes.value, "font-bold tracking-tight", colors.text)}>
              {prefix}
              {animate ? (
                <NumberFlowDisplay
                  value={value}
                  decimalPlaces={decimals}
                  format={
                    format === "currency"
                      ? "currency"
                      : format === "compact"
                        ? "compact"
                        : "default"
                  }
                  currency={currency}
                />
              ) : (
                formatValue(value, format, decimals, currency)
              )}
              {suffix}
            </span>
            <TrendDisplay />
          </div>

          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>

        {onClick && <ExternalLink className={cn(sizes.icon, "text-muted-foreground shrink-0")} />}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && expandedContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-border/50 mt-3 border-t pt-3">{expandedContent}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return content;
}

/**
 * MetricTooltip - A simple tooltip wrapper for metrics
 */
export function MetricTooltip({
  children,
  label,
  value,
  description,
}: {
  children: React.ReactNode;
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <p className="font-semibold">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * AnimatedValue - Simple animated number display
 */
export function AnimatedValue({
  value,
  // eslint-disable-next-line unused-imports/no-unused-vars
  format = "number",
  decimals = 1,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  format?: "number" | "currency" | "percent" | "compact";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {prefix}
      <NumberFlowDisplay value={value} decimalPlaces={decimals} />
      {suffix}
    </span>
  );
}
