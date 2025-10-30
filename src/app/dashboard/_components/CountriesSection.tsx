// src/app/dashboard/_components/CountriesSection.tsx
"use client";

import React, { useEffect } from "react";
import { RefreshCw, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { CountryCard } from "./CountryCard";
import type { CountryStats, CountryWithEconomicData } from "~/types/ixstats";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";
import { useMemo } from "react";
import { createUrl } from "~/lib/url-utils";
import { unifiedFlagService } from "~/lib/unified-flag-service";

interface CountriesSectionProps {
  // Rename to end with Action so Next.js knows it's a client callback
  onGlobalRefreshAction: () => void;
}

class CountriesErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card text-card-foreground rounded-lg border p-6 text-center shadow-sm">
          An error occurred in Countries Section.
        </div>
      );
    }
    return this.props.children;
  }
}

function CountriesSectionImpl({ onGlobalRefreshAction }: CountriesSectionProps) {
  const router = useRouter();
  // getAll now returns { countries, total }
  const {
    data: listData,
    refetch: refetchCountries,
    isLoading: countriesLoading,
  } = api.countries.getAll.useQuery();

  // bulk‐update mutation
  const updateAllMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      void refetchCountries();
      onGlobalRefreshAction();
    },
    onError: (error) => {
      console.error("Update All Countries Error:", error);
      alert(`Error updating all countries: ${error.message}`);
    },
  });

  /**
   * Transform CountryWithEconomicData to CountryStats format
   * Ensures all required fields are properly mapped and typed
   */
  const transformCountryData = (country: CountryWithEconomicData): CountryStats => ({
    // BaseCountryData fields - mapping from CountryWithEconomicData structure
    country: country.name,
    continent: country.continent,
    region: country.region,
    governmentType: country.governmentType,
    religion: country.religion,
    leader: country.leader,
    population: country.baselinePopulation, // Base population for calculations
    gdpPerCapita: country.baselineGdpPerCapita, // Base GDP per capita
    landArea: country.landArea,
    areaSqMi: country.areaSqMi,
    maxGdpGrowthRate: country.maxGdpGrowthRate,
    adjustedGdpGrowth: country.adjustedGdpGrowth,
    populationGrowthRate: country.populationGrowthRate,
    actualGdpGrowth: country.adjustedGdpGrowth, // Use adjusted growth as actual
    projected2040Population:
      country.currentPopulation * Math.pow(1 + country.populationGrowthRate, 20), // 20-year projection
    projected2040Gdp: country.currentTotalGdp * Math.pow(1 + country.adjustedGdpGrowth, 20),
    projected2040GdpPerCapita:
      country.currentGdpPerCapita * Math.pow(1 + country.adjustedGdpGrowth, 20),
    localGrowthFactor: 1.0, // Default local growth factor

    // Additional required CountryStats fields
    lastCalculated: Date.now(),
    baselineDate: Date.now(),
    globalGrowthFactor: 1.0321, // Standard global growth factor
    populationDensity: country.populationDensity,
    economicTier: getEconomicTierFromGdpPerCapita(country.currentGdpPerCapita),
    populationTier: getPopulationTierFromPopulation(country.currentPopulation),

    // CountryStats specific fields (no duplicates)
    id: country.id,
    name: country.name,
    totalGdp: country.currentTotalGdp,
    currentPopulation: country.currentPopulation,
    currentGdpPerCapita: country.currentGdpPerCapita,
    currentTotalGdp: country.currentTotalGdp,
  });

  // Transform the countries with proper type safety
  const rawCountries = listData?.countries ?? [];
  const transformedCountries: CountryStats[] = rawCountries.map(transformCountryData);

  // Use bulk flag cache for all countries - moved before early return
  const countryNames = useMemo(
    () => transformedCountries.map((c) => c.name),
    [transformedCountries]
  );

  // Prefetch flags in the background
  useEffect(() => {
    if (countryNames.length > 0) {
      console.log(`[Dashboard] Prefetching ${countryNames.length} country flags`);
      unifiedFlagService.prefetchFlags(countryNames);
    }
  }, [countryNames]);

  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  const handleRefreshCountries = () => {
    // no countryId triggers bulk‐update path
    updateAllMutation.mutate({});
  };

  const handleIndividualUpdate = () => {
    void refetchCountries();
    onGlobalRefreshAction();
  };

  // Loading skeleton
  if (countriesLoading && transformedCountries.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Countries</h2>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="mb-2 h-6 w-3/4" />
              <Skeleton className="mb-4 h-4 w-1/2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Countries</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {transformedCountries.length} countries loaded
            {transformedCountries.length > 0 && (
              <span className="ml-2">
                • Last updated:{" "}
                {new Date(
                  Math.max(
                    ...transformedCountries.map((c) =>
                      typeof c.lastCalculated === "number"
                        ? c.lastCalculated
                        : new Date(c.lastCalculated).getTime()
                    )
                  )
                ).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        <Button onClick={handleRefreshCountries} disabled={updateAllMutation.isPending}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${updateAllMutation.isPending ? "animate-spin" : ""}`}
          />
          {updateAllMutation.isPending ? "Updating All..." : "Update All Countries"}
        </Button>
      </div>

      {transformedCountries.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {transformedCountries.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              onUpdateAction={handleIndividualUpdate}
              flagUrl={
                flagUrls[country.name] ||
                (rawCountries.find((c) => c.id === country.id) as any)?.flag ||
                null
              }
              flagLoading={flagsLoading}
            />
          ))}
        </div>
      ) : (
        <Card className="py-16 text-center">
          <CardHeader>
            <CardTitle className="text-muted-foreground flex justify-center">
              <Globe className="mr-2 h-12 w-12 opacity-50" />
              No countries loaded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              Countries will appear here once you import roster data in the Admin panel.
            </p>
            <Button
              variant="secondary"
              className="mt-6"
              onClick={() => router.push(createUrl("/admin"))}
            >
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function CountriesSection(props: CountriesSectionProps) {
  return (
    <CountriesErrorBoundary>
      <CountriesSectionImpl {...props} />
    </CountriesErrorBoundary>
  );
}
