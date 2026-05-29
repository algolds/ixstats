"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { CountriesFocusGridModularBuilder } from "../components/CountriesFocusGridModularBuilder";
import type { RealCountryData } from "../lib/economy-data-service";
import type { CountryCardData } from "../components/CountryFocusCardBuilder";
import { useBuilderFilter } from "../components/builder-filter-context";

interface CountryGridProps {
  countries: RealCountryData[];
  filteredCountries: RealCountryData[];
  searchTerm: string;
  selectedArchetype: string;
  onCountryHover: (country: RealCountryData | null) => void;
  onCountryClick: (country: RealCountryData) => void;
  onClearFilters: () => void;
  softSelectedCountryId: string | null;
  scrollPosition: number;
  onScroll: (position: number) => void;
  flagUrls?: Record<string, string | null>;
}

export function CountryGrid({
  countries,
  filteredCountries,
  searchTerm,
  selectedArchetype,
  onCountryHover,
  onCountryClick,
  onClearFilters,
  softSelectedCountryId,
  scrollPosition,
  onScroll,
  flagUrls = {},
}: CountryGridProps) {
  const { heroHeight } = useBuilderFilter();
  const AUTO_SCROLL_SPEED = 0.5;

  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  // Create infinite loop data - duplicate countries for seamless scrolling
  const infiniteCountries = useMemo(() => {
    if (filteredCountries.length === 0) return [];

    const maxCountries = Math.min(24, filteredCountries.length);
    const baseCountries = filteredCountries.slice(0, maxCountries);
    const duplicatedSet: CountryCardData[] = [];

    // Create 3 sets for seamless infinite scroll
    for (let setIndex = 0; setIndex < 3; setIndex++) {
      baseCountries.forEach((country, countryIndex) => {
        duplicatedSet.push({
          id: `${country.countryCode}-set${setIndex}-${countryIndex}`,
          name: country.name,
          originalId: country.countryCode,
        });
      });
    }

    return duplicatedSet;
  }, [filteredCountries]);

  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || infiniteCountries.length === 0) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    const { scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    // Calculate section height (one copy of content)
    const sectionHeight = scrollHeight / 3; // 3 copies

    // Smooth increment
    scrollPositionRef.current += AUTO_SCROLL_SPEED;

    // Seamless loop - reset when we've scrolled past first section
    if (scrollPositionRef.current >= sectionHeight) {
      scrollPositionRef.current = 0;
    }

    // Apply scroll position smoothly
    container.scrollTop = scrollPositionRef.current;

    // Continue animation
    animationRef.current = requestAnimationFrame(runAutoScroll);
  }, [infiniteCountries.length]);

  // Start/stop auto-scroll
  useEffect(() => {
    if (isAutoScrolling) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAutoScrolling, runAutoScroll]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container && !isAutoScrolling) {
      scrollPositionRef.current = container.scrollTop;
      onScroll(container.scrollTop);
    }
  }, [isAutoScrolling, onScroll]);

  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrolling((prev) => !prev);
  }, []);

  // Reset on filter changes
  useEffect(() => {
    scrollPositionRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, selectedArchetype, filteredCountries]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="relative scrollbar-none overflow-y-auto rounded-xl transition-all duration-300 ease-out"
        style={{
          marginTop: `-${heroHeight}px`,
          paddingTop: `${heroHeight}px`,
          maxHeight: `calc(70vh + ${heroHeight}px)`,
        }}
        data-country-grid="true"
        onScroll={handleScroll}
      >
        {/* Top fade gradient */}
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-8 bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/50 to-transparent" />

        {/* Bottom fade gradient */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-12 bg-gradient-to-t from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/50 to-transparent" />

        {/* Ambient glow when auto-scrolling */}
        {isAutoScrolling && filteredCountries.length > 0 && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        )}

        {/* Content */}
        {filteredCountries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-[var(--color-border-primary)]/50 bg-[var(--color-bg-secondary)]/80 p-12 text-center backdrop-blur-sm"
          >
            <Globe className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-muted)]/50" />
            <p className="text-[var(--color-text-muted)]">No countries match your criteria</p>
            <button
              onClick={onClearFilters}
              className="mt-4 text-sm text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Clear filters
            </button>
          </motion.div>
        ) : (
          <CountriesFocusGridModularBuilder
            countries={infiniteCountries}
            visibleCount={infiniteCountries.length}
            onCardHoverChange={(countryId: string | null) => {
              if (countryId) {
                const originalId =
                  infiniteCountries.find((c) => c.id === countryId)?.originalId || countryId;
                const hovered = countries.find((c) => c.countryCode === originalId);
                onCountryHover(hovered || null);
              } else {
                onCountryHover(null);
              }
            }}
            onCountryClick={(countryId: string) => {
              const originalId =
                infiniteCountries.find((c) => c.id === countryId)?.originalId || countryId;
              const selected = filteredCountries.find((c) => c.countryCode === originalId);
              if (selected) {
                onCountryClick(selected);
              }
            }}
            isLoading={false}
            hasMore={false}
            onLoadMore={() => {}}
            searchInput={searchTerm}
            filterBy={selectedArchetype}
            onClearFilters={onClearFilters}
            cardSize="small"
            scrollPosition={scrollPositionRef.current}
            softSelectedCountryId={softSelectedCountryId}
            parallaxOffsets={[]}
            isAutoScrolling={isAutoScrolling}
            flagUrls={flagUrls}
          />
        )}
      </div>

      {filteredCountries.length > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{filteredCountries.length} countries</span>
        </div>
      )}
    </div>
  );
}
