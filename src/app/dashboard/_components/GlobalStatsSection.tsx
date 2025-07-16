// src/app/dashboard/_components/GlobalStatsSection.tsx
"use client";

import React from "react";
import { useMemo } from "react";
import { Users, Globe, TrendingUp, MapPin, Scaling, Layers, Calendar } from "lucide-react";
import type { GlobalEconomicSnapshot } from "~/types/ixstats";
import { IxTime } from "~/lib/ixtime";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Separator } from "../../../components/ui/separator";
import { 
  formatPopulation, 
  formatCurrency, 
  formatPercentage 
} from "~/lib/chart-utils";
import { GlassCard } from "../../../components/ui/enhanced-card";
import { Badge } from "../../../components/ui/badge";
import { TierVisualization } from "../../_components/TierVisualization";
import type { Country } from "~/types/ixstats";
import { useBulkFlagCache } from "~/hooks/useBulkFlagCache";

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
    trend: 'up' | 'down' | 'stable';
    description: string;
  }>;
  isLoading?: boolean;
}

// Helper function to safely format numbers - same approach as countries page
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

const safeFormatDensity = (num: number | null | undefined, unit: string): string => {
  if (num == null || !isFinite(num) || isNaN(num)) {
    return "N/A";
  }
  if (num < 0.01 && unit === "/km²") { // Only apply <0.01 logic for population density, not GDP
    return "< 0.01" + unit;
  }
  // Apply currency formatting for GDP density, keep as is for population density
  const formattedNum = unit.includes("GDP") ? safeFormatCurrency(num) : num.toFixed(1);
  return `${formattedNum}${unit}`;
};

class ExecutiveSummaryErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 text-center">An error occurred in Executive Summary.</div>;
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
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-6">Executive Summary</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <GlassCard key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }
  // Get the names of the top countries
  const topCountryNames = topCountries.map(c => c.name);
  // Use the bulk flag cache hook
  const { flagUrls } = useBulkFlagCache(topCountryNames);
  const countries: Country[] = [];
  return (
    <section className="executive-summary py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Economic Tier Distribution */}
          <GlassCard variant="economic" hover="lift" className="tier-distribution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📊</span>
                Economic Tiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TierVisualization 
                countries={countries}
                isLoading={isLoading}
              />
              <div className="tier-legend mt-4 space-y-2">
                {Object.entries(globalStats.economicTierDistribution || {}).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full tier-indicator-${tier.toLowerCase()}`} />
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
                      <div className="country-flag w-8 h-6 rounded overflow-hidden">
                        <img 
                          src={flagUrls[country.name] || '/placeholder-flag.png'} 
                          alt={`${country.name} flag`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--color-text-primary)]">
                          {country.name}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">
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
  suffix = '', 
  trend, 
  description 
}: {
  label: string;
  value: number;
  suffix?: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}) {
  return (
    <div className="trend-item">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-[var(--color-text-primary)]">
          {label}
        </span>
        <span className="font-bold text-[var(--color-text-primary)]">
          {value > 0 ? '+' : ''}{value}{suffix}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-muted)]">
          {description}
        </span>
        {/* You can use TrendIndicator here if desired */}
      </div>
    </div>
  );
}

export function ExecutiveSummary(props: ExecutiveSummaryProps) {
  return <ExecutiveSummaryErrorBoundary><ExecutiveSummaryImpl {...props} /></ExecutiveSummaryErrorBoundary>;
}