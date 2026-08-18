"use client";

import { useState, useMemo, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { CountriesPageModular } from "./_components/CountriesPageModular";
import type { CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { unifiedFlagService } from "~/lib/flags/unified-flag-service";
import { useBulkFlagCache } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";

export default function CountriesPage() {
  usePageTitle({ title: "Countries" });

  const { userProfile } = useUserCountry();
  const viewerCountryId = userProfile?.countryId;

  const [searchQuery, setSearchQuery] = useState("");

  // Fetch countries data
  const {
    data: countriesResult,
    isLoading,
    error,
  } = api.countries.getAll.useQuery(
    {
      limit: 1000,
    },
    {
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    }
  );

  // Get all country names for flag caching
  const countryNames = useMemo(() => {
    return countriesResult?.countries?.map((c) => c.name) || [];
  }, [countriesResult]);

  // Prefetch flags in the background as soon as we have country names
  useEffect(() => {
    if (countryNames.length > 0) {
      console.log(`[CountriesPage] Starting background prefetch for ${countryNames.length} flags`);

      // First, cache any database flags we have
      if (countriesResult?.countries) {
        countriesResult.countries.forEach((country) => {
          if (country.flag) {
            unifiedFlagService.cacheDatabaseFlag(country.name, country.flag);
          }
        });
      }

      // Then prefetch the rest
      unifiedFlagService.prefetchFlags(countryNames);
    }
  }, [countryNames, countriesResult]);

  // Bulk fetch flags (will use prefetched cache)
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  // Process countries data for the focus grid
  const processedCountries: CountryCardData[] = useMemo(() => {
    if (!countriesResult?.countries) return [];

    return countriesResult.countries.map((country): CountryCardData => ({
      id: country.id,
      name: country.name,
      slug: country.slug ?? country.name.replace(/\s+/g, "_"),
      currentPopulation: country.currentPopulation || 0,
      currentGdpPerCapita: country.currentGdpPerCapita || 0,
      currentTotalGdp: country.currentTotalGdp || 0,
      economicTier: country.economicTier || "Unknown",
      populationTier: country.populationTier || "Unknown",
      landArea: country.landArea ?? undefined,
      populationDensity: country.populationDensity ?? undefined,
      gdpDensity: country.gdpDensity ?? undefined,
      adjustedGdpGrowth: country.adjustedGdpGrowth ?? undefined,
      populationGrowthRate: country.populationGrowthRate ?? undefined,
      // Use cached flag first, then database flag, then undefined
      flagUrl: flagUrls[country.name] || country.flag || undefined,
      // Identity & Governance
      continent: country.continent ?? undefined,
      region: country.region ?? undefined,
      governmentType: country.governmentType ?? undefined,
      leader: country.leader ?? undefined,
      religion: country.religion ?? undefined,
      // Social Indicators
      lifeExpectancy: country.lifeExpectancy ?? undefined,
      literacyRate: country.literacyRate ?? undefined,
      unemploymentRate: country.unemploymentRate ?? undefined,
      inflationRate: country.inflationRate ?? undefined,
      povertyRate: country.povertyRate ?? undefined,
      // Fiscal
      totalDebtGDPRatio: country.totalDebtGDPRatio ?? undefined,
      realGDPGrowthRate: country.realGDPGrowthRate ?? undefined,
    }));
  }, [countriesResult, flagUrls]);

  if (error) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Error Loading Countries</h1>
          <p className="text-muted-foreground">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <CountriesPageModular
      countries={processedCountries}
      isLoading={isLoading || flagsLoading}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      hasMore={false}
      viewerCountryId={viewerCountryId ?? undefined}
    />
  );
}
