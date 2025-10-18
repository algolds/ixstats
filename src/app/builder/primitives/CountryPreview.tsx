"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Activity, BarChart } from 'lucide-react';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { HealthRing } from '~/components/ui/health-ring';
import { getEconomicTier } from '../lib/economy-data-service';
import { formatNumber } from '../utils/country-selector-utils';
import type { RealCountryData } from '../lib/economy-data-service';

interface CountryPreviewProps {
  country: RealCountryData;
  size?: 'small' | 'large';
}

export function CountryPreview({ country, size = 'large' }: CountryPreviewProps) {
  const isLarge = size === 'large';
  const ringSize = isLarge ? 70 : 60;

  const metrics = [
    {
      label: 'Economic Health',
      value: Math.min(100, (country.gdpPerCapita / 50000) * 100),
      color: '#22d3ee',
      icon: DollarSign,
      tooltip: `Economic strength based on GDP per capita (${formatNumber(country.gdpPerCapita)}). Higher values indicate stronger economic performance.`
    },
    {
      label: 'Market Activity',
      value: Math.min(100, Math.max(20, ((country.growthRate || 2) + 2) * 20)),
      color: '#10b981',
      icon: Activity,
      tooltip: `Market dynamism based on GDP growth rate (${((country.growthRate || 0) * 100).toFixed(1)}%). Measures economic momentum and business activity.`
    },
    {
      label: 'Development Index',
      value: (() => {
        const tier = getEconomicTier(country.gdpPerCapita);
        return tier === "Advanced" ? 95 :
               tier === "Developed" ? 75 :
               tier === "Emerging" ? 55 :
               tier === "Developing" ? 35 : 20;
      })(),
      color: '#8b5cf6',
      icon: BarChart,
      tooltip: `Overall development level (${getEconomicTier(country.gdpPerCapita)}). Composite indicator of infrastructure, education, and institutional quality.`
    }
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
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3 w-full h-auto">
          <EnhancedCountryFlag
            countryName={country.name}
            size="xl"
            hoverBlur={false}
            priority={true}
          />
        </div>
        <h4 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
          {country.name}
        </h4>
        <p className="text-[var(--color-text-muted)]">{country.continent}</p>
      </div>

      {/* Live Activity Rings */}
      <div className={`grid grid-cols-3 gap-${isLarge ? '4' : '3'} mb-6`}>
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <HealthRing
              value={metric.value}
              size={ringSize}
              color={metric.color}
              label={metric.label}
              tooltip={isLarge ? metric.tooltip : undefined}
            />
            <div className="text-white/90 text-xs mt-2 font-medium">
              {isLarge ? metric.label : metric.label.split(' ')[0]}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="p-4 bg-[var(--color-bg-secondary)]/30 rounded-lg border border-[var(--color-border-primary)]">
        <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Quick Stats</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--color-text-muted)]">Total Population:</span>
            <div className="text-[var(--color-text-primary)] font-medium">
              {formatNumber(country.population)}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">GDP Total:</span>
            <div className="text-[var(--color-text-primary)] font-medium">
              {formatNumber(country.gdp)}
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">Tax Revenue:</span>
            <div className="text-[var(--color-text-primary)] font-medium">
              {(country.taxRevenuePercent || 0).toFixed(1)}%
            </div>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)]">GDP/Capita:</span>
            <div className="text-[var(--color-text-primary)] font-medium">
              {formatNumber(country.gdpPerCapita)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}