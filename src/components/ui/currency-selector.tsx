"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { getAvailableCurrencies, getCurrencyInfo, isValidCurrency } from '~/lib/format-utils';

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
  className = ""
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
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Standard Currencies
        </div>
        {currencies.filter(currency => {
          const info = getCurrencyInfo(currency);
          return info.isISO;
        }).map(currency => (
          <SelectItem key={currency} value={currency}>
            <div className="flex items-center gap-2">
              <span>{currency}</span>
              <Badge variant="secondary" className="text-xs">
                ISO
              </Badge>
            </div>
          </SelectItem>
        ))}
        
        {/* Custom Currencies */}
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
          Custom Currencies
        </div>
        {currencies.filter(currency => {
          const info = getCurrencyInfo(currency);
          return !info.isISO;
        }).map(currency => {
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
}

export function CurrencyInput({
  value,
  onValueChange,
  placeholder = "Enter currency code",
  disabled = false,
  className = "",
  showValidation = true
}: CurrencyInputProps) {
  const isValid = !value || isValidCurrency(value);
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
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className} ${
            !isValid ? 'border-red-500 focus-visible:ring-red-500' : ''
          }`}
        />
        {currencyInfo?.symbol && (
          <Badge variant="secondary" className="text-xs">
            {currencyInfo.symbol}
          </Badge>
        )}
      </div>
      
      {showValidation && value && (
        <div className="text-xs">
          {isValid ? (
            <span className="text-green-600 dark:text-green-400">
              ✓ Valid currency code
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              ✗ Invalid currency code
            </span>
          )}
        </div>
      )}
    </div>
  );
}
