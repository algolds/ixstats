// src/app/countries/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { useGlobalFlagPreloader } from "~/hooks/useFlagPreloader";
import {
  CountriesPageHeader,
  CountriesSearch,
  CountriesGrid,
  type SortField,
  type SortDirection,
  type TierFilter
} from "./_components";
import type { Country } from "~/types/ixstats";

export default function CountriesPage() {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [continentFilter, setContinentFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Data fetching
  const { data: countries, isLoading, error } = api.countries.getAll.useQuery();

  const { preloadAllFlags, currentStats: flagPreloaderStats } = useGlobalFlagPreloader();

  useEffect(() => {
    if (countries && countries.length > 0) {
      const countryNames = countries.map(c => c.name);
      void preloadAllFlags(countryNames);
    }
  }, [countries, preloadAllFlags]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && countries && countries.length > 0) {
      console.log('[Countries] Flag cache stats (updated):', flagPreloaderStats);
    }
  }, [flagPreloaderStats, countries]);

  const availableContinents = useMemo(() => {
    if (!countries) return [];
    const continents = new Set(countries.map((c: Country) => c.continent).filter(Boolean) as string[]);
    return Array.from(continents).sort();
  }, [countries]);

  const availableRegions = useMemo(() => {
    if (!countries) return [];
    let regionsSource = countries;
    if (continentFilter !== "all") {
        regionsSource = countries.filter((c: Country) => c.continent === continentFilter);
    }
    const regions = new Set(regionsSource.map((c: Country) => c.region).filter(Boolean) as string[]);
    return Array.from(regions).sort();
  }, [countries, continentFilter]);


  const filteredAndSortedCountries = useMemo(() => {
    if (!countries) return [];

    let filtered = countries as Array<Country & { country: string }>; // Asserting combined type

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply tier filter
    if (tierFilter !== "all") {
      filtered = filtered.filter((country) => country.economicTier === tierFilter);
    }
    
    // Apply continent filter
    if (continentFilter !== "all") {
      filtered = filtered.filter((country: Country) => country.continent === continentFilter);
    }

    // Apply region filter
    if (regionFilter !== "all") {
      filtered = filtered.filter((country: Country) => country.region === regionFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      const getSortableValue = (country: any, field: SortField) => {
        switch (field) {
            case 'name': return country.name.toLowerCase();
            case 'population': return country.currentPopulation;
            case 'gdpPerCapita': return country.currentGdpPerCapita;
            case 'totalGdp': return country.currentTotalGdp;
            case 'economicTier':
                const tierOrder = { 'Advanced': 4, 'Developed': 3, 'Emerging': 2, 'Developing': 1, 'Unknown': 0 };
                return tierOrder[country.economicTier as keyof typeof tierOrder] || 0;
            case 'continent': return country.continent?.toLowerCase() || '';
            case 'region': return country.region?.toLowerCase() || '';
            case 'landArea': return country.landArea || 0;
            case 'populationDensity': return country.populationDensity || 0;
            default: return country.name.toLowerCase();
        }
      };
      
      aValue = getSortableValue(a, sortField);
      bValue = getSortableValue(b, sortField);


      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1; // Nulls last for asc, first for desc
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1; // Nulls last for asc, first for desc


      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return 0; // Fallback for mixed types or unexpected values
    });

    return filtered;
  }, [countries, searchTerm, tierFilter, continentFilter, regionFilter, sortField, sortDirection]);

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center p-6 bg-[var(--color-error)]20 border border-[var(--color-error)]40 rounded-lg max-w-md">
          <div className="text-[var(--color-error)] text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-2">
            Error Loading Countries
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CountriesPageHeader
          totalCountries={countries?.length || 0}
          isLoading={isLoading}
        />

        <CountriesSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          continentFilter={continentFilter}
          onContinentFilterChange={setContinentFilter}
          regionFilter={regionFilter}
          onRegionFilterChange={setRegionFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          totalResults={countries?.length || 0}
          filteredResults={filteredAndSortedCountries.length}
          availableContinents={availableContinents}
          availableRegions={availableRegions}
        />

        <CountriesGrid
          countries={filteredAndSortedCountries}
          isLoading={isLoading}
          searchTerm={searchTerm}
        />
        
        {process.env.NODE_ENV === 'development' && countries && (
          <div className="mt-8 p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-primary)] rounded-lg">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Flag Cache Stats (Development)
            </h4>
            <div className="text-xs text-[var(--color-text-muted)] space-x-4">
              <span>Total Flags Queried: {flagPreloaderStats.flags}</span>
              <span>Preloaded: {flagPreloaderStats.preloadedFlags}</span>
              <span>Failed: {flagPreloaderStats.failedFlags}</span>
              <span>Cache Efficiency: {flagPreloaderStats.cacheEfficiency.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
