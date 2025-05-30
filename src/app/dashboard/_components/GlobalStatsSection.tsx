// src/app/dashboard/_components/GlobalStatsSection.tsx
"use client";

import { Users, Globe, TrendingUp, MapPin, Scaling, Layers } from "lucide-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";

interface GlobalStatsSectionProps {
  globalStats: GlobalEconomicSnapshot;
  isLoading?: boolean;
}

export function GlobalStatsSection({ globalStats, isLoading = false }: GlobalStatsSectionProps) {
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Global Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card">
              <div className="loading-skeleton h-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const primaryStats = [
    { 
      icon: Users, 
      label: "Total Population", 
      value: `${(globalStats.totalPopulation / 1e9).toFixed(2)}B`, 
      color: "info",
      description: "Combined population across all nations"
    },
    { 
      icon: Globe, 
      label: "Total GDP", 
      value: `$${(globalStats.totalGdp / 1e12).toFixed(2)}T`, 
      color: "success",
      description: "Combined economic output"
    },
    { 
      icon: TrendingUp, 
      label: "Avg GDP p.c.", 
      value: `$${globalStats.averageGdpPerCapita.toFixed(0)}`, 
      color: "chart-1",
      description: "Average GDP per capita across all countries"
    },
    { 
      icon: MapPin, 
      label: "Countries", 
      value: globalStats.countryCount.toString(), 
      color: "warning",
      description: "Total number of nations"
    },
  ];

  const geographicStats = [
    { 
      icon: Scaling, 
      label: "Avg. Population Density", 
      value: `${globalStats.averagePopulationDensity?.toFixed(1) ?? 'N/A'} /km²`, 
      color: "chart-6",
      description: "Average population per square kilometer across all nations"
    },
    { 
      icon: Layers, 
      label: "Avg. GDP Density", 
      value: `$${(globalStats.averageGdpDensity ? globalStats.averageGdpDensity / 1000000 : 0).toFixed(1)}M /km²`, 
      color: "chart-5",
      description: "Average economic output per square kilometer"
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Global Statistics</h2>
      
      {/* Primary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {primaryStats.map(stat => (
          <div key={stat.label} className="card group">
            <div className="flex items-center">
              <stat.icon 
                className="h-8 w-8 mr-4 transition-transform group-hover:scale-110" 
                style={{ color: `var(--color-${stat.color})` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                  {stat.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Geographic Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {geographicStats.map(stat => (
          <div key={stat.label} className="card group">
            <div className="flex items-center mb-2">
              <stat.icon 
                className="h-8 w-8 mr-4 transition-transform group-hover:scale-110" 
                style={{ color: `var(--color-${stat.color})` }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-muted)]">
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {stat.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}