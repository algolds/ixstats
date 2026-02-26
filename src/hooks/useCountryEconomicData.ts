"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { mapCountryToEconomyData } from "~/lib/economy-data-mapper";

/**
 * Hook that fetches country data via tRPC and maps it to the structured
 * economyData format used by metric detail modals.
 */
export function useCountryEconomicData(countryId: string, enabled = true) {
  const {
    data: countryData,
    isLoading,
    refetch,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId && enabled }
  );

  const economyData = useMemo(
    () => (countryData ? mapCountryToEconomyData(countryData) : undefined),
    [countryData]
  );

  return { countryData, economyData, isLoading, refetch, error };
}
