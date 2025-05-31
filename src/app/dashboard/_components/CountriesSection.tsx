// src/app/dashboard/_components/CountriesSection.tsx
"use client";

import { RefreshCw, Globe } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button"; // shadcn/ui Button
import { Skeleton } from "~/components/ui/skeleton"; // shadcn/ui Skeleton
import { CountryCard } from "./CountryCard";
import type { CountryStats, EconomicTier, PopulationTier } from "~/types/ixstats"; // Ensure types are correctly imported
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface CountriesSectionProps {
  onGlobalRefresh: () => void;
}

export function CountriesSection({ onGlobalRefresh }: CountriesSectionProps) {
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();

  // Assuming updateStats mutation is for all countries if no countryId is passed,
  // or you might need a specific "updateAllCountries" mutation.
  // For this example, I'm assuming updateStats can trigger a general refresh or update.
  const updateAllMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      void refetchCountries();
      onGlobalRefresh(); // Also refresh global stats
    },
    onError: (error) => {
      console.error("Update All Countries Error:", error);
      alert(`Error updating all countries: ${error.message}`);
    },
  });

  const transformedCountries: CountryStats[] = countries?.map(country => ({
    ...country, // Spread existing fields from the fetched country
    id: country.id, // Ensure id is present
    name: country.name,
    country: country.name, // Add country field if it's used by CountryCard
    totalGdp: country.currentTotalGdp, // Add missing totalGdp field
    population: country.baselinePopulation, // Map baseline to population for consistency if needed by card
    gdpPerCapita: country.baselineGdpPerCapita, // Map baseline to gdpPerCapita
    // currentPopulation, currentGdpPerCapita, currentTotalGdp are already in the fetched type
    lastCalculated: new Date(country.lastCalculated), // Ensure it's a Date object
    baselineDate: new Date(country.baselineDate), // Ensure it's a Date object
    globalGrowthFactor: 1.0, // Default or from config if available
    economicTier: country.economicTier as EconomicTier,
    populationTier: country.populationTier as PopulationTier,
    // Ensure optional fields are handled
    continent: country.continent || null,
    region: country.region || null,
    governmentType: country.governmentType || null,
    religion: country.religion || null,
    leader: country.leader || null,
    landArea: country.landArea || null,
    areaSqMi: country.areaSqMi || null,
    maxGdpGrowthRate: country.maxGdpGrowthRate,
    adjustedGdpGrowth: country.adjustedGdpGrowth,
    populationGrowthRate: country.populationGrowthRate,
    populationDensity: country.populationDensity || null,
    gdpDensity: country.gdpDensity || null,
    localGrowthFactor: country.localGrowthFactor,
    projected2040Population: country.projected2040Population,
    projected2040Gdp: country.projected2040Gdp,
    projected2040GdpPerCapita: country.projected2040GdpPerCapita,
    actualGdpGrowth: country.actualGdpGrowth,
  })) || [];


  const handleRefreshCountries = () => {
    // If your updateStats mutation needs a countryId, this approach needs adjustment.
    // This example assumes calling it without countryId triggers a broader update or you have an "updateAll" endpoint.
    // A more robust way would be to iterate or have a dedicated "updateAll" mutation.
    // For simplicity, we're just refetching here as the primary action.
    updateAllMutation.mutate({
      countryId: ""
    }); // Pass an empty object or adjust if specific params are needed
  };

  const handleIndividualUpdate = () => {
    void refetchCountries();
    onGlobalRefresh();
  };

  if (countriesLoading && !transformedCountries?.length) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Countries</h2>
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
          <h2 className="text-2xl font-semibold text-foreground">Countries</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {transformedCountries.length} countries loaded
            {transformedCountries.length > 0 && transformedCountries[0]?.lastCalculated && (
              <span className="ml-2">
                • Last updated: {
                  new Date(Math.max(...transformedCountries.map(c =>
                    c.lastCalculated instanceof Date ? c.lastCalculated.getTime() : new Date(c.lastCalculated).getTime()
                  ))).toLocaleString()
                }
              </span>
            )}
          </p>
        </div>

        <Button
          onClick={handleRefreshCountries}
          disabled={updateAllMutation.isPending}
          variant="default"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updateAllMutation.isPending ? "animate-spin" : ""}`} />
          {updateAllMutation.isPending ? 'Updating All...' : 'Update All Countries'}
        </Button>
      </div>

      {transformedCountries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transformedCountries.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              onUpdate={handleIndividualUpdate}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="flex justify-center text-muted-foreground">
              <Globe className="mx-auto h-12 w-12 opacity-50 mr-2" />
                No countries loaded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Countries will appear here once you import roster data through the Admin panel.
            </p>
            <Button variant="secondary" className="mt-6" onClick={() => window.location.href = '/admin'}>
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}