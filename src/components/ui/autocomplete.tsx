"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Check,
  ArrowSeparateVertical as ChevronsUpDown,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Command, CommandGroup, CommandItem, CommandList } from "~/components/ui/command";
import { Badge } from "~/components/ui/badge";

export interface AutocompleteSuggestion {
  id: string;
  value: string;
  usageCount?: number;
  isGlobal?: boolean;
}

export interface AutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  globalSuggestions?: AutocompleteSuggestion[];
  userSuggestions?: AutocompleteSuggestion[];
  defaultSuggestions?: (string | AutocompleteSuggestion)[] | readonly string[];
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
}

export const Autocomplete = React.memo(function Autocomplete({
  // oxlint-disable-next-line eslint/no-unused-vars
  fieldName,
  value,
  onChange,
  onBlur,
  onOpenChange,
  placeholder = "Select or type...",
  globalSuggestions = [],
  userSuggestions = [],
  defaultSuggestions = [],
  isLoading = false,
  disabled = false,
  className,
  // oxlint-disable-next-line eslint/no-unused-vars
  allowCustom = true,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notify parent when open state changes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (onOpenChange) {
        onOpenChange(newOpen);
      }
      if (!newOpen && onBlur) {
        onBlur();
      }
    },
    [onOpenChange, onBlur]
  );

  // Click outside listener for clean dismissal without fragile timeouts
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleOpenChange]);

  // Normalized default suggestions
  const normalizedDefaults = useMemo<AutocompleteSuggestion[]>(() => {
    if (!defaultSuggestions || defaultSuggestions.length === 0) return [];
    return defaultSuggestions.map((item) =>
      typeof item === "string"
        ? { id: `def-${item}`, value: item, isGlobal: true }
        : item
    );
  }, [defaultSuggestions]);

  // Combined global suggestions (database global + default presets)
  const allGlobal = useMemo(() => {
    if (globalSuggestions.length === 0) return normalizedDefaults;
    const existingValues = new Set(globalSuggestions.map((s) => s.value.toLowerCase()));
    const additional = normalizedDefaults.filter((d) => !existingValues.has(d.value.toLowerCase()));
    return [...globalSuggestions, ...additional];
  }, [globalSuggestions, normalizedDefaults]);

  // Filter suggestions based on current value
  const query = value.trim().toLowerCase();
  const filteredGlobal = useMemo(
    () => (query ? allGlobal.filter((s) => s.value.toLowerCase().includes(query)) : allGlobal),
    [allGlobal, query]
  );

  const filteredUser = useMemo(
    () => (query ? userSuggestions.filter((s) => s.value.toLowerCase().includes(query)) : userSuggestions),
    [userSuggestions, query]
  );

  const totalSuggestions = filteredGlobal.length + filteredUser.length;

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      handleOpenChange(false);
      inputRef.current?.focus();
    },
    [onChange, handleOpenChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      if (!open) handleOpenChange(true);
    },
    [onChange, open, handleOpenChange]
  );

  const handleInputFocus = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleOpenChange(false);
      } else if (e.key === "ArrowDown" && !open) {
        handleOpenChange(true);
      }
    },
    [open, handleOpenChange]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground",
            "border-border/70 bg-background/40 flex h-9 w-full min-w-0 rounded-md border",
            "px-3 py-1 pr-8 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 outline-none hover:shadow-xs dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
            "hover:border-border hover:bg-background/60",
            "focus-visible:border-ring focus-visible:bg-background/90 focus-visible:ring-ring/25 focus-visible:ring-[2.5px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (disabled) return;
            handleOpenChange(!open);
            inputRef.current?.focus();
          }}
          className="text-muted-foreground/50 hover:text-foreground absolute right-2.5 flex h-5 w-5 items-center justify-center rounded transition-colors active:scale-95"
          aria-label="Toggle options"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {open && totalSuggestions > 0 && (
        <div className="border-border/60 bg-popover/95 text-popover-foreground absolute z-[100020] mt-1.5 w-full rounded-lg border p-1 shadow-lg backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
          <Command shouldFilter={false}>
            <CommandList className="max-h-[260px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground ml-2 text-xs">Loading...</span>
                </div>
              ) : (
                <>
                  {/* User's Custom Values */}
                  {filteredUser.length > 0 && (
                    <CommandGroup heading="Your Custom Values">
                      {filteredUser.map((suggestion) => {
                        const isSelected = value.toLowerCase() === suggestion.value.toLowerCase();
                        return (
                          <CommandItem
                            key={suggestion.id}
                            value={suggestion.value}
                            onSelect={() => handleSelect(suggestion.value)}
                            className="cursor-pointer text-xs py-1.5"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-primary",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1 font-medium">{suggestion.value}</span>
                            {suggestion.usageCount && suggestion.usageCount > 1 && (
                              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                                {suggestion.usageCount}x
                              </Badge>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  {/* Common / Popular Values */}
                  {filteredGlobal.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {filteredGlobal.map((suggestion) => {
                        const isSelected = value.toLowerCase() === suggestion.value.toLowerCase();
                        return (
                          <CommandItem
                            key={suggestion.id}
                            value={suggestion.value}
                            onSelect={() => handleSelect(suggestion.value)}
                            className="cursor-pointer text-xs py-1.5"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-primary",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{suggestion.value}</span>
                            {suggestion.usageCount && suggestion.usageCount > 1 && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                                {suggestion.usageCount}x
                              </Badge>
                            )}
                          </CommandItem>
                        );
                      })}
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
});
