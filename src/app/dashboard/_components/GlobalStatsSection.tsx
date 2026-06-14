// src/app/dashboard/_components/GlobalStatsSection.tsx
"use client";

import React from "react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import { CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { formatPopulation, formatCurrency } from "~/lib/chart-utils";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Badge } from "~/components/ui/badge";
import { TierVisualization } from "../../_components/TierVisualization";
// Import TierVisualization's Country interface to avoid conflicts
interface TierVisualizationCountry {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
}
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";

// eslint-disable-next-line unused-imports/no-unused-vars
interface GlobalStatsSectionProps {
  globalStats: GlobalEconomicSnapshot;
  isLoading?: boolean;
}

interface ExecutiveSummaryProps {
  globalStats: GlobalEconomicSnapshot;
  topCountries: Array<{
    id: string;
    name: string;
    flagUrl?: string;
    currentTotalGdp: number;
    economicTier: string;
  }>;
  economicTrends: Array<{
    label: string;
    value: number;
    suffix?: string;
    trend: "up" | "down" | "stable";
    description: string;
  }>;
  isLoading?: boolean;
}

// Helper function to safely format numbers - same approach as countries page
// eslint-disable-next-line unused-imports/no-unused-vars
const safeFormatPopulation = (num: number | null | undefined): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  return formatPopulation(num);
};

const safeFormatCurrency = (num: number | null | undefined): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  return formatCurrency(num);
};

// eslint-disable-next-line unused-imports/no-unused-vars
const safeFormatDensity = (num: number | null | undefined, unit: string): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  if (num < 0.01 && unit === "/km²") {
    // Only apply <0.01 logic for population density, not GDP
    return "< 0.01" + unit;
  }
  // Apply currency formatting for GDP density, keep as is for population density
  const formattedNum = unit.includes("GDP") ? safeFormatCurrency(num) : num.toFixed(1);
  return `${formattedNum}${unit}`;
};

class ExecutiveSummaryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card text-card-foreground rounded-lg border p-6 text-center shadow-sm">
          An error occurred in Executive Summary.
        </div>
      );
    }
    return this.props.children;
  }
}

function ExecutiveSummaryImpl({
  globalStats,
  topCountries = [],
  economicTrends = [],
  isLoading = false,
}: ExecutiveSummaryProps) {
  // Get the names of the top countries - must be called before any early returns
  const topCountryNames = topCountries.map((c) => c.name);
  // Use the bulk flag cache hook - must be called unconditionally
  const { flagUrls } = useBulkFlagCache(topCountryNames);

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-foreground mb-6 text-2xl font-semibold">Executive Summary</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <GlassCard key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }
  const countries: TierVisualizationCountry[] = topCountries.map((country) => ({
    id: country.id,
    name: country.name,
    currentPopulation: 0, // Not available in topCountries
    currentGdpPerCapita: 0, // Not available in topCountries
    currentTotalGdp: country.currentTotalGdp,
    economicTier: country.economicTier,
    populationTier: "1", // Default value
    landArea: null,
    populationDensity: null,
    gdpDensity: null,
    adjustedGdpGrowth: 0, // Default value
    populationGrowthRate: 0, // Default value
  }));
  return (
    <section className="executive-summary py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Economic Tier Distribution */}
          <GlassCard variant="economic" hover="lift" className="tier-distribution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📊</span>
                Economic Tiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TierVisualization countries={countries} isLoading={isLoading} />
              <div className="tier-legend mt-4 space-y-2">
                {Object.entries(globalStats.economicTierDistribution || {}).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full tier-indicator-${tier.toLowerCase()}`}
                      />
                      {tier}
                    </span>
                    <span className="font-medium">{count} nations</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlassCard>

          {/* Top Performing Countries */}
          <GlassCard variant="diplomatic" hover="lift" className="top-countries">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🏆</span>
                Leading Nations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topCountries.slice(0, 5).map((country, index) => (
                  <div key={country.id} className="top-country-item">
                    <div className="flex items-center gap-3">
                      <div className="rank-badge">#{index + 1}</div>
                      <div className="country-flag h-6 w-8 overflow-hidden rounded">
                        <img
                          src={flagUrls[country.name] || "/placeholder-flag.svg"}
                          alt={`${country.name} flag`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-foreground font-medium">{country.name}</div>
                        <div className="text-muted-foreground text-sm">
                          ${(country.currentTotalGdp / 1e12).toFixed(1)}T GDP
                        </div>
                      </div>
                      <Badge variant="outline" className="tier-badge">
                        {country.economicTier}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlassCard>

          {/* Global Trends */}
          <GlassCard variant="cultural" hover="lift" className="global-trends">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📈</span>
                Global Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {economicTrends.map((trend) => (
                  <TrendItem key={trend.label} {...trend} />
                ))}
              </div>
            </CardContent>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

function TrendItem({
  label,
  value,
  suffix = "",
  // eslint-disable-next-line unused-imports/no-unused-vars
  trend,
  description,
}: {
  label: string;
  value: number;
  suffix?: string;
  trend: "up" | "down" | "stable";
  description: string;
}) {
  return (
    <div className="trend-item">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-foreground font-bold">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{description}</span>
        {/* You can use TrendIndicator here if desired */}
      </div>
    </div>
  );
}

export function ExecutiveSummary(props: ExecutiveSummaryProps) {
  return (
    <ExecutiveSummaryErrorBoundary>
      <ExecutiveSummaryImpl {...props} />
    </ExecutiveSummaryErrorBoundary>
  );
}
