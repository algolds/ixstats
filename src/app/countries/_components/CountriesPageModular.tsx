"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { CountriesHeader } from "./CountriesHeader";
import { CountriesFocusGridModular } from "./CountriesFocusGridModular";
import { CountriesStats } from "./CountriesStats";
import { CountriesCommandPalette } from "./CountriesCommandPalette";
import { type CountryCardData } from "~/components/countries/CountryFocusCard";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface CountriesPageModularProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  viewerCountryId?: string;
}

type SortOption = "random" | "name" | "population" | "gdp" | "gdpPerCapita" | "tier";
type FilterOption = "all" | "developed" | "developing" | "superpower";

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
  const [sortBy, setSortBy] = useState<SortOption>("random");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showDynamicIsland, setShowDynamicIsland] = useState(false);
  const [randomSeed, setRandomSeed] = useState(Date.now());
  const [continentFilter, setContinentFilter] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  // Reshuffle function
  const handleReshuffle = () => {
    setRandomSeed(Date.now());
    setSortBy("random");
  };

  // Filter and sort countries
  const processedCountries = useMemo(() => {
    let filtered = countries;

    // Apply continent filter
    if (continentFilter) {
      filtered = filtered.filter((c) => (c.continent || "Unknown") === continentFilter);
    }

    // Apply filters
    if (filterBy !== "all") {
      filtered = filtered.filter((country) => {
        switch (filterBy) {
          case "developed":
            return ["Developed", "Healthy", "Strong", "Very Strong", "Extravagant"].includes(
              country.economicTier
            );
          case "developing":
            return ["Impoverished", "Developing"].includes(country.economicTier);
          case "superpower":
            return country.currentTotalGdp > 5e12; // $5T+ GDP
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (country) =>
          country.name.toLowerCase().includes(q) ||
          country.economicTier.toLowerCase().includes(q) ||
          (country.continent && country.continent.toLowerCase().includes(q)) ||
          (country.region && country.region.toLowerCase().includes(q))
      );
    }

    // Apply sorting
    if (sortBy === "random") {
      // Create a stable random sort based on country ID and randomSeed to maintain consistency but allow reshuffling
      filtered.sort((a, b) => {
        const aHash =
          (a.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        const bHash =
          (b.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        return aHash - bHash;
      });
    } else {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "population":
            return b.currentPopulation - a.currentPopulation;
          case "gdp":
            return b.currentTotalGdp - a.currentTotalGdp;
          case "gdpPerCapita":
            return b.currentGdpPerCapita - a.currentGdpPerCapita;
          case "tier":
            const tierOrder = [
              "Extravagant",
              "Very Strong",
              "Strong",
              "Healthy",
              "Developed",
              "Developing",
              "Impoverished",
            ];
            return tierOrder.indexOf(a.economicTier) - tierOrder.indexOf(b.economicTier);
          default:
            return a.name.localeCompare(b.name);
        }
      });
    }

    return filtered;
  }, [countries, continentFilter, filterBy, searchQuery, sortBy, randomSeed]);

  // I'm Feeling Lucky function
  const handleImFeelingLucky = () => {
    if (processedCountries.length > 0) {
      const randomIndex = Math.floor(Math.random() * processedCountries.length);
      const randomCountry = processedCountries[randomIndex];
      if (randomCountry) {
        handleCountryClick(randomCountry.id, randomCountry.name);
      }
    }
  };

  // Tab key handler for command palette and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      if (e.key === "Tab" && !e.ctrlKey && !inInput) {
        e.preventDefault();
        setShowDynamicIsland((prev) => !prev);
      }
      if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();
        handleImFeelingLucky();
      }
      if (e.key === "r" && showDynamicIsland && !inInput) {
        e.preventDefault();
        handleReshuffle();
      }
      if (e.key === "Escape") {
        setShowDynamicIsland(false);
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
  }, [expanded, showDynamicIsland, processedCountries]);

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

  const handleCountryClick = (countryId: string, countryName: string) => {
    // Use country name for pretty URLs, replace spaces with underscores
    const slug = countryName.replace(/\s+/g, "_");
    window.location.href = createAbsoluteUrl(`/countries/${slug}`);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilterBy("all");
    setContinentFilter(null);
  };

  return (
    <div className="bg-background relative min-h-screen">
      <div className="relative z-50 container mx-auto px-4 py-8">
        {/* Header */}
        <CountriesHeader onOpenCommandPalette={() => setShowDynamicIsland(true)} />

        {/* Inline search bar */}
        <div className="relative mx-auto mb-8 w-full max-w-xl">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search countries by name, tier, continent, region..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring h-10 w-full rounded-lg border pl-10 pr-10 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="text-muted-foreground mt-1.5 text-center text-xs">
            {searchInput
              ? `${processedCountries.length} country${processedCountries.length !== 1 ? "ies" : "y"} match${processedCountries.length !== 1 ? "es" : ""}`
              : `${countries.length} total countries`}
          </div>
        </div>

        {/* Stats */}
        <CountriesStats
          countries={processedCountries}
          allCountries={countries}
          searchQuery={searchQuery}
          filterBy={filterBy}
          continentFilter={continentFilter}
          onContinentFilter={setContinentFilter}
          onCountryClick={handleCountryClick}
        />

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
          searchInput={searchInput}
          filterBy={filterBy}
          onClearFilters={handleClearFilters}
          viewerCountryId={viewerCountryId}
        />
      </div>

      {/* Command Palette */}
      <CountriesCommandPalette
        isOpen={showDynamicIsland}
        onClose={() => setShowDynamicIsland(false)}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
        onReshuffle={handleReshuffle}
        onImFeelingLucky={handleImFeelingLucky}
        resultsCount={processedCountries.length}
      />
    </div>
  );
};
