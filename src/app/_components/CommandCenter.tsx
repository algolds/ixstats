"use client";

import React from "react";
import { api } from "~/trpc/react";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { TierVisualization } from "./TierVisualization";
import { ActivityFeed } from "./ActivityFeed";
import { FeaturedArticle } from "./FeaturedArticle";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
// Types managed locally for component interface

export function CommandCenter() {
  // Fetch all necessary data first
  const {
    data: allData,
    refetch: refetchCountries,
    isLoading: countriesLoading,
  } = api.countries.getAll.useQuery();

  const {
    data: globalStatsData,
    refetch: refetchGlobalStats,
    isLoading: globalStatsLoading,
  } = api.countries.getGlobalStats.useQuery();

  const countries = allData?.countries ?? [];
  const isLoading = countriesLoading || globalStatsLoading;

  // Process countries for leaderboards - after countries is defined
  const processedCountries = countries.map((country) => ({
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
    adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
    populationGrowthRate: country.populationGrowthRate ?? 0,
  }));

  const handleRefresh = () => {
    void refetchCountries();
    void refetchGlobalStats();
  };

  // Define interface for global stats data structure
  interface GlobalStatsApiResponse {
    ixTimeTimestamp: number;
    totalPopulation: number;
    totalGdp: number;
    averageGdpPerCapita: number;
    totalCountries: number;
    economicTierDistribution: Record<string, number>;
    populationTierDistribution: Record<string, number>;
    averagePopulationDensity?: number;
    averageGdpDensity?: number;
    globalGrowthRate: number;
  }

  // Type guard to check if data matches expected structure
  const isValidGlobalStatsData = (data: unknown): data is GlobalStatsApiResponse => {
    return (
      typeof data === "object" &&
      data !== null &&
      "ixTimeTimestamp" in data &&
      "totalPopulation" in data &&
      "totalGdp" in data &&
      "averageGdpPerCapita" in data &&
      "totalCountries" in data &&
      "globalGrowthRate" in data
    );
  };

  // Adapt global stats to match GlobalEconomicSnapshot interface
  const adaptedGlobalStats = isValidGlobalStatsData(globalStatsData)
    ? {
        timestamp: globalStatsData.ixTimeTimestamp,
        totalPopulation: globalStatsData.totalPopulation,
        totalGdp: globalStatsData.totalGdp,
        averageGdpPerCapita: globalStatsData.averageGdpPerCapita,
        countryCount: globalStatsData.totalCountries,
        economicTierDistribution: globalStatsData.economicTierDistribution,
        populationTierDistribution: globalStatsData.populationTierDistribution,
        averagePopulationDensity: globalStatsData.averagePopulationDensity || 0,
        averageGdpDensity: globalStatsData.averageGdpDensity || 0,
        globalGrowthRate: globalStatsData.globalGrowthRate,
        ixTimeTimestamp: globalStatsData.ixTimeTimestamp,
      }
    : undefined;

  return (
    <div className="bg-background relative min-h-screen">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />
      <div className="container mx-auto mt-16 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content Area */}
          <div className="space-y-6 lg:col-span-2">
            {/* Leaderboards Section */}
            <LeaderboardsSection countries={processedCountries} isLoading={countriesLoading} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Featured Article */}
            <FeaturedArticle />

            {/* Tier Visualization */}
            <TierVisualization countries={processedCountries} isLoading={countriesLoading} />

            {/* Activity Feed */}
            <ActivityFeed countries={processedCountries} isLoading={countriesLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
