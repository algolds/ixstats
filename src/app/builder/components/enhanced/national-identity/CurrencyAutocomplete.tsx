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
      const symbol = unified ? unified.symbol : (quick ? quick.symbol : info.symbol);
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
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Coins className="text-muted-foreground h-4 w-4" />
          <span>National Currency</span>
        </label>
        <button
          type="button"
          onClick={() => {
            soundEffects.toggle();
            setInputMode(inputMode === "selector" ? "input" : "selector");
          }}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] transition-[color,transform] duration-150 ease-out"
          data-cuelume-press
        >
          {inputMode === "selector" ? (
            <>
              <Edit2 className="h-3 w-3" />
              <span>Type Custom Currency</span>
            </>
          ) : (
            <>
              <List className="h-3 w-3" />
              <span>Select from Standard List</span>
            </>
          )}
        </button>
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
              <div className="rounded-lg border border-border/40 bg-muted/30 p-2 text-xs">
                <div className="text-muted-foreground mb-1 text-[10px] font-bold uppercase tracking-wider">
                  Community Currencies:
                </div>
                <div className="flex flex-wrap gap-1">
                  {data?.user?.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleValueChange(suggestion.value)}
                      className="rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-xs hover:bg-accent active:scale-95 transition-all"
                    >
                      {suggestion.value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Currency Meta Pill Badges */}
        {value && currencyInfo && (
          <div className="flex items-center gap-2 text-xs">
            {currencyInfo.isISO ? (
              <Badge variant="secondary" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                <span>Standard ISO</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border/60 bg-muted/30 text-foreground">
                Custom Sovereign Currency
              </Badge>
            )}
            {currencyInfo.symbol && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <span>Symbol:</span>
                <span className="inline-flex items-center gap-1 rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 text-foreground font-mono font-bold text-xs">
                  <CurrencyIcon code={value} symbol={currencyInfo.symbol} className="h-3.5 w-3.5 shrink-0" />
                  <span>{currencyInfo.symbol}</span>
                </span>
              </span>
            )}
          </div>
        )}

        {/* Quick Access Badges for Popular Currencies */}
        <div className="space-y-1.5 pt-1">
          <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            Quick Select:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_CURRENCIES.map(({ code, symbol, label }) => {
              const isSelected = value === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleValueChange(code)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] ${
                    isSelected
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-500 dark:text-amber-400 shadow-xs"
                      : "border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  }`}
                  title={label}
                  data-cuelume-press
                >
                  <CurrencyIcon
                    code={code}
                    symbol={symbol}
                    className="h-3.5 w-3.5 shrink-0 opacity-80 group-hover:opacity-100"
                  />
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
