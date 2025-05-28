// src/app/_components/ixstats-dashboard.tsx
"use client";

import { api } from "~/trpc/react";
import { 
  DashboardHeader, 
  GlobalStatsSection, 
  GlobalAnalytics, 
  CountriesSection,
  type ProcessedCountryData 
} from "./dashboard";

export default function IxStatsDashboard() {
  // Queries
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStats, refetch: refetchGlobalStats, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();

  // Process countries data for charts with proper type safety
  const processedCountries: ProcessedCountryData[] = countries?.map(country => ({
    id: country.id,
    name: country.name || country.country || 'Unknown',
    currentPopulation: country.currentPopulation || 0,
    currentGdpPerCapita: country.currentGdpPerCapita || 0,
    currentTotalGdp: country.currentTotalGdp || 0,
    economicTier: country.economicTier || 'Unknown',
    populationTier: country.populationTier || 'Unknown',
    landArea: country.landArea || null,
    populationDensity: country.populationDensity || null,
    gdpDensity: country.gdpDensity || null,
  })) || [];

  // Global refresh handler
  const handleGlobalRefresh = () => {
    refetchCountries();
    refetchGlobalStats();
  };

  const isLoading = countriesLoading || globalStatsLoading;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <DashboardHeader 
        onRefresh={handleGlobalRefresh}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Global Statistics */}
        {globalStats ? (
          <GlobalStatsSection 
            globalStats={globalStats}
            isLoading={globalStatsLoading}
          />
        ) : !globalStatsLoading ? (
          <div className="card text-center py-8">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              No Global Statistics Available
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Global statistics will appear here once countries are loaded.
            </p>
          </div>
        ) : null}

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