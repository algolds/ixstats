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

function FlagWaveBackground({ flagUrl }: { flagUrl: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 flex items-end justify-center overflow-hidden"
      style={{ minHeight: 120 }}
    >
      {flagUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: `url(${flagUrl}) center/cover no-repeat`,
            opacity: 0.22,
            filter: "blur(0.5px) saturate(1.2)",
          }}
        />
      )}
      <div style={{ position: "absolute", bottom: 0, width: "100%", height: "100%" }}>
        <svg viewBox="0 0 1440 120" className="h-full w-full opacity-70" preserveAspectRatio="none">
          <defs>
            <linearGradient id="flag-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            fill="url(#flag-gradient)"
            d="M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,64C672,53,768,43,864,48C960,53,1056,75,1152,80C1248,85,1344,75,1392,69.3L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          />
        </svg>
      </div>
    </div>
  );
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

  const flagUrl = null;

  return (
    <div className="relative mb-8">
      <FlagWaveBackground flagUrl={flagUrl ?? ""} />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground flex items-center text-3xl font-bold md:text-4xl">
            <Globe className="text-primary mr-3 h-8 w-8 md:h-10 md:w-10" />
            Explore Countries
          </h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">
            Browse detailed statistics for all countries in the world.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExpandableStatCard
            icon={<Users className="mr-2 h-5 w-5 text-blue-500" />}
            label="Total Population"
            value={isLoading ? undefined : totalPopulation}
            isLoading={isLoading}
            type="population"
            formattedValue={isLoading ? undefined : formatPopulation(totalPopulation)}
          />
          <ExpandableStatCard
            icon={<BarChart3 className="mr-2 h-5 w-5 text-green-500" />}
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
            icon={<BarChart3 className="mr-2 h-5 w-5 text-green-500" />}
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
    </div>
  );
}

export default CountriesPageHeader;
