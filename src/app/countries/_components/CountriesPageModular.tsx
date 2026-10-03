"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CountriesHeader } from "./CountriesHeader";
import { CountriesFocusGridModular } from "./CountriesFocusGridModular";
import { CountriesStats } from "./CountriesStats";
import { type CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { createAbsoluteUrl } from "~/lib/utils";
import { matchesTierFilter, type TierFilter } from "~/lib/economic-tier-filter";

interface CountriesPageModularProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  viewerCountryId?: string;
}

export const CountriesPageModular: React.FC<CountriesPageModularProps> = ({
  countries,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  searchQuery = "",
  onSearchChange,
  viewerCountryId,
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [randomSeed] = useState(Date.now);
  const [continentFilter, setContinentFilter] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  const handleCountryClick = useCallback((countryId: string, countryName: string) => {
    const slug = countryName.replace(/\s+/g, "_");
    window.location.href = createAbsoluteUrl(`/countries/${slug}`);
  }, []);

  // Filtered and shuffled by a per-visit seed (filter returns a new array, so props are not mutated).
  const processedCountries = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const seededHash = (id: string) =>
      (id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;

    return countries
      .filter((c) => !continentFilter || (c.continent || "Unknown") === continentFilter)
      .filter((c) => tierFilter === "all" || matchesTierFilter(c.economicTier, tierFilter))
      .filter(
        (c) =>
          !query ||
          [c.name, c.economicTier, c.continent, c.region].some((field) =>
            field?.toLowerCase().includes(query)
          )
      )
      .sort((a, b) => seededHash(a.id) - seededHash(b.id));
  }, [countries, continentFilter, tierFilter, searchQuery, randomSeed]);

  // Feeling lucky: open a random country from the current results
  const handleImFeelingLucky = () => {
    const pick = processedCountries[Math.floor(Math.random() * processedCountries.length)];
    if (pick) handleCountryClick(pick.id, pick.name);
  };

  // Key handler and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(null);
      }
    };

    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".country-focus-card") && expanded !== null) {
        setExpanded(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickAway);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClickAway);
    };
  }, [expanded]);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (visibleCount < processedCountries.length) {
      setVisibleCount((prev) => Math.min(prev + 12, processedCountries.length));
    } else if (hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [visibleCount, processedCountries.length, hasMore, onLoadMore]);

  // Scroll detection for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setContinentFilter(null);
    setTierFilter("all");
  }, []);

  return (
    <div className="bg-background relative min-h-screen">
      <div className="relative z-10 container mx-auto px-4 pt-4 pb-8">
        <CountriesHeader
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onImFeelingLucky={handleImFeelingLucky}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
        >
          <CountriesStats
            countries={processedCountries}
            allCountries={countries}
            continentFilter={continentFilter}
            onContinentFilter={setContinentFilter}
            onCountryClick={handleCountryClick}
          />
        </CountriesHeader>

        {/* Grid */}
        <CountriesFocusGridModular
          countries={processedCountries}
          visibleCount={visibleCount}
          hovered={hovered}
          setHovered={setHovered}
          expanded={expanded}
          setExpanded={setExpanded}
          onCountryClick={handleCountryClick}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onClearFilters={handleClearFilters}
          viewerCountryId={viewerCountryId}
        />
      </div>
    </div>
  );
};
