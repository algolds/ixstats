"use client";

import React, { useState, useCallback } from "react";
import { Autocomplete } from "~/components/ui/autocomplete";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";

interface IdentityAutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  iconClassName?: string;
  onSave?: (fieldName: string, value: string) => void;
  disabled?: boolean;
  extraLabelElement?: React.ReactNode;
  defaultSuggestions?: readonly string[] | string[];
  size?: "default" | "sm";
  className?: string;
}

function formatFieldLabel(fieldName: string): string {
  switch (fieldName) {
    case "officialLanguages":
      return "Primary Official Language";
    case "nationalLanguage":
      return "National / Lingua Franca";
    case "capitalCity":
      return "Capital City";
    case "largestCity":
      return "Largest City";
    case "demonym":
      return "Demonym";
    default:
      return fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  }
}

export const IdentityAutocomplete = React.memo(function IdentityAutocomplete({
  fieldName,
  value,
  onChange,
  placeholder,
  icon: Icon,
  label,
  iconClassName,
  onSave,
  disabled = false,
  extraLabelElement,
  defaultSuggestions,
  size = "default",
  className,
}: IdentityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = api.customTypes.getFieldSuggestions.useQuery(
    { fieldName, limit: 10 },
    { enabled: isOpen && !disabled }
  );

  const handleBlur = useCallback(() => {
    if (value.trim() && onSave && !disabled) {
      onSave(fieldName, value.trim());
    }
  }, [value, onSave, fieldName, disabled]);

  return (
    <div className="space-y-1.5">
      <label className="text-foreground flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          {Icon && (
            <Icon className={cn("h-3.5 w-3.5", iconClassName || "text-muted-foreground")} />
          )}
          <span>{label || formatFieldLabel(fieldName)}</span>
        </span>
        {extraLabelElement}
      </label>
      <Autocomplete
        fieldName={fieldName}
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        onOpenChange={setIsOpen}
        placeholder={placeholder}
        disabled={disabled}
        defaultSuggestions={defaultSuggestions}
        className={cn(
          size === "sm" && "h-8 text-xs",
          className
        )}
        globalSuggestions={
          data?.global.map((s) => ({
            id: s.id,
            value: s.value,
            usageCount: s.usageCount,
            isGlobal: s.isGlobal,
          })) || []
        }
        userSuggestions={
          data?.user.map((s) => ({
            id: s.id,
            value: s.value,
            usageCount: s.usageCount,
            isGlobal: s.isGlobal,
          })) || []
        }
        isLoading={isLoading}
        allowCustom={true}
      />
    </div>
  );
});
