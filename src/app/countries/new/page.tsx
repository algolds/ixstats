'use client';

import { useState, useMemo } from 'react';
import { api } from '~/trpc/react';
import { CountriesPageModular } from '../_components/CountriesPageModular';
import type { CountryCardData } from '~/components/countries/CountryFocusCard';
import { useBulkFlagCache } from '~/hooks/useBulkFlagCache';

export default function NewCountriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch countries data
  const {
    data: countriesResult,
    isLoading,
    error
  } = api.countries.getAll.useQuery({
    limit: 1000
  }, {
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  });

  // Get all country names for flag caching
  const countryNames = useMemo(() => {
    return countriesResult?.countries?.map(c => c.name) || [];
  }, [countriesResult]);

  // Bulk fetch flags
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  // Process countries data for the focus grid
  const processedCountries: CountryCardData[] = useMemo(() => {
    if (!countriesResult?.countries) return [];
    
    return countriesResult.countries.map((country): CountryCardData => ({
      id: country.id,
      name: country.name,
      currentPopulation: country.currentPopulation || 0,
      currentGdpPerCapita: country.currentGdpPerCapita || 0,
      currentTotalGdp: country.currentTotalGdp || 0,
      economicTier: country.economicTier || 'Unknown',
      populationTier: country.populationTier || 'Unknown',
      landArea: country.landArea || undefined,
      populationDensity: country.populationDensity || undefined,
      gdpDensity: country.gdpDensity || undefined,
      adjustedGdpGrowth: country.adjustedGdpGrowth || undefined,
      populationGrowthRate: country.populationGrowthRate || undefined,
      flagUrl: flagUrls[country.name] || undefined
    }));
  }, [countriesResult, flagUrls]);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            Error Loading Countries
          </h1>
          <p className="text-muted-foreground">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <CountriesPageModular
      countries={processedCountries}
      isLoading={isLoading || flagsLoading}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      hasMore={false}
    />
  );
}