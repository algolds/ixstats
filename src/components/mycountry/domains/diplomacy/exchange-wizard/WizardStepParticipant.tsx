"use client";

import React from "react";
import { Search } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
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
          <Skeleton key={i} className="rounded-row h-16" />
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="border-separator bg-surface rounded-row border p-6 text-center">
        <p className="text-label-secondary text-body">No countries found</p>
      </div>
    );
  }

  return (
    <FacetList>
      <FacetListSection aria-label="Countries">
        {countries.map((country) => {
          const isSelected = participantCountryId === country.id;
          return (
            <FacetRow
              key={country.id}
              onClick={() => onSelect(country.id)}
              selected={isSelected}
              accessory="check"
              leading={
                <UnifiedCountryFlag
                  countryName={country.name}
                  size="sm"
                  className="shadow-card rounded-xs"
                  flagUrl={country.flag}
                />
              }
              title={country.name}
              subtitle={`${country.economicTier} Economy`}
            />
          );
        })}
      </FacetListSection>
    </FacetList>
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
        <h3 className="text-label text-title-3 mb-2">Select participant country</h3>
        <p className="text-label-secondary text-body">
          Choose the country that will participate in this exchange.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-label-secondary absolute top-1/2 left-3 -translate-y-1/2" />
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
