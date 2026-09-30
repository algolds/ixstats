"use client";

import React from "react";
import { Check, Search } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import type { WizardCountry } from "./exchange-wizard-config";

interface WizardStepParticipantProps {
  countrySearch: string;
  onCountrySearchChange: (value: string) => void;
  isLoading: boolean;
  countries: WizardCountry[];
  participantCountryId: string;
  onSelect: (countryId: string) => void;
}

function CountryList({
  isLoading,
  countries,
  participantCountryId,
  onSelect,
}: Omit<WizardStepParticipantProps, "countrySearch" | "onCountrySearchChange">) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="facet-hierarchy-child bg-muted/50 h-16 animate-pulse rounded-lg p-3"
          />
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="facet-hierarchy-child rounded-lg p-6 text-center">
        <p className="text-muted-foreground text-sm">No countries found</p>
      </div>
    );
  }

  return (
    <>
      {countries.map((country) => {
        const isSelected = participantCountryId === country.id;
        return (
          <div
            key={country.id}
            onClick={() => onSelect(country.id)}
            className={cn(
              "facet-hierarchy-child w-full rounded-lg p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
              "cursor-pointer border text-left hover:border-amber-500/40",
              isSelected ? "border-amber-500/50 ring-2 ring-amber-500/50" : "border-border/50"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Checkbox checked={isSelected} className="pointer-events-none" />
              <UnifiedCountryFlag
                countryName={country.name}
                size="sm"
                className="rounded shadow-sm"
                flagUrl={country.flag}
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{country.name}</p>
                <p className="text-muted-foreground text-xs">{country.economicTier} Economy</p>
              </div>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-amber-500" />}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Step 2 — pick the participant country. */
export const WizardStepParticipant = React.memo(function WizardStepParticipant({
  countrySearch,
  onCountrySearchChange,
  ...listProps
}: WizardStepParticipantProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground mb-2 text-lg font-bold">Select Participant Country</h3>
        <p className="text-muted-foreground text-sm">
          Choose the country that will participate in this exchange.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search countries..."
          value={countrySearch}
          onChange={(e) => onCountrySearchChange(e.target.value)}
          className="bg-input border-border pl-10 focus:border-amber-500/50"
        />
      </div>

      {/* Country List */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
        <CountryList {...listProps} />
      </div>
    </div>
  );
});
