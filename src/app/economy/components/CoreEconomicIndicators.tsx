// src/app/economy/components/CoreEconomicIndicators.tsx
"use client";

import { useState } from "react";
import {
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  Globe,
  Coins,
  Info,
  AlertCircle,
} from "lucide-react";
import type { CoreEconomicIndicators, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";

interface CoreEconomicIndicatorsProps {
  indicators: CoreEconomicIndicators;
  referenceCountry: RealCountryData;
  onIndicatorsChange: (indicators: CoreEconomicIndicators) => void;
}

export function CoreEconomicIndicatorsComponent({
  indicators,
  referenceCountry,
  onIndicatorsChange,
}: CoreEconomicIndicatorsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');

  const handleInputChange = (field: keyof CoreEconomicIndicators, value: number) => {
    const newIndicators = { ...indicators, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'totalPopulation' || field === 'nominalGDP') {
      newIndicators.gdpPerCapita = newIndicators.nominalGDP / newIndicators.totalPopulation;
    } else if (field === 'gdpPerCapita') {
      newIndicators.nominalGDP = newIndicators.gdpPerCapita * newIndicators.totalPopulation;
    }
    
    onIndicatorsChange(newIndicators);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const formatPopulation = (pop: number): string => formatNumber(pop, 1, false);

  const economicTier = getEconomicTier(indicators.gdpPerCapita);
  const tierStyle = getTierStyle(economicTier);

  const comparisonData = [
    {
      label: "GDP per Capita",
      userValue: indicators.gdpPerCapita,
      refValue: referenceCountry.gdpPerCapita,
      format: (v: number) => formatNumber(v, 2),
      icon: DollarSign,
    },
    {
      label: "Population",
      userValue: indicators.totalPopulation,
      refValue: referenceCountry.population,
      format: (v: number) => formatPopulation(v),
      icon: Users,
    },
    {
      label: "Total GDP",
      userValue: indicators.nominalGDP,
      refValue: referenceCountry.gdp,
      format: (v: number) => formatNumber(v, 1),
      icon: Globe,
    },
  ];

  const getHealthIndicator = (growth: number, inflation: number) => {
    if (growth > 4 && inflation < 3) return { color: "text-green-600", label: "Excellent" };
    if (growth > 2 && inflation < 5) return { color: "text-blue-600", label: "Good" };
    if (growth > 0 && inflation < 8) return { color: "text-yellow-600", label: "Moderate" };
    return { color: "text-red-600", label: "Concerning" };
  };

  const healthIndicator = getHealthIndicator(indicators.realGDPGrowthRate, indicators.inflationRate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Core Economic Indicators
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          <button
            onClick={() => setSelectedView('overview')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedView === 'overview'
                ? 'bg-[var(--color-brand-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('detailed')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              selectedView === 'detailed'
                ? 'bg-[var(--color-brand-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparisonData.map((item) => {
            const Icon = item.icon;
            const difference = ((item.userValue - item.refValue) / item.refValue) * 100;
            const isHigher = difference > 0;
            
            return (
              <div key={item.label} className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-6 w-6 text-[var(--color-brand-primary)]" />
                  {item.label === "GDP per Capita" && (
                    <span className={`tier-badge ${tierStyle.className}`}>{economicTier}</span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-[var(--color-text-primary)]">
                    {item.format(item.userValue)}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Ref: {item.format(item.refValue)}
                  </div>
                  <div className={`text-xs font-medium ${isHigher ? 'text-green-600' : 'text-red-600'}`}>
                    {isHigher ? '+' : ''}{difference.toFixed(1)}% vs {referenceCountry.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="form-label flex items-center">
              <Users className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Total Population
            </label>
            <div className="relative">
              <input
                type="number"
                value={indicators.totalPopulation}
                onChange={(e) => handleInputChange('totalPopulation', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="1000"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                {formatPopulation(indicators.totalPopulation)}
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Ref: {formatPopulation(referenceCountry.population)}
            </div>
          </div>

          <div>
            <label className="form-label flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              GDP per Capita ($)
            </label>
            <div className="relative">
              <input
                type="number"
                value={indicators.gdpPerCapita}
                onChange={(e) => handleInputChange('gdpPerCapita', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="100"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className={`tier-badge ${tierStyle.className}`}>{economicTier}</span>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Ref: ${referenceCountry.gdpPerCapita.toLocaleString()}
            </div>
          </div>

          <div>
            <label className="form-label flex items-center">
              <Globe className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Nominal GDP ($)
            </label>
            <div className="relative">
              <input
                type="number"
                value={indicators.nominalGDP}
                onChange={(e) => handleInputChange('nominalGDP', parseFloat(e.target.value) || 0)}
                className="form-input"
                step="1000000"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                {formatNumber(indicators.nominalGDP)}
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Ref: {formatNumber(referenceCountry.gdp)}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="form-label flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Real GDP Growth Rate (%)
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="-5"
                max="10"
                step="0.1"
                value={indicators.realGDPGrowthRate}
                onChange={(e) => handleInputChange('realGDPGrowthRate', parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>-5%</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {indicators.realGDPGrowthRate.toFixed(1)}%
                </span>
                <span>10%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Inflation Rate (%)
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="15"
                step="0.1"
                value={indicators.inflationRate}
                onChange={(e) => handleInputChange('inflationRate', parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>0%</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {indicators.inflationRate.toFixed(1)}%
                </span>
                <span>15%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label flex items-center">
              <Coins className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Currency Exchange Rate
            </label>
            <input
              type="number"
              value={indicators.currencyExchangeRate}
              onChange={(e) => handleInputChange('currencyExchangeRate', parseFloat(e.target.value) || 1)}
              className="form-input"
              step="0.01"
              min="0.01"
            />
            <div className="text-xs text-[var(--color-text-muted)]">
              Value relative to USD (1.0 = parity)
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-[var(--color-info)] mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Economic Health: <span className={healthIndicator.color}>{healthIndicator.label}</span>
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              Based on {indicators.realGDPGrowthRate.toFixed(1)}% growth and {indicators.inflationRate.toFixed(1)}% inflation. 
              Optimal: 2-4% growth with 2-3% inflation for sustainable development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
