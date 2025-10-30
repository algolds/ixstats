"use client";

import React from "react";
import { motion } from "framer-motion";
import { CountryFocusCard, type CountryCardData } from "~/components/countries/CountryFocusCard";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { RiGlobalLine } from "react-icons/ri";

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
}) => {
  const visibleCountries = countries.slice(0, visibleCount);

  const loadMore = () => {
    if (onLoadMore) {
      onLoadMore();
    }
  };

  return (
    <div className="space-y-12">
      {/* Countries Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCountries.map((country, index) => (
          <motion.div
            key={country.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.05,
              ease: "easeOut",
            }}
          >
            <CountryFocusCard
              country={country}
              index={index}
              hovered={hovered}
              setHovered={setHovered}
              expanded={expanded}
              setExpanded={setExpanded}
              onCountryClick={onCountryClick}
            />
          </motion.div>
        ))}
      </div>

      {/* Loading State with Progressive Blur */}
      {(isLoading || visibleCount < countries.length) && (
        <div className="mt-12">
          <ProgressiveBlur>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-surface glass-refraction h-60 animate-pulse md:h-80">
                  <div className="space-y-4 p-6">
                    <div className="bg-muted/30 h-6 rounded"></div>
                    <div className="bg-muted/20 h-4 w-2/3 rounded"></div>
                    <div className="mt-4 space-y-2">
                      <div className="bg-muted/20 h-3 rounded"></div>
                      <div className="bg-muted/20 h-3 w-3/4 rounded"></div>
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-8 py-3 font-medium transition-colors"
          >
            Load More Countries
          </button>
        </div>
      )}

      {/* End Message */}
      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="mt-12 text-center">
          <div className="glass-floating glass-refraction inline-block px-6 py-4">
            <p className="text-muted-foreground">You've viewed all {countries.length} countries</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {countries.length === 0 && !isLoading && (
        <div className="mt-12 text-center">
          <div className="glass-floating glass-refraction mx-auto max-w-md p-12">
            <RiGlobalLine className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
            <h3 className="mb-2 text-xl font-semibold">No Countries Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={onClearFilters}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
