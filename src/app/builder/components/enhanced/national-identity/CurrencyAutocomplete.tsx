"use client";

import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { CurrencySelector, CurrencyInput } from '~/components/ui/currency-selector';
import { api } from '~/trpc/react';
import { getAvailableCurrencies, getCurrencyInfo, isValidCurrency } from '~/lib/format-utils';

interface CurrencyAutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSave?: (fieldName: string, value: string) => void;
  showValidation?: boolean;
  allowCustom?: boolean;
}

export function CurrencyAutocomplete({
  fieldName,
  value,
  onChange,
  placeholder = "Select or enter currency",
  onSave,
  showValidation = true,
  allowCustom = true
}: CurrencyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'selector' | 'input'>('selector');

  const { data, isLoading } = api.customTypes.getFieldSuggestions.useQuery(
    { fieldName, limit: 20 },
    { enabled: isOpen }
  );

  const handleBlur = () => {
    if (value.trim() && onSave) {
      onSave(fieldName, value.trim());
    }
  };

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
    if (onSave && newValue.trim()) {
      onSave(fieldName, newValue.trim());
    }
  };

  const availableCurrencies = getAvailableCurrencies();
  const currencyInfo = getCurrencyInfo(value);
  const isValid = !value || isValidCurrency(value);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Coins className="h-4 w-4" />
        Currency
      </label>
      
      <div className="space-y-2">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode('selector')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              inputMode === 'selector'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Select Currency
          </button>
          <button
            type="button"
            onClick={() => setInputMode('input')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              inputMode === 'input'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Custom Entry
          </button>
        </div>

        {/* Currency Selector Mode */}
        {inputMode === 'selector' && (
          <div className="space-y-2">
            <CurrencySelector
              value={value}
              onValueChange={handleValueChange}
              placeholder={placeholder}
            />
            
            {/* Show current currency info */}
            {value && currencyInfo && (
              <div className="text-xs text-muted-foreground">
                {currencyInfo.isISO ? (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ Standard ISO currency
                  </span>
                ) : (
                  <div className="space-y-1">
                    <span className="text-blue-600 dark:text-blue-400">
                      ✓ Custom currency
                    </span>
                    {currencyInfo.symbol && (
                      <div className="flex items-center gap-1">
                        <span>Symbol:</span>
                        <span className="font-mono bg-muted px-1 rounded">
                          {currencyInfo.symbol}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom Input Mode */}
        {inputMode === 'input' && (
          <div className="space-y-2">
            <CurrencyInput
              value={value}
              onValueChange={handleValueChange}
              placeholder="Enter custom currency name"
              showValidation={showValidation}
            />
            
            {/* Show suggestions from database */}
            {isOpen && ((data?.global?.length ?? 0) > 0 || (data?.user?.length ?? 0) > 0) && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs">
                <div className="font-medium mb-1">Recent entries:</div>
                <div className="space-y-1">
                  {data?.user?.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleValueChange(suggestion.value)}
                      className="block w-full text-left hover:bg-background px-2 py-1 rounded"
                    >
                      {suggestion.value}
                      {suggestion.usageCount > 1 && (
                        <span className="text-muted-foreground ml-1">
                          ({suggestion.usageCount}x)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Access to Common Currencies */}
        {!value && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Quick select:</div>
            <div className="flex flex-wrap gap-1">
              {['USD', 'EUR', 'GBP', 'JPY', 'Taler', 'Crown', 'Mark'].map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => handleValueChange(currency)}
                  className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
