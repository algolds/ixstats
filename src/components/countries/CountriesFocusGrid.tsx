"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountryFocusCard, type CountryCardData } from "./CountryFocusCard";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { CharacterBlurReveal } from "~/components/ui/character-blur-reveal";
import { RainbowButton } from "~/components/magicui/rainbow-button";
import { TextAnimate } from "~/components/magicui/text-animate";
import { createUrl } from "~/lib/url-utils";
import { 
  RiSearchLine, 
  RiFilterLine, 
  RiSortAsc,
  RiGlobalLine,
  RiBarChartLine,
  RiGroupLine,
  RiCommandLine
} from "react-icons/ri";

interface CountriesFocusGridProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

type SortOption = 'random' | 'name' | 'population' | 'gdp' | 'gdpPerCapita' | 'tier';
type FilterOption = 'all' | 'developed' | 'developing' | 'superpower';

export const CountriesFocusGrid: React.FC<CountriesFocusGridProps> = ({
  countries,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  searchQuery = "",
  onSearchChange
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('random');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
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
    setSortBy('random');
  };

  // I'm Feeling Lucky function
  const handleImFeelingLucky = () => {
    if (processedCountries.length > 0) {
      const randomIndex = Math.floor(Math.random() * processedCountries.length);
      const randomCountry = processedCountries[randomIndex];
      onCountryClick?.(randomCountry.id);
    }
  };

  // Tab key handler for command palette and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.ctrlKey) {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        handleImFeelingLucky();
      }
      if (e.key === 'r' && showCommandPalette) {
        e.preventDefault();
        handleReshuffle();
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setExpanded(null);
      }
    };

    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.country-focus-card') && expanded !== null) {
        setExpanded(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickAway);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickAway);
    };
  }, [expanded]);

  // Filter and sort countries
  const processedCountries = useMemo(() => {
    let filtered = countries;

    // Apply filters
    if (filterBy !== 'all') {
      filtered = countries.filter(country => {
        switch (filterBy) {
          case 'developed':
            return ['Developed', 'Healthy', 'Strong', 'Very Strong', 'Extravagant'].includes(country.economicTier);
          case 'developing':
            return ['Impoverished', 'Developing'].includes(country.economicTier);
          case 'superpower':
            return country.currentTotalGdp > 5e12; // $5T+ GDP
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(country =>
        country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.economicTier.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy === 'random') {
      // Create a stable random sort based on country ID and randomSeed to maintain consistency but allow reshuffling
      filtered.sort((a, b) => {
        const aHash = (a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        const bHash = (b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + randomSeed) % 10000;
        return aHash - bHash;
      });
    } else {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'population':
            return b.currentPopulation - a.currentPopulation;
          case 'gdp':
            return b.currentTotalGdp - a.currentTotalGdp;
          case 'gdpPerCapita':
            return b.currentGdpPerCapita - a.currentGdpPerCapita;
          case 'tier':
            const tierOrder = ['Extravagant', 'Very Strong', 'Strong', 'Healthy', 'Developed', 'Developing', 'Impoverished'];
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
      setVisibleCount(prev => Math.min(prev + 12, processedCountries.length));
    } else if (hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [visibleCount, processedCountries.length, hasMore, onLoadMore]);

  // Scroll detection for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= 
        document.documentElement.scrollHeight - 1000
      ) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const handleCountryClick = (countryId: string) => {
    window.location.href = createUrl(`/countries/${countryId}`);
  };

  const onCountryClick = handleCountryClick;

  const getSortIcon = (option: SortOption) => {
    switch (option) {
      case 'random':
        return <RiCommandLine className="h-4 w-4" />;
      case 'population':
        return <RiGroupLine className="h-4 w-4" />;
      case 'gdp':
      case 'gdpPerCapita':
        return <RiBarChartLine className="h-4 w-4" />;
      case 'tier':
        return <RiSortAsc className="h-4 w-4" />;
      default:
        return <RiGlobalLine className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative z-50 container mx-auto px-4 py-8">
        {/* Streamlined Header */}
        <div className="mb-12 text-center">
          <TextAnimate
            animation="scaleUp"
            by="text"
            delay={0.2}
            duration={0.8}
            className="text-2xl md:text-3xl font-medium text-foreground mb-6"
          >
            explore the countries of the world
          </TextAnimate>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass-surface glass-interactive bg-background/50 text-muted-foreground rounded-lg cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setShowCommandPalette(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RiCommandLine className="h-4 w-4" />
            <span className="text-sm">Press Tab to search & filter</span>
          </motion.div>
        </div>

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
                onCountryClick={handleCountryClick}
              />
            </motion.div>
          ))}
        </div>

        {/* Loading State with Progressive Blur */}
        {(isLoading || visibleCount < processedCountries.length) && (
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
        {!isLoading && visibleCount < processedCountries.length && (
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
        {!isLoading && !hasMore && visibleCount >= processedCountries.length && processedCountries.length > 0 && (
          <div className="text-center mt-12">
            <div className="inline-block px-6 py-4 glass-floating glass-refraction">
              <p className="text-muted-foreground">
                You've viewed all {processedCountries.length} countries
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {processedCountries.length === 0 && !isLoading && (
          <div className="text-center mt-12">
            <div className="p-12 max-w-md mx-auto glass-floating glass-refraction">
              <RiGlobalLine className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">No Countries Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filter criteria
              </p>
              <button
                onClick={() => {
                  setSearchInput("");
                  setFilterBy("all");
                }}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Command Palette */}
        <AnimatePresence>
          {showCommandPalette && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCommandPalette(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
              />
              
              {/* Command Palette */}
              <motion.div
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-4 top-1/2 -translate-y-1/2 w-96 z-[10002]"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  boxShadow: "0 16px 64px rgba(0, 0, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)"
                }}
              >
                {/* Refraction border effects */}
                <div className="absolute inset-0 pointer-events-none rounded-xl">
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
                  <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                </div>

                <div className="relative z-10 p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xl font-bold text-foreground flex items-center gap-3">
                        <RiCommandLine className="h-6 w-6 text-blue-400" />
                        Countries Filter
                      </div>
                      <button
                        onClick={() => setShowCommandPalette(false)}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent/10 p-2 rounded-lg transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <RiSearchLine className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search countries..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-accent/10 border-border text-foreground placeholder:text-muted-foreground rounded-xl text-base focus:bg-accent/15 focus:border-blue-400 transition-all"
                        autoFocus
                      />
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Sort by</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="w-full px-3 py-3 bg-accent/10 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
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
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Filter by</label>
                      <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                        className="w-full px-3 py-3 bg-accent/10 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 hover:bg-accent/20 border-border rounded-xl transition-colors text-foreground"
                      >
                        <RiCommandLine className="h-4 w-4" />
                        <span>Reshuffle Order</span>
                        <kbd className="px-2 py-1 bg-muted/50 rounded text-xs border-border">R</kbd>
                      </button>
                      
                      <RainbowButton
                        onClick={handleImFeelingLucky}
                        className="w-full flex items-center justify-center gap-2 text-white font-medium relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(239, 68, 68, 0.8), rgba(245, 158, 11, 0.8), rgba(34, 197, 94, 0.8))',
                          backgroundSize: '300% 300%',
                          animation: 'rainbow-subtle 8s ease-in-out infinite',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                        size="lg"
                      >
                        <span className="relative z-10">🍀 I'm Feeling Lucky</span>
                        <kbd className="relative z-10 px-2 py-1 bg-black/30 rounded text-xs border-border border-white/30">Ctrl+Tab</kbd>
                      </RainbowButton>
                    </div>

                    {/* Results Preview */}
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Showing {processedCountries.length} countries
                        {searchInput && ` matching "${searchInput}"`}
                        {filterBy !== 'all' && ` in ${filterBy} category`}
                      </p>
                    </div>

                    {/* Help Text */}
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pt-2">
                      <div className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-muted rounded border-border">Tab</kbd>
                        <span>to toggle</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-muted rounded border-border">Esc</kbd>
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