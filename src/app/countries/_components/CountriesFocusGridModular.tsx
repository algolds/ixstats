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
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";

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
                "relative transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
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
                <FacetCard
                  key={i}
                  depth={2}
                  className="flex h-60 flex-col justify-end rounded-2xl p-5 md:h-96"
                >
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-4 space-y-2 pt-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-4/5" />
                    </div>
                  </div>
                </FacetCard>
              ))}
            </div>
          </ProgressiveBlur>
        </div>
      )}

      {/* Load More Button */}
      {!isLoading && visibleCount < countries.length && (
        <div className="mt-12 text-center">
          <Button type="button" size="lg" onClick={loadMore}>
            Load More Countries
          </Button>
        </div>
      )}

      {/* End Message */}
      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            You've viewed all {countries.length} countries
          </p>
        </div>
      )}

      {/* Empty State */}
      {countries.length === 0 && !isLoading && (
        <div className="mt-12 text-center">
          <FacetCard depth={2} className="mx-auto max-w-md rounded-2xl p-12">
            <Globe aria-hidden="true" className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-xl font-semibold tracking-tight">
              No Countries Found
            </h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Try adjusting your search or filter criteria
            </p>
            <Button type="button" onClick={onClearFilters}>
              Clear Filters
            </Button>
          </FacetCard>
        </div>
      )}
    </div>
  );
};
