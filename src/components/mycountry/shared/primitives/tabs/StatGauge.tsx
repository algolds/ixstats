"use client";

import React from "react";
import { motion } from "motion/react";
import { Progress } from "~/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { StatUp as TrendingUp, StatDown as TrendingDown, Minus, InfoCircle as Info } from "iconoir-react";

export interface StatGaugeProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    isGood?: boolean; // Whether this trend direction is positive
  };
  thresholds?: {
    low?: number;
    medium?: number;
    high?: number;
  };
  color?: "green" | "blue" | "purple" | "red" | "amber" | "cyan";
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}

// Color configurations
const colorConfig = {
  green: {
    gradient: "from-green-500 to-emerald-500",
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    progress: "bg-green-500",
  },
  blue: {
    gradient: "from-blue-500 to-cyan-500",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    progress: "bg-blue-500",
  },
  purple: {
    gradient: "from-purple-500 to-violet-500",
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    progress: "bg-purple-500",
  },
  red: {
    gradient: "from-red-500 to-rose-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    progress: "bg-red-500",
  },
  amber: {
    gradient: "from-amber-500 to-yellow-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    progress: "bg-amber-500",
  },
  cyan: {
    gradient: "from-cyan-500 to-teal-500",
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    border: "border-cyan-200 dark:border-cyan-800",
    progress: "bg-cyan-500",
  },
};

// Size configurations
const sizeConfig = {
  sm: {
    value: "text-xl",
    label: "text-xs",
    icon: "h-4 w-4",
    padding: "p-3",
    progress: "h-1.5",
  },
  md: {
    value: "text-xl",
    label: "text-xs",
    icon: "h-4 w-4",
    padding: "p-3",
    progress: "h-1.5",
  },
  lg: {
    value: "text-3xl",
    label: "text-base",
    icon: "h-6 w-6",
    padding: "p-5",
    progress: "h-3",
  },
};

/**
 * StatGauge - A visual gauge for displaying statistics with progress bars and trends
 */
export function StatGauge({
  label,
  value,
  max = 100,
  unit = "%",
  description,
  icon: Icon,
  trend,
  thresholds,
  color = "blue",
  size = "md",
  animate = true,
  className = "",
}: StatGaugeProps) {
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];
  const safeValue = value ?? 0;
  const safeMax = max || 100;
  const percentage = Math.min((safeValue / safeMax) * 100, 100);

  // Determine status color based on thresholds
  const getStatusColor = () => {
    if (!thresholds) return colors.progress;

    if (thresholds.high && safeValue >= thresholds.high) return "bg-green-500";
    if (thresholds.medium && safeValue >= thresholds.medium) return "bg-yellow-500";
    if (thresholds.low && safeValue >= thresholds.low) return "bg-orange-500";
    return "bg-red-500";
  };

  // Trend icon
  const TrendIcon = () => {
    if (!trend) return null;

    const icons = {
      up: TrendingUp,
      down: TrendingDown,
      stable: Minus,
    };

    const TIcon = icons[trend.direction];
    const isPositive = trend.isGood !== undefined ? trend.isGood : trend.direction === "up";

    return (
      <div
        className={cn(
          "flex items-center gap-1 text-xs",
          isPositive ? "text-green-500" : "text-red-500"
        )}
      >
        <TIcon className="h-3 w-3" />
        {trend.value !== undefined && (
          <span>
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}
            {unit}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all hover:scale-[1.02]",
        colors.bg,
        colors.border,
        sizes.padding,
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={cn("rounded-lg bg-gradient-to-br p-1.5", colors.gradient)}>
              <Icon className={cn(sizes.icon, "text-white")} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1">
              <span className={cn(sizes.label, "text-muted-foreground font-medium")}>{label}</span>
              {description && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <TrendIcon />
          </div>
        </div>
      </div>

      <div className={cn(sizes.value, "font-bold", colors.text)}>
        {animate ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {value.toFixed(1)}
            {unit}
          </motion.span>
        ) : (
          <span>
            {value.toFixed(1)}
            {unit}
          </span>
        )}
      </div>

      <div className={cn("bg-muted mt-2 overflow-hidden rounded-full", sizes.progress)}>
        <motion.div
          className={cn("h-full rounded-full", getStatusColor())}
          initial={animate ? { width: 0 } : undefined}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        />
      </div>

      {safeMax !== 100 && (
        <p className="text-muted-foreground mt-1 text-xs">
          of {safeMax.toLocaleString()}
          {unit !== "%" ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}

export interface StatGaugeGridProps {
  gauges: Omit<StatGaugeProps, "animate" | "className">[];
  columns?: 2 | 3 | 4;
  animate?: boolean;
  className?: string;
}

/**
 * StatGaugeGrid - A grid of StatGauge components
 */
export function StatGaugeGrid({
  gauges,
  columns = 4,
  animate = true,
  className = "",
}: StatGaugeGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-3", gridCols[columns], className)}>
      {gauges.map((gauge, index) => (
        <motion.div
          key={gauge.label}
          initial={animate ? { opacity: 0, y: 20 } : undefined}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          <StatGauge {...gauge} animate={animate} />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * DistributionBar - A horizontal bar showing distribution across categories
 */
export interface DistributionSegment {
  label: string;
  value: number;
  color: string; // Tailwind color name
}

export interface DistributionBarProps {
  segments: DistributionSegment[];
  height?: "sm" | "md" | "lg";
  showLabels?: boolean;
  showValues?: boolean;
  animate?: boolean;
  className?: string;
}

export function DistributionBar({
  segments,
  height = "md",
  showLabels = true,
  showValues = true,
  animate = true,
  className = "",
}: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const heightClass = {
    sm: "h-4",
    md: "h-6",
    lg: "h-8",
  };

  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    cyan: "bg-cyan-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    pink: "bg-pink-500",
    orange: "bg-orange-500",
  };

  const safeTotal = total || 1;

  return (
    <div className={className}>
      <div className={cn("flex overflow-hidden rounded-full", heightClass[height])}>
        {segments.map((segment, index) => {
          const safeValue = segment.value ?? 0;
          const percentage = (safeValue / safeTotal) * 100;
          return (
            <Tooltip key={segment.label}>
              <TooltipTrigger asChild>
                <motion.div
                  className={cn(
                    "flex cursor-help items-center justify-center",
                    colorClasses[segment.color] || "bg-gray-500"
                  )}
                  initial={animate ? { width: 0 } : undefined}
                  animate={{ width: `${percentage}%` }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.1,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  {showValues && percentage >= 10 && (
                    <span className="text-xs font-medium text-white">{percentage.toFixed(0)}%</span>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{segment.label}</p>
                <p className="text-muted-foreground text-xs">
                  {percentage.toFixed(1)}% ({safeValue.toLocaleString()})
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {showLabels && (
        <div className="mt-2 flex flex-wrap gap-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-1.5">
              <div
                className={cn("h-3 w-3 rounded-full", colorClasses[segment.color] || "bg-gray-500")}
              />
              <span className="text-muted-foreground text-xs">{segment.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
