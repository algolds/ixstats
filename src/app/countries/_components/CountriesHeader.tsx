"use client";

import React from "react";
import { DiceSix as Dices } from "iconoir-react";
import { TIER_FILTER_OPTIONS, type TierFilter } from "~/lib/economic-tier-filter";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";

interface CountriesHeaderProps {
  searchInput?: string;
  onSearchChange?: (value: string) => void;
  onImFeelingLucky?: () => void;
  tierFilter?: TierFilter;
  onTierFilterChange?: (tier: TierFilter) => void;
  children?: React.ReactNode;
}

export const CountriesHeader: React.FC<CountriesHeaderProps> = ({
  searchInput = "",
  onSearchChange,
  onImFeelingLucky,
  tierFilter = "all",
  onTierFilterChange,
  children,
}) => {
  const luckyButton = onImFeelingLucky && (
    <Button type="button" variant="outline" size="sm" onClick={onImFeelingLucky}>
      <Dices aria-hidden="true" />
      Feeling lucky
    </Button>
  );

  return (
    <div className="mb-6">
      <PageHeader title="Countries" actions={luckyButton} bleed />
      <Card padding="md" className="flex flex-col gap-3">
        <SearchField
          size="lg"
          value={searchInput}
          onValueChange={(value) => onSearchChange?.(value)}
          aria-label="Search countries"
          placeholder="Search by name, economic tier, region or continent"
        />
        {onTierFilterChange && (
          <SegmentedControl
            aria-label="Filter by economic tier"
            size="sm"
            value={tierFilter}
            onValueChange={onTierFilterChange}
            options={TIER_FILTER_OPTIONS}
          />
        )}
        {children}
      </Card>
    </div>
  );
};
