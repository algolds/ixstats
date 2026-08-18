"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, X, Globe } from "lucide-react";
import { CountriesHeader } from "./CountriesHeader";
import { CountriesFocusGridModular } from "./CountriesFocusGridModular";
import { CountriesStats } from "./CountriesStats";
import { type CountryCardData } from "~/components/countries/CountryFocusCard";
import { createAbsoluteUrl } from "~/lib/utils";
import { useDIPlugin } from "~/components/DynamicIsland";
import { CountriesDIView } from "~/components/DynamicIsland/CountriesDIView";

interface CountriesPageModularProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  viewerCountryId?: string;
}

export const SORT_OPTIONS = [
  "random",
  "name",
  "population",
  "gdp",
  "gdpPerCapita",
  "tier",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const FILTER_OPTIONS = ["all", "developed", "developing", "superpower"] as const;
export type FilterOption = (typeof FILTER_OPTIONS)[number];

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
  const [isDIPaletteOpen, setIsDIPaletteOpen] = useState(false);
  const [randomSeed, setRandomSeed] = useState(Date.now());
  const [continentFilter, setContinentFilter] = useState<string | null>(null);

  // Sync isDIPaletteOpen with actual Dynamic Island mode
  useEffect(() => {
    const handleDiModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: string }>;
      setIsDIPaletteOpen(customEvent.detail?.mode === "plugin:countries");
    };
    window.addEventListener("ix:di-mode-changed", handleDiModeChange);
    return () => {
      window.removeEventListener("ix:di-mode-changed", handleDiModeChange);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange?.(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  // Reshuffle function
  const handleReshuffle = useCallback(() => {
    setRandomSeed(Date.now());
    setSortBy("random");
  }, []);

  const handleCountryClick = useCallback((countryId: string, countryName: string) => {
    const slug = countryName.replace(/\s+/g, "_");
    window.location.href = createAbsoluteUrl(`/countries/${slug}`);
  }, []);

  // Filter and sort countries (cloning to prevent prop array mutation)
  const processedCountries = useMemo(() => {
    let result = [...countries];

    // Apply continent filter
    if (continentFilter) {
      result = result.filter((c) => (c.continent || "Unknown") === continentFilter);
    }

    // Apply filters
    if (filterBy !== "all") {
      result = result.filter((country) => {
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
      result = result.filter(
        (country) =>
          country.name.toLowerCase().includes(q) ||
          country.economicTier.toLowerCase().includes(q) ||
          (country.continent && country.continent.toLowerCase().includes(q)) ||
          (country.region && country.region.toLowerCase().includes(q))
      );
    }

    // Apply sorting
    if (sortBy === "random") {
      result.sort((a, b) => {
        const aHash =
          (a.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        const bHash =
          (b.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        return aHash - bHash;
      });
    } else {
      const tierOrder: readonly string[] = [
        "Extravagant",
        "Very Strong",
        "Strong",
        "Healthy",
        "Developed",
        "Developing",
        "Impoverished",
      ];
      result.sort((a, b) => {
        switch (sortBy) {
          case "population":
            return b.currentPopulation - a.currentPopulation;
          case "gdp":
            return b.currentTotalGdp - a.currentTotalGdp;
          case "gdpPerCapita":
            return b.currentGdpPerCapita - a.currentGdpPerCapita;
          case "tier":
            return tierOrder.indexOf(a.economicTier) - tierOrder.indexOf(b.economicTier);
          default:
            return a.name.localeCompare(b.name);
        }
      });
    }

    return result;
  }, [countries, continentFilter, filterBy, searchQuery, sortBy, randomSeed]);

  // I'm Feeling Lucky function
  const handleImFeelingLucky = useCallback(() => {
    if (processedCountries.length > 0) {
      const randomIndex = Math.floor(Math.random() * processedCountries.length);
      const randomCountry = processedCountries[randomIndex];
      if (randomCountry) {
        handleCountryClick(randomCountry.id, randomCountry.name);
      }
    }
  }, [processedCountries, handleCountryClick]);

  // Register the Countries Search Dynamic Island plugin
  const countriesDIPlugin = useMemo(() => {
    return {
      id: "countries",
      priority: 25, // Higher priority to override general plugins on this page
      center: (
        <span className="flex items-center gap-1.5 select-none">
          <Globe className="h-3.5 w-3.5 shrink-0 text-purple-400" />
          <span className="text-foreground/80 text-xs font-semibold">Countries Search</span>
        </span>
      ),
      expandedViews: {
        countries: () => (
          <CountriesDIView
            onClose={() => {
              window.dispatchEvent(
                new CustomEvent("ix:switch-di-mode", { detail: { mode: "compact" } })
              );
            }}
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
        ),
      },
      accentColor: "#a855f7",
      stickyLabel: "Countries Search",
    };
  }, [
    searchInput,
    sortBy,
    filterBy,
    handleReshuffle,
    handleImFeelingLucky,
    processedCountries.length,
  ]);

  useDIPlugin(countriesDIPlugin);

  // Tab key handler for command palette and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      if (e.key === "Tab" && !e.ctrlKey && !inInput) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("ix:switch-di-mode", {
            detail: { mode: isDIPaletteOpen ? "compact" : "plugin:countries" },
          })
        );
      }
      if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();
        handleImFeelingLucky();
      }
      if (e.key === "r" && isDIPaletteOpen && !inInput) {
        e.preventDefault();
        handleReshuffle();
      }
      if (e.key === "Escape") {
        if (isDIPaletteOpen) {
          window.dispatchEvent(
            new CustomEvent("ix:switch-di-mode", { detail: { mode: "compact" } })
          );
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, isDIPaletteOpen, processedCountries]);

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
    setFilterBy("all");
    setContinentFilter(null);
  }, []);

  return (
    <div className="bg-background relative min-h-screen">
      <div className="relative z-10 container mx-auto px-4 pb-8">
        {/* Unified Apple Control Panel with Search Bar & 4 Stat Cards */}
        <CountriesHeader
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onImFeelingLucky={handleImFeelingLucky}
        >
          <CountriesStats
            countries={processedCountries}
            allCountries={countries}
            searchQuery={searchQuery}
            filterBy={filterBy}
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
          searchInput={searchInput}
          filterBy={filterBy}
          onClearFilters={handleClearFilters}
          viewerCountryId={viewerCountryId}
        />
      </div>
    </div>
  );
};
