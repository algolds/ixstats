// src/app/economy/components/EconomicPreview.tsx
"use client";

import { useMemo } from "react";
import {
  ArrowLeft, CheckCircle, Users, DollarSign, Percent, TrendingDown, Building, CreditCard,
  Globe, Star, BarChart3, Info, BarChartHorizontalBig
} from "lucide-react";
import type { EconomicInputs, RealCountryData, EconomicComparison } from "../lib/economy-data-service";
import { generateEconomicComparisons, getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils"; // Assuming you have this

interface EconomicPreviewProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  allCountries: RealCountryData[];
  onBack: () => void;
  onConfirm: () => void;
}

export function EconomicPreview({
  inputs,
  referenceCountry,
  allCountries,
  onBack,
  onConfirm
}: EconomicPreviewProps) {
  const comparisons = useMemo(() => {
    return generateEconomicComparisons(inputs, allCountries.filter(c => c.name !== "World"));
  }, [inputs, allCountries]);

  const calculateTotalGDP = () => (inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita) / 1e9; // Billions
  const calculateTaxRevenueValue = () => (calculateTotalGDP() * inputs.fiscalSystem.taxRevenueGDPPercent) / 100;

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };
  const formatPopulationDisplay = (pop: number): string => formatNumber(pop, 1, false);

  const economicTier = getEconomicTier(inputs.coreIndicators.gdpPerCapita);
  const tierStyle = getTierStyle(economicTier);
  const totalGDP = calculateTotalGDP();
  const taxRevenue = calculateTaxRevenueValue();

  const getEconomicHealthScore = () => {
    let score = 70;
    if (inputs.coreIndicators.gdpPerCapita >= 50000) score += 15; 
    else if (inputs.coreIndicators.gdpPerCapita >= 25000) score += 10; 
    else if (inputs.coreIndicators.gdpPerCapita >= 10000) score += 5; 
    else score -= 5;
    
    if (inputs.laborEmployment.unemploymentRate <= 5) score += 10; 
    else if (inputs.laborEmployment.unemploymentRate <= 10) score += 5; 
    else if (inputs.laborEmployment.unemploymentRate >= 20) score -= 15; 
    else if (inputs.laborEmployment.unemploymentRate >= 15) score -= 10;
    
    if (inputs.fiscalSystem.taxRevenueGDPPercent >= 15 && inputs.fiscalSystem.taxRevenueGDPPercent <= 30) score += 5; 
    else if (inputs.fiscalSystem.taxRevenueGDPPercent < 10 || inputs.fiscalSystem.taxRevenueGDPPercent > 40) score -= 5;
    
    const totalDebt = inputs.fiscalSystem.internalDebtGDPPercent + inputs.fiscalSystem.externalDebtGDPPercent;
    if (totalDebt <= 60) score += 5; 
    else if (totalDebt >= 150) score -= 10; 
    else if (totalDebt >= 100) score -= 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const healthScore = getEconomicHealthScore();
  const getHealthRating = (score: number): { label: string; color: string } => {
    if (score >= 85) return { label: 'Excellent', color: 'text-[var(--color-success)]' };
    if (score >= 70) return { label: 'Good', color: 'text-[var(--color-info)]' };
    if (score >= 55) return { label: 'Fair', color: 'text-[var(--color-warning)]' };
    if (score >= 40) return { label: 'Poor', color: 'text-[var(--color-error-dark)]' };
    return { label: 'Critical', color: 'text-[var(--color-error)]' };
  };
  const healthRating = getHealthRating(healthScore);

  const indicatorItems = [
    { icon: Users, label: 'Population', value: formatPopulationDisplay(inputs.coreIndicators.totalPopulation), reference: formatPopulationDisplay(referenceCountry.population), color: 'blue' },
    { icon: DollarSign, label: 'GDP per Capita', value: formatNumber(inputs.coreIndicators.gdpPerCapita, 2), reference: formatNumber(referenceCountry.gdpPerCapita, 2), color: 'green' },
    { icon: Percent, label: 'Tax Revenue %', value: `${inputs.fiscalSystem.taxRevenueGDPPercent.toFixed(1)}%`, reference: `${referenceCountry.taxRevenuePercent.toFixed(1)}%`, color: 'purple' },
    { icon: TrendingDown, label: 'Unemployment %', value: `${inputs.laborEmployment.unemploymentRate.toFixed(1)}%`, reference: `${referenceCountry.unemploymentRate.toFixed(1)}%`, color: 'red' },
    { icon: Building, label: 'Gov. Budget %', value: `${inputs.fiscalSystem.governmentBudgetGDPPercent.toFixed(1)}%`, reference: `Ref: ${referenceCountry.taxRevenuePercent.toFixed(1)}%`, color: 'indigo' },
    { icon: CreditCard, label: 'Total Debt %', value: `${(inputs.fiscalSystem.internalDebtGDPPercent + inputs.fiscalSystem.externalDebtGDPPercent).toFixed(1)}%`, reference: 'Varies', color: 'orange' }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">Economic Preview: {inputs.countryName}</h2>
          <p className="text-[var(--color-text-muted)]">Review and compare your nation's economic profile.</p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, label: "Population", value: formatPopulationDisplay(inputs.coreIndicators.totalPopulation), tier: economicTier, tierColorStyle: tierStyle.className },
          { icon: DollarSign, label: "GDP p.c.", value: formatNumber(inputs.coreIndicators.gdpPerCapita), subLabel: "per capita" },
          { icon: Globe, label: "Total GDP", value: formatNumber(totalGDP * 1e9), subLabel: "total" },
          { icon: Star, label: "Health Score", value: healthScore.toString(), subLabel: healthRating.label, colorClass: healthRating.color }
        ].map(item => {
            const Icon = item.icon;
            return(
                <div key={item.label} className={`p-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]`}>
                    <div className="flex items-center justify-between mb-2">
                        <Icon className={`h-7 w-7 ${item.colorClass || 'text-[var(--color-brand-primary)]'}`} />
                        {item.tier && <span className={`tier-badge ${item.tierColorStyle}`}>{item.tier}</span>}
                    </div>
                    <div className={`text-2xl font-bold text-[var(--color-text-primary)] ${item.colorClass}`}>{item.value}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">{item.label} {item.subLabel && `(${item.subLabel})`}</div>
                </div>
            );
        })}
      </div>

      <div className="card mb-8">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" /> Economic Indicators
          </h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {indicatorItems.map(item => {
              const Icon = item.icon;
              return(
                <div key={item.label} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-md border border-[var(--color-border-secondary)]">
                  <div className="flex items-center">
                    <Icon className={`h-5 w-5 mr-3 text-[var(--color-brand-primary)]`} />
                    <div>
                      <div className="font-medium text-[var(--color-text-primary)]">{item.label}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">Ref ({referenceCountry.name}): {item.reference}</div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-[var(--color-text-primary)]">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="card-header">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
                <BarChartHorizontalBig className="h-5 w-5 mr-2" /> Country Comparisons
            </h3>
        </div>
        <div className="card-content space-y-6">
            {comparisons.map((comp, index) => (
            <div key={index} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-secondary)]">
                <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">{comp.metric}
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getTierStyle(comp.tier).className}`}>
                        {comp.tier}
                    </span>
                </h4>
                <p className="text-sm text-[var(--color-text-muted)] mb-3">{comp.analysis}</p>
                {comp.comparableCountries.length > 0 && (
                <div>
                    <h5 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Similar Countries:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {comp.comparableCountries.map((country, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 text-xs bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border-primary)]">
                        <span className="font-medium text-[var(--color-text-primary)] truncate" title={country.name}>{country.name}</span>
                        <span className="text-[var(--color-text-muted)]">
                            {comp.metric.includes('Population') ? formatPopulationDisplay(country.value)
                            : comp.metric.includes('GDP per Capita') ? formatNumber(country.value)
                            : `${country.value.toFixed(1)}%`}
                        </span>
                        </div>
                    ))}
                    </div>
                </div>
                )}
            </div>
            ))}
        </div>
      </div>

      <div className="bg-[var(--color-brand-primary)] bg-opacity-10 border border-[var(--color-brand-primary)] border-opacity-30 rounded-lg p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-primary)] mb-1">Ready to Set Baseline?</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              This will lock in parameters for {inputs.countryName}. Next, you can apply DM modifications.
            </p>
          </div>
          <button onClick={onConfirm} className="btn-primary flex-shrink-0">
            <CheckCircle className="h-5 w-5 mr-2" /> Confirm Baseline
          </button>
        </div>
      </div>
    </div>
  );
}
