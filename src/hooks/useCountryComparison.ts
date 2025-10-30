import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import type { ComparisonCountry } from "~/app/countries/_components/CountryComparisonModal";

const CHART_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function useCountryComparison() {
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [comparisonCountries, setComparisonCountries] = useState<ComparisonCountry[]>([]);

  // Fetch detailed data for a specific country
  const { data: countryData, isLoading: isLoadingCountry } = api.countries.getByIdAtTime.useQuery(
    { id: selectedCountryIds[0] || "" },
    {
      enabled:
        selectedCountryIds.length === 1 &&
        !!selectedCountryIds[0] &&
        selectedCountryIds[0].trim() !== "",
      retry: false,
    }
  );

  // Fetch all countries for selection
  const { data: allCountries, isLoading: isLoadingAllCountries } = api.countries.getAll.useQuery(
    { limit: 1000 },
    { refetchOnWindowFocus: false, staleTime: 30 * 1000 }
  );

  // Add country to comparison
  const addCountryToComparison = useCallback(
    async (countryId: string) => {
      if (comparisonCountries.length >= 8) return;

      try {
        // Fetch detailed country data
        const response = await fetch(
          `/api/trpc/countries.getByIdAtTime?batch=1&input=${encodeURIComponent(JSON.stringify({ id: countryId }))}`
        );
        const data = await response.json();

        if (data[0]?.result?.data?.json) {
          const country = data[0].result.data.json;

          const comparisonCountry: ComparisonCountry = {
            id: country.id,
            name: country.name,
            currentPopulation: country.currentPopulation || 0,
            currentGdpPerCapita: country.currentGdpPerCapita || 0,
            currentTotalGdp: country.currentTotalGdp || 0,
            populationGrowthRate: country.populationGrowthRate || 0,
            adjustedGdpGrowth: country.adjustedGdpGrowth || 0,
            economicTier: country.economicTier || "Unknown",
            populationTier: country.populationTier || "Unknown",
            populationDensity: country.populationDensity,
            gdpDensity: country.gdpDensity,
            landArea: country.landArea,
            continent: country.continent,
            color: CHART_COLORS[comparisonCountries.length] || "#8b5cf6",
          };

          setComparisonCountries((prev) => [...prev, comparisonCountry]);
          setSelectedCountryIds((prev) => [...prev, countryId]);
        }
      } catch (error) {
        console.error("Error fetching country data for comparison:", error);
      }
    },
    [comparisonCountries.length]
  );

  // Remove country from comparison
  const removeCountryFromComparison = useCallback((countryId: string) => {
    setComparisonCountries((prev) => {
      const newCountries = prev.filter((c) => c.id !== countryId);
      // Reassign colors
      return newCountries.map((country, index) => ({
        ...country,
        color: CHART_COLORS[index] || "#8b5cf6",
      }));
    });
    setSelectedCountryIds((prev) => prev.filter((id) => id !== countryId));
  }, []);

  // Clear all countries from comparison
  const clearComparison = useCallback(() => {
    setComparisonCountries([]);
    setSelectedCountryIds([]);
  }, []);

  // Get available countries for selection (excluding already selected ones)
  const getAvailableCountries = useCallback(() => {
    if (!allCountries?.countries) return [];

    const selectedIds = new Set(selectedCountryIds);
    return allCountries.countries
      .filter((country) => !selectedIds.has(country.id))
      .map((country) => ({
        id: country.id,
        name: country.name,
        continent: country.continent,
        economicTier: country.economicTier,
      }));
  }, [allCountries?.countries, selectedCountryIds]);

  return {
    comparisonCountries,
    selectedCountryIds,
    addCountryToComparison,
    removeCountryFromComparison,
    clearComparison,
    getAvailableCountries,
    isLoading: isLoadingAllCountries,
    isLoadingCountry,
    countryData,
  };
}
