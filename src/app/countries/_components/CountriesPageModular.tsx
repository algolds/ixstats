"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CountriesHeader } from "./CountriesHeader";
import { CommandPalette } from "~/components/DynamicIsland";
import { CountriesFocusGridModular } from "./CountriesFocusGridModular";
import { CountriesStats } from "./CountriesStats";
import { type CountryCardData } from "~/components/countries/CountryFocusCard";
import { createUrl } from "~/lib/url-utils";

interface CountriesPageModularProps {
  countries: CountryCardData[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

type SortOption = 'random' | 'name' | 'population' | 'gdp' | 'gdpPerCapita' | 'tier';
type FilterOption = 'all' | 'developed' | 'developing' | 'superpower';

export const CountriesPageModular: React.FC<CountriesPageModularProps> = ({
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
    setSortBy('random');
  };

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

  // I'm Feeling Lucky function
  const handleImFeelingLucky = () => {
    if (processedCountries.length > 0) {
      const randomIndex = Math.floor(Math.random() * processedCountries.length);
      const randomCountry = processedCountries[randomIndex];
      if (randomCountry) {
        handleCountryClick(randomCountry.id);
      }
    }
  };

  // Tab key handler for command palette and clickaway for expanded cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.ctrlKey) {
        e.preventDefault();
        setShowDynamicIsland(prev => !prev);
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        handleImFeelingLucky();
      }
      if (e.key === 'r' && showDynamicIsland) {
        e.preventDefault();
        handleReshuffle();
      }
      if (e.key === 'Escape') {
        setShowDynamicIsland(false);
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
  }, [expanded, showDynamicIsland, processedCountries]);

  // Infinite scroll
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

  const handleClearFilters = () => {
    setSearchInput("");
    setFilterBy("all");
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative z-50 container mx-auto px-4 py-8">
        {/* Header */}
        <CountriesHeader onOpenCommandPalette={() => setShowDynamicIsland(true)} />
        
        {/* Stats */}
        <CountriesStats 
          countries={processedCountries}
          searchQuery={searchQuery}
          filterBy={filterBy}
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
        />

        {/* Command Palette */}
        <CommandPalette />
      </div>
    </div>
  );
};