"use client";

import React from "react";
import { motion } from "motion/react";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Minus,
  InfoCircle as Info,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { useFormattedAnimatedValue, MOTION_VARIANTS } from "./animation-utils";
import type { MetricCardProps } from "./types";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { TextureOverlay } from "~/components/ui/texture-overlay";

export function MetricCard({
  label,
  value,
  unit,
  description,
  icon: Icon,
  sectionId,
  theme,
  trend,
  change,
  changeUnit,
  className,
  texture,
  textureOpacity,
  tooltip,
  precision,
}: MetricCardProps) {
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  const numericValue = typeof value === "number" ? value : 0;
  const isNumeric = typeof value === "number";
  const safeValue = value ?? 0;

  // Animated value for smooth number transitions with fast response
  const animatedValue = useFormattedAnimatedValue(
    numericValue,
    isNumeric && precision !== undefined ? (val) => val.toFixed(precision) : undefined,
    { enabled: true, duration: 400, easing: "easeOut", delay: 0 } // Fast animation config
  );

  // Get trend icon and color
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="text-green h-4 w-4" />;
      case "down":
        return <TrendingDown className="text-red h-4 w-4" />;
      default:
        return <Minus className="text-label-secondary h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green";
      case "down":
        return "text-red";
      default:
        return "text-label-secondary";
    }
  };

  return (
    <motion.div
      {...MOTION_VARIANTS.scaleIn}
      className={cn(
        "rounded-control hover:shadow-floating relative overflow-hidden p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
        getGlassClasses("base", resolvedTheme, sectionId),
        className
      )}
      style={cssVars as React.CSSProperties}
    >
      {texture && texture !== "none" && (
        <TextureOverlay texture={texture} opacity={textureOpacity ?? 0.03} />
      )}

      {/* Header with Icon and Label */}
      <div className="relative z-10 mb-3 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="rounded-control shrink-0 p-2"
              style={{ backgroundColor: colors.background }}
            >
              <Icon className="h-5 w-5" style={{ color: colors.primary }} />
            </motion.div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-label text-headline truncate">{label}</h3>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-label-secondary hover:text-green cursor-pointer p-0.5 transition-colors focus:outline-none">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-footnote max-w-[250px] px-3 py-2 font-normal"
                  >
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {description && (
              <p className="text-label-secondary text-footnote mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        </div>

        {/* Trend Indicator */}
        {trend && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="shrink-0"
          >
            {getTrendIcon()}
          </motion.div>
        )}
      </div>

      {/* Main Value */}
      <div className="relative z-10 mb-2">
        <div className="flex flex-wrap items-baseline gap-1">
          <motion.span className="text-label text-title-1" style={{ color: colors.primary }}>
            {isNumeric ? animatedValue : safeValue}
          </motion.span>

          {unit && <span className="text-label-secondary text-body font-medium">{unit}</span>}
        </div>
      </div>

      {/* Change Indicator */}
      {change !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-body relative z-10 flex items-center gap-1"
        >
          <span className={cn("font-bold", getTrendColor())}>
            {change > 0 ? "+" : ""}
            {!isNaN(change) ? change.toFixed(1) : "0"}
            {changeUnit}
          </span>
          <span className="text-label-secondary">from previous</span>
        </motion.div>
      )}

      {/* Animated Background Glow on Hover */}
      <motion.div
        className="rounded-control pointer-events-none absolute inset-0 z-0 opacity-0"
        whileHover={{ opacity: 0.1 }}
        style={{ backgroundColor: colors.primary }}
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
}
