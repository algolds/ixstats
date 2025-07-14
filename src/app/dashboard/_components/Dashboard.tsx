// src/app/dashboard/_components/Dashboard.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Check if user has completed setup
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Redirect to setup if user hasn't completed it
  useEffect(() => {
    if (isLoaded && user && !profileLoading) {
      if (userProfile && !userProfile.countryId) {
        router.push('/setup');
      }
    }
  }, [isLoaded, user, profileLoading, userProfile, router]);

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

  const isLoading = countriesLoading || globalStatsLoading || profileLoading;

  // Show loading while checking setup status
  if (isLoaded && user && profileLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking setup status...</p>
        </div>
      </div>
    );
  }

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