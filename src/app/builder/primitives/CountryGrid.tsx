"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Pause, Play } from "lucide-react";
import { CountriesFocusGridModularBuilder } from "../components/CountriesFocusGridModularBuilder";
import type { RealCountryData } from "../lib/economy-data-service";
import type { CountryCardData } from "../components/CountryFocusCardBuilder";

interface CountryGridProps {
  countries: RealCountryData[];
  filteredCountries: RealCountryData[];
  searchTerm: string;
  selectedArchetype: string;
  onCountryHover: (country: RealCountryData | null) => void;
  onCountryClick: (country: RealCountryData) => void;
  onClearFilters: () => void;
  softSelectedCountryId: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
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
  onMouseEnter,
  onMouseLeave,
  scrollPosition,
  onScroll,
  flagUrls = {},
}: CountryGridProps) {
  // Configuration
  const AUTO_SCROLL_SPEED = 0.5; // Pixels per frame - smooth and slow
  const PAUSE_ON_HOVER_DELAY = 150; // ms before pausing on hover
  const RESUME_AFTER_INTERACTION = 2000; // ms after interaction before resuming

  // State
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Smooth auto-scroll animation using requestAnimationFrame
  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isPaused || infiniteCountries.length === 0) {
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
  }, [isPaused, infiniteCountries.length]);

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

  // Handle mouse enter - pause after delay
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    onMouseEnter();

    // Clear any pending resume
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    // Pause after short delay
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
    }, PAUSE_ON_HOVER_DELAY);
  }, [onMouseEnter]);

  // Handle mouse leave - resume after delay
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    onMouseLeave();

    // Clear pause timeout if still pending
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    // Resume after delay
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, RESUME_AFTER_INTERACTION);
  }, [onMouseLeave]);

  // Handle manual scroll - sync position
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container && !isAutoScrolling) {
      scrollPositionRef.current = container.scrollTop;
      onScroll(container.scrollTop);
    }
  }, [isAutoScrolling, onScroll]);

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrolling((prev) => !prev);
    setIsPaused(false);
  }, []);

  // Reset on filter changes
  useEffect(() => {
    scrollPositionRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, selectedArchetype, filteredCountries]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const isEffectivelyPaused = isPaused || !isAutoScrolling;

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Auto-scroll indicator */}
      <AnimatePresence>
        {isHovering && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-10 right-0 z-30"
          >
            <button
              onClick={toggleAutoScroll}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400 backdrop-blur-sm transition-colors hover:bg-emerald-500/30"
            >
              {isAutoScrolling ? (
                <>
                  <Pause className="h-3 w-3" />
                  {isPaused ? "Paused" : "Auto-scrolling"}
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Resume auto-scroll
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Container */}
      <div
        ref={scrollContainerRef}
        className="relative max-h-[70vh] scrollbar-none overflow-y-auto rounded-xl"
        data-country-grid="true"
        onScroll={handleScroll}
        style={{
          scrollBehavior: isEffectivelyPaused ? "smooth" : "auto",
        }}
      >
        {/* Top fade gradient */}
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-8 bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/50 to-transparent" />

        {/* Bottom fade gradient */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-12 bg-gradient-to-t from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/50 to-transparent" />

        {/* Ambient glow when auto-scrolling */}
        {isAutoScrolling && !isPaused && filteredCountries.length > 0 && (
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
            isAutoScrolling={isAutoScrolling && !isPaused}
            flagUrls={flagUrls}
          />
        )}
      </div>

      {/* Scroll status indicator */}
      {filteredCountries.length > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{filteredCountries.length} countries</span>
          {isAutoScrolling && (
            <>
              <span className="text-[var(--color-text-muted)]/50">•</span>
              <span className={isPaused ? "text-amber-400" : "text-emerald-400"}>
                {isPaused ? "Paused" : "Auto-scrolling"}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
