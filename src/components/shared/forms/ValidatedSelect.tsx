"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { AlertCircle, Info } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: string;
}

export interface ValidatedSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  disabled?: boolean;
  groupBy?: (option: SelectOption) => string;
}

export function ValidatedSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  description,
  required = false,
  error,
  helperText,
  className,
  disabled = false,
  groupBy,
}: ValidatedSelectProps) {
  const groupedOptions = groupBy
    ? options.reduce(
        (acc, option) => {
          const group = groupBy(option);
          if (!acc[group]) acc[group] = [];
          acc[group]!.push(option);
          return acc;
        },
        {} as Record<string, SelectOption[]>
      )
    : null;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn(error && "border-destructive focus:ring-destructive")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groupedOptions
            ? Object.entries(groupedOptions).map(([group, groupOptions]) => (
                <div key={group}>
                  <div className="text-muted-foreground px-2 py-1.5 text-sm font-semibold">
                    {group}
                  </div>
                  {groupOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          {option.description && (
                            <span className="text-muted-foreground text-xs">
                              {option.description}
                            </span>
                          )}
                        </div>
                        {option.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {option.badge}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))
            : options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-muted-foreground text-xs">{option.description}</span>
                      )}
                    </div>
                    {option.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {option.badge}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
        </SelectContent>
      </Select>
      {error && (
        <Alert variant="destructive" className="px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </div>
        </Alert>
      )}
      {helperText && !error && (
        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </div>
  );
}
