"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { CountriesPageModular } from "./_components/CountriesPageModular";
import type { CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { useBulkFlagCache } from "~/hooks/useUnifiedFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { WarningTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";

export default function CountriesPage() {
  usePageTitle({ title: "Countries" });

  const { userProfile } = useUserCountry();
  const viewerCountryId = userProfile?.countryId;

  const [searchQuery, setSearchQuery] = useState("");
  // ?realm=<slug> lists that realm; without it the server uses the viewer's active nation's realm.
  const realm = useSearchParams().get("realm") ?? undefined;

  // Fetch countries data
  const {
    data: countriesResult,
    isLoading,
    error,
  } = api.countries.getAll.useQuery(
    {
      limit: 1000,
      realm,
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

  // Bulk fetch flags
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
      // Use database flag first, then cached/resolved flag, then undefined
      flagUrl:
        normalizeFlagUrl(country.flag) || normalizeFlagUrl(flagUrls[country.name]) || undefined,
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
      <div className="bg-background text-label flex min-h-screen items-center justify-center px-4">
        <EmptyState
          icon={<WarningTriangle className="text-destructive" />}
          title="Could not load countries"
          message={error.message}
          action={<Button onClick={() => window.location.reload()}>Reload page</Button>}
        />
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
