// src/app/dashboard/_components/CountriesSection.tsx
"use client";

import { RefreshCw, Globe } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { CountryCard } from "./CountryCard";
import type { CountryStats } from "~/types/ixstats";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";
import { useMemo } from "react";

interface CountriesSectionProps {
  // Rename to end with Action so Next.js knows it's a client callback
  onGlobalRefreshAction: () => void;
}

export function CountriesSection({
  onGlobalRefreshAction,
}: CountriesSectionProps) {
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

  // Always fall back to an array of any
  const rawCountries = (listData?.countries ?? []) as any[];

  // Map to the minimal shape CountryCard needs
  const transformedCountries = rawCountries.map((country: any) => ({
    id: country.id,
    name: country.name,
    currentPopulation: country.currentPopulation,
    currentGdpPerCapita: country.currentGdpPerCapita,
    currentTotalGdp: country.currentTotalGdp,
    populationDensity: country.populationDensity,
    landArea: country.landArea,
    continent: country.continent,
    region: country.region,
    economicTier: country.economicTier,
    populationTier: country.populationTier,
    lastCalculated:
      typeof country.lastCalculated === "number"
        ? country.lastCalculated
        : new Date(country.lastCalculated).getTime(),
  })) as CountryStats[]; // cast to satisfy CountryCard

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
              onClick={() => (window.location.href = "/admin")}
            >
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
