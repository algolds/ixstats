"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { cn, debounce } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import type { EnhancedInputProps } from "./types";
import { FieldHelpTooltip } from "../../components/help/FieldHelpTooltip";
import { ChangedFieldDot } from "../ChangedFieldDot";
import { EditPencil as Edit3, ControlSlider as Sliders } from "iconoir-react";
import { Button } from "~/components/ui/button";

interface SliderWithDirectInputProps extends EnhancedInputProps {
  orientation?: "horizontal" | "vertical";
  showTicks?: boolean;
  tickCount?: number;
  showValue?: boolean;
  showRange?: boolean;
  trackHeight?: number;
  thumbSize?: number;
  icon?: React.ComponentType<{ className?: string }>;
  helpContent?: React.ReactNode;
  helpTitle?: string;
  defaultMode?: "slider" | "input";
  allowModeToggle?: boolean;
  onCommit?: (value: number) => void;
  valueClassName?: string;
  labelClassName?: string;
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
  // oxlint-disable-next-line eslint/no-unused-vars
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
  onCommit,
  valueClassName,
  labelClassName,
}: SliderWithDirectInputProps) {
  const [inputMode, setInputMode] = useState<"slider" | "input">(defaultMode);
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // oxlint-disable-next-line eslint/no-unused-vars
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

  // Sync local value when external value changes (only if not focused or dragging)
  useEffect(() => {
    if (!isFocused && !isDragging) {
      setLocalValue(numericValue.toFixed(precision));
    }
  }, [numericValue, precision, isFocused, isDragging]);

  // Stable debounced onChange for active slider dragging
  const debouncedOnChange = useMemo(
    () =>
      debounce((val: number) => {
        onChange(val);
      }, 16),
    [onChange]
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  // Size configurations
  const config = {
    track: trackHeight || (size === "sm" ? 8 : size === "lg" ? 16 : 12),
    thumb: thumbSize || (size === "sm" ? 20 : size === "lg" ? 32 : 24),
    input: size === "sm" ? "text-body" : size === "lg" ? "text-title-3" : "text-body",
  };

  // Calculate percentage position for slider based on localValue
  const percentage = (((parseFloat(localValue) || safeMin) - safeMin) / (safeMax - safeMin)) * 100;

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
    if (onCommit) {
      onCommit(numericValue);
    }
  }, [numericValue, precision, onCommit]);

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue)) {
        setLocalValue(newValue.toFixed(precision));
        debouncedOnChange(newValue);
      }
    },
    [precision, debouncedOnChange]
  );

  // Handle slider drag end
  const handleSliderDragEnd = useCallback(() => {
    setIsDragging(false);
    debouncedOnChange.cancel();
    const finalValue = parseFloat(localValue);
    if (!isNaN(finalValue)) {
      onChange(finalValue);
      if (onCommit) {
        onCommit(finalValue);
      }
    }
  }, [onChange, localValue, debouncedOnChange, onCommit]);

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
    referenceValue !== undefined ? ((referenceValue - safeMin) / (safeMax - safeMin)) * 100 : null;

  return (
    <div className={cn("space-y-3", className)} style={cssVars as React.CSSProperties}>
      {/* Label and Value Header */}
      {(label || showValue || description) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            {label && (
              <label
                className={cn(
                  "text-label text-body flex items-center gap-2 font-medium",
                  labelClassName
                )}
              >
                {Icon && <Icon className="text-label-secondary h-4 w-4 shrink-0" />}
                <span>{label}</span>
                <ChangedFieldDot name={label} value={numericValue} />
                {required && <span className="text-red">*</span>}
                {helpContent && (
                  <FieldHelpTooltip content={helpContent} title={helpTitle || label} />
                )}
              </label>
            )}
            <div className="flex shrink-0 items-center gap-2">
              {showValue && (
                <div
                  className={cn(
                    "rounded-control border-separator bg-background text-headline text-label inline-flex items-center gap-2 border px-3 py-1 tabular-nums shadow-2xs",
                    valueClassName
                  )}
                >
                  <NumberFlow
                    value={!isNaN(parseFloat(localValue)) ? parseFloat(localValue) : 0}
                    format={{
                      minimumFractionDigits: precision,
                      maximumFractionDigits: precision,
                    }}
                  />
                  {unit && (
                    <span className="text-label-secondary text-footnote font-normal">{unit}</span>
                  )}
                </div>
              )}
              {allowModeToggle && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => setInputMode(inputMode === "slider" ? "input" : "slider")}
                  className="text-label-secondary hover:text-label"
                  title={inputMode === "slider" ? "Switch to direct input" : "Switch to slider"}
                  aria-label={
                    inputMode === "slider" ? "Switch to direct input" : "Switch to slider"
                  }
                  disabled={disabled}
                >
                  {inputMode === "slider" ? (
                    <Edit3 className="h-3.5 w-3.5" />
                  ) : (
                    <Sliders className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {description && (
            <p className="text-label-secondary text-footnote leading-relaxed">{description}</p>
          )}
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
              "rounded-control w-full border px-4 py-3 md:py-3",
              "bg-surface",
              "text-label placeholder-muted-foreground",
              "border-separator",
              "focus:border-blue/60 focus:ring-blue/20 focus:ring-2 focus:outline-none",
              "hover:shadow-card",
              "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
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
            <span className="text-label-secondary text-body pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
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
              "bg-fill-2",
              "border-separator border",
              "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-out",
              orientation === "horizontal" ? "w-full" : "mx-auto h-40 w-fit"
            )}
            style={{
              [orientation === "horizontal" ? "height" : "width"]: `${config.track}px`,
            }}
          >
            {/* Background Track */}
            <div
              className={cn(
                "absolute inset-0 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
                getGlassClasses("base", resolvedTheme, sectionId)
              )}
            />

            {/* Progress Track */}
            <motion.div
              className={cn(
                "absolute rounded-full",
                !isDragging &&
                  "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
                isDragging && "shadow-floating scale-[1.02]",
                "bg-blue"
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
                className="bg-label-tertiary absolute h-full w-0.5 opacity-60"
                style={{
                  [orientation === "horizontal" ? "left" : "bottom"]: `${referencePercentage}%`,
                }}
              />
            )}

            {/* Tick Marks */}
            {ticks.map((tick, index) => (
              <div
                key={index}
                className="bg-separator-opaque absolute h-2 w-px -translate-x-1/2"
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
              value={parseFloat(localValue) || safeMin}
              onChange={handleSliderChange}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={handleSliderDragEnd}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={handleSliderDragEnd}
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
            <div className="text-label-secondary text-footnote mt-2 flex justify-between">
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
              className="text-label-secondary text-footnote mt-2"
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
