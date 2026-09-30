"use client";

import React from "react";
import { Search, Xmark as X, DiceSix as Dices, Globe } from "iconoir-react";
import { TIER_FILTER_OPTIONS, type TierFilter } from "~/lib/economic-tier-filter";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";

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
    <div className="bg-background sticky top-0 z-40 mb-6 pt-2 pb-3">
      <FacetContainer
        depth={2}
        texture="dots"
        textureOpacity={0.4}
        className="overflow-hidden rounded-2xl p-4 md:p-5"
      >
        {/* Header Title */}
        <div className="relative z-10 mb-3">
          <h1 className="text-foreground flex items-center gap-2.5 text-2xl font-semibold tracking-tight md:text-3xl">
            <Globe aria-hidden="true" className="h-6 w-6 text-blue-500" />
            <span>Countries</span>
          </h1>
        </div>

        {/* Search with the "Feeling Lucky" random-country action */}
        <div className="relative z-10 mb-3">
          <div className="border-border bg-background focus-within:border-ring focus-within:ring-ring/25 flex items-center rounded-xl border px-3.5 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:ring-2">
            <Search aria-hidden="true" className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange?.(e.target.value)}
              aria-label="Search countries"
              placeholder="Search by country name, economic tier, region, or continent..."
              className="facet-refraction-none text-foreground placeholder:text-muted-foreground w-full min-w-0 bg-transparent px-3 py-1 text-sm font-medium focus:outline-none"
            />

            {searchInput && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onSearchChange?.("")}
                className="text-muted-foreground mr-1 h-8 w-8 shrink-0"
                aria-label="Clear search"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}

            {onImFeelingLucky && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.preventDefault();
                  onImFeelingLucky();
                }}
                className="shrink-0 rounded-full"
                title="Explore a random country"
              >
                <Dices aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
                Feeling Lucky
              </Button>
            )}
          </div>
        </div>

        {/* Economic tier filter */}
        {onTierFilterChange && (
          <div
            role="radiogroup"
            aria-label="Filter by economic tier"
            className="relative z-10 mb-3 flex flex-wrap gap-1.5"
          >
            {TIER_FILTER_OPTIONS.map((opt) => {
              const selected = tierFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onTierFilterChange(opt.value)}
                  data-cuelume-press="tick"
                  data-cuelume-hover="tick"
                  className={cn(
                    "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium transition-[color,background-color,border-color,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
                    selected
                      ? "text-foreground border-blue-500/50 bg-blue-500/10"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Stat cards rendered inside the unified sticky container */}
        {children && <div className="relative z-10">{children}</div>}
      </FacetContainer>
    </div>
  );
};
