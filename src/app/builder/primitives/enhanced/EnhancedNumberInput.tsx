"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Minus,
  Plus,
  Undo as RotateCcw,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { parseNumberInput } from "~/lib/utils";
import type { EnhancedInputProps } from "./types";
import { FieldHelpTooltip } from "../../components/help/FieldHelpTooltip";
import { ChangedFieldDot } from "../ChangedFieldDot";

interface EnhancedNumberInputProps extends Omit<EnhancedInputProps, "value" | "onChange"> {
  value: number | string;
  onChange: (value: number | string) => void;
  format?: (value: number | string) => string;
  showButtons?: boolean;
  showReset?: boolean;
  resetValue?: number | string;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  acceptText?: boolean; // Allow text input for names, etc.
  helpContent?: React.ReactNode;
  helpTitle?: string;
  dynamicStep?: boolean;
}

function formatInputOnTheFly(val: string): string {
  if (!val || val === "-") return val;

  // Clean value by removing spaces and any currency symbols (including custom ones)
  let cleaned = val.replace(/[^-\d.KMBTkmbt]/g, "");

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

/** Pulls a number or string out of a value that may be wrapped in an object (`value`, `amount`, `number`). */
function unwrapValue(value: number | string | object | null): number | string {
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, number | string | boolean | undefined>;
  for (const key of ["value", "amount", "number"]) {
    const candidate = record[key];
    if (typeof candidate === "number" || typeof candidate === "string") return candidate;
  }
  return 0;
}

/** The text an idle input shows for `value`. */
function displayTextFor(
  value: number | string,
  {
    acceptText,
    format,
    precision,
  }: Pick<EnhancedNumberInputProps, "acceptText" | "format" | "precision">
): string {
  const unwrapped = unwrapValue(value);
  if (acceptText) return String(unwrapped || "");
  const numValue = Number(unwrapped);
  if (isNaN(numValue)) return "0";
  return typeof format === "function" ? format(numValue) : numValue.toFixed(precision);
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

  const { cssVars } = useSectionTheme(sectionId, theme);

  // Safely handle all numeric parameters
  const safeMin = typeof min === "number" && !isNaN(min) ? min : 0;
  const safeStep = typeof step === "number" && !isNaN(step) ? step : 1;

  // Safely handle numeric values with NaN protection
  const numericValue =
    typeof value === "number" && !isNaN(value)
      ? value
      : typeof value === "string" && !acceptText && !isNaN(parseFloat(value))
        ? parseFloat(value)
        : safeMin;
  const isNumeric = typeof value === "number" && !acceptText;

  const sizeClasses = {
    sm: "text-body px-3 py-2 h-10",
    md: "text-body px-4 py-3 h-12",
    lg: "text-title-3 px-5 py-4 h-14",
  };

  const formatForDisplay = (n: number) =>
    isFocused
      ? formatInputOnTheFly(n.toString())
      : typeof format === "function"
        ? format(n)
        : n.toFixed(precision);

  const formatWholeNumber = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /** Puts the caret `suffixLength` characters from the end once the new text is rendered. */
  const placeCaretFromEnd = (textLength: number, suffixLength: number) => {
    requestAnimationFrame(() => {
      const caret = Math.max(0, textLength - suffixLength);
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  // Update display value when value prop changes
  useEffect(() => {
    if (!isEditing && !isFocused) {
      setDisplayValue(displayTextFor(value, { acceptText, format, precision }));
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

    placeCaretFromEnd(formatted.length, lengthBefore - selectionStart);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    setIsFocused(false);

    if (acceptText || typeof value === "string") {
      onChange(displayValue);
    } else {
      // Use smart number parser to handle "1.5M", "50k", "1,000,000", etc.
      // oxlint-disable-next-line eslint/no-shadow -- shadowed 'numericValue' is intentional in this scope
      const numericValue = parseNumberInput(displayValue);

      if (!isNaN(numericValue)) {
        // Only clamp if the value is extremely outside bounds
        // Allow values between 0 and max, but warn if below min
        const clampedValue = numericValue < 0 ? 0 : numericValue > max ? max : numericValue;
        onChange(clampedValue);

        setDisplayValue(formatWholeNumber(clampedValue));
      } else {
        setDisplayValue(formatWholeNumber(typeof value === "number" ? value : 0));
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

  const nudge = (direction: 1 | -1) => {
    if (!isNumeric) return;
    const currentStep = dynamicStep ? getDynamicStep(numericValue, safeStep) : safeStep;
    const newValue =
      direction > 0
        ? Math.min(max, numericValue + currentStep)
        : Math.max(min, numericValue - currentStep);
    onChange(newValue);
    setDisplayValue(formatForDisplay(newValue));
  };
  const handleIncrement = () => nudge(1);
  const handleDecrement = () => nudge(-1);

  const handleReset = () => {
    if (resetValue === undefined) return;
    onChange(resetValue);
    setDisplayValue(
      isFocused
        ? formatInputOnTheFly(resetValue.toString())
        : typeof format === "function"
          ? format(resetValue)
          : Number(resetValue).toFixed(precision)
    );
  };

  /** Backspace/Delete next to a thousands comma removes the adjoining digit too. */
  const deleteAcrossComma = (
    e: React.KeyboardEvent<HTMLInputElement>,
    key: "Backspace" | "Delete"
  ) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    if (start !== (input.selectionEnd || 0)) return;
    const backwards = key === "Backspace";
    if (displayValue[backwards ? start - 1 : start] !== ",") return;

    e.preventDefault();
    const combined = backwards
      ? displayValue.slice(0, start - 2) + displayValue.slice(start)
      : displayValue.slice(0, start) + displayValue.slice(start + 2);
    const formatted = formatInputOnTheFly(combined);
    setDisplayValue(formatted);
    placeCaretFromEnd(
      formatted.length,
      Math.max(0, displayValue.length - start - (backwards ? 0 : 2))
    );
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
      setDisplayValue(
        typeof format === "function" ? format(originalValue) : originalValue.toFixed(precision)
      );
      inputRef.current?.blur();
    } else if ((e.key === "Backspace" || e.key === "Delete") && !acceptText) {
      deleteAcrossComma(e, e.key);
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

  const glassFocusClass = isFocused ? "border-tint ring-tint/20 ring-[3px]" : "";

  return (
    <div className={cn("space-y-2", className)} style={cssVars as React.CSSProperties}>
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="text-label text-body flex items-center gap-2 font-medium">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              <ChangedFieldDot name={label} value={value} />
              {required && <span className="text-red">*</span>}
              {helpContent && <FieldHelpTooltip content={helpContent} title={helpTitle || label} />}
            </label>
          )}
          {description && <p className="text-label-secondary text-footnote">{description}</p>}
        </div>
      )}

      <div className="relative w-full">
        <div
          className={cn(
            "relative w-full",
            "rounded-control transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out",
            "border-separator bg-surface border",
            "hover:border-separator hover:bg-surface",
            "hover:shadow-card",
            "focus-within:border-tint/50 focus-within:bg-surface",
            isEditing && "border-tint/50 bg-surface",
            glassFocusClass,
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <div className="relative flex w-full items-center justify-between pr-2">
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
                "text-label placeholder:text-label-tertiary",
                "font-medium",
                sizeClasses[size],
                !isEditing && "cursor-pointer"
              )}
            />

            {unit && displayValue && !isEditing && (
              <span className="text-label-secondary text-body mx-2 shrink-0">{unit}</span>
            )}

            {showButtons && (
              <div className="z-10 flex shrink-0 items-center gap-0.5">
                <div className="bg-fill-3 mx-1 h-4 w-[1px] shrink-0" />

                <motion.button
                  type="button"
                  onClick={handleDecrement}
                  disabled={disabled || Number(value) <= min}
                  className={cn(
                    "flex items-center justify-center rounded transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                    "hover:bg-surface hover:text-tint",
                    "h-6 w-6",
                    "disabled:cursor-not-allowed disabled:opacity-20",
                    "text-label/70 hover:text-label"
                  )}
                >
                  <Minus className="h-3.5 w-3.5" />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={handleIncrement}
                  disabled={disabled || Number(value) >= max}
                  className={cn(
                    "flex items-center justify-center rounded transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                    "hover:bg-surface hover:text-tint",
                    "h-6 w-6",
                    "disabled:cursor-not-allowed disabled:opacity-20",
                    "text-label/70 hover:text-label"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </motion.button>

                {showReset && resetValue !== undefined && (
                  <motion.button
                    type="button"
                    onClick={handleReset}
                    disabled={disabled}
                    className={cn(
                      "flex items-center justify-center rounded transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                      "hover:bg-surface hover:text-tint",
                      "h-6 w-6",
                      "disabled:cursor-not-allowed disabled:opacity-20",
                      "text-label/70 hover:text-label"
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

      {comparisonData && referenceLabel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={cn(
            "rounded-control text-body flex items-center gap-2 px-3 py-2",
            getGlassClasses("base")
          )}
        >
          {comparisonData.trend === "up" && <TrendingUp className="text-green h-4 w-4" />}
          {comparisonData.trend === "down" && <TrendingDown className="text-red h-4 w-4" />}

          <span className="text-label">
            vs {referenceLabel}:
            <span
              className={cn(
                "ml-1 font-bold",
                comparisonData.trend === "up" && "text-green",
                comparisonData.trend === "down" && "text-red"
              )}
            >
              {comparisonData.difference > 0 ? "+" : ""}
              {format
                ? format(comparisonData.difference)
                : comparisonData.difference.toFixed(precision)}
              {unit}
            </span>
            <span className="text-label-secondary ml-1">
              ({comparisonData.percentage > 0 ? "+" : ""}
              {comparisonData.percentage.toFixed(1)}%)
            </span>
          </span>
        </motion.div>
      )}
    </div>
  );
}
