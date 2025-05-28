// src/app/economy/components/EconomicPreview.tsx
"use client";

import { useMemo } from "react";
import { 
  ArrowLeft, 
  CheckCircle, 
  Users, 
  DollarSign, 
  Percent, 
  TrendingDown, 
  Building, 
  CreditCard,
  Globe,
  Star,
  BarChart3
} from "lucide-react";
import type { EconomicInputs, RealCountryData, EconomicComparison } from "../lib/economy-data-service";
import { generateEconomicComparisons, getEconomicTier } from "../lib/economy-data-service";

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
    return generateEconomicComparisons(inputs, allCountries);
  }, [inputs, allCountries]);

  const calculateTotalGDP = () => {
    return (inputs.population * inputs.gdpPerCapita) / 1e9; // In billions
  };

  const calculateTaxRevenue = () => {
    return (calculateTotalGDP() * inputs.taxRevenuePercent) / 100;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatPopulation = (pop: number): string => {
    if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
    if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
    if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
    return pop.toString();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    }
  };

  const economicTier = getEconomicTier(inputs.gdpPerCapita);
  const totalGDP = calculateTotalGDP();
  const taxRevenue = calculateTaxRevenue();

  // Calculate economic health score
  const getEconomicHealthScore = () => {
    let score = 70; // Base score
    
    // GDP per capita factor
    if (inputs.gdpPerCapita >= 50000) score += 15;
    else if (inputs.gdpPerCapita >= 25000) score += 10;
    else if (inputs.gdpPerCapita >= 10000) score += 5;
    else score -= 5;
    
    // Unemployment factor
    if (inputs.unemploymentRate <= 5) score += 10;
    else if (inputs.unemploymentRate <= 10) score += 5;
    else if (inputs.unemploymentRate >= 20) score -= 15;
    else if (inputs.unemploymentRate >= 15) score -= 10;
    
    // Tax revenue factor (balance needed)
    if (inputs.taxRevenuePercent >= 15 && inputs.taxRevenuePercent <= 30) score += 5;
    else if (inputs.taxRevenuePercent < 10 || inputs.taxRevenuePercent > 40) score -= 5;
    
    // Debt factor
    const totalDebt = inputs.internalDebtPercent + inputs.externalDebtPercent;
    if (totalDebt <= 60) score += 5;
    else if (totalDebt >= 150) score -= 10;
    else if (totalDebt >= 100) score -= 5;
    
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = getEconomicHealthScore();
  const getHealthRating = (score: number): { label: string; color: string } => {
    if (score >= 85) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 70) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 55) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    if (score >= 40) return { label: 'Poor', color: 'text-orange-600 dark:text-orange-400' };
    return { label: 'Critical', color: 'text-red-600 dark:text-red-400' };
  };

  const healthRating = getHealthRating(healthScore);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Economic Preview: {inputs.countryName}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Review your nation's economic profile and compare with real-world countries
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Inputs
        </button>
      </div>

      {/* Economic Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierColor(economicTier)}`}>
              {economicTier}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPopulation(inputs.population)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Population</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="text-xs text-green-700 dark:text-green-300">per capita</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(inputs.gdpPerCapita)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">GDP per Capita</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <Globe className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="text-xs text-purple-700 dark:text-purple-300">total</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(totalGDP * 1e9)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total GDP</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-2">
            <Star className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div className={`text-xs font-medium ${healthRating.color}`}>{healthRating.label}</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {healthScore}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Health Score</div>
        </div>
      </div>

      {/* Economic Indicators Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Economic Indicators
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { 
                icon: Users, 
                label: 'Population', 
                value: formatPopulation(inputs.population),
                reference: formatPopulation(referenceCountry.population),
                color: 'blue'
              },
              { 
                icon: DollarSign, 
                label: 'GDP per Capita', 
                value: formatNumber(inputs.gdpPerCapita),
                reference: formatNumber(referenceCountry.gdpPerCapita),
                color: 'green'
              },
              { 
                icon: Percent, 
                label: 'Tax Revenue', 
                value: `${inputs.taxRevenuePercent.toFixed(1)}%`,
                reference: `${referenceCountry.taxRevenuePercent.toFixed(1)}%`,
                color: 'purple'
              },
              { 
                icon: TrendingDown, 
                label: 'Unemployment', 
                value: `${inputs.unemploymentRate.toFixed(1)}%`,
                reference: `${referenceCountry.unemploymentRate.toFixed(1)}%`,
                color: 'red'
              },
              { 
                icon: Building, 
                label: 'Gov. Budget', 
                value: `${inputs.governmentBudgetPercent.toFixed(1)}%`,
                reference: `${inputs.taxRevenuePercent.toFixed(1)}%`,
                color: 'indigo'
              },
              { 
                icon: CreditCard, 
                label: 'Total Debt', 
                value: `${(inputs.internalDebtPercent + inputs.externalDebtPercent).toFixed(1)}%`,
                reference: 'varies',
                color: 'orange'
              }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <Icon className={`h-5 w-5 mr-3 text-${item.color}-600 dark:text-${item.color}-400`} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {referenceCountry.name}: {item.reference}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Country Comparisons */}
      <div className="space-y-6 mb-8">
        {comparisons.map((comparison, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white">{comparison.metric}</h4>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">{comparison.analysis}</p>
              
              {comparison.comparableCountries.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Similar Countries:
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {comparison.comparableCountries.slice(0, 6).map((country, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-750 rounded border border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {country.name}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {comparison.metric.includes('Population') 
                            ? formatPopulation(country.value)
                            : comparison.metric.includes('GDP per Capita')
                              ? formatNumber(country.value)
                              : `${country.value.toFixed(1)}%`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Section */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
              Ready to Set Baseline?
            </h3>
            <p className="text-indigo-700 dark:text-indigo-300 text-sm">
              This will lock in your economic parameters as the starting point for {inputs.countryName}. 
              You'll be able to see growth projections and apply DM modifications in the next phases.
            </p>
          </div>
          <button
            onClick={onConfirm}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirm Baseline
          </button>
        </div>
      </div>
    </div>
  );
}