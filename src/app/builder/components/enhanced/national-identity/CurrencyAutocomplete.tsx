"use client";

import React, { useState, useCallback, useId } from "react";
import { Coins, EditPencil as Edit2, List, Check } from "iconoir-react";
import { CurrencySelector, CurrencyInput, UNIFIED_CURRENCIES } from "./CurrencySelector";
import { CurrencyIcon } from "./CurrencyIcon";
import { api } from "~/trpc/react";
import { getCurrencyInfo, isValidCurrency } from "~/lib/utils";
import { POPULAR_CURRENCIES } from "./identityUtils";
import { soundEffects } from "~/lib/sound/cuelume";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

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

  const labelId = useId();
  const currencyInfo = getCurrencyInfo(value);
  const isValid = !value || isValidCurrency(value);

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelId}>
      <div className="flex items-center justify-between">
        <label id={labelId} className="text-label text-body flex items-center gap-2 font-medium">
          <Coins aria-hidden className="text-label-secondary h-4 w-4" />
          <span>National currency</span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            soundEffects.toggle();
            setInputMode(inputMode === "selector" ? "input" : "selector");
          }}
        >
          {inputMode === "selector" ? (
            <>
              <Edit2 aria-hidden />
              <span>Type custom currency</span>
            </>
          ) : (
            <>
              <List aria-hidden />
              <span>Select from standard list</span>
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
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
                      variant="secondary"
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
              <Badge variant="default">Custom sovereign currency</Badge>
            )}
            {currencyInfo.symbol && (
              <span className="text-label-secondary text-footnote inline-flex items-center gap-2">
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
        <div className="space-y-2 pt-1">
          <div className="text-subhead text-label-secondary">Quick select</div>
          <ToggleGroup
            type="single"
            aria-label="Popular currencies"
            variant="outline"
            size="sm"
            disallowEmpty
            value={POPULAR_CURRENCIES.some((c) => c.code === value) ? value : ""}
            onValueChange={(code) => {
              if (code) handleValueChange(code);
            }}
            className="flex flex-wrap gap-2"
          >
            {POPULAR_CURRENCIES.map(({ code, symbol, label }) => (
              <ToggleGroupItem key={code} value={code} title={label} className="gap-1">
                <CurrencyIcon code={code} symbol={symbol} className="size-3.5 shrink-0" />
                <span>{code}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
});
