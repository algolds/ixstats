"use client";

import { Globe } from "iconoir-react";

import React from "react";
import { motion } from "motion/react";
import {
  CountryFocusCard,
  type CountryCardData,
} from "~/components/mycountry/dossier/CountryFocusCard";
import { ProgressiveBlur } from "~/components/ui/magicui/progressive-blur";
import { cn } from "~/lib/utils";

interface CountriesFocusGridModularProps {
  countries: CountryCardData[];
  visibleCount: number;
  hovered: number | null;
  setHovered: React.Dispatch<React.SetStateAction<number | null>>;
  expanded: number | null;
  setExpanded: React.Dispatch<React.SetStateAction<number | null>>;
  onCountryClick: (countryId: string, countryName: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  searchInput: string;
  filterBy: string;
  onClearFilters: () => void;
  viewerCountryId?: string;
}

export const CountriesFocusGridModular: React.FC<CountriesFocusGridModularProps> = ({
  countries,
  visibleCount,
  hovered,
  setHovered,
  expanded,
  setExpanded,
  onCountryClick,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  searchInput,
  filterBy,
  onClearFilters,
  viewerCountryId,
}) => {
  const visibleCountries = countries.slice(0, visibleCount);

  const loadMore = React.useCallback(() => {
    if (onLoadMore) {
      onLoadMore();
    }
  }, [onLoadMore]);

  const handleHoverToggle = React.useCallback(
    (index: number | null) => {
      setHovered(index);
    },
    [setHovered]
  );

  const handleExpandToggle = React.useCallback(
    (index: number | null) => {
      setExpanded(index);
    },
    [setExpanded]
  );

  const isAnyHovered = hovered !== null;
  const isAnyExpanded = expanded !== null;

  return (
    <div className="space-y-12">
      {/* Countries Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCountries.map((country, index) => {
          const isHovered = hovered === index;
          const isExpanded = expanded === index;
          const isOtherHovered = isAnyHovered && !isHovered;
          const isOtherExpanded = isAnyExpanded && !isExpanded;

          return (
            <motion.div
              key={country.id}
              className={cn(
                "relative transition-all duration-300",
                isHovered ? "z-20" : isExpanded ? "z-30" : "z-10"
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: Math.min(index * 0.03, 0.3),
                ease: "easeOut",
              }}
            >
              <CountryFocusCard
                country={country}
                index={index}
                isHovered={isHovered}
                isExpanded={isExpanded}
                isOtherHovered={isOtherHovered}
                isOtherExpanded={isOtherExpanded}
                onHoverToggle={handleHoverToggle}
                onExpandToggle={handleExpandToggle}
                onCountryClick={onCountryClick}
                viewerCountryId={viewerCountryId}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Loading State with Progressive Blur */}
      {(isLoading || visibleCount < countries.length) && (
        <div className="mt-12">
          <ProgressiveBlur>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="facet-surface facet-refraction flex h-60 flex-col justify-end rounded-2xl border border-white/10 p-5 md:h-96"
                >
                  <div className="space-y-3">
                    <div className="bg-muted/40 h-6 w-3/4 rounded-lg animate-pulse" />
                    <div className="bg-muted/20 h-4 w-1/2 rounded-md animate-pulse" />
                    <div className="mt-4 space-y-2 pt-2">
                      <div className="bg-muted/15 h-3.5 w-full rounded animate-pulse" />
                      <div className="bg-muted/15 h-3.5 w-4/5 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ProgressiveBlur>
        </div>
      )}

      {/* Load More Button */}
      {!isLoading && visibleCount < countries.length && (
        <div className="mt-12 text-center">
          <button
            onClick={loadMore}
            data-cuelume-press="tick"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 py-3 font-semibold shadow-md transition-all duration-150 active:scale-[0.98]"
          >
            Load More Countries
          </button>
        </div>
      )}

      {/* End Message */}
      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="mt-12 text-center">
          <div className="facet-floating facet-refraction inline-block rounded-xl px-6 py-4">
            <p className="text-muted-foreground text-sm font-medium">You've viewed all {countries.length} countries</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {countries.length === 0 && !isLoading && (
        <div className="mt-12 text-center">
          <div className="facet-floating facet-refraction mx-auto max-w-md rounded-2xl p-12">
            <Globe className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
            <h3 className="mb-2 text-xl font-bold tracking-tight">No Countries Found</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={onClearFilters}
              data-cuelume-press="tick"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md transition-all duration-150 active:scale-[0.98]"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
