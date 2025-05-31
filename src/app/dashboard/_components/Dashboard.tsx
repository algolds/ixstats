// src/app/dashboard/_components/Dashboard.tsx
"use client";

import { api } from "~/trpc/react";
import {
  DashboardHeader,
  GlobalStatsSection,
  GlobalAnalytics,
  CountriesSection,
  type ProcessedCountryData
} from "./index"; // Assuming index.ts exports these

// shadcn/ui components you might use for overall layout, if needed
// import { Card } from "~/components/ui/card"; // Example

export default function Dashboard() {
  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStatsData, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

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
    void refetchCountries();
    void refetchGlobalStats();
  };

  const isLoading = countriesLoading || globalStatsLoading;

  // Adapt globalStats to match expected GlobalEconomicSnapshot type
  // Assuming GlobalEconomicSnapshot type is defined in your types
  const adaptedGlobalStats = globalStatsData ? {
    ...globalStatsData,
    countryCount: globalStatsData.totalCountries, // Adjust if your type has a different field
    globalGrowthRate: globalStatsData.globalGrowthRate || 0, // Ensure this field exists or provide default
  } : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <DashboardHeader
        onRefresh={handleGlobalRefresh}
        isLoading={isLoading}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Global Stats */}
        {adaptedGlobalStats && (
          <GlobalStatsSection
            globalStats={adaptedGlobalStats}
            isLoading={globalStatsLoading}
          />
        )}

        {/* Global Analytics Charts */}
        {processedCountries.length > 0 && !countriesLoading ? (
          <GlobalAnalytics countries={processedCountries} />
        ) : countriesLoading ? (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <p className="text-muted-foreground text-center">Loading analytics data...</p>
          </div>
        ) : null}


        {/* Countries Section */}
        <CountriesSection onGlobalRefresh={handleGlobalRefresh} />
      </div>
    </div>
  );
}