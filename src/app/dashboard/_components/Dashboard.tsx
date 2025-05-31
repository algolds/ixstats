// src/app/dashboard/_components/Dashboard.tsx
"use client";

import { api } from "~/trpc/react";
import { 
  DashboardHeader, 
  GlobalStatsSection, 
  GlobalAnalytics, 
  CountriesSection,
  type ProcessedCountryData 
} from "./index";

export default function Dashboard() {
  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

  // Process countries data for charts with proper type safety and casting
  const processedCountries: ProcessedCountryData[] = countries?.map(country => ({
    id: country.id,
    name: country.name, // Use name instead of country property
    currentPopulation: country.currentPopulation || 0,
    currentGdpPerCapita: country.currentGdpPerCapita || 0,
    currentTotalGdp: country.currentTotalGdp || 0,
    economicTier: country.economicTier || 'Unknown',
    populationTier: country.populationTier || 'Unknown',
    landArea: country.landArea || null,
    populationDensity: country.populationDensity || null,
    gdpDensity: country.gdpDensity || null,
  })) || [];

  const handleGlobalRefresh = () => {
    refetchCountries();
    refetchGlobalStats();
  };

  const isLoading = countriesLoading || globalStatsLoading;

  // Adapt globalStats to match expected GlobalEconomicSnapshot type
  const adaptedGlobalStats = globalStats ? {
    ...globalStats,
    countryCount: globalStats.totalCountries,
    globalGrowthRate: 0, // Default value if not provided
  } : undefined;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <DashboardHeader 
        onRefresh={handleGlobalRefresh}
        isLoading={isLoading}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Stats */}
        {adaptedGlobalStats && (
          <GlobalStatsSection 
            globalStats={adaptedGlobalStats}
            isLoading={globalStatsLoading}
          />
        )}

        {/* Global Analytics Charts */}
        {processedCountries.length > 0 && (
          <GlobalAnalytics countries={processedCountries} />
        )}

        {/* Countries Section */}
        <CountriesSection onGlobalRefresh={handleGlobalRefresh} />
      </div>
    </div>
  );
}
