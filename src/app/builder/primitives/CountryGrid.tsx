"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { CountriesFocusGridModularBuilder } from "../components/CountriesFocusGridModularBuilder";
import type { RealCountryData } from "../lib/economy-data-service";
import type { CountryCardData } from "../components/CountryFocusCardBuilder";
import { useBuilderFilter } from "../components/builder-filter-context";
import { DYNAMIC_ISLAND_STYLE, RefractiveGridBezel } from "../components/glass";

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

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
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
  const cardCounterRef = useRef(0);

  const [displayCountries, setDisplayCountries] = useState<CountryCardData[]>([]);

  const generateRandomChunk = useCallback((baseCountries: RealCountryData[]) => {
    if (baseCountries.length === 0) return [];
    const shuffled = shuffleArray(baseCountries);
    return shuffled.map((c) => {
      const uniqueId = `${c.countryCode}-card-${cardCounterRef.current++}`;
      return {
        id: uniqueId,
        name: c.name,
        originalId: c.countryCode,
      };
    });
  }, []);

  const checkAndAppendCountries = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || filteredCountries.length === 0) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // If we are within 400px of the bottom, append another shuffled chunk!
    if (scrollTop + clientHeight >= scrollHeight - 400) {
      setDisplayCountries((prev) => {
        const newChunk = generateRandomChunk(filteredCountries);
        return [...prev, ...newChunk];
      });
    }
  }, [filteredCountries, generateRandomChunk]);

  const handleCardHoverChange = useCallback((countryId: string | null) => {
    if (countryId) {
      const originalId = countryId.split("-card-")[0] || countryId;
      const hovered = countries.find((c) => c.countryCode === originalId);
      onCountryHover(hovered || null);
    } else {
      onCountryHover(null);
    }
  }, [countries, onCountryHover]);

  const handleCardClick = useCallback((countryId: string) => {
    const originalId = countryId.split("-card-")[0] || countryId;
    const selected = filteredCountries.find((c) => c.countryCode === originalId);
    if (selected) {
      onCountryClick(selected);
    }
  }, [filteredCountries, onCountryClick]);

  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || filteredCountries.length === 0) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    const { scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    // Smooth increment
    scrollPositionRef.current += AUTO_SCROLL_SPEED;

    // Apply scroll position smoothly
    container.scrollTop = scrollPositionRef.current;

    // Check if we need to append more countries
    checkAndAppendCountries();

    // Continue animation
    animationRef.current = requestAnimationFrame(runAutoScroll);
  }, [filteredCountries.length, checkAndAppendCountries]);

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
    if (container) {
      if (!isAutoScrolling) {
        scrollPositionRef.current = container.scrollTop;
        onScroll(container.scrollTop);
      }
      checkAndAppendCountries();
    }
  }, [isAutoScrolling, onScroll, checkAndAppendCountries]);

  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrolling((prev) => !prev);
  }, []);

  // Reset on filter changes
  useEffect(() => {
    scrollPositionRef.current = 0;
    cardCounterRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    if (filteredCountries.length > 0) {
      const initialList: CountryCardData[] = [];
      // Keep appending shuffled chunks until we have at least 36 items
      while (initialList.length < 36) {
        initialList.push(...generateRandomChunk(filteredCountries));
      }
      setDisplayCountries(initialList);
    } else {
      setDisplayCountries([]);
    }
  }, [searchTerm, selectedArchetype, filteredCountries, generateRandomChunk]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-xl border-t border-l border-zinc-300/80 dark:border-black/80 border-r border-b border-white/60 dark:border-white/10 bg-zinc-100/70 dark:bg-zinc-950/40 shadow-[inset_0_5px_15px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_6px_20px_rgba(0,0,0,0.65)] backdrop-blur-md"
        style={{
          marginTop: `-${heroHeight}px`,
        }}
      >
        <div
          ref={scrollContainerRef}
          className="relative scrollbar-none overflow-y-auto rounded-xl transition-all duration-300 ease-out"
          style={{
            paddingTop: `${heroHeight + 16}px`,
            paddingBottom: "32px",
            paddingLeft: "16px",
            paddingRight: "16px",
            maxHeight: `calc(70vh + ${heroHeight}px)`,
          }}
          data-country-grid="true"
          onScroll={handleScroll}
        >
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
            <div className="flex flex-col gap-6">
              <CountriesFocusGridModularBuilder
                countries={displayCountries}
                visibleCount={displayCountries.length}
                onCardHoverChange={handleCardHoverChange}
                onCountryClick={handleCardClick}
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
                variant="raw"
              />
            </div>
          )}
        </div>

        {/* Top fade gradient */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 h-8 bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/50 to-transparent" />

        {/* Fused Refractive U-Bezel */}
        <RefractiveGridBezel countryCount={filteredCountries.length} />
      </div>
    </div>
  );
}
