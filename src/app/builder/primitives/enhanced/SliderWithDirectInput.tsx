"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { useAnimatedPercentage, DEFAULT_ANIMATIONS } from "./animation-utils";
import type { EnhancedInputProps } from "./types";
import { FieldHelpTooltip } from "../../components/help/GovernmentHelpSystem";
import { Edit3, Sliders } from "lucide-react";

interface SliderWithDirectInputProps extends EnhancedInputProps {
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
  defaultMode?: "slider" | "input";
  allowModeToggle?: boolean;
}

export function SliderWithDirectInput({
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
  defaultMode = "input",
  allowModeToggle = true,
}: SliderWithDirectInputProps) {
  const [inputMode, setInputMode] = useState<"slider" | "input">(defaultMode);
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  // Sync local value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(numericValue.toFixed(precision));
    }
  }, [numericValue, precision, isFocused]);

  // Size configurations
  const config = {
    track: trackHeight || (size === "sm" ? 8 : size === "lg" ? 16 : 12),
    thumb: thumbSize || (size === "sm" ? 20 : size === "lg" ? 32 : 24),
    input: size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
  };

  // Calculate percentage position for slider
  const percentage = ((numericValue - safeMin) / (safeMax - safeMin)) * 100;

  // Handle input change
  const handleInputChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      // Parse and validate
      const parsed = parseFloat(newValue);
      if (!isNaN(parsed)) {
        // Clamp to min/max
        const clamped = Math.max(safeMin, Math.min(safeMax, parsed));
        // Round to step
        const stepped = Math.round(clamped / safeStep) * safeStep;
        onChange(stepped);
      }
    },
    [safeMin, safeMax, safeStep, onChange]
  );

  // Handle input blur (format value)
  const handleInputBlur = useCallback(() => {
    setIsFocused(false);
    setLocalValue(numericValue.toFixed(precision));
  }, [numericValue, precision]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onChange(newValue);
    },
    [onChange]
  );

  // Generate tick marks
  const ticks = showTicks
    ? Array.from({ length: tickCount }, (_, i) => {
        const tickValue = safeMin + (i / (tickCount - 1)) * (safeMax - safeMin);
        const tickPercentage = ((tickValue - safeMin) / (safeMax - safeMin)) * 100;
        return { value: tickValue, percentage: tickPercentage };
      })
    : [];

  // Reference value position if provided
  const referencePercentage =
    referenceValue !== undefined
      ? ((referenceValue - safeMin) / (safeMax - safeMin)) * 100
      : null;

  return (
    <div className={cn("space-y-3", className)} style={cssVars as React.CSSProperties}>
      {/* Label and Value Header */}
      {(label || showValue || description) && (
        <div className="space-y-1">
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
            <div className="flex items-center gap-2">
              {showValue && (
                <motion.div className="text-foreground flex items-center gap-1 text-sm font-semibold">
                  <span>{!isNaN(numericValue) ? numericValue.toFixed(precision) : "0"}</span>
                  {unit && <span className="text-muted-foreground">{unit}</span>}
                </motion.div>
              )}
              {allowModeToggle && (
                <button
                  type="button"
                  onClick={() => setInputMode(inputMode === "slider" ? "input" : "slider")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    "hover:bg-accent/50 active:bg-accent/70",
                    "text-muted-foreground hover:text-foreground"
                  )}
                  title={inputMode === "slider" ? "Switch to input mode" : "Switch to slider mode"}
                  disabled={disabled}
                >
                  {inputMode === "slider" ? (
                    <Edit3 className="h-3.5 w-3.5" />
                  ) : (
                    <Sliders className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      )}

      {/* Input Mode: Direct Number Input */}
      {inputMode === "input" && (
        <div className="relative">
          <input
            type="number"
            min={safeMin}
            max={safeMax}
            step={safeStep}
            value={isFocused ? localValue : numericValue.toFixed(precision)}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setLocalValue(numericValue.toString());
            }}
            onBlur={handleInputBlur}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border px-4 py-3 md:py-2.5",
              "bg-card/50 backdrop-blur-sm",
              "text-foreground placeholder-muted-foreground",
              "border-gray-200/40 dark:border-gray-700/40",
              "focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 focus:outline-none",
              "transition-all duration-200",
              config.input,
              "font-mono", // Monospace for better number alignment
              disabled && "cursor-not-allowed opacity-60",
              unit && "pr-16" // Make room for unit suffix
            )}
            style={{
              fontSize: "16px", // Prevent iOS zoom
            }}
          />
          {unit && (
            <span className="text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      )}

      {/* Slider Mode: Visual Slider */}
      {inputMode === "slider" && (
        <div className={cn("relative px-2", orientation === "vertical" && "flex justify-center")}>
          {/* Track Container */}
          <div
            className={cn(
              "relative overflow-hidden rounded-full will-change-transform",
              "bg-gray-100/80 dark:bg-gray-800/80",
              "border border-gray-200/40 dark:border-gray-700/40",
              "transition-all duration-300 ease-out",
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
                getGlassClasses("base", resolvedTheme, sectionId)
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

            {/* Input Overlay (Native Slider) */}
            <input
              type="range"
              min={safeMin}
              max={safeMax}
              step={safeStep}
              value={numericValue}
              onChange={handleSliderChange}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              disabled={disabled}
              className={cn(
                "absolute inset-0 h-full w-full cursor-pointer opacity-0",
                "disabled:cursor-not-allowed",
                "touch-manipulation" // Better mobile handling
              )}
              style={{
                WebkitTapHighlightColor: "transparent",
              }}
            />
          </div>

          {/* Range Display */}
          {showRange && (
            <div className="text-muted-foreground mt-2 flex justify-between text-xs">
              <span>
                {safeMin}
                {unit}
              </span>
              <span>
                {safeMax}
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
      )}
    </div>
  );
}
