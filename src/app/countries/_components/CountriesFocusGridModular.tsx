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
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

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

      {/* Loading placeholders */}
      {(isLoading || visibleCount < countries.length) && (
        <div className="mt-12">
          <ProgressiveBlur>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="rounded-card flex h-60 flex-col justify-end p-5 md:h-96">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="mt-4 space-y-2 pt-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-4/5" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ProgressiveBlur>
        </div>
      )}

      {!isLoading && visibleCount < countries.length && (
        <div className="mt-12 text-center">
          <Button type="button" size="lg" onClick={loadMore}>
            Load more countries
          </Button>
        </div>
      )}

      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="mt-12 text-center">
          <p className="text-label-secondary text-body font-medium">
            All {countries.length} countries shown
          </p>
        </div>
      )}

      {countries.length === 0 && !isLoading && (
        <div className="mt-12 text-center">
          <Card className="rounded-card mx-auto max-w-md p-12">
            <Globe aria-hidden="true" className="text-label-secondary mx-auto mb-4 h-12 w-12" />
            <h3 className="text-label text-title-2 mb-2">No countries match</h3>
            <p className="text-label-secondary text-body mb-6">
              Change the search or clear the filters to see more countries.
            </p>
            <Button type="button" onClick={onClearFilters}>
              Clear filters
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
