"use client";

import React from "react";
import { api } from "~/trpc/react";
import { LiveGameBanner } from "./LiveGameBanner";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { TierVisualization } from "./TierVisualization";
import { ActivityFeed } from "./ActivityFeed";
import { FeaturedArticle } from "./FeaturedArticle";
import { Navigation } from "./navigation";

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
  const processedCountries = countries.map((country: any) => ({
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

  // Adapt global stats
  const adaptedGlobalStats = globalStatsData
    ? {
        totalPopulation: globalStatsData.totalPopulation,
        totalGdp: globalStatsData.totalGdp,
        averageGdpPerCapita: globalStatsData.averageGdpPerCapita,
        countryCount: globalStatsData.totalCountries,
        economicTierDistribution: globalStatsData.economicTierDistribution,
        populationTierDistribution: globalStatsData.populationTierDistribution,
        averagePopulationDensity: globalStatsData.averagePopulationDensity || 0,
        averageGdpDensity: globalStatsData.averageGdpDensity || 0,
        globalGrowthRate: globalStatsData.globalGrowthRate,
        timestamp: globalStatsData.ixTimeTimestamp,
        ixTimeTimestamp: globalStatsData.ixTimeTimestamp,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      {/* Live Game Banner with Global Stats */}
      <LiveGameBanner 
        onRefresh={handleRefresh} 
        isLoading={isLoading} 
        globalStats={adaptedGlobalStats}
      />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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