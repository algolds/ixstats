"use client";

import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Globe, Search } from "lucide-react";
import { api } from "~/trpc/react";
import { BlurFade } from "~/components/ui/magicui/blur-fade";
import { formatPopulation } from "~/lib/utils";
import { CountryStatsModal } from "./CountryStatsModal";

interface EligibleCountryGridProps {
  site: "iiwiki" | "althistory";
  /** When non-empty, filters the grid cards by displayName (case-insensitive substring). */
  searchFilter?: string;
  /** Called when a grid card is clicked. Receives the country's wiki page name. */
  onCountryClick?: (pageName: string) => void;
}

interface EligibleCountry {
  displayName: string;
  pageName?: string;
  flagUrl?: string;
  completeness: number;
  leaderTitle?: string;
  leaderName?: string;
  population?: number;
  gdp?: string;
  governmentType?: string;
  capital?: string;
  currency?: string;
  currencyCode?: string;
  languages?: string;
  areaKm2?: number;
  demonym?: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanization?: number;
  internetTld?: string;
  callingCode?: string;
  anthem?: string;
  motto?: string;
  coordinates?: string;
  largestCity?: string;
  officialName?: string;
}

export function EligibleCountryGrid({
  site,
  searchFilter,
  onCountryClick,
}: EligibleCountryGridProps) {
  const AUTO_SCROLL_SPEED = 0.5;
  const RESUME_AFTER_HOVER = 2000;
  const MIN_COMPLETENESS = 80;

  const { data: countries, isLoading } = api.countries.getEligibleCountries.useQuery({ site });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<EligibleCountry | null>(null);

  const isFiltering = !!searchFilter?.trim();

  // Filter countries: only show those with >80% completeness
  const filteredCountries: EligibleCountry[] = useMemo(() => {
    if (!countries || countries.length === 0) return [];
    const qualified = countries.filter((c) => c.completeness > MIN_COMPLETENESS);
    if (!isFiltering) return qualified;
    const needle = (searchFilter ?? "").trim().toLowerCase();
    return qualified.filter((c) => c.displayName.toLowerCase().includes(needle));
  }, [countries, searchFilter, isFiltering]);

  // When filtering, show the filtered list once. When idle, duplicate 3× for infinite scroll.
  const displayCountries: EligibleCountry[] = useMemo(() => {
    if (isFiltering) return filteredCountries;
    if (filteredCountries.length === 0) return [];
    const duplicated: EligibleCountry[] = [];
    for (let i = 0; i < 3; i++) {
      for (const country of filteredCountries) {
        duplicated.push({ ...country });
      }
    }
    return duplicated;
  }, [filteredCountries, isFiltering]);

  // Auto-scroll should pause when filtering or when the user hovers
  const shouldScroll = !isPaused && !isFiltering;

  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !shouldScroll || displayCountries.length === 0) {
      return; // Don't schedule next frame when paused
    }

    const { scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      animationRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    const sectionHeight = scrollHeight / 3;

    scrollPositionRef.current += AUTO_SCROLL_SPEED;

    if (scrollPositionRef.current >= sectionHeight) {
      scrollPositionRef.current = 0;
    }

    container.scrollTop = scrollPositionRef.current;

    animationRef.current = requestAnimationFrame(runAutoScroll);
  }, [shouldScroll, displayCountries.length]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(runAutoScroll);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [runAutoScroll]);

  // Reset scroll position when transitioning from filtering back to idle
  useEffect(() => {
    if (!isFiltering && scrollContainerRef.current) {
      scrollPositionRef.current = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isFiltering]);

  const handleMouseEnter = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, RESUME_AFTER_HOVER);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="relative">
        <div className="relative max-h-[60vh] scrollbar-none overflow-y-auto rounded-xl">
          <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-8 bg-gradient-to-b from-[var(--color-bg-primary)] to-transparent" />
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-12 bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent" />
          <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!countries || countries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border-primary)]/50 bg-[var(--color-bg-secondary)]/50 p-12 text-center backdrop-blur-sm">
        <Globe className="mb-4 h-12 w-12 text-[var(--color-text-muted)]/50" />
        <p className="font-medium text-[var(--color-text-primary)]">No eligible countries found</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Countries need 80%+ infobox data completeness to appear here
        </p>
      </div>
    );
  }

  // Filtering active but no matches
  if (isFiltering && filteredCountries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border-primary)]/50 bg-[var(--color-bg-secondary)]/50 p-8 text-center backdrop-blur-sm">
        <Search className="mb-3 h-8 w-8 text-[var(--color-text-muted)]/50" />
        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          No matches for &ldquo;{searchFilter}&rdquo;
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Try the search bar above for a full wiki search
        </p>
      </div>
    );
  }

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Filter result count badge */}
      <AnimatePresence>
        {isFiltering && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-2 flex items-center gap-2 px-1"
          >
            <Search className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Showing{" "}
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                {filteredCountries.length}
              </span>{" "}
              of {countries.length} countries
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={scrollContainerRef}
        className="relative max-h-[60vh] scrollbar-none overflow-y-auto rounded-xl"
      >
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-8 bg-gradient-to-b from-[var(--color-bg-primary)] to-transparent" />
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-12 bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent" />

        <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayCountries.map((country, index) =>
            isFiltering ? (
              <BlurFade
                key={`${country.displayName}-${index}`}
                delay={index * 0.04}
                duration={0.5}
                direction="up"
                blur="3px"
              >
                <EligibleCountryCard
                  country={country}
                  onClick={() => setSelectedCountry(country)}
                />
              </BlurFade>
            ) : (
              <EligibleCountryCard
                key={`${country.displayName}-${index}`}
                country={country}
                onClick={() => setSelectedCountry(country)}
              />
            )
          )}
        </div>
      </div>

      {selectedCountry && (
        <CountryStatsModal
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          onImport={() => {
            setSelectedCountry(null);
            onCountryClick?.(selectedCountry.pageName ?? selectedCountry.displayName);
          }}
        />
      )}
    </div>
  );
}

const EligibleCountryCard = React.memo(function EligibleCountryCard({
  country,
  onClick,
}: {
  country: EligibleCountry;
  onClick?: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  // Only countries with a valid, loadable flag belong in the grid — drop the rest.
  if (!country.flagUrl || imgError) return null;

  return (
    <motion.div
      className={`glass-floating glass-refraction relative h-48 overflow-hidden rounded-xl${onClick ? "cursor-pointer" : ""}`}
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
    >
      <img
        src={country.flagUrl}
        alt={`Flag of ${country.displayName}`}
        className="absolute inset-0 h-full w-full object-cover object-center"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />

      <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 hover:opacity-100" />

      <div className="absolute right-0 bottom-0 left-0 p-4">
        <p className="text-lg font-bold text-white [text-shadow:0_0_10px_rgba(0,0,0,0.5)]">
          {country.displayName}
        </p>
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-white/70 [text-shadow:0_0_8px_rgba(0,0,0,0.6)]">
          {country.population !== undefined && <p>Pop: {formatPopulation(country.population)}</p>}
          {country.gdp && <p className="truncate">GDP: {country.gdp}</p>}
          {country.governmentType && <p className="truncate">Gov: {country.governmentType}</p>}
        </div>
      </div>
    </motion.div>
  );
});
