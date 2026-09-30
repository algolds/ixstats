"use client";

import React from "react";
import { Check, Search } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
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
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="border-border bg-card rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">No countries found</p>
      </div>
    );
  }

  return (
    <>
      {countries.map((country) => {
        const isSelected = participantCountryId === country.id;
        return (
          <button
            type="button"
            key={country.id}
            onClick={() => onSelect(country.id)}
            aria-pressed={isSelected}
            className={cn(
              "bg-card focus-visible:ring-ring w-full cursor-pointer rounded-xl border p-3 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.99]",
              isSelected
                ? "border-ring bg-accent ring-ring ring-1"
                : "border-border hover:bg-accent/50"
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
              {isSelected && <Check className="text-foreground h-4 w-4 shrink-0" />}
            </div>
          </button>
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
          className="pl-10"
        />
      </div>

      {/* Country List */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
        <CountryList {...listProps} />
      </div>
    </div>
  );
});
