"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Command, CommandGroup, CommandItem, CommandList } from "~/components/ui/command";
import { Badge } from "~/components/ui/badge";

interface AutocompleteSuggestion {
  id: string;
  value: string;
  usageCount?: number;
  isGlobal?: boolean;
}

interface AutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  globalSuggestions?: AutocompleteSuggestion[];
  userSuggestions?: AutocompleteSuggestion[];
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
}

export function Autocomplete({
  fieldName,
  value,
  onChange,
  onBlur,
  onOpenChange,
  placeholder = "Select or type...",
  globalSuggestions = [],
  userSuggestions = [],
  isLoading = false,
  disabled = false,
  className,
  allowCustom = true,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preventBlurRef = useRef(false);

  // Notify parent when open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    if (!newOpen && onBlur) {
      onBlur();
    }
  };

  // Filter suggestions based on current value
  const filteredGlobal = globalSuggestions.filter((s) =>
    s.value.toLowerCase().includes(value.toLowerCase())
  );
  const filteredUser = userSuggestions.filter((s) =>
    s.value.toLowerCase().includes(value.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    preventBlurRef.current = true;
    onChange(selectedValue);
    handleOpenChange(false);
    // Restore focus after selection
    setTimeout(() => {
      inputRef.current?.focus();
      preventBlurRef.current = false;
    }, 0);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) handleOpenChange(true);
        }}
        onFocus={() => handleOpenChange(true)}
        onBlur={() => {
          // Don't blur if we're selecting from dropdown
          if (preventBlurRef.current) {
            return;
          }
          // Delay closing to allow clicking on suggestions
          setTimeout(() => {
            handleOpenChange(false);
          }, 200);
        }}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg px-4 py-3 pr-10",
          "border-input bg-background text-foreground border font-normal",
          "focus:border-ring focus:ring-ring focus:ring-2 focus:outline-none",
          "transition-all duration-200",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      />
      <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <ChevronsUpDown className="text-muted-foreground h-4 w-4" />
        )}
      </div>
      {open && (globalSuggestions.length > 0 || userSuggestions.length > 0) && (
        <div className="border-border bg-popover absolute z-[80] mt-2 w-full rounded-lg border shadow-lg">
          <Command shouldFilter={false}>
            <CommandList className="max-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground ml-2 text-sm">Loading...</span>
                </div>
              ) : (
                <>
                  {/* User's Custom Values */}
                  {filteredUser.length > 0 && (
                    <CommandGroup heading="Your Custom Values">
                      {filteredUser.map((suggestion) => (
                        <CommandItem
                          key={suggestion.id}
                          value={suggestion.value}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(suggestion.value);
                          }}
                          onSelect={() => handleSelect(suggestion.value)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === suggestion.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1">{suggestion.value}</span>
                          {suggestion.usageCount && suggestion.usageCount > 1 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {suggestion.usageCount}x
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Global/Common Values */}
                  {filteredGlobal.length > 0 && (
                    <CommandGroup heading="Common Values">
                      {filteredGlobal.map((suggestion) => (
                        <CommandItem
                          key={suggestion.id}
                          value={suggestion.value}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(suggestion.value);
                          }}
                          onSelect={() => handleSelect(suggestion.value)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === suggestion.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1">{suggestion.value}</span>
                          {suggestion.usageCount && suggestion.usageCount > 1 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {suggestion.usageCount}x
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
