"use client";

import React, { useMemo, memo } from "react";
import { api } from "~/trpc/react";
import { ActivityMarquee } from "./ActivityMarquee";

interface Country {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
}

export const GlobalActivityMarquee = memo(function GlobalActivityMarquee() {
  const { data: allData, isLoading: countriesLoading } = api.countries.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes - greatly reduce API calls
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const countries = allData?.countries ?? [];

  // Memoize processed countries to prevent unnecessary recalculations
  const processedCountries: Country[] = useMemo(
    () =>
      countries.map((country) => ({
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
      })),
    [countries]
  );

  // Only render marquee if we have data and it's not loading
  if (countriesLoading || processedCountries.length === 0) {
    return (
      <div className="relative z-[9000] h-16 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="container mx-auto flex h-full items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {countriesLoading ? "Loading activities..." : "No activity data available"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-[9000] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ActivityMarquee
          countries={processedCountries.slice(0, 10)} // Limit to 10 countries for better performance
          isLoading={false} // We already handled loading above
        />
      </div>
    </div>
  );
});
