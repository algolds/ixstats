// src/app/countries/page.tsx
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { api } from "~/trpc/react";
import { useGlobalFlagPreloader } from "~/hooks/useFlagPreloader";
import {
  CountriesPageHeader,
  CountriesSearch,
  CountriesGrid,
  type SortField,
  type SortDirection,
  type TierFilter
} from "./_components"; // Assuming index.ts exports these
import { Skeleton } from "~/components/ui/skeleton"; // For loading state
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // For error state
import { AlertTriangle, Globe } from "lucide-react";
import { Button } from "~/components/ui/button";

// Define a more specific type for the country data used in this page
// This should align with what api.countries.getAll.useQuery() returns
// and what CountriesGrid/CountryListCard expect.
export interface PageCountryData {
  id: string;
  name: string;
  continent: string | null;
  region: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string; // Should match EconomicTier enum values
  populationTier: string; // Should match PopulationTier enum values
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  lastCalculated: number; // Assuming timestamp
}


function CountriesPageContent() {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [continentFilter, setContinentFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Data fetching
  const { data: countriesData, isLoading, error } = api.countries.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false, // Prevent excessive refetching
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Flag preloader
  const { preloadAllFlags, currentStats: flagPreloaderStats } = useGlobalFlagPreloader();

  // Transform fetched data to PageCountryData[]
  const countries: PageCountryData[] = useMemo(() => {
    return countriesData?.map(c => ({
      id: c.id,
      name: c.name,
      continent: c.continent ?? null,
      region: c.region ?? null,
      currentPopulation: c.currentPopulation,
      currentGdpPerCapita: c.currentGdpPerCapita,
      currentTotalGdp: c.currentTotalGdp,
      economicTier: c.economicTier,
      populationTier: c.populationTier,
      landArea: c.landArea ?? null,
      populationDensity: c.populationDensity ?? null,
      gdpDensity: c.gdpDensity ?? null,
      lastCalculated: c.lastCalculated, // Assuming this is a number (timestamp)
    })) || [];
  }, [countriesData]);

  // Preload flags when countries data is loaded
  useEffect(() => {
    if (countries && countries.length > 0) {
      const countryNames = countries.map(c => c.name);
      void preloadAllFlags(countryNames);
    }
  }, [countries, preloadAllFlags]);

  // Logging for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && countries && countries.length > 0) {
      console.log('[CountriesPage] Flag cache stats (updated):', flagPreloaderStats);
    }
  }, [flagPreloaderStats, countries]);


  // Extract available continents and regions
  const availableContinents = useMemo(() => {
    if (!countries) return [];
    const continents = new Set(countries.map(c => c.continent).filter(Boolean) as string[]);
    return Array.from(continents).sort();
  }, [countries]);

  const availableRegions = useMemo(() => {
    if (!countries) return [];
    let regionsSource = countries;
    if (continentFilter && continentFilter !== "all") {
      regionsSource = countries.filter(c => c.continent === continentFilter);
    }
    const regions = new Set(regionsSource.map(c => c.region).filter(Boolean) as string[]);
    return Array.from(regions).sort();
  }, [countries, continentFilter]);


  // Filter and sort countries
  const filteredAndSortedCountries = useMemo(() => {
    if (!countries) return [];
    let filtered = [...countries]; // Create a new array to avoid mutating the original

    if (searchTerm) {
      filtered = filtered.filter((country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (tierFilter !== "all") {
      filtered = filtered.filter((country) => country.economicTier === tierFilter);
    }
    if (continentFilter !== "all") {
      filtered = filtered.filter((country) => country.continent === continentFilter);
    }
    if (regionFilter !== "all") {
      filtered = filtered.filter((country) => country.region === regionFilter);
    }

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'population': aValue = a.currentPopulation; bValue = b.currentPopulation; break;
        case 'gdpPerCapita': aValue = a.currentGdpPerCapita; bValue = b.currentGdpPerCapita; break;
        case 'totalGdp': aValue = a.currentTotalGdp; bValue = b.currentTotalGdp; break;
        case 'economicTier':
          const tierOrder = { 'Advanced': 4, 'Developed': 3, 'Emerging': 2, 'Developing': 1, 'Unknown': 0 };
          aValue = tierOrder[a.economicTier as keyof typeof tierOrder] || 0;
          bValue = tierOrder[b.economicTier as keyof typeof tierOrder] || 0;
          break;
        case 'continent': aValue = a.continent || ""; bValue = b.continent || ""; break;
        case 'region': aValue = a.region || ""; bValue = b.region || ""; break;
        case 'landArea': aValue = a.landArea || 0; bValue = b.landArea || 0; break;
        case 'populationDensity': aValue = a.populationDensity || 0; bValue = b.populationDensity || 0; break;
        default: aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase();
      }

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1; // Nulls last for asc, first for desc
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1; // Nulls last for asc, first for desc


      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (aValue as number) - (bValue as number);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });
    return filtered;
  }, [countries, searchTerm, tierFilter, continentFilter, regionFilter, sortField, sortDirection]);

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const handleContinentFilterChange = (continent: string) => {
    setContinentFilter(continent);
    setRegionFilter("all");
  };

  const handleRegionFilterChange = (region: string) => {
    setRegionFilter(region);
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Countries</AlertTitle>
          <AlertDescription>
            {error.message || "An unexpected error occurred."}
            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="mt-2">
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Skeleton Loading for initial page load
  if (isLoading && !countries?.length) {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <CountriesPageHeader totalCountries={0} isLoading={true} />
            <div className="mb-8">
                <Skeleton className="h-12 w-full mb-4" /> {/* Search bar skeleton */}
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-1/4" /> {/* Results count skeleton */}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[280px] w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CountriesPageHeader
          totalCountries={countries?.length || 0}
          isLoading={isLoading && !countries?.length} // Pass loading state for header elements
        />

        <CountriesSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          continentFilter={continentFilter}
          onContinentFilterChange={handleContinentFilterChange}
          regionFilter={regionFilter}
          onRegionFilterChange={handleRegionFilterChange}
          availableContinents={availableContinents}
          availableRegions={availableRegions}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          totalResults={countries?.length || 0}
          filteredResults={filteredAndSortedCountries?.length || 0}
        />

        <CountriesGrid
          countries={filteredAndSortedCountries || []}
          isLoading={isLoading && !countries?.length} // Pass loading state for grid items
          searchTerm={searchTerm}
        />

        {process.env.NODE_ENV === 'development' && countries && (
          <div className="mt-8 p-4 bg-card border rounded-lg">
            <h4 className="text-sm font-semibold text-card-foreground mb-2">
              Flag Cache Stats (Development)
            </h4>
            <div className="text-xs text-muted-foreground space-x-4">
              <span>Total: {flagPreloaderStats.flags}</span>
              <span>Preloaded: {flagPreloaderStats.preloadedFlags}</span>
              <span>Failed: {flagPreloaderStats.failedFlags}</span>
              <span>Efficiency: {flagPreloaderStats.cacheEfficiency}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CountriesPage() {
  return (
    // Suspense can be used if you expect parts of the page to load asynchronously
    // For now, the loading state is handled within CountriesPageContent
    <CountriesPageContent />
  );
}
