"use client";
// src/app/countries/_components/CountriesPageHeader.tsx

import { Globe, StatsReport as BarChart3, Group as Users } from "iconoir-react";
import { formatPopulation, formatCurrency } from "~/lib/utils";
import { ExpandableStatCard } from "./ExpandableStatCard";
import { useMemo } from "react";

interface CountriesPageHeaderProps {
  isLoading?: boolean;
  totalPopulation?: number;
  combinedGdp?: number;
}

export function CountriesPageHeader({
  isLoading = false,
  totalPopulation,
  combinedGdp,
  filteredCountries = [],
}: CountriesPageHeaderProps & { filteredCountries?: any[] }) {
  const topGdpCountries = useMemo(
    () =>
      (filteredCountries || [])
        .slice()
        .sort((a, b) => (b.currentTotalGdp ?? 0) - (a.currentTotalGdp ?? 0))
        .slice(0, 3),
    [filteredCountries]
  );

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-label text-large-title md:text-large-title flex items-center">
            <Globe aria-hidden="true" className="text-blue mr-3 h-8 w-8 md:h-10 md:w-10" />
            Explore Countries
          </h1>
          <p className="text-label-secondary text-body md:text-title-3 mt-2">
            Browse detailed statistics for all countries in the world.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExpandableStatCard
            icon={<Users aria-hidden="true" className="text-label-secondary h-4 w-4" />}
            label="Total Population"
            value={isLoading ? undefined : totalPopulation}
            isLoading={isLoading}
            type="population"
            formattedValue={isLoading ? undefined : formatPopulation(totalPopulation)}
          />
          <ExpandableStatCard
            icon={<BarChart3 aria-hidden="true" className="text-label-secondary h-4 w-4" />}
            label="Combined GDP"
            value={isLoading ? undefined : combinedGdp}
            isLoading={isLoading}
            type="gdp"
            topCountries={topGdpCountries}
            formattedValue={
              isLoading || combinedGdp === undefined ? undefined : formatCurrency(combinedGdp)
            }
          />
          <ExpandableStatCard
            icon={<BarChart3 aria-hidden="true" className="text-label-secondary h-4 w-4" />}
            label="Active Stats"
            value={isLoading ? undefined : "Real-time"}
            isLoading={isLoading}
            type="active"
            extraStats={{
              countryCount: filteredCountries.length,
              avgGdpPerCapita:
                filteredCountries.length > 0
                  ? Math.round(
                      filteredCountries.reduce((sum, c) => sum + (c.currentGdpPerCapita ?? 0), 0) /
                        filteredCountries.length
                    )
                  : 0,
              avgPopulationDensity:
                filteredCountries.length > 0
                  ? filteredCountries.reduce((sum, c) => sum + (c.populationDensity ?? 0), 0) /
                    filteredCountries.length
                  : 0,
            }}
            formattedValue={isLoading ? undefined : "Real-time"}
          />
        </div>
      </div>
    </header>
  );
}

export default CountriesPageHeader;
