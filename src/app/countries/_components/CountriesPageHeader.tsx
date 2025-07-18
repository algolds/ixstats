// src/app/countries/_components/CountriesPageHeader.tsx
"use client";

import { Globe, BarChart3, Users } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton"; // Assuming Skeleton is in this path
import {
  formatPopulation,
  formatCurrency
} from '~/lib/chart-utils';
import { ExpandableStatCard } from '~/components/ui/ExpandableStatCard';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

interface CountriesPageHeaderProps {
  // totalCountries: number; // Removed
  isLoading?: boolean;
  // showing?: number; // Removed
  totalPopulation?: number; // Add totalPopulation prop
  combinedGdp?: number; // Add combinedGdp prop
}

// Dynamically import react-wavify to avoid SSR issues
const Wave = dynamic(() => import('react-wavify').then(mod => mod.default), { ssr: false });

function FlagWaveBackground({ flagUrl }: { flagUrl: string }) {
  // The SVG wave overlays the flag image for a realistic effect
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-end justify-center" style={{ minHeight: 120 }}>
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: `url(${flagUrl}) center/cover no-repeat`, opacity: 0.22, filter: 'blur(0.5px) saturate(1.2)' }} />
      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '100%' }}>
        <Wave
          fill="url(#flag-gradient)"
          options={{ height: 60, amplitude: 18, speed: 0.18, points: 5 }}
          style={{ width: '100%', height: 120, minHeight: 80, opacity: 0.7 }}
        >
          <defs>
            <linearGradient id="flag-gradient" gradientTransform="rotate(90)">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </Wave>
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
  // Find top 3 countries by GDP for the GDP card
  const topGdpCountries = useMemo(() => (filteredCountries || [])
    .slice()
    .sort((a, b) => (b.currentTotalGdp ?? 0) - (a.currentTotalGdp ?? 0))
    .slice(0, 3), [filteredCountries]);

  // Use a prominent flag for the background (e.g., United States or a world flag)
  const flagUrl = '/flags/United_States.png';

  return (
    <div className="mb-8 relative">
      {/* Realistic waving flag background using react-wavify */}
      <FlagWaveBackground flagUrl={flagUrl} />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left side: Title and description */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
            <Globe className="h-8 w-8 md:h-10 md:w-10 mr-3 text-primary" />
            Explore Countries
          </h1>
          <p className="mt-2 text-base md:text-lg text-muted-foreground">
            Browse detailed statistics for all countries in the world.
          </p>
        </div>
        {/* Right side: Expandable Stat Cards */}
        <div className="flex flex-col sm:flex-row gap-3">
          <ExpandableStatCard
            icon={<Users className="h-5 w-5 mr-2 text-blue-500" />}
            label="Total Population"
            value={isLoading ? undefined : totalPopulation}
            isLoading={isLoading}
            type="population"
            formattedValue={isLoading ? undefined : formatPopulation(totalPopulation)}
          />
          <ExpandableStatCard
            icon={<BarChart3 className="h-5 w-5 mr-2 text-green-500" />}
            label="Combined GDP"
            value={isLoading ? undefined : combinedGdp}
            isLoading={isLoading}
            type="gdp"
            topCountries={topGdpCountries}
            formattedValue={isLoading ? undefined : formatCurrency(combinedGdp)}
          />
          <ExpandableStatCard
            icon={<BarChart3 className="h-5 w-5 mr-2 text-green-500" />}
            label="Active Stats"
            value={isLoading ? undefined : 'Real-time'}
            isLoading={isLoading}
            type="active"
            extraStats={{
              countryCount: filteredCountries.length,
              avgGdpPerCapita: filteredCountries.length > 0 ? Math.round(filteredCountries.reduce((sum, c) => sum + (c.currentGdpPerCapita ?? 0), 0) / filteredCountries.length) : 0,
              avgPopulationDensity: filteredCountries.length > 0 ? (filteredCountries.reduce((sum, c) => sum + (c.populationDensity ?? 0), 0) / filteredCountries.length) : 0,
            }}
            formattedValue={isLoading ? undefined : 'Real-time'}
          />
        </div>
      </div>
    </div>
  );
}

// Default export for the component, useful for dynamic imports or if it's the primary export of the file.
export default CountriesPageHeader;
