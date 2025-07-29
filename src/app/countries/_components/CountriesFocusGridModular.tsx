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
  onCountryClick: (countryId: string) => void;
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
  onClearFilters
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleCountries.map((country, index) => (
          <motion.div
            key={country.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.05,
              ease: "easeOut"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-60 md:h-80 animate-pulse glass-surface glass-refraction"
                >
                  <div className="p-6 space-y-4">
                    <div className="h-6 bg-muted/30 rounded"></div>
                    <div className="h-4 bg-muted/20 rounded w-2/3"></div>
                    <div className="space-y-2 mt-4">
                      <div className="h-3 bg-muted/20 rounded"></div>
                      <div className="h-3 bg-muted/20 rounded w-3/4"></div>
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
        <div className="text-center mt-12">
          <button
            onClick={loadMore}
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
          >
            Load More Countries
          </button>
        </div>
      )}

      {/* End Message */}
      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="text-center mt-12">
          <div className="inline-block px-6 py-4 glass-floating glass-refraction">
            <p className="text-muted-foreground">
              You've viewed all {countries.length} countries
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {countries.length === 0 && !isLoading && (
        <div className="text-center mt-12">
          <div className="p-12 max-w-md mx-auto glass-floating glass-refraction">
            <RiGlobalLine className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No Countries Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={onClearFilters}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};