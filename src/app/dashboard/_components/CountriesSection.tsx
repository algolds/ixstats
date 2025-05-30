// src/app/dashboard/_components/CountriesSection.tsx
"use client";

import { RefreshCw, Globe } from "lucide-react";
import { api } from "~/trpc/react";
import { getButtonClasses } from "~/lib/theme-utils";
import { CountryCard } from "./CountryCard";
import type { CountryStats, EconomicTier, PopulationTier } from "~/types/ixstats";

interface CountriesSectionProps {
  onGlobalRefresh: () => void;
}

export function CountriesSection({ onGlobalRefresh }: CountriesSectionProps) {
  const { data: countries, refetch: refetchCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();

  const updateAllMutation = api.countries.updateStats.useMutation({
    onSuccess: () => {
      refetchCountries();
      onGlobalRefresh(); // Also refresh global stats
    },
    onError: (error) => {
      console.error("Update All Error:", error);
      alert(`Update All Error: ${error.message}`);
    },
  });

  // Transform countries data to match CountryStats interface for CountryCard
  const transformedCountries: CountryStats[] = countries?.map(country => ({
    ...country,
    // Map database fields to CountryStats interface
    population: country.baselinePopulation,
    gdpPerCapita: country.baselineGdpPerCapita,
    lastCalculated: country.lastCalculated, // Keep as Date object
    totalGdp: country.currentTotalGdp,
    globalGrowthFactor: 1.0, // Default value, could be fetched from system config
    // Cast enum types properly
    economicTier: country.economicTier as EconomicTier,
    populationTier: country.populationTier as PopulationTier,
  })) || [];

  const handleRefreshCountries = () => {
    updateAllMutation.mutate({});
  };

  const handleIndividualUpdate = () => {
    refetchCountries();
    onGlobalRefresh();
  };

  if (countriesLoading) {
    return (
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Countries</h2>
          <div className="loading-skeleton w-24 h-8 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <div className="loading-skeleton h-48"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Countries</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {transformedCountries.length} countries loaded
            {transformedCountries.length > 0 && (
              <span className="ml-2">
                • Last updated: {Math.max(...transformedCountries.map(c => 
                  c.lastCalculated instanceof Date ? c.lastCalculated.getTime() : new Date(c.lastCalculated).getTime()
                )) > 0 ? new Date(Math.max(...transformedCountries.map(c => 
                  c.lastCalculated instanceof Date ? c.lastCalculated.getTime() : new Date(c.lastCalculated).getTime()
                ))).toLocaleString() : 'Unknown'}
              </span>
            )}
          </p>
        </div>
        
        {/* Countries Refresh Button */}
        <button
          onClick={handleRefreshCountries}
          disabled={updateAllMutation.isPending}
          className={getButtonClasses('primary', 'md', updateAllMutation.isPending)}
          title="Recalculate statistics for all countries"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updateAllMutation.isPending ? "loading-spinner" : ""}`} />
          {updateAllMutation.isPending ? 'Updating...' : 'Update All Countries'}
        </button>
      </div>

      {/* Countries Grid */}
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
        <div className="text-center py-12 card">
          <Globe className="mx-auto h-12 w-12 text-[var(--color-text-muted)] opacity-50" />
          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            No countries loaded
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            Countries will appear here once you import roster data through the Admin panel.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.location.href = '/admin'}
              className={getButtonClasses('secondary', 'md')}
            >
              Go to Admin Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}