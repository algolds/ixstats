"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CountryFocusCardBuilder, type CountryCardData } from "./CountryFocusCardBuilder";
import { RiGlobalLine } from "react-icons/ri";
import { motion, useAnimation } from "framer-motion";
import { BlurFade } from "~/components/magicui/blur-fade";
import { ProgressiveBlur } from '~/components/magicui/progressive-blur';

interface CountriesFocusGridModularProps {
  countries: CountryCardData[];
  visibleCount: number;
  onCountryClick: (countryId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  searchInput: string;
  filterBy: string;
  onClearFilters: () => void;
  cardSize?: 'default' | 'small';
  onCardHoverChange: (countryId: string | null) => void;
  scrollPosition: number;
  softSelectedCountryId?: string | null;
  parallaxOffsets?: number[];
  isAutoScrolling?: boolean;
}

const CountryCard: React.FC<{
  country: CountryCardData;
  index: number;
  onHoverChange: (countryId: string | null) => void;
  onCountryClick: (countryId: string) => void;
  cardSize?: 'default' | 'small';
  softSelectedCountryId?: string | null;
  parallaxOffset: number;
}> = ({
  country,
  index,
  onHoverChange,
  onCountryClick,
  cardSize,
  softSelectedCountryId,
  parallaxOffset,
}) => {
  const controls = useAnimation();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHoverChange(country.id);
    controls.start({
      filter: "brightness(1.1) saturate(1.1)",
      scale: 1.02,
      transition: { type: "spring", stiffness: 300, damping: 20 },
    });
  }, [country.id, onHoverChange, controls]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverChange(null);
    controls.start({
      filter: "brightness(1) saturate(1)",
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 20 },
    });
  }, [onHoverChange, controls]);

  const numColumns = 4;
  const rowIndex = Math.floor(index / numColumns);
  const blurIntensity = Math.min(rowIndex * 0.5, 2);

  return (
    <BlurFade
      key={country.id}
      delay={index * 0.03}
      duration={0.5}
      offset={6}
      direction="up"
      blur="3px"
    >
      <div className="relative h-full">
        <motion.div
          style={{ y: parallaxOffset }}
          className="h-full"
          animate={controls}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <CountryFocusCardBuilder
            country={country}
            onHoverChange={() => {}}
            onCountryClick={onCountryClick}
            cardSize={cardSize}
            softSelectedCountryId={softSelectedCountryId}
          />
        </motion.div>
        {rowIndex > 1 && (
          <ProgressiveBlur
            position="both"
            height="100%"
            blurLevels={[blurIntensity, blurIntensity * 1.5, blurIntensity * 2]}
            className="opacity-30 pointer-events-none"
          />
        )}
      </div>
    </BlurFade>
  );
};

export const CountriesFocusGridModularBuilder: React.FC<CountriesFocusGridModularProps> = ({
  countries,
  visibleCount,
  onCountryClick,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  searchInput,
  filterBy,
  onClearFilters,
  cardSize,
  onCardHoverChange,
  scrollPosition,
  softSelectedCountryId,
  parallaxOffsets = [],
  isAutoScrolling = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleCountries = countries.slice(0, visibleCount);

  return (
    <div className="space-y-12" ref={containerRef}>
      <div className="relative">
        {isAutoScrolling && (
          <div className="absolute top-0 right-0 z-10 p-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400/60"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 glass-surface shadow-xl rounded-lg p-4 backdrop-blur-sm overflow-hidden">
          {visibleCountries.map((country, index) => {
            const columnIndex = index % 4;
            const parallaxOffset = parallaxOffsets[columnIndex] ?? 0;
            return (
              <CountryCard
                key={country.id}
                country={country}
                index={index}
                onHoverChange={onCardHoverChange}
                onCountryClick={onCountryClick}
                cardSize={cardSize}
                softSelectedCountryId={softSelectedCountryId}
                parallaxOffset={parallaxOffset}
              />
            );
          })}
        </div>
      </div>

      {(isLoading || (hasMore && visibleCount < countries.length)) && (
        <div className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse glass-floating glass-refraction"
              >
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/5 rounded w-2/3"></div>
                  <div className="space-y-2 mt-4">
                    <div className="h-3 bg-white/5 rounded"></div>
                    <div className="h-3 bg-white/5 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="text-center mt-12">
          <div className="inline-block px-6 py-4 glass-floating glass-refraction">
            <p className="text-muted-foreground">
              You've viewed all {countries.length} countries
            </p>
          </div>
        </div>
      )}

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