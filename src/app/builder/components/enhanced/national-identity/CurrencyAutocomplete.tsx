"use client";

import React, { useState, useCallback } from "react";
import { Coins, EditPencil as Edit2, List, Check } from "iconoir-react";
import { CurrencySelector, CurrencyInput, UNIFIED_CURRENCIES } from "./CurrencySelector";
import { CurrencyIcon } from "./CurrencyIcon";
import { api } from "~/trpc/react";
import { getCurrencyInfo, isValidCurrency } from "~/lib/utils";
import { POPULAR_CURRENCIES } from "./identityUtils";
import { soundEffects } from "~/lib/sound/cuelume";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface CurrencyAutocompleteProps {
  fieldName: string;
  value: string;
  onChange: (value: string, symbol?: string) => void;
  placeholder?: string;
  onSave?: (fieldName: string, value: string) => void;
  showValidation?: boolean;
  allowCustom?: boolean;
  currencySymbol?: string;
}

export const CurrencyAutocomplete = React.memo(function CurrencyAutocomplete({
  fieldName,
  value,
  onChange,
  placeholder = "Select or enter currency",
  onSave,
  showValidation = true,
  allowCustom = true,
}: CurrencyAutocompleteProps) {
  const [inputMode, setInputMode] = useState<"selector" | "input">("selector");

  const { data } = api.customTypes.getFieldSuggestions.useQuery(
    { fieldName, limit: 20 },
    { enabled: inputMode === "input" }
  );

  const handleValueChange = useCallback(
    (newValue: string) => {
      soundEffects.press();
      const unified = UNIFIED_CURRENCIES.find(
        (c) => c.code.toLowerCase() === newValue.toLowerCase()
      );
      const quick = POPULAR_CURRENCIES.find((c) => c.code === newValue);
      const info = getCurrencyInfo(newValue);
      const symbol = unified ? unified.symbol : quick ? quick.symbol : info.symbol;
      onChange(newValue, symbol);
      if (onSave && newValue.trim()) {
        onSave(fieldName, newValue.trim());
      }
    },
    [onChange, onSave, fieldName]
  );

  const currencyInfo = getCurrencyInfo(value);
  const isValid = !value || isValidCurrency(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-label text-body flex items-center gap-2 font-medium">
          <Coins className="text-label-secondary h-4 w-4" />
          <span>National Currency</span>
        </label>
        <Button
          type="button"
          variant="plain"
          size="sm"
          onClick={() => {
            soundEffects.toggle();
            setInputMode(inputMode === "selector" ? "input" : "selector");
          }}
        >
          {inputMode === "selector" ? (
            <>
              <Edit2 aria-hidden />
              <span>Type Custom Currency</span>
            </>
          ) : (
            <>
              <List aria-hidden />
              <span>Select from Standard List</span>
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2.5">
        {/* Currency Selector Mode */}
        {inputMode === "selector" ? (
          <div className="space-y-2">
            <CurrencySelector
              value={value}
              onValueChange={handleValueChange}
              placeholder={placeholder}
            />
          </div>
        ) : (
          /* Custom Input Mode */
          <div className="space-y-2">
            <CurrencyInput
              value={value}
              onValueChange={handleValueChange}
              placeholder="Enter sovereign currency name (e.g. Solar, Denar)"
              showValidation={showValidation}
              allowCustom={allowCustom}
            />

            {/* Suggestions from database */}
            {((data?.global?.length ?? 0) > 0 || (data?.user?.length ?? 0) > 0) && (
              <div className="bg-surface-secondary rounded-row text-footnote p-2">
                <div className="text-subhead text-label-secondary mb-1">Community currencies</div>
                <div className="flex flex-wrap gap-1">
                  {data?.user?.slice(0, 5).map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      type="button"
                      variant="gray"
                      size="sm"
                      onClick={() => handleValueChange(suggestion.value)}
                    >
                      {suggestion.value}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Currency Meta Pill Badges */}
        {value && currencyInfo && (
          <div className="text-footnote flex items-center gap-2">
            {currencyInfo.isISO ? (
              <Badge variant="success">
                <Check aria-hidden />
                <span>Standard ISO</span>
              </Badge>
            ) : (
              <Badge variant="neutral">Custom Sovereign Currency</Badge>
            )}
            {currencyInfo.symbol && (
              <span className="text-label-secondary text-footnote inline-flex items-center gap-1.5">
                <span>Symbol:</span>
                <span className="bg-fill-3 rounded-control-sm text-caption text-label inline-flex items-center gap-1 px-2 py-0.5">
                  <CurrencyIcon
                    code={value}
                    symbol={currencyInfo.symbol}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span>{currencyInfo.symbol}</span>
                </span>
              </span>
            )}
          </div>
        )}

        {/* Quick Access Badges for Popular Currencies */}
        <div className="space-y-1.5 pt-1">
          <div className="text-subhead text-label-secondary">Quick select</div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_CURRENCIES.map(({ code, symbol, label }) => {
              const isSelected = value === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleValueChange(code)}
                  aria-pressed={isSelected}
                  className={`text-caption rounded-control inline-flex items-center gap-1 border px-2 py-1 transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                    isSelected
                      ? "border-tint/50 bg-tint-fill text-tint"
                      : "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3 hover:text-label"
                  }`}
                  title={label}
                  data-cuelume-press
                >
                  <CurrencyIcon code={code} symbol={symbol} className="h-3.5 w-3.5 shrink-0" />
                  <span>{code}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
