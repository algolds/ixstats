"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { useAnimatedPercentage, DEFAULT_ANIMATIONS } from "./animation-utils";
import type { EnhancedInputProps } from "./types";
import { FieldHelpTooltip } from "../../components/help/GovernmentHelpSystem";

interface EnhancedSliderProps extends EnhancedInputProps {
  orientation?: "horizontal" | "vertical";
  showTicks?: boolean;
  tickCount?: number;
  showValue?: boolean;
  showRange?: boolean;
  trackHeight?: number;
  thumbSize?: number;
  icon?: React.ComponentType<any>;
  helpContent?: React.ReactNode;
  helpTitle?: string;
}

export function EnhancedSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  precision = 1,
  label,
  description,
  unit = "%",
  sectionId,
  theme,
  size = "md",
  disabled = false,
  required = false,
  referenceValue,
  referenceLabel,
  showComparison = false,
  animationDuration = 800,
  className,
  orientation = "horizontal",
  showTicks = false,
  tickCount = 5,
  showValue = true,
  showRange = false,
  trackHeight,
  thumbSize,
  icon: Icon,
  helpContent,
  helpTitle,
}: EnhancedSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  // Ensure all numeric values are safe for calculations
  const safeMin = typeof min === "number" && !isNaN(min) ? min : 0;
  const safeMax = typeof max === "number" && !isNaN(max) ? max : 100;
  const safeStep = typeof step === "number" && !isNaN(step) ? step : 1;
  const numericValue =
    typeof value === "number" && !isNaN(value)
      ? value
      : typeof value === "string" && !isNaN(parseFloat(value))
        ? parseFloat(value)
        : safeMin;

  // Animated percentage for smooth value display with safe calculations
  const range = safeMax - safeMin;
  const animatedPercentage = useAnimatedPercentage(
    range > 0 ? ((numericValue - safeMin) / range) * 100 : 0,
    1,
    { ...DEFAULT_ANIMATIONS.spring, duration: animationDuration }
  );

  // Size configurations - increased thickness
  const config = {
    track: trackHeight || (size === "sm" ? 8 : size === "lg" ? 16 : 12),
    thumb: thumbSize || (size === "sm" ? 20 : size === "lg" ? 32 : 24),
  };

  // Calculate percentage position
  const percentage = ((numericValue - min) / (max - min)) * 100;

  const calculateValueFromPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!trackRef.current) return numericValue;

      const rect = trackRef.current.getBoundingClientRect();

      // Get current mouse/touch position relative to track
      const position = orientation === "horizontal" ? clientX - rect.left : rect.bottom - clientY;

      const trackSize = orientation === "horizontal" ? rect.width : rect.height;

      // For touch events, calculate from current position + delta
      let percentage = (position / trackSize) * 100;

      // Strictly clamp position to track bounds (no out-of-bounds allowed)
      percentage = Math.max(0, Math.min(100, percentage));

      // Calculate new value with proper stepping
      const range = max - min;
      const rawValue = min + (percentage / 100) * range;
      const steppedValue = Math.round(rawValue / step) * step;

      // Immediate onChange call for responsive feedback
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step, orientation, numericValue]
  );

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;

      setIsDragging(true);
      const newValue = calculateValueFromPosition(clientX, clientY);
      onChange(newValue);
    },
    [disabled, calculateValueFromPosition, onChange]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || disabled) return;

      const newValue = calculateValueFromPosition(clientX, clientY);
      onChange(newValue);
    },
    [isDragging, disabled, calculateValueFromPosition, onChange]
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);

      const handleMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      };

      const handleMouseUp = () => {
        handleEnd();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleStart, handleMove, handleEnd]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;

      handleStart(touch.clientX, touch.clientY);

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        handleMove(touch.clientX, touch.clientY);
      };

      const handleTouchEnd = () => {
        handleEnd();
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    },
    [handleStart, handleMove, handleEnd]
  );

  // Handle track clicks
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || isDragging) return;

      const newValue = calculateValueFromPosition(e.clientX, e.clientY);
      onChange(newValue);
    },
    [disabled, isDragging, calculateValueFromPosition, onChange]
  );

  // Generate tick marks
  const ticks = showTicks
    ? Array.from({ length: tickCount }, (_, i) => {
        const tickValue = min + (i / (tickCount - 1)) * (max - min);
        const tickPercentage = ((tickValue - min) / (max - min)) * 100;
        return { value: tickValue, percentage: tickPercentage };
      })
    : [];

  // Reference value position if provided
  const referencePercentage =
    referenceValue !== undefined ? ((referenceValue - min) / (max - min)) * 100 : null;

  return (
    <div className={cn("space-y-3", className)} style={cssVars as React.CSSProperties}>
      {/* Label and Value Header */}
      {(label || showValue || description) && (
        <div className="space-y-1">
          {(label || showValue) && (
            <div className="flex items-center justify-between">
              {label && (
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                  {required && <span className="text-red-400">*</span>}
                  {helpContent && (
                    <FieldHelpTooltip content={helpContent} title={helpTitle || label} />
                  )}
                </label>
              )}
              {showValue && (
                <motion.div className="text-foreground flex items-center gap-1 text-sm">
                  <motion.span>
                    {!isNaN(numericValue) ? numericValue.toFixed(precision) : "0"}
                  </motion.span>
                  {unit && <span className="text-muted-foreground">{unit}</span>}
                </motion.div>
              )}
            </div>
          )}
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      )}

      {/* Slider Container */}
      <div className={cn("relative px-2", orientation === "vertical" && "flex justify-center")}>
        {/* Track */}
        <motion.div
          ref={trackRef}
          onClick={handleTrackClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2, ease: "easeOut" },
          }}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-full will-change-transform",
            "bg-gray-100/80 dark:bg-gray-800/80",
            "border border-gray-200/40 dark:border-gray-700/40",
            "transition-all duration-300 ease-out",
            isHovered && "shadow-lg",
            orientation === "horizontal" ? "w-full" : "mx-auto h-40 w-fit"
          )}
          style={{
            [orientation === "horizontal" ? "height" : "width"]: `${config.track}px`,
          }}
        >
          {/* Background Track */}
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-200",
              getGlassClasses("base", resolvedTheme, sectionId),
              isHovered && "shadow-md"
            )}
          />

          {/* Progress Track */}
          <motion.div
            className={cn(
              "absolute rounded-full transition-all duration-200",
              isDragging && "scale-[1.02] shadow-lg",
              "bg-blue-500 dark:bg-blue-600"
            )}
            style={{
              [orientation === "horizontal" ? "width" : "height"]: `${percentage}%`,
              [orientation === "horizontal" ? "height" : "width"]: "100%",
              [orientation === "horizontal" ? "left" : "bottom"]: 0,
            }}
            animate={{
              opacity: isDragging ? 1 : 0.95,
              scale: isDragging ? 1.02 : 1,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />

          {/* Reference Value Indicator */}
          {referencePercentage !== null && showComparison && (
            <div
              className="absolute h-full w-0.5 bg-[var(--primitive-muted)] opacity-60"
              style={{
                [orientation === "horizontal" ? "left" : "bottom"]: `${referencePercentage}%`,
              }}
            />
          )}

          {/* Tick Marks */}
          {ticks.map((tick, index) => (
            <div
              key={index}
              className="absolute h-2 w-px -translate-x-1/2 bg-[var(--primitive-muted)]/40"
              style={{
                [orientation === "horizontal" ? "left" : "bottom"]: `${tick.percentage}%`,
                [orientation === "horizontal" ? "top" : "left"]: "100%",
              }}
            />
          ))}

          {/* Thumb */}
          <motion.div
            className={cn(
              "absolute cursor-grab rounded-full active:cursor-grabbing",
              "transform-gpu shadow-xl will-change-transform",
              // Apple-style glass effect
              "bg-white/90 dark:bg-gray-800/90",
              "border border-gray-200/50 dark:border-gray-600/50",
              "hover:border-gray-300/70 dark:hover:border-gray-500/70",
              // Smooth transitions
              "transition-[border-color,box-shadow] duration-200 ease-out"
            )}
            style={{
              width: `${config.thumb}px`,
              height: `${config.thumb}px`,
              [orientation === "horizontal" ? "top" : "left"]:
                `${-config.thumb / 2 + config.track / 2}px`,
              transform: orientation === "horizontal" ? "translateX(-50%)" : "translateX(-50%)",
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            animate={{
              [orientation === "horizontal" ? "left" : "bottom"]: `${percentage}%`,
              scale: isDragging ? 1.1 : isHovered ? 1.05 : 1,
            }}
            transition={{
              scale: { duration: 0.15, ease: "easeOut" },
              left: isDragging
                ? {
                    type: "tween",
                    duration: 0.05,
                    ease: "linear",
                  }
                : {
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                    mass: 0.8,
                  },
              bottom: isDragging
                ? {
                    type: "tween",
                    duration: 0.05,
                    ease: "linear",
                  }
                : {
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                    mass: 0.8,
                  },
            }}
          >
            {/* Thumb Inner Dot */}
            <div className="absolute inset-[30%] rounded-full bg-blue-500 opacity-80 dark:bg-blue-400" />
          </motion.div>
        </motion.div>

        {/* Range Display */}
        {showRange && (
          <div className="text-muted-foreground mt-2 flex justify-between text-xs">
            <span>
              {min}
              {unit}
            </span>
            <span>
              {max}
              {unit}
            </span>
          </div>
        )}

        {/* Reference Label */}
        {referenceLabel && showComparison && referenceValue !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground mt-2 text-xs"
          >
            Reference ({referenceLabel}): {referenceValue.toFixed(precision)}
            {unit}
          </motion.div>
        )}
      </div>
    </div>
  );
}
