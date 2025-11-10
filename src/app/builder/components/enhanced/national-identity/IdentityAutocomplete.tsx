"use client";

import React, { useState, useCallback } from "react";
import { Autocomplete } from "~/components/ui/autocomplete";
import { api } from "~/trpc/react";

interface IdentityAutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  onSave?: (fieldName: string, value: string) => void;
}

export const IdentityAutocomplete = React.memo(function IdentityAutocomplete({
  fieldName,
  value,
  onChange,
  placeholder,
  icon: Icon,
  onSave,
}: IdentityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = api.customTypes.getFieldSuggestions.useQuery(
    { fieldName, limit: 10 },
    { enabled: isOpen }
  );

  const handleBlur = useCallback(() => {
    if (value.trim() && onSave) {
      onSave(fieldName, value.trim());
    }
  }, [value, onSave, fieldName]);

  return (
    <div className="space-y-2">
      <label className="text-foreground flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
      </label>
      <Autocomplete
        fieldName={fieldName}
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        onOpenChange={setIsOpen}
        placeholder={placeholder}
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
