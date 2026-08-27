"use client";

import React from "react";
import { motion } from "motion/react";
import { Dollar as DollarSign, Activity, StatsReport as BarChart } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { HealthRing } from "~/components/ui/health-ring";
import { getEconomicTier } from "../lib/economy-data-service";
import { formatNumber } from "../utils/country-selector-utils";
import type { RealCountryData } from "../lib/economy-data-service";
import { cn } from "~/lib/utils";

interface CountryPreviewProps {
  country: RealCountryData;
  size?: "small" | "large";
}

export function CountryPreview({ country, size = "large" }: CountryPreviewProps) {
  const isLarge = size === "large";
  const isSmall = size === "small";
  const ringSize = isLarge ? 70 : 60;

  const econValue = Math.min(100, (country.gdpPerCapita / 50000) * 100);
  const marketValue = Math.min(100, Math.max(20, ((country.growthRate || 2) + 2) * 20));
  const devValue = (() => {
    const tier = getEconomicTier(country.gdpPerCapita);
    return tier === "Advanced"
      ? 95
      : tier === "Developed"
        ? 75
        : tier === "Emerging"
          ? 55
          : tier === "Developing"
            ? 35
            : 20;
  })();

  const getMetricColor = (val: number) => {
    if (val < 35) return "#ef4444"; // Red danger/low
    if (val < 60) return "#f97316"; // Orange bad
    if (val < 80) return "#eab308"; // Yellow ok
    return "#10b981"; // Green good
  };

  const metrics = [
    {
      label: "Economic Health",
      value: econValue,
      color: getMetricColor(econValue),
      icon: DollarSign,
      tooltip: `Economic strength based on GDP per capita (${formatNumber(country.gdpPerCapita)}). Higher values indicate stronger economic performance.`,
    },
    {
      label: "Market Activity",
      value: marketValue,
      color: getMetricColor(marketValue),
      icon: Activity,
      tooltip: `Market dynamism based on GDP growth rate (${((country.growthRate || 0) * 100).toFixed(1)}%). Measures economic momentum and business activity.`,
    },
    {
      label: "Development Index",
      value: devValue,
      color: getMetricColor(devValue),
      icon: BarChart,
      tooltip: `Overall development level (${getEconomicTier(country.gdpPerCapita)}). Composite indicator of infrastructure, education, and institutional quality.`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="space-y-4"
    >
      {/* Country Header */}
      {!isSmall && (
        <div className="mb-6 text-center">
          <div className="mb-3 flex h-auto w-full justify-center">
            <UnifiedCountryFlag countryName={country.name} size="xl" />
          </div>
          <h4 className="mb-1 text-xl font-bold text-[var(--color-text-primary)]">
            {country.name}
          </h4>
          <p className="text-[var(--color-text-muted)]">{country.continent}</p>
        </div>
      )}

      {/* Live Activity Rings */}
      <div
        className={cn(
          "mb-6 grid scrollbar-none grid-cols-3 overflow-visible px-1 py-3.5",
          isLarge ? "gap-4" : "gap-1.5"
        )}
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <HealthRing
              value={metric.value}
              size={ringSize}
              color={metric.color}
              label={metric.label}
              tooltip={metric.tooltip}
            />
            <div
              className="mx-auto mt-2 max-w-[64px] truncate text-xs font-medium text-[var(--color-text-secondary)] transition-colors"
              title={metric.label}
            >
              {isLarge ? metric.label : metric.label.split(" ")[0]}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/30 p-4">
        <h5 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Quick Stats</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--color-text-muted)]">Total Population:</span>
            <div className="font-medium text-[var(--color-text-primary)]">
              {formatNumber(country.population, false, 0)}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">GDP Total:</span>
            <div className="font-medium text-[var(--color-text-primary)]">
              {formatNumber(country.gdp)}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Tax Revenue:</span>
            <div className="font-medium text-[var(--color-text-primary)]">
              {(country.taxRevenuePercent || 0).toFixed(1)}%
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">GDP/Capita:</span>
            <div className="font-medium text-[var(--color-text-primary)]">
              {formatNumber(country.gdpPerCapita)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
