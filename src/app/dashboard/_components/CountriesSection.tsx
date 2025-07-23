// src/app/dashboard/_components/CountriesSection.tsx
"use client";

import React from "react";
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

interface CountriesSectionProps {
  // Rename to end with Action so Next.js knows it's a client callback
  onGlobalRefreshAction: () => void;
}

class CountriesErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 text-center">An error occurred in Countries Section.</div>;
    }
    return this.props.children;
  }
}

function CountriesSectionImpl({
  onGlobalRefreshAction,
}: CountriesSectionProps) {
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
    projected2040Population: country.currentPopulation * Math.pow(1 + country.populationGrowthRate, 20), // 20-year projection
    projected2040Gdp: country.currentTotalGdp * Math.pow(1 + country.adjustedGdpGrowth, 20),
    projected2040GdpPerCapita: country.currentGdpPerCapita * Math.pow(1 + country.adjustedGdpGrowth, 20),
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

  const handleRefreshCountries = () => {
    // no countryId triggers bulk‐update path
    updateAllMutation.mutate({});
  };

  const handleIndividualUpdate = () => {
    void refetchCountries();
    onGlobalRefreshAction();
  };

  // Use bulk flag cache for all countries
  const countryNames = useMemo(() => transformedCountries.map(c => c.name), [transformedCountries]);
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  // Loading skeleton
  if (countriesLoading && transformedCountries.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Countries</h2>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Countries</h2>
          <p className="text-sm text-muted-foreground mt-1">
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

        <Button
          onClick={handleRefreshCountries}
          disabled={updateAllMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              updateAllMutation.isPending ? "animate-spin" : ""
            }`}
          />
          {updateAllMutation.isPending
            ? "Updating All..."
            : "Update All Countries"}
        </Button>
      </div>

      {transformedCountries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transformedCountries.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              onUpdateAction={handleIndividualUpdate}
              flagUrl={flagUrls[country.name] || null}
              flagLoading={flagsLoading}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="flex justify-center text-muted-foreground">
              <Globe className="h-12 w-12 opacity-50 mr-2" />
              No countries loaded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mt-2 text-sm text-muted-foreground mx-auto max-w-md">
              Countries will appear here once you import roster data in the Admin
              panel.
            </p>
            <Button
              variant="secondary"
              className="mt-6"
              onClick={() => router.push("/admin")}
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
  return <CountriesErrorBoundary><CountriesSectionImpl {...props} /></CountriesErrorBoundary>;
}
