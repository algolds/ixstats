// src/app/builder/components/CoreEconomicIndicators.tsx
"use client";

import React, { useState, useEffect } from "react";
import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import {
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  Globe,
  Coins,
  Info,
  AlertCircle,
  Search,
  Loader2,
  Check,
} from "lucide-react";
import type { CoreEconomicIndicators, RealCountryData } from "../lib/economy-data-service";
// Import the original getEconomicTier with an alias if needed, or ensure the local one is distinct
import { getEconomicTier as getEconomicTierFromService } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";



interface CoreEconomicIndicatorsProps {
  indicators: CoreEconomicIndicators;
  referenceCountry?: RealCountryData;
  /** SERVER ACTION */
  onIndicatorsChangeAction: (i: CoreEconomicIndicators) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

// Renamed local function to avoid conflict
function calculateEconomicTierLocally(gdp: number): string {
  if (gdp >= 65000) return "Extravagant";
  if (gdp >= 55000) return "Very Strong";
  if (gdp >= 45000) return "Strong";
  if (gdp >= 35000) return "Healthy";
  if (gdp >= 25000) return "Developed";
  if (gdp >= 10000) return "Emerging";
  return "Developing";
}

function computeHealth(g: number, i: number) {
  if (g > 0.04 && i < 0.03) return { label: "Excellent", color: "text-green-600" };
  if (g > 0.02 && i < 0.05) return { label: "Good", color: "text-blue-600" };
  if (g > 0 && i < 0.08) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Concerning", color: "text-red-600" };
}

export function CoreEconomicIndicatorsComponent({ // Renamed component to avoid conflict if this is a shared name
  indicators,
  referenceCountry,
  onIndicatorsChangeAction,
  isReadOnly = false,
  showComparison = true,
}: CoreEconomicIndicatorsProps) {
  const handleInputChange = (field: keyof CoreEconomicIndicators, value: number) => {
    const newIndicators = { ...indicators, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'totalPopulation' || field === 'nominalGDP') {
      if (newIndicators.totalPopulation > 0) { // Avoid division by zero
        newIndicators.gdpPerCapita = newIndicators.nominalGDP / newIndicators.totalPopulation;
      } else {
        newIndicators.gdpPerCapita = 0;
      }
    } else if (field === 'gdpPerCapita') {
      newIndicators.nominalGDP = newIndicators.gdpPerCapita * newIndicators.totalPopulation;
    }
    
    onIndicatorsChangeAction(newIndicators);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? `${prefix}N/A` : 'N/A';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };
  
  const formatPopulation = (pop: number): string => formatNumber(pop, 1, false);

  const economicTier = calculateEconomicTierLocally(indicators.gdpPerCapita); // Use renamed local function
  const tierStyle = getTierStyle(economicTier);

  const comparisonData = referenceCountry ? [ // Ensure referenceCountry exists before creating comparisonData
    {
      label: "GDP per Capita",
      userValue: indicators.gdpPerCapita,
      refValue: referenceCountry.gdpPerCapita || 0,
      format: (v: number) => formatNumber(v, 2),
      icon: DollarSign,
    },
    {
      label: "Population",
      userValue: indicators.totalPopulation,
      refValue: referenceCountry.population || 0,
      format: (v: number) => formatPopulation(v),
      icon: Users,
    },
    {
      label: "Total GDP",
      userValue: indicators.nominalGDP,
      refValue: referenceCountry.gdp || 0,
      format: (v: number) => formatNumber(v, 1),
      icon: Globe,
    },
  ] : [];

  const healthIndicator = computeHealth(indicators.realGDPGrowthRate, indicators.inflationRate);

  


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Core Economic Indicators
        </h3>
      </div>

      {showComparison && referenceCountry && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparisonData.map((item) => {
            const Icon = item.icon;
            const difference = item.refValue !== 0 ? ((item.userValue - item.refValue) / item.refValue) * 100 : (item.userValue > 0 ? Infinity : 0);
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
                    {isFinite(difference) ? `${isHigher ? '+' : ''}${difference.toFixed(1)}%` : (item.userValue > item.refValue ? '+∞%' : (item.userValue === item.refValue ? '0%' : '-∞%'))} vs {referenceCountry?.name || 'Unknown'}
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
                  disabled={isReadOnly}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                  {formatPopulation(indicators.totalPopulation)}
                </div>
              </div>
              {showComparison && referenceCountry && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  Ref: {formatPopulation(referenceCountry.population || 0)}
                </div>
              )}
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
                  disabled={isReadOnly}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <span className={`tier-badge ${tierStyle.className}`}>{economicTier}</span>
                </div>
              </div>
              {showComparison && referenceCountry && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  Ref: {formatNumber(referenceCountry.gdpPerCapita || 0, 2)}
                </div>
              )}
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
                  disabled={isReadOnly}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                  {formatNumber(indicators.nominalGDP)}
                </div>
              </div>
              {showComparison && referenceCountry && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  Ref: {formatNumber(referenceCountry.gdp || 0)}
                </div>
              )}
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
                  value={indicators.realGDPGrowthRate * 100} // Display as percentage
                  onChange={(e) => handleInputChange('realGDPGrowthRate', parseFloat(e.target.value) / 100)} // Store as decimal
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  disabled={isReadOnly}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>-5%</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {(indicators.realGDPGrowthRate * 100).toFixed(1)}%
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
                  value={indicators.inflationRate * 100} // Display as percentage
                  onChange={(e) => handleInputChange('inflationRate', parseFloat(e.target.value) / 100)} // Store as decimal
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  disabled={isReadOnly}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>0%</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {(indicators.inflationRate * 100).toFixed(1)}%
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
                disabled={isReadOnly}
              />
              <div className="text-xs text-[var(--color-text-muted)]">
                Value relative to USD (1.0 = parity)
              </div>
            </div>
          </div>
        </div>


      

      
    </div>
  );
}