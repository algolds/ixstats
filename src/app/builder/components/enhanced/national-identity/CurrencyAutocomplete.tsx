"use client";

import React, { useState } from "react";
import { Coins } from "lucide-react";
import { CurrencySelector, CurrencyInput } from "~/components/ui/currency-selector";
import { api } from "~/trpc/react";
import { getAvailableCurrencies, getCurrencyInfo, isValidCurrency } from "~/lib/format-utils";

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
  allowCustom = true,
}: CurrencyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"selector" | "input">("selector");

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
      <label className="text-foreground flex items-center gap-2 text-sm font-medium">
        <Coins className="h-4 w-4" />
        Currency
      </label>

      <div className="space-y-2">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode("selector")}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              inputMode === "selector"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Select Currency
          </button>
          <button
            type="button"
            onClick={() => setInputMode("input")}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              inputMode === "input"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Custom Entry
          </button>
        </div>

        {/* Currency Selector Mode */}
        {inputMode === "selector" && (
          <div className="space-y-2">
            <CurrencySelector
              value={value}
              onValueChange={handleValueChange}
              placeholder={placeholder}
            />

            {/* Show current currency info */}
            {value && currencyInfo && (
              <div className="text-muted-foreground text-xs">
                {currencyInfo.isISO ? (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ Standard ISO currency
                  </span>
                ) : (
                  <div className="space-y-1">
                    <span className="text-blue-600 dark:text-blue-400">✓ Custom currency</span>
                    {currencyInfo.symbol && (
                      <div className="flex items-center gap-1">
                        <span>Symbol:</span>
                        <span className="bg-muted rounded px-1 font-mono">
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
        {inputMode === "input" && (
          <div className="space-y-2">
            <CurrencyInput
              value={value}
              onValueChange={handleValueChange}
              placeholder="Enter custom currency name"
              showValidation={showValidation}
            />

            {/* Show suggestions from database */}
            {isOpen && ((data?.global?.length ?? 0) > 0 || (data?.user?.length ?? 0) > 0) && (
              <div className="bg-muted/50 mt-2 rounded-md p-2 text-xs">
                <div className="mb-1 font-medium">Recent entries:</div>
                <div className="space-y-1">
                  {data?.user?.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleValueChange(suggestion.value)}
                      className="hover:bg-background block w-full rounded px-2 py-1 text-left"
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
            <div className="text-muted-foreground text-xs">Quick select:</div>
            <div className="flex flex-wrap gap-1">
              {["USD", "EUR", "GBP", "JPY", "Taler", "Crown", "Mark"].map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => handleValueChange(currency)}
                  className="bg-muted hover:bg-muted/80 rounded px-2 py-1 text-xs transition-colors"
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
