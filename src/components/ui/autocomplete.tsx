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
  /** Id for the text input, so a `<label htmlFor>` can name it. */
  id?: string;
}

export const Autocomplete = React.memo(function Autocomplete({
  // oxlint-disable-next-line eslint/no-unused-vars
  fieldName,
  value,
  onChange,
  onBlur,
  onOpenChange,
  placeholder = "Select or type...",
  id,
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
      typeof item === "string" ? { id: `def-${item}`, value: item, isGlobal: true } : item
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
    () =>
      query
        ? userSuggestions.filter((s) => s.value.toLowerCase().includes(query))
        : userSuggestions,
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
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "rounded-control bg-fill-3 text-body text-label flex h-(--control-height) w-full min-w-0 px-3 py-1 pr-8",
            "placeholder:text-label-tertiary selection:bg-tint selection:text-on-tint",
            "duration-fast ease-out-facet transition-[background-color,box-shadow] outline-none",
            "focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
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
          className="rounded-control-sm text-label-tertiary duration-fast hover:text-label absolute right-2 flex size-5 items-center justify-center transition-colors"
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
        <div className="z-popover animate-facet-in rounded-row border-separator bg-surface-elevated text-label shadow-floating absolute mt-1 w-full origin-top border p-1">
          <Command shouldFilter={false} className="rounded-control-sm bg-transparent">
            <CommandList className="max-h-[260px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-label-secondary size-4 animate-spin" />
                  <span className="text-footnote text-label-secondary ml-2">Loading…</span>
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
                            className="text-callout cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "text-tint mr-2 size-3.5",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1 font-medium">{suggestion.value}</span>
                            {suggestion.usageCount && suggestion.usageCount > 1 && (
                              <Badge variant="default" className="ml-2 tabular-nums">
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
                            className="text-callout cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "text-tint mr-2 size-3.5",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{suggestion.value}</span>
                            {suggestion.usageCount && suggestion.usageCount > 1 && (
                              <Badge variant="outline" className="ml-2 tabular-nums">
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
