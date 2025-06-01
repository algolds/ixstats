// src/app/dashboard/_components/Dashboard.tsx
"use client";

import React from "react";
import { api } from "~/trpc/react";
import {
  DashboardHeader,
  GlobalStatsSection,
  GlobalAnalytics,
  CountriesSection,
  type ProcessedCountryData,
} from "./index";
import { IxTime } from "~/lib/ixtime";

export default function Dashboard() {
  // 1) Fetch paginated country list (now returns { countries, total })
  const {
    data: allData,
    refetch: refetchCountries,
    isLoading: countriesLoading,
  } = api.countries.getAll.useQuery();

  // 2) Fetch global stats
  const {
    data: globalStatsData,
    refetch: refetchGlobalStats,
    isLoading: globalStatsLoading,
  } = api.countries.getGlobalStats.useQuery();

  // 3) Always treat listData.countries as an array
  const countriesRaw = allData?.countries ?? [];

  // 4) Map raw to your ProcessedCountryData
  const processedCountries: ProcessedCountryData[] = countriesRaw.map(
    (country: any) => ({
      id: country.id,
      name: country.name,
      currentPopulation: country.currentPopulation ?? 0,
      currentGdpPerCapita: country.currentGdpPerCapita ?? 0,
      currentTotalGdp: country.currentTotalGdp ?? 0,
      economicTier: country.economicTier ?? "Unknown",
      populationTier: country.populationTier ?? "Unknown",
      landArea: country.landArea ?? null,
      populationDensity: country.populationDensity ?? null,
      gdpDensity: country.gdpDensity ?? null,
    })
  );

  const isLoading = countriesLoading || globalStatsLoading;

  const handleGlobalRefresh = () => {
    void refetchCountries();
    void refetchGlobalStats();
  };

 // In Dashboard.tsx, update the adaptedGlobalStats section
const adaptedGlobalStats = globalStatsData
? {
    ...globalStatsData,
    countryCount: globalStatsData.totalCountries,
    timestamp: IxTime.getCurrentIxTime(), // Add timestamp for formatting
  }
: undefined;


  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader
    onRefreshAction={handleGlobalRefresh} isLoading={isLoading}  />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {adaptedGlobalStats && (
          <GlobalStatsSection
            globalStats={adaptedGlobalStats}
            isLoading={globalStatsLoading}
          />
        )}

        {processedCountries.length > 0 && !countriesLoading ? (
          <GlobalAnalytics countries={processedCountries} />
        ) : countriesLoading ? (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <p className="text-muted-foreground text-center">
              Loading analytics data...
            </p>
          </div>
        ) : null}

<CountriesSection onGlobalRefreshAction={handleGlobalRefresh} />
      </div>
    </div>
  );
}
