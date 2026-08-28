"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { getAvailableCurrencies, getCurrencyInfo, isValidCurrency } from "~/lib/utils";
import { cn } from "~/lib/utils";

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
  const currencies = getAvailableCurrencies();
  const currencyInfo = getCurrencyInfo(value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <div className="flex items-center gap-2">
              <span className="font-medium">{value}</span>
              {currencyInfo.symbol && (
                <Badge variant="secondary" className="text-xs">
                  {currencyInfo.symbol}
                </Badge>
              )}
              {!currencyInfo.isISO && (
                <Badge variant="outline" className="text-xs">
                  Custom
                </Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* ISO Currencies */}
        <div className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
          Standard Currencies
        </div>
        {currencies
          .filter((currency) => {
            const info = getCurrencyInfo(currency);
            return info.isISO;
          })
          .map((currency) => {
            const info = getCurrencyInfo(currency);
            return (
              <SelectItem key={currency} value={currency}>
                <div className="flex items-center gap-2">
                  {info.symbol && <span className="w-5 text-center text-sm">{info.symbol}</span>}
                  <span>{currency}</span>
                </div>
              </SelectItem>
            );
          })}

        {/* Custom Currencies */}
        <div className="text-muted-foreground mt-2 px-2 py-1.5 text-xs font-semibold">
          Custom Currencies
        </div>
        {currencies
          .filter((currency) => {
            const info = getCurrencyInfo(currency);
            return !info.isISO;
          })
          .map((currency) => {
            const info = getCurrencyInfo(currency);
            return (
              <SelectItem key={currency} value={currency}>
                <div className="flex items-center gap-2">
                  <span>{currency}</span>
                  {info.symbol && (
                    <Badge variant="secondary" className="text-xs">
                      {info.symbol}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Custom
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
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
            "file:text-foreground placeholder:text-muted-foreground/80 selection:bg-primary selection:text-primary-foreground",
            "flex h-9 w-full min-w-0 rounded-md border border-neutral-200 bg-white/50 dark:border-white/[0.08] dark:bg-white/[0.015]",
            "px-3 py-1 text-sm shadow-[0_1.5px_3px_rgba(0,0,0,0.04)] transition-all duration-200 outline-none hover:shadow-xs dark:shadow-[0_1.5px_3px_rgba(0,0,0,0.2)]",
            "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "hover:border-neutral-300 hover:bg-white/70 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.03]",
            "focus:scale-[1.01] focus:border-amber-500/60 focus:bg-white/95 focus:shadow-md focus:ring-[2.5px] focus:shadow-amber-500/20 focus:ring-amber-500/20 dark:focus:bg-gray-800/90",
            !isValid && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
        />
        {currencyInfo?.symbol && (
          <Badge variant="secondary" className="text-xs">
            {currencyInfo.symbol}
          </Badge>
        )}
      </div>

      {showValidation && value && (
        <div className="text-xs">
          {isStandard ? (
            <span className="text-green-600 dark:text-green-400">✓ Valid standard currency</span>
          ) : allowCustom ? (
            <span className="text-blue-600 dark:text-blue-400">✓ Custom currency</span>
          ) : (
            <span className="text-red-600 dark:text-red-400">✗ Invalid currency code</span>
          )}
        </div>
      )}
    </div>
  );
}
