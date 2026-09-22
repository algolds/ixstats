"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { CurrencyIcon } from "./CurrencyIcon";
import { getCurrencyInfo, isValidCurrency } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { Search, NavArrowDown, Check } from "iconoir-react";
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
    return !ALL_CURRENCY_OPTIONS.some(
      (opt) => opt.code.toLowerCase() === value.toLowerCase()
    );
  }, [value]);

  const activeOption = useMemo(() => {
    return ALL_CURRENCY_OPTIONS.find(
      (opt) => opt.code.toLowerCase() === value.toLowerCase()
    );
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
            "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
            "aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2",
            "rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow,border-color]",
            "outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 select-none active:scale-[0.99]",
            className
          )}
        >
          {value ? (
            <div className="flex items-center gap-2 min-w-0">
              <CurrencyIcon
                code={value}
                symbol={activeOption?.symbol || currencyInfo.symbol}
                className="h-4 w-4 shrink-0"
              />
              <span className="font-semibold text-xs font-mono">{value}</span>
              {activeOption && (
                <span className="text-muted-foreground text-xs hidden sm:inline truncate max-w-[140px]">
                  ({activeOption.name})
                </span>
              )}
              {(activeOption?.symbol || currencyInfo.symbol) && (
                <Badge variant="secondary" className="text-[10px] font-mono font-bold ml-1 shrink-0">
                  {activeOption?.symbol || currencyInfo.symbol}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/70 text-xs">{placeholder}</span>
          )}
          <NavArrowDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[320px] sm:w-[380px] p-0 border border-border bg-popover/95 backdrop-blur-2xl shadow-2xl rounded-xl overflow-hidden z-[100050]"
        align="start"
        sideOffset={4}
      >
        {/* STICKY TOP SEARCH HEADER - Fixed at top, never scrolls */}
        <div className="border-b border-border/40 bg-popover/95 p-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search 400+ currencies & crypto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredCurrencies.length > 0) {
                  e.preventDefault();
                  onValueChange(filteredCurrencies[0].code);
                  setOpen(false);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Custom current selection indicator if active */}
        {isCustomSelection && (
          <div className="p-1 border-b border-border/20">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-left bg-accent/60 font-semibold"
            >
              <CurrencyIcon
                code={value}
                symbol={currencyInfo.symbol}
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
              <span className="font-mono font-semibold text-xs">{value}</span>
              <Badge variant="outline" className="text-[10px] ml-auto">
                Custom
              </Badge>
              <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
            </button>
          </div>
        )}

        {/* SCROLLABLE ITEMS LIST - Dedicated independent scroll container */}
        <div className="max-h-72 overflow-y-auto p-1 overscroll-contain">
          {filteredCurrencies.map(({ code, name, symbol }) => {
            const isSelected = value.toLowerCase() === code.toLowerCase();
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onValueChange(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-left select-none transition-colors",
                  isSelected
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "hover:bg-accent/60 text-foreground"
                )}
              >
                <CurrencyIcon
                  code={code}
                  symbol={symbol}
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
                <span className="font-mono font-semibold text-xs">{code}</span>
                <span className="text-muted-foreground text-xs truncate max-w-[160px] sm:max-w-[200px]">
                  {name}
                </span>
                <span className="text-muted-foreground/70 font-mono text-[11px] ml-auto pl-2 font-bold shrink-0">
                  {symbol}
                </span>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
                )}
              </button>
            );
          })}

          {filteredCurrencies.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No currency found matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
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
            "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground",
            "flex h-9 w-full min-w-0 rounded-md border border-border/70 bg-background/40",
            "px-3 py-1 text-sm shadow-xs transition-[border-color,background-color,box-shadow] duration-150 ease-out outline-none",
            "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "hover:border-border hover:bg-background/70",
            "focus:border-amber-500/60 focus:bg-background/90 focus:ring-2 focus:ring-amber-500/20",
            !isValid && "border-destructive focus:border-destructive focus:ring-destructive/20",
            className
          )}
        />
        {currencyInfo?.symbol && (
          <Badge variant="secondary" className="inline-flex items-center gap-1 text-xs">
            <CurrencyIcon code={value} symbol={currencyInfo.symbol} className="h-3 w-3" />
            <span>{currencyInfo.symbol}</span>
          </Badge>
        )}
      </div>

      {showValidation && value && (
        <div className="text-xs">
          {isStandard ? (
            <span className="text-emerald-600 dark:text-emerald-400">✓ Valid standard currency</span>
          ) : allowCustom ? (
            <span className="text-blue-600 dark:text-blue-400">✓ Custom currency</span>
          ) : (
            <span className="text-destructive">✗ Invalid currency code</span>
          )}
        </div>
      )}
    </div>
  );
}
