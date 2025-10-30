"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountryFocusCard, type CountryCardData } from "./CountryFocusCard";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { CharacterBlurReveal } from "~/components/ui/character-blur-reveal";
import { RainbowButton } from "~/components/magicui/rainbow-button";
import { TextAnimate } from "~/components/magicui/text-animate";
import { createAbsoluteUrl } from "~/lib/url-utils";
import {
  RiSearchLine,
  RiFilterLine,
  RiSortAsc,
  RiGlobalLine,
  RiBarChartLine,
  RiGroupLine,
  RiCommandLine,
} from "react-icons/ri";

interface CountriesFocusGridProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

type SortOption = "random" | "name" | "population" | "gdp" | "gdpPerCapita" | "tier";
type FilterOption = "all" | "developed" | "developing" | "superpower";

export const CountriesFocusGrid: React.FC<CountriesFocusGridProps> = ({
  countries,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  searchQuery = "",
  onSearchChange,
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("random");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showDynamicIsland, setShowDynamicIsland] = useState(false);
  const [randomSeed, setRandomSeed] = useState(Date.now());

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

  // I'm Feeling Lucky function
  const handleImFeelingLucky = () => {
    if (processedCountries.length > 0) {
      const randomIndex = Math.floor(Math.random() * processedCountries.length);
      const randomCountry = processedCountries[randomIndex];
      if (randomCountry) {
        onCountryClick?.(randomCountry.id);
      }
    }
  };

  // Tab key handler for command palette and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && !e.ctrlKey) {
        e.preventDefault();
        setShowDynamicIsland((prev) => !prev);
      }
      if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();
        handleImFeelingLucky();
      }
      if (e.key === "r" && showDynamicIsland) {
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
  }, [expanded]);

  // Filter and sort countries
  const processedCountries = useMemo(() => {
    let filtered = countries;

    // Apply filters
    if (filterBy !== "all") {
      filtered = countries.filter((country) => {
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
      filtered = filtered.filter(
        (country) =>
          country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          country.economicTier.toLowerCase().includes(searchQuery.toLowerCase())
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
  }, [countries, filterBy, searchQuery, sortBy, randomSeed]);

  // Infinite scroll
  const visibleCountries = processedCountries.slice(0, visibleCount);

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

  const handleCountryClick = (countryId: string) => {
    // Find country by ID to get slug
    const country = countries.find((c) => c.id === countryId);
    if (country?.slug) {
      window.location.href = createAbsoluteUrl(`/countries/${country.slug}`);
    }
  };

  const onCountryClick = handleCountryClick;

  const getSortIcon = (option: SortOption) => {
    switch (option) {
      case "random":
        return <RiCommandLine className="h-4 w-4" />;
      case "population":
        return <RiGroupLine className="h-4 w-4" />;
      case "gdp":
      case "gdpPerCapita":
        return <RiBarChartLine className="h-4 w-4" />;
      case "tier":
        return <RiSortAsc className="h-4 w-4" />;
      default:
        return <RiGlobalLine className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-background relative min-h-screen">
      <div className="relative z-50 container mx-auto px-4 py-8">
        {/* Streamlined Header */}
        <div className="mb-12 text-center">
          <TextAnimate
            animation="scaleUp"
            by="text"
            delay={0.2}
            duration={0.8}
            className="text-foreground mb-6 text-2xl font-medium md:text-3xl"
          >
            explore the countries of the world
          </TextAnimate>

          <div
            className="glass-hierarchy-interactive cursor-pointer rounded-lg px-4 py-2 transition-transform hover:scale-[1.02]"
            onClick={() => setShowDynamicIsland(true)}
          >
            <div className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
              <RiCommandLine className="h-4 w-4" />
              <span className="text-sm">Press ⌘K to open command palette</span>
            </div>
          </div>
        </div>

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
                onCountryClick={handleCountryClick}
              />
            </motion.div>
          ))}
        </div>

        {/* Loading State with Progressive Blur */}
        {(isLoading || visibleCount < processedCountries.length) && (
          <div className="mt-12">
            <ProgressiveBlur>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="glass-surface glass-refraction h-60 animate-pulse md:h-80"
                  >
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
        {!isLoading && visibleCount < processedCountries.length && (
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
        {!isLoading &&
          !hasMore &&
          visibleCount >= processedCountries.length &&
          processedCountries.length > 0 && (
            <div className="mt-12 text-center">
              <div className="glass-floating glass-refraction inline-block px-6 py-4">
                <p className="text-muted-foreground">
                  You've viewed all {processedCountries.length} countries
                </p>
              </div>
            </div>
          )}

        {/* Empty State */}
        {processedCountries.length === 0 && !isLoading && (
          <div className="mt-12 text-center">
            <div className="glass-floating glass-refraction mx-auto max-w-md p-12">
              <RiGlobalLine className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
              <h3 className="mb-2 text-xl font-semibold">No Countries Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={() => {
                  setSearchInput("");
                  setFilterBy("all");
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Command Palette */}
        <AnimatePresence>
          {showDynamicIsland && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDynamicIsland(false)}
                className="fixed inset-0 z-[10001] bg-black/20 backdrop-blur-sm"
              />

              {/* Command Palette */}
              <motion.div
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed top-1/2 left-4 z-[10002] w-96 -translate-y-1/2"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  boxShadow:
                    "0 16px 64px rgba(0, 0, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
                }}
              >
                {/* Refraction border effects */}
                <div className="pointer-events-none absolute inset-0 rounded-xl">
                  <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
                  <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                </div>

                <div className="relative z-10 p-6">
                  <div className="space-y-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-foreground flex items-center gap-3 text-xl font-bold">
                        <RiCommandLine className="h-6 w-6 text-blue-400" />
                        Countries Filter
                      </div>
                      <button
                        onClick={() => setShowDynamicIsland(false)}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-lg p-2 transition-colors"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <RiSearchLine className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform" />
                      <input
                        type="text"
                        placeholder="Search countries..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="bg-accent/10 border-border text-foreground placeholder:text-muted-foreground focus:bg-accent/15 w-full rounded-xl py-3 pr-4 pl-12 text-base transition-all focus:border-blue-400"
                        autoFocus
                      />
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="text-muted-foreground mb-2 block text-sm font-medium">
                        Sort by
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="bg-accent/10 border-border focus:ring-primary/50 text-foreground w-full rounded-xl px-3 py-3 focus:ring-2 focus:outline-none"
                      >
                        <option value="random">Random</option>
                        <option value="name">Name</option>
                        <option value="population">Population</option>
                        <option value="gdp">Total GDP</option>
                        <option value="gdpPerCapita">GDP per Capita</option>
                        <option value="tier">Economic Tier</option>
                      </select>
                    </div>

                    {/* Filter */}
                    <div>
                      <label className="text-muted-foreground mb-2 block text-sm font-medium">
                        Filter by
                      </label>
                      <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                        className="bg-accent/10 border-border focus:ring-primary/50 text-foreground w-full rounded-xl px-3 py-3 focus:ring-2 focus:outline-none"
                      >
                        <option value="all">All Countries</option>
                        <option value="developed">Developed</option>
                        <option value="developing">Developing</option>
                        <option value="superpower">Superpowers</option>
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={handleReshuffle}
                        className="bg-accent/10 hover:bg-accent/20 border-border text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors"
                      >
                        <RiCommandLine className="h-4 w-4" />
                        <span>Reshuffle Order</span>
                        <kbd className="bg-muted/50 border-border rounded px-2 py-1 text-xs">R</kbd>
                      </button>

                      <RainbowButton
                        onClick={handleImFeelingLucky}
                        className="relative flex w-full items-center justify-center gap-2 overflow-hidden font-medium text-white"
                        style={{
                          background:
                            "linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(239, 68, 68, 0.8), rgba(245, 158, 11, 0.8), rgba(34, 197, 94, 0.8))",
                          backgroundSize: "300% 300%",
                          animation: "rainbow-subtle 8s ease-in-out infinite",
                          backdropFilter: "blur(10px)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          boxShadow:
                            "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                        }}
                        size="lg"
                      >
                        <span className="relative z-10">🍀 I'm Feeling Lucky</span>
                        <kbd className="relative z-10 rounded border border-white/30 bg-black/30 px-2 py-1 text-xs">
                          Ctrl+Tab
                        </kbd>
                      </RainbowButton>
                    </div>

                    {/* Results Preview */}
                    <div className="border-border border-t pt-4">
                      <p className="text-muted-foreground text-sm">
                        Showing {processedCountries.length} countries
                        {searchInput && ` matching "${searchInput}"`}
                        {filterBy !== "all" && ` in ${filterBy} category`}
                      </p>
                    </div>

                    {/* Help Text */}
                    <div className="text-muted-foreground/50 flex items-center justify-center gap-2 pt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <kbd className="bg-muted border-border rounded px-2 py-1">Tab</kbd>
                        <span>to toggle</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <kbd className="bg-muted border-border rounded px-2 py-1">Esc</kbd>
                        <span>to close</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
