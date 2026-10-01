"use client";

import React from "react";
import { DiceSix as Dices, Globe } from "iconoir-react";
import { TIER_FILTER_OPTIONS, type TierFilter } from "~/lib/economic-tier-filter";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { shellPageTitleProps } from "~/components/shell/ShellPageHeader";

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
  return (
    <div className="bg-background z-sticky sticky top-0 mb-6 pt-2 pb-3">
      <FacetCard
        variant="glass"
        texture="dots"
        textureOpacity={0.04}
        className="overflow-hidden p-4 md:p-5"
      >
        {/* v2 (c5c6b382): the hero card over a fine dot grid — now the glass hero tier. */}
        {/* Header Title (phones under the new shell get the ShellPageHeader title instead) */}
        <div {...shellPageTitleProps} className="mb-3">
          <h1 className="text-large-title text-label flex items-center gap-2">
            <Globe aria-hidden="true" className="text-tint size-6" />
            <span>Countries</span>
          </h1>
        </div>

        {/* Search with the "Feeling Lucky" random-country action */}
        <div className="mb-3 flex items-center gap-2">
          <SearchField
            size="lg"
            containerClassName="min-w-0 flex-1"
            value={searchInput}
            onValueChange={(value) => onSearchChange?.(value)}
            aria-label="Search countries"
            placeholder="Search by country name, economic tier, region, or continent..."
          />

          {onImFeelingLucky && (
            <Button
              type="button"
              variant="bordered"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                onImFeelingLucky();
              }}
              className="shrink-0 rounded-full"
              title="Explore a random country"
            >
              <Dices aria-hidden="true" />
              Feeling lucky
            </Button>
          )}
        </div>

        {/* Economic tier filter */}
        {onTierFilterChange && (
          <SegmentedControl
            aria-label="Filter by economic tier"
            size="sm"
            className="mb-3"
            value={tierFilter}
            onValueChange={onTierFilterChange}
            options={TIER_FILTER_OPTIONS}
          />
        )}

        {/* Stat cards rendered inside the unified sticky container */}
        {children && <div>{children}</div>}
      </FacetCard>
    </div>
  );
};
