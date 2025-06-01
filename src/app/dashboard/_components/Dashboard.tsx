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

  // FIXED: Properly adapt global stats to match the interface and ensure number consistency
  const adaptedGlobalStats = globalStatsData
    ? {
        totalPopulation: globalStatsData.totalPopulation,
        totalGdp: globalStatsData.totalGdp,
        averageGdpPerCapita: globalStatsData.averageGdpPerCapita,
        countryCount: globalStatsData.totalCountries, // Map totalCountries to countryCount
        economicTierDistribution: globalStatsData.economicTierDistribution,
        populationTierDistribution: globalStatsData.populationTierDistribution,
        averagePopulationDensity: globalStatsData.averagePopulationDensity || 0, // Convert null to 0
        averageGdpDensity: globalStatsData.averageGdpDensity || 0, // Convert null to 0
        globalGrowthRate: globalStatsData.globalGrowthRate,
        timestamp: globalStatsData.ixTimeTimestamp, // Use the actual timestamp from API
        ixTimeTimestamp: globalStatsData.ixTimeTimestamp,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader
        onRefreshAction={handleGlobalRefresh} 
        isLoading={isLoading}  
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
Based on the lint error shown in the context, there's a type mismatch with the `economicTierDistribution` property. The error indicates that the object is missing required properties from the `EconomicTier` type. Let's fix this by ensuring the distribution object has all required properties:

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