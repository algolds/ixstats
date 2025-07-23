"use client";

import React from "react";
import { api } from "~/trpc/react";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { TierVisualization } from "./TierVisualization";
import { ActivityFeed } from "./ActivityFeed";
import { FeaturedArticle } from "./FeaturedArticle";
// Types managed locally for component interface

export function CommandCenter() {
  // Fetch all necessary data
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

  const handleRefresh = () => {
    void refetchCountries();
    void refetchGlobalStats();
  };

  // Process countries for leaderboards
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
      typeof data === 'object' &&
      data !== null &&
      'ixTimeTimestamp' in data &&
      'totalPopulation' in data &&
      'totalGdp' in data &&
      'averageGdpPerCapita' in data &&
      'totalCountries' in data &&
      'globalGrowthRate' in data
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leaderboards Section */}
            <LeaderboardsSection
              countries={processedCountries}
              isLoading={countriesLoading}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Featured Article */}
            <FeaturedArticle />
            
            {/* Tier Visualization */}
            <TierVisualization
              countries={processedCountries}
              isLoading={countriesLoading}
            />

            {/* Activity Feed */}
            <ActivityFeed
              countries={processedCountries}
              isLoading={countriesLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 