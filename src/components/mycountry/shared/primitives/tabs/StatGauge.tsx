"use client";

import React from "react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Minus,
  InfoCircle as Info,
} from "iconoir-react";

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
  color?: "emerald" | "green" | "blue" | "indigo" | "purple" | "red" | "amber" | "cyan";
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
}

// Color configurations
const colorConfig = {
  emerald: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-green",
  },
  green: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-green",
  },
  blue: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-blue",
  },
  indigo: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-indigo",
  },
  purple: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-indigo",
  },
  red: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-red",
  },
  amber: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-yellow",
  },
  cyan: {
    iconBg: "",
    text: "text-label",
    bg: "bg-fill-3",
    border: "border-separator",
    progress: "bg-cyan",
  },
};

// Size configurations
const sizeConfig = {
  sm: {
    value: "text-title-2",
    label: "text-footnote",
    icon: "h-4 w-4",
    padding: "p-3",
    progress: "h-1.5",
  },
  md: {
    value: "text-title-2",
    label: "text-footnote",
    icon: "h-4 w-4",
    padding: "p-3",
    progress: "h-1.5",
  },
  lg: {
    value: "text-large-title",
    label: "text-body",
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

    if (thresholds.high && safeValue >= thresholds.high) return "bg-green";
    if (thresholds.medium && safeValue >= thresholds.medium) return "bg-yellow";
    if (thresholds.low && safeValue >= thresholds.low) return "bg-yellow";
    return "bg-red";
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
          "text-footnote flex items-center gap-1",
          isPositive ? "text-green" : "text-red"
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
        "rounded-row border transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:scale-[1.02]",
        colors.bg,
        colors.border,
        sizes.padding,
        className
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn(sizes.icon, "text-label-secondary")} />}
          <div>
            <div className="flex items-center gap-1">
              <span className={cn(sizes.label, "text-label-secondary font-medium")}>{label}</span>
              {description && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-label-secondary h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-footnote">{description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <TrendIcon />
          </div>
        </div>
      </div>

      <div className={cn(sizes.value, "font-semibold", colors.text)}>
        {animate ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
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

      <div className={cn("bg-fill-3 mt-2 overflow-hidden rounded-full", sizes.progress)}>
        <motion.div
          className={cn("h-full rounded-full", getStatusColor())}
          initial={animate ? { width: 0 } : undefined}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        />
      </div>

      {safeMax !== 100 && (
        <p className="text-label-secondary text-footnote mt-1">
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
          transition={{ duration: 0.25, delay: index * 0.1 }}
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
    green: "bg-green",
    emerald: "bg-green",
    blue: "bg-blue",
    indigo: "bg-indigo",
    purple: "bg-indigo",
    violet: "bg-indigo",
    red: "bg-red",
    amber: "bg-yellow",
    orange: "bg-yellow",
    cyan: "bg-cyan",
    pink: "bg-blue",
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
                    colorClasses[segment.color] || "bg-fill"
                  )}
                  initial={animate ? { width: 0 } : undefined}
                  animate={{ width: `${percentage}%` }}
                  transition={{
                    duration: 0.25,
                    delay: index * 0.03,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  {showValues && percentage >= 10 && (
                    <span className="text-caption text-white">{percentage.toFixed(0)}%</span>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{segment.label}</p>
                <p className="text-label-secondary text-footnote">
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
            <div key={segment.label} className="flex items-center gap-2">
              <div
                className={cn("h-3 w-3 rounded-full", colorClasses[segment.color] || "bg-fill")}
              />
              <span className="text-label-secondary text-footnote">{segment.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
