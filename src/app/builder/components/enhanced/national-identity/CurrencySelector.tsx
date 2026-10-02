"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SearchField } from "~/components/ui/search-field";
import { Badge } from "~/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { CurrencyIcon } from "./CurrencyIcon";
import { getCurrencyInfo, isValidCurrency } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { NavArrowDown, Check } from "iconoir-react";
import {
  type CurrencyOption,
  UNIFIED_CURRENCIES,
  ALL_FIAT_CURRENCIES,
  ALL_CRYPTO_CURRENCIES,
  ALL_SOVEREIGN_CURRENCIES,
} from "./currencyData";

export type { CurrencyOption };
export const FIAT_CURRENCIES = ALL_FIAT_CURRENCIES;
export const CRYPTO_CURRENCIES = ALL_CRYPTO_CURRENCIES;
export const SOVEREIGN_CURRENCIES = ALL_SOVEREIGN_CURRENCIES;
export { UNIFIED_CURRENCIES };

const ALL_CURRENCY_OPTIONS = UNIFIED_CURRENCIES;

interface CurrencySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelector({
  value,
  onValueChange,
  placeholder = "Select currency",
  disabled = false,
  className = "",
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const currencyInfo = getCurrencyInfo(value);

  // Focus input automatically when popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    setSearchQuery("");
    return undefined;
  }, [open]);

  // Check if current selection is outside standard presets
  const isCustomSelection = useMemo(() => {
    if (!value) return false;
    return !ALL_CURRENCY_OPTIONS.some((opt) => opt.code.toLowerCase() === value.toLowerCase());
  }, [value]);

  const activeOption = useMemo(() => {
    return ALL_CURRENCY_OPTIONS.find((opt) => opt.code.toLowerCase() === value.toLowerCase());
  }, [value]);

  // Real-time filter across all 400+ currencies
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) return UNIFIED_CURRENCIES;
    const q = searchQuery.toLowerCase().trim();
    return UNIFIED_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          data-slot="select-trigger"
          aria-expanded={open}
          className={cn(
            "border-separator data-[placeholder]:text-label-secondary [&_svg:not([class*='text-'])]:text-label-secondary",
            "focus-visible:border-ring focus-visible:ring-tint/50 aria-invalid:ring-destructive/20",
            "aria-invalid:border-destructive flex w-full items-center justify-between gap-2",
            "rounded-control-sm text-body shadow-card border bg-transparent px-3 py-2 whitespace-nowrap transition-[color,box-shadow,border-color]",
            "h-9 outline-none select-none focus-visible:ring-[3px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          {value ? (
            <div className="flex min-w-0 items-center gap-2">
              <CurrencyIcon
                code={value}
                symbol={activeOption?.symbol || currencyInfo.symbol}
                className="h-4 w-4 shrink-0"
              />
              <span className="text-caption font-mono">{value}</span>
              {activeOption && (
                <span className="text-label-secondary text-footnote hidden max-w-[140px] truncate sm:inline">
                  ({activeOption.name})
                </span>
              )}
              {(activeOption?.symbol || currencyInfo.symbol) && (
                <Badge variant="default" className="ml-1 shrink-0">
                  {activeOption?.symbol || currencyInfo.symbol}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-label-secondary text-footnote">{placeholder}</span>
          )}
          <NavArrowDown className="text-label-secondary h-4 w-4 shrink-0 transition-transform duration-200" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 overflow-hidden p-0 sm:w-96" align="start" sideOffset={4}>
        {/* Combobox (spec §7.2): our own filtering over 400+ currencies, cmdk for the listbox
            semantics and arrow/Enter navigation (Enter picks the highlighted, first by default). */}
        <Command shouldFilter={false} className="rounded-none bg-transparent">
          <div className="border-separator border-b p-2">
            <SearchField
              ref={inputRef}
              size="sm"
              aria-label="Search currencies"
              placeholder="Search 400+ currencies & crypto..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          <CommandList className="max-h-72 overscroll-contain">
            {/* Custom current selection indicator if active */}
            {/* The current custom (non-listed) currency, shown for reference only. */}
            {isCustomSelection && (
              <div className="border-separator border-b p-1">
                <div className="bg-fill-3 rounded-control-sm text-body flex items-center gap-2 px-2 py-2">
                  <CurrencyIcon
                    code={value}
                    symbol={currencyInfo.symbol}
                    className="text-label-secondary h-4 w-4 shrink-0"
                  />
                  <span className="text-caption font-mono font-semibold">{value}</span>
                  <Badge variant="outline" className="ml-auto">
                    Custom
                  </Badge>
                  <Check aria-hidden className="text-tint ml-1 size-3.5" />
                  <span className="sr-only">(selected)</span>
                </div>
              </div>
            )}

            <CommandEmpty>No currency found matching &quot;{searchQuery}&quot;</CommandEmpty>
            <CommandGroup>
              {filteredCurrencies.map(({ code, name, symbol }) => {
                const isSelected = value.toLowerCase() === code.toLowerCase();
                return (
                  <CommandItem
                    key={code}
                    value={code}
                    onSelect={() => {
                      onValueChange(code);
                      setOpen(false);
                    }}
                    data-checked={isSelected || undefined}
                    className={cn("text-footnote", isSelected && "font-semibold")}
                  >
                    <CurrencyIcon
                      code={code}
                      symbol={symbol}
                      className="text-label-secondary h-4 w-4 shrink-0"
                    />
                    <span className="text-caption font-mono font-semibold">{code}</span>
                    <span className="text-label-secondary text-footnote max-w-[160px] truncate sm:max-w-[200px]">
                      {name}
                    </span>
                    <span className="text-caption text-label-secondary ml-auto shrink-0 pl-2">
                      {symbol}
                    </span>
                    {isSelected && (
                      <>
                        <Check aria-hidden className="text-tint ml-1 size-3.5" />
                        <span className="sr-only">(selected)</span>
                      </>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Currency input with validation
 */
interface CurrencyInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showValidation?: boolean;
  allowCustom?: boolean;
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "Enter currency code",
  disabled = false,
  className = "",
  showValidation = true,
  allowCustom = true,
}: CurrencyInputProps) {
  const isStandard = !value || isValidCurrency(value);
  const isValid = isStandard || allowCustom;
  const currencyInfo = value ? getCurrencyInfo(value) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "file:text-label placeholder:text-label-secondary selection:bg-tint selection:text-on-tint",
            "rounded-control-sm border-separator bg-fill-4 flex h-9 w-full min-w-0 border",
            "text-body shadow-card px-3 py-1 transition-[border-color,background-color,box-shadow] duration-150 ease-out outline-none",
            "file:text-footnote file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-tint focus-visible:ring-tint/20 focus-visible:ring-2",
            !isValid && "border-destructive focus:border-destructive focus:ring-destructive/20",
            className
          )}
        />
        {currencyInfo?.symbol && (
          <Badge variant="default" className="text-footnote inline-flex items-center gap-1">
            <CurrencyIcon code={value} symbol={currencyInfo.symbol} className="h-3 w-3" />
            <span>{currencyInfo.symbol}</span>
          </Badge>
        )}
      </div>

      {showValidation && value && (
        <div className="text-footnote">
          {isStandard ? (
            <span className="text-green">✓ Valid standard currency</span>
          ) : allowCustom ? (
            <span className="text-blue">✓ Custom currency</span>
          ) : (
            <span className="text-destructive">✗ Invalid currency code</span>
          )}
        </div>
      )}
    </div>
  );
}
