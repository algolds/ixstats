// src/app/dashboard/_components/CountryCard.tsx
"use client";

import { RefreshCw, Users, TrendingUp, MapPin, Scaling } from "lucide-react";
import { api } from "~/trpc/react";
import { getTierStyle, formatNumber as formatNumberUtil, cn } from "~/lib/theme-utils";
import type { CountryStats } from "~/types/ixstats";

interface CountryCardProps {
  country: CountryStats;
  onUpdate: () => void;
}

export function CountryCard({ country, onUpdate }: CountryCardProps) {
  const updateMutation = api.countries.updateStats.useMutation({
    onSuccess: onUpdate,
  });

  const handleUpdate = () => {
    updateMutation.mutate({ countryId: country.id });
  };

  const formatNumber = (num: number | null | undefined, isCurrency = true, precision = 2) => {
    return formatNumberUtil(num, { isCurrency, precision });
  };

  const getEfficiencyRating = (country: CountryStats): { rating: string; color: string } => {
    if (!country.landArea || !country.populationDensity) {
      return { rating: 'N/A', color: 'var(--color-text-muted)' };
    }
    
    const economicDensity = country.currentTotalGdp / country.landArea;
    const populationEfficiency = country.currentGdpPerCapita / country.populationDensity;
    
    // Create a composite efficiency score
    const efficiencyScore = (economicDensity / 1000000) + (populationEfficiency / 100);
    
    if (efficiencyScore > 100) return { rating: 'Excellent', color: 'var(--color-success)' };
    if (efficiencyScore > 50) return { rating: 'Good', color: 'var(--color-info)' };
    if (efficiencyScore > 25) return { rating: 'Average', color: 'var(--color-warning)' };
    if (efficiencyScore > 10) return { rating: 'Below Avg', color: 'var(--color-warning-dark)' };
    return { rating: 'Poor', color: 'var(--color-error)' };
  };

  const efficiency = getEfficiencyRating(country);
  const tierStyle = getTierStyle(country.economicTier);

  const stats = [
    {
      icon: Users,
      label: "Population",
      value: formatNumber(country.currentPopulation, false),
      color: "var(--color-info)"
    },
    {
      icon: TrendingUp,
      label: "GDP p.c.",
      value: formatNumber(country.currentGdpPerCapita),
      color: "var(--color-success)"
    },
    {
      icon: MapPin,
      label: "Land Area",
      value: country.landArea ? `${formatNumber(country.landArea, false, 0)} km²` : 'N/A',
      color: "var(--color-warning)"
    },
    {
      icon: Scaling,
      label: "Pop. Density",
      value: country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A',
      color: "var(--color-chart-1)"
    }
  ];

  return (
    <div className="card group animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
          {country.name}
        </h3>
        <button
          onClick={handleUpdate}
          disabled={updateMutation.isPending}
          className={cn(
            "p-1 rounded-md transition-all",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            "hover:bg-[var(--color-bg-tertiary)]",
            "disabled:opacity-50",
            "focus-ring"
          )}
          title="Update country statistics"
        >
          <RefreshCw className={`h-4 w-4 ${updateMutation.isPending ? 'loading-spinner' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-start space-x-2">
              <Icon 
                className="h-4 w-4 mt-0.5 flex-shrink-0" 
                style={{ color: stat.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[var(--color-text-muted)] truncate">{stat.label}</p>
                <p className="font-medium text-[var(--color-text-secondary)] truncate" title={stat.value}>
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Efficiency Rating */}
      <div className="flex justify-between items-center py-2 px-3 bg-[var(--color-bg-tertiary)] rounded-md mb-4">
        <span className="text-sm text-[var(--color-text-muted)]">Economic Efficiency</span>
        <span className="text-sm font-medium" style={{ color: efficiency.color }}>
          {efficiency.rating}
        </span>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border-primary)]">
        <span className={tierStyle.className}>
          {country.economicTier}
        </span>
        <span className="text-[var(--color-text-muted)]" title="Last calculation time">
          Updated: {country.lastCalculated instanceof Date 
            ? country.lastCalculated.toLocaleDateString() 
            : new Date(country.lastCalculated).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}