"use client";

import React, { useState, useCallback } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
  severity?: "error" | "warning" | "info";
}

export interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  description?: string;
  rules?: ValidationRule[];
  onChange?: (value: string, isValid: boolean) => void;
  showValidation?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  required?: boolean;
  helperText?: string;
  successMessage?: string;
}

export function ValidatedInput({
  label,
  description,
  rules = [],
  onChange,
  showValidation = true,
  validateOnBlur = true,
  validateOnChange = true,
  required = false,
  helperText,
  successMessage,
  className,
  ...inputProps
}: ValidatedInputProps) {
  const [value, setValue] = useState(inputProps.value?.toString() || "");
  const [touched, setTouched] = useState(false);
  const [validationMessages, setValidationMessages] = useState<
    Array<{ message: string; severity: "error" | "warning" | "info" }>
  >([]);
  const [isValid, setIsValid] = useState(true);

  const validate = useCallback(
    (val: string): boolean => {
      if (required && !val.trim()) {
        setValidationMessages([{ message: "This field is required", severity: "error" }]);
        setIsValid(false);
        return false;
      }

      const messages: Array<{ message: string; severity: "error" | "warning" | "info" }> = [];
      let valid = true;

      for (const rule of rules) {
        if (!rule.validate(val)) {
          messages.push({
            message: rule.message,
            severity: rule.severity || "error",
          });
          if (rule.severity === "error" || !rule.severity) {
            valid = false;
          }
        }
      }

      setValidationMessages(messages);
      setIsValid(valid);
      return valid;
    },
    [rules, required]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (validateOnChange && touched) {
      const valid = validate(newValue);
      onChange?.(newValue, valid);
    } else {
      onChange?.(newValue, true);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (validateOnBlur) {
      const valid = validate(value);
      onChange?.(value, valid);
    }
  };

  const hasErrors = validationMessages.some((m) => m.severity === "error");
  const hasWarnings = validationMessages.some((m) => m.severity === "warning");
  const hasInfo = validationMessages.some((m) => m.severity === "info");
  const showSuccess =
    touched && isValid && validationMessages.length === 0 && value.trim() && successMessage;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {showSuccess && (
            <Badge variant="outline" className="border-green-600/20 bg-green-600/5 text-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Valid
            </Badge>
          )}
        </div>
      )}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      <Input
        {...inputProps}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          hasErrors && "border-destructive focus-visible:ring-destructive",
          hasWarnings && "border-yellow-500 focus-visible:ring-yellow-500",
          showSuccess && "border-green-500 focus-visible:ring-green-500"
        )}
      />
      {showValidation && touched && (
        <>
          {validationMessages.map((msg, idx) => (
            <Alert
              key={idx}
              variant={msg.severity === "error" ? "destructive" : "default"}
              className={cn(
                "px-3 py-2",
                msg.severity === "warning" &&
                  "border-yellow-500/20 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400",
                msg.severity === "info" &&
                  "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400"
              )}
            >
              <div className="flex items-center gap-2">
                {msg.severity === "error" && <AlertCircle className="h-4 w-4" />}
                {msg.severity === "warning" && <AlertCircle className="h-4 w-4" />}
                {msg.severity === "info" && <Info className="h-4 w-4" />}
                <AlertDescription className="text-sm">{msg.message}</AlertDescription>
              </div>
            </Alert>
          ))}
        </>
      )}
      {helperText && !touched && <p className="text-muted-foreground text-sm">{helperText}</p>}
      {showSuccess && successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
}

// Pre-configured validation rules
export const ValidationRules = {
  required: (): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message: "This field is required",
    severity: "error",
  }),

  minLength: (min: number): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: `Must be at least ${min} characters`,
    severity: "error",
  }),

  maxLength: (max: number): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: `Must be no more than ${max} characters`,
    severity: "error",
  }),

  number: (): ValidationRule => ({
    validate: (value) => !isNaN(Number(value)),
    message: "Must be a valid number",
    severity: "error",
  }),

  min: (min: number): ValidationRule => ({
    validate: (value) => Number(value) >= min,
    message: `Must be at least ${min}`,
    severity: "error",
  }),

  max: (max: number): ValidationRule => ({
    validate: (value) => Number(value) <= max,
    message: `Must be no more than ${max}`,
    severity: "error",
  }),

  integer: (): ValidationRule => ({
    validate: (value) => Number.isInteger(Number(value)),
    message: "Must be a whole number",
    severity: "error",
  }),

  positive: (): ValidationRule => ({
    validate: (value) => Number(value) > 0,
    message: "Must be a positive number",
    severity: "error",
  }),

  email: (): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: "Must be a valid email address",
    severity: "error",
  }),

  url: (): ValidationRule => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: "Must be a valid URL",
    severity: "error",
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
    severity: "error",
  }),

  custom: (
    validator: (value: string) => boolean,
    message: string,
    severity: "error" | "warning" | "info" = "error"
  ): ValidationRule => ({
    validate: validator,
    message,
    severity,
  }),
};
