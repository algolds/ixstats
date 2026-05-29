"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionTemplate } from "motion/react";
import { Minus, Plus, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { useFormattedAnimatedValue, DEFAULT_ANIMATIONS } from "./animation-utils";
import { parseNumberInput } from "~/lib/format-utils";
import type { EnhancedInputProps } from "./types";
import { FieldHelpTooltip } from "../../components/help/GovernmentHelpSystem";

interface EnhancedNumberInputProps extends Omit<EnhancedInputProps, "value" | "onChange"> {
  value: number | string;
  onChange: (value: number | string) => void;
  format?: (value: number | string) => string;
  showButtons?: boolean;
  showReset?: boolean;
  resetValue?: number | string;
  placeholder?: string;
  icon?: React.ComponentType<any>;
  acceptText?: boolean; // Allow text input for names, etc.
  helpContent?: React.ReactNode;
  helpTitle?: string;
}

export function EnhancedNumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  precision = 0,
  label,
  description,
  unit,
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
  format,
  showButtons = true,
  showReset = false,
  resetValue,
  placeholder,
  icon: Icon,
  acceptText = false,
  helpContent,
  helpTitle,
}: EnhancedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  // Safely handle all numeric parameters
  const safeMin = typeof min === "number" && !isNaN(min) ? min : 0;
  const safeMax = typeof max === "number" && !isNaN(max) ? max : Infinity;
  const safeStep = typeof step === "number" && !isNaN(step) ? step : 1;

  // Safely handle numeric values with NaN protection
  const numericValue =
    typeof value === "number" && !isNaN(value)
      ? value
      : typeof value === "string" && !acceptText && !isNaN(parseFloat(value))
        ? parseFloat(value)
        : safeMin;
  const isNumeric = typeof value === "number" && !acceptText;

  // Animated value for smooth transitions (only for numeric values)
  const animatedValue = useFormattedAnimatedValue(numericValue, isNumeric ? format : undefined, {
    ...DEFAULT_ANIMATIONS.numberFlow,
    duration: animationDuration,
  });

  const sizeClasses = {
    sm: "text-sm px-3 py-2 h-10",
    md: "text-base px-4 py-3 h-12",
    lg: "text-lg px-5 py-4 h-14",
  };

  const buttonSizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  // Update display value when value prop changes
  useEffect(() => {
    if (!isEditing && !isFocused) {
      // Force convert any value to number or string
      let processedValue = value;

      // If value is an object, try to extract a number from it
      if (typeof value === "object" && value !== null) {
        // Try common object properties that might contain the actual value
        if ("value" in value) processedValue = (value as any).value;
        else if ("amount" in value) processedValue = (value as any).amount;
        else if ("number" in value) processedValue = (value as any).number;
        else processedValue = 0; // fallback
      }

      // Convert to number if not acceptText mode
      if (!acceptText) {
        const numValue = Number(processedValue);
        if (!isNaN(numValue)) {
          if (typeof format === "function") {
            setDisplayValue(format(numValue));
          } else {
            setDisplayValue(numValue.toFixed(precision));
          }
        } else {
          setDisplayValue("0");
        }
      } else {
        // Text mode - convert everything to string
        setDisplayValue(String(processedValue || ""));
      }
    }
  }, [value, precision, isEditing, isFocused, acceptText, format]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    // Don't call onChange here - wait for blur to avoid feedback loops
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    setIsFocused(false);

    if (acceptText || typeof value === "string") {
      onChange(displayValue);
    } else {
      // Use smart number parser to handle "1.5M", "50k", "1,000,000", etc.
      const numericValue = parseNumberInput(displayValue);

      if (!isNaN(numericValue)) {
        // Only clamp if the value is extremely outside bounds
        // Allow values between 0 and max, but warn if below min
        const clampedValue = numericValue < 0 ? 0 : numericValue > max ? max : numericValue;
        onChange(clampedValue);

        // Keep the exact number as-is (don't format until focus for better UX)
        // This preserves the user's exact input like "1500000" instead of converting to "1.5M"
        setDisplayValue(
          clampedValue.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        );
      } else {
        const fallbackValue = typeof value === "number" ? value : 0;
        setDisplayValue(
          fallbackValue.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        );
      }
    }
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    setIsFocused(true);
    // Select all text when focusing for easier editing
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  };

  const handleIncrement = () => {
    if (isNumeric) {
      const newValue = Math.min(max, numericValue + step);
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    if (isNumeric) {
      const newValue = Math.max(min, numericValue - step);
      onChange(newValue);
    }
  };

  const handleReset = () => {
    if (resetValue !== undefined) {
      onChange(resetValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      // Reset to original value on escape
      setIsEditing(false);
      setIsFocused(false);
      const originalValue = typeof value === "number" ? value : 0;
      if (typeof format === "function") {
        setDisplayValue(format(originalValue));
      } else {
        setDisplayValue(originalValue.toFixed(precision));
      }
      inputRef.current?.blur();
    }
  };

  // Calculate comparison with reference value
  const comparisonData =
    showComparison && referenceValue !== undefined && typeof value === "number"
      ? {
          difference: Number(value) - referenceValue,
          percentage:
            referenceValue !== 0 ? ((Number(value) - referenceValue) / referenceValue) * 100 : 0,
          trend:
            Number(value) > referenceValue
              ? ("up" as const)
              : Number(value) < referenceValue
                ? ("down" as const)
                : ("neutral" as const),
        }
      : null;

  const glassFocusClass = isFocused
    ? `border-[${colors.primary}] shadow-[0_0_0_3px_${colors.primary}20]`
    : "";

  return (
    <div className={cn("space-y-2", className)} style={cssVars as React.CSSProperties}>
      {/* Label and Description */}
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {required && <span className="text-red-400">*</span>}
              {helpContent && <FieldHelpTooltip content={helpContent} title={helpTitle || label} />}
            </label>
          )}
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {/* Main Input Container */}
        <div
          className={cn(
            "relative flex-1",
            "rounded-lg transition-all duration-200 ease-out",
            "border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
            "hover:border-white/[0.12] hover:bg-white/[0.04] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.03]",
            "focus-within:border-[var(--primitive-primary)]/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_10px_rgba(var(--primitive-primary),0.15)]",
            isEditing &&
              "border-[var(--primitive-primary)]/50 bg-white/[0.05] shadow-[0_0_10px_rgba(var(--primitive-primary),0.15)]",
            glassFocusClass,
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {/* Animated Background Gradient */}
          <motion.div
            className="absolute inset-0 rounded-lg opacity-0 transition-opacity"
            style={{
              background: useMotionTemplate`linear-gradient(135deg, ${colors.background}, transparent)`,
            }}
            animate={{ opacity: isFocused ? 1 : 0 }}
          />

          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={displayValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (acceptText ? "Enter text..." : "Enter number...")}
              disabled={disabled}
              className={cn(
                "w-full border-none bg-transparent outline-none",
                acceptText ? "font-sans" : "font-mono",
                "text-foreground placeholder:text-muted-foreground/60",
                "font-medium",
                sizeClasses[size],
                showButtons && "pr-2",
                !isEditing && "cursor-pointer"
              )}
            />

            {/* Unit Display */}
            {unit && displayValue && !isEditing && (
              <span className="text-muted-foreground ml-1 text-sm">{unit}</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {showButtons && (
          <div className="flex items-center gap-1">
            <motion.button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || Number(value) <= min}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex items-center justify-center rounded-lg transition-all",
                "border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
                "hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-[var(--primitive-primary)]",
                buttonSizeClasses[size],
                "disabled:cursor-not-allowed disabled:opacity-30",
                "text-foreground"
              )}
            >
              <Minus className="h-4 w-4" />
            </motion.button>

            <motion.button
              type="button"
              onClick={handleIncrement}
              disabled={disabled || Number(value) >= max}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex items-center justify-center rounded-lg transition-all",
                "border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
                "hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-[var(--primitive-primary)]",
                buttonSizeClasses[size],
                "disabled:cursor-not-allowed disabled:opacity-30",
                "text-foreground"
              )}
            >
              <Plus className="h-4 w-4" />
            </motion.button>

            {showReset && resetValue !== undefined && (
              <motion.button
                type="button"
                onClick={handleReset}
                disabled={disabled}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-all",
                  "border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
                  "hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-[var(--primitive-primary)]",
                  buttonSizeClasses[size],
                  "disabled:cursor-not-allowed disabled:opacity-30",
                  "text-foreground"
                )}
              >
                <RotateCcw className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Comparison Display */}
      {comparisonData && referenceLabel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            getGlassClasses("base", resolvedTheme, sectionId)
          )}
        >
          {comparisonData.trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
          {comparisonData.trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}

          <span className="text-foreground">
            vs {referenceLabel}:
            <span
              className={cn(
                "ml-1 font-bold",
                comparisonData.trend === "up" && "text-green-500",
                comparisonData.trend === "down" && "text-red-500"
              )}
            >
              {comparisonData.difference > 0 ? "+" : ""}
              {format
                ? format(comparisonData.difference)
                : comparisonData.difference.toFixed(precision)}
              {unit}
            </span>
            <span className="text-muted-foreground ml-1">
              ({comparisonData.percentage > 0 ? "+" : ""}
              {comparisonData.percentage.toFixed(1)}%)
            </span>
          </span>
        </motion.div>
      )}
    </div>
  );
}
