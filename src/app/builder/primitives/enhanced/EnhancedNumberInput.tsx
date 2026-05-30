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
  dynamicStep?: boolean;
}

function formatInputOnTheFly(val: string): string {
  if (!val || val === "-") return val;

  // Clean value by removing spaces and any currency symbols
  let cleaned = val.replace(/[$€£¥\s]/g, "");

  // Check for leading minus sign
  const hasMinus = cleaned.startsWith("-");
  if (hasMinus) {
    cleaned = cleaned.slice(1);
  }

  // Extract suffix (K, M, B, T) at the end
  const suffixMatch = cleaned.match(/([KMBTkmbt])$/);
  const suffix = suffixMatch ? suffixMatch[1]!.toUpperCase() : "";
  let mainPart = suffix ? cleaned.slice(0, -1) : cleaned;

  // Strip any commas from the main part
  mainPart = mainPart.replace(/,/g, "");

  // Separate integer and decimal portions
  const dotIndex = mainPart.indexOf(".");
  let integerPart = mainPart;
  let decimalPart = "";

  if (dotIndex !== -1) {
    integerPart = mainPart.slice(0, dotIndex);
    decimalPart = mainPart.slice(dotIndex);
  }

  // Clean integer part to contain only digits
  const cleanInteger = integerPart.replace(/\D/g, "");

  // Format the integer part with commas
  let formattedInteger = cleanInteger;
  if (cleanInteger) {
    formattedInteger = Number(cleanInteger).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  } else if (integerPart === "" && dotIndex !== -1) {
    formattedInteger = "";
  }

  // Clean decimal part to contain only dot and digits
  let cleanDecimal = decimalPart;
  if (decimalPart) {
    const decimalDigits = decimalPart.slice(1).replace(/\D/g, "");
    cleanDecimal = "." + decimalDigits;
  }

  return (hasMinus ? "-" : "") + formattedInteger + cleanDecimal + suffix;
}

function getDynamicStep(val: number, defaultStep: number = 1): number {
  const absVal = Math.abs(val);
  if (absVal === 0) return defaultStep;
  const targetStep = absVal * 0.1;
  const stepMagnitude = Math.pow(10, Math.floor(Math.log10(targetStep)));
  if (stepMagnitude === 0) return defaultStep;
  const rawRatio = targetStep / stepMagnitude;
  let roundedRatio = 1;
  if (rawRatio >= 5) roundedRatio = 5;
  else if (rawRatio >= 2) roundedRatio = 2;
  return Math.max(defaultStep, roundedRatio * stepMagnitude);
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
  dynamicStep = false,
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
    if (acceptText) {
      setDisplayValue(e.target.value);
      return;
    }

    const input = e.target;
    const rawValue = input.value;

    // Capture cursor position from the right side of the input (to avoid comma shifts moving the cursor)
    const selectionStart = input.selectionStart || 0;
    const lengthBefore = rawValue.length;

    const formatted = formatInputOnTheFly(rawValue);

    setDisplayValue(formatted);

    // Restore cursor position in the next tick
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const suffixLengthBefore = lengthBefore - selectionStart;
        const newSelectionStart = Math.max(0, formatted.length - suffixLengthBefore);
        inputRef.current.setSelectionRange(newSelectionStart, newSelectionStart);
      }
    });
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

    if (!acceptText) {
      const cleanValue = formatInputOnTheFly(displayValue);
      setDisplayValue(cleanValue);
    }

    // Select all text when focusing for easier editing
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  };

  const handleIncrement = () => {
    if (isNumeric) {
      const currentStep = dynamicStep ? getDynamicStep(numericValue, safeStep) : safeStep;
      const newValue = Math.min(max, numericValue + currentStep);
      onChange(newValue);

      const formatted = isFocused
        ? formatInputOnTheFly(newValue.toString())
        : typeof format === "function"
          ? format(newValue)
          : newValue.toFixed(precision);
      setDisplayValue(formatted);
    }
  };

  const handleDecrement = () => {
    if (isNumeric) {
      const currentStep = dynamicStep ? getDynamicStep(numericValue, safeStep) : safeStep;
      const newValue = Math.max(min, numericValue - currentStep);
      onChange(newValue);

      const formatted = isFocused
        ? formatInputOnTheFly(newValue.toString())
        : typeof format === "function"
          ? format(newValue)
          : newValue.toFixed(precision);
      setDisplayValue(formatted);
    }
  };

  const handleReset = () => {
    if (resetValue !== undefined) {
      onChange(resetValue);

      const formatted = isFocused
        ? formatInputOnTheFly(resetValue.toString())
        : typeof format === "function"
          ? format(resetValue)
          : Number(resetValue).toFixed(precision);
      setDisplayValue(formatted);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    } else if (e.key === "Backspace" && !acceptText) {
      const input = inputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;

        if (start === end && start > 0) {
          const charToDelete = displayValue[start - 1];
          if (charToDelete === ",") {
            e.preventDefault();
            // Delete comma and the digit before it
            const before = displayValue.slice(0, start - 2);
            const after = displayValue.slice(start);
            const combined = before + after;
            const formatted = formatInputOnTheFly(combined);

            setDisplayValue(formatted);

            const lengthBefore = displayValue.length;
            const suffixLengthBefore = lengthBefore - start;
            requestAnimationFrame(() => {
              if (inputRef.current) {
                const newStart = Math.max(0, formatted.length - suffixLengthBefore);
                inputRef.current.setSelectionRange(newStart, newStart);
              }
            });
          }
        }
      }
    } else if (e.key === "Delete" && !acceptText) {
      const input = inputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;

        if (start === end && start < displayValue.length) {
          const charToDelete = displayValue[start];
          if (charToDelete === ",") {
            e.preventDefault();
            // Delete comma and the digit after it
            const before = displayValue.slice(0, start);
            const after = displayValue.slice(start + 2);
            const combined = before + after;
            const formatted = formatInputOnTheFly(combined);

            setDisplayValue(formatted);

            const lengthBefore = displayValue.length;
            const suffixLengthBefore = lengthBefore - start;
            const newSuffixLength = Math.max(0, suffixLengthBefore - 2);
            requestAnimationFrame(() => {
              if (inputRef.current) {
                const newStart = Math.max(0, formatted.length - newSuffixLength);
                inputRef.current.setSelectionRange(newStart, newStart);
              }
            });
          }
        }
      }
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

      <div className="relative w-full">
        {/* Main Input Container */}
        <div
          className={cn(
            "relative w-full",
            "rounded-lg transition-all duration-200 ease-out",
            "border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
            "hover:border-white/[0.12] hover:bg-white/[0.04] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.03]",
            "shadow-[0_1.5px_3px_rgba(0,0,0,0.04)] hover:shadow-xs dark:shadow-[0_1.5px_3px_rgba(0,0,0,0.2)]",
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

          <div className="relative flex w-full items-center justify-between pr-1.5">
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
                "min-w-0 flex-1 border-none bg-transparent outline-none",
                acceptText ? "font-sans" : "font-mono",
                "text-foreground placeholder:text-muted-foreground/60",
                "font-medium",
                sizeClasses[size],
                !isEditing && "cursor-pointer"
              )}
            />

            {/* Unit Display */}
            {unit && displayValue && !isEditing && (
              <span className="text-muted-foreground mx-2 shrink-0 text-sm">{unit}</span>
            )}

            {/* Action Buttons */}
            {showButtons && (
              <div className="z-10 flex shrink-0 items-center gap-0.5">
                {/* Divider Line */}
                <div className="mx-1 h-4 w-[1px] shrink-0 bg-white/10 dark:bg-white/5" />

                <motion.button
                  type="button"
                  onClick={handleDecrement}
                  disabled={disabled || Number(value) <= min}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex items-center justify-center rounded transition-all",
                    "hover:bg-white/[0.08] hover:text-[var(--primitive-primary)] dark:hover:bg-white/[0.05]",
                    "h-6 w-6",
                    "disabled:cursor-not-allowed disabled:opacity-20",
                    "text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Minus className="h-3.5 w-3.5" />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={handleIncrement}
                  disabled={disabled || Number(value) >= max}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex items-center justify-center rounded transition-all",
                    "hover:bg-white/[0.08] hover:text-[var(--primitive-primary)] dark:hover:bg-white/[0.05]",
                    "h-6 w-6",
                    "disabled:cursor-not-allowed disabled:opacity-20",
                    "text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </motion.button>

                {showReset && resetValue !== undefined && (
                  <motion.button
                    type="button"
                    onClick={handleReset}
                    disabled={disabled}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex items-center justify-center rounded transition-all",
                      "hover:bg-white/[0.08] hover:text-[var(--primitive-primary)] dark:hover:bg-white/[0.05]",
                      "h-6 w-6",
                      "disabled:cursor-not-allowed disabled:opacity-20",
                      "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </div>
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
