// src/app/economy/components/EnhancedEconomicPreview.tsx
// Comprehensive preview & comparison

import { useMemo } from "react";
import {
  ArrowLeft, CheckCircle, Users, DollarSign, Percent, TrendingDown, Building, CreditCard,
  Globe, Star, BarChart3, Info, BarChartHorizontalBig, PieChart, TrendingUp, Activity
} from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import type { EnhancedEconomicInputs, CountryComparison } from "../lib/enhanced-economic-types";
import type { RealCountryData, EconomicComparison } from "../lib/economy-data-service";
import { generateEconomicComparisons, getEconomicTier } from "../lib/economy-data-service";
import { getTierStyle } from "~/lib/theme-utils";

interface EnhancedEconomicPreviewProps {
  inputs: EnhancedEconomicInputs;
  referenceCountry: RealCountryData;
  allCountries: RealCountryData[];
  onBack: () => void;
  onConfirm: () => void;
}

export function EnhancedEconomicPreview({
  inputs,
  referenceCountry,
  allCountries,
  onBack,
  onConfirm
}: EnhancedEconomicPreviewProps) {
  const comparisons = useMemo(() => {
    return generateEconomicComparisons(inputs, allCountries.filter(c => c.name !== "World"));
  }, [inputs, allCountries]);

  // Calculate comprehensive economic metrics
  const totalGDP = inputs.population * inputs.gdpPerCapita;
  const realTotalGDP = totalGDP * (1 + inputs.realGDPGrowthRate);
  const taxRevenue = totalGDP * (inputs.taxRevenuePercent / 100);
  const governmentBudget = totalGDP * (inputs.governmentBudgetPercent / 100);
  const budgetBalance = taxRevenue - governmentBudget;
  const totalDebt = totalGDP * ((inputs.internalDebtPercent + inputs.externalDebtPercent) / 100);
  const laborForce = inputs.population * 0.65 * (inputs.laborForceParticipationRate / 100);
  const employedPopulation = laborForce * (1 - inputs.unemploymentRate / 100);

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const formatPopulationDisplay = (pop: number): string => formatNumber(pop, 1, false);

  const economicTier = getEconomicTier(inputs.gdpPerCapita);
  const tierStyle = getTierStyle(economicTier);

  // Calculate economic health score
  const getEconomicHealthScore = () => {
    let score = 70;
    
    // GDP per capita contribution
    if (inputs.gdpPerCapita >= 50000) score += 15;
    else if (inputs.gdpPerCapita >= 25000) score += 10;
    else if (inputs.gdpPerCapita >= 10000) score += 5;
    else score -= 5;
    
    // Unemployment contribution
    if (inputs.unemploymentRate <= 5) score += 10;
    else if (inputs.unemploymentRate <= 10) score += 5;
    else if (inputs.unemploymentRate >= 20) score -= 15;
    else if (inputs.unemploymentRate >= 15) score -= 10;
    
    // Tax efficiency
    if (inputs.taxRevenuePercent >= 15 && inputs.taxRevenuePercent <= 30) score += 5;
    else if (inputs.taxRevenuePercent < 10 || inputs.taxRevenuePercent > 40) score -= 5;
    
    // Debt burden
    const totalDebtPercent = inputs.internalDebtPercent + inputs.externalDebtPercent;
    if (totalDebtPercent <= 60) score += 5;
    else if (totalDebtPercent >= 150) score -= 10;
    else if (totalDebtPercent >= 100) score -= 5;
    
    // Growth and inflation
    if (inputs.realGDPGrowthRate >= 0.02 && inputs.realGDPGrowthRate <= 0.06) score += 5;
    if (inputs.inflationRate >= 0.015 && inputs.inflationRate <= 0.03) score += 5;
    
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

  // Government spending data for chart
  const spendingData = [
    { name: 'Defense', value: inputs.governmentSpendingBreakdown.defense, color: '#ef4444' },
    { name: 'Education', value: inputs.governmentSpendingBreakdown.education, color: '#3b82f6' },
    { name: 'Healthcare', value: inputs.governmentSpendingBreakdown.healthcare, color: '#10b981' },
    { name: 'Infrastructure', value: inputs.governmentSpendingBreakdown.infrastructure, color: '#f59e0b' },
    { name: 'Social Services', value: inputs.governmentSpendingBreakdown.socialServices, color: '#8b5cf6' },
    { name: 'Other', value: 100 - Object.values(inputs.governmentSpendingBreakdown).reduce((a, b) => a + b, 0), color: '#6b7280' }
  ].filter(item => item.value > 0);

  // Tax breakdown for visualization
  const taxData = [
    { name: 'Income Tax', value: 45, amount: taxRevenue * 0.45 },
    { name: 'Corporate Tax', value: 20, amount: taxRevenue * 0.20 },
    { name: 'Sales Tax', value: inputs.salesTaxRate / 2, amount: taxRevenue * (inputs.salesTaxRate / 100) },
    { name: 'Property Tax', value: inputs.propertyTaxRate * 5, amount: taxRevenue * (inputs.propertyTaxRate / 100) },
    { name: 'Payroll Tax', value: inputs.payrollTaxRate / 2, amount: taxRevenue * (inputs.payrollTaxRate / 100) },
    { name: 'Other', value: 15, amount: taxRevenue * 0.15 }
  ];

  // Key economic indicators
  const keyIndicators = [
    { 
      icon: Users, 
      label: "Population", 
      value: formatPopulationDisplay(inputs.population), 
      tier: economicTier, 
      tierColorStyle: tierStyle.className,
      change: inputs.population > referenceCountry.population ? 'up' : 'down'
    },
    { 
      icon: DollarSign, 
      label: "GDP per Capita", 
      value: formatNumber(inputs.gdpPerCapita), 
      subLabel: "per capita",
      change: inputs.gdpPerCapita > referenceCountry.gdpPerCapita ? 'up' : 'down'
    },
    { 
      icon: Globe, 
      label: "Total GDP", 
      value: formatNumber(totalGDP), 
      subLabel: "total economy",
      change: 'neutral'
    },
    { 
      icon: Star, 
      label: "Health Score", 
      value: healthScore.toString(), 
      subLabel: healthRating.label, 
      colorClass: healthRating.color,
      change: 'neutral'
    },
    {
      icon: TrendingUp,
      label: "Real GDP Growth",
      value: `${(inputs.realGDPGrowthRate * 100).toFixed(1)}%`,
      subLabel: "annual growth",
      colorClass: inputs.realGDPGrowthRate > 0 ? 'text-green-400' : 'text-red-400',
      change: 'neutral'
    },
    {
      icon: Activity,
      label: "Inflation Rate",
      value: `${(inputs.inflationRate * 100).toFixed(1)}%`,
      subLabel: "price growth",
      colorClass: inputs.inflationRate > 0.05 ? 'text-red-400' : inputs.inflationRate < 0 ? 'text-red-400' : 'text-green-400',
      change: 'neutral'
    }
  ];

  // Labor market indicators
  const laborIndicators = [
    { label: 'Labor Force', value: formatPopulationDisplay(laborForce), icon: Users },
    { label: 'Employed', value: formatPopulationDisplay(employedPopulation), icon: Building },
    { label: 'Unemployment', value: `${inputs.unemploymentRate.toFixed(1)}%`, icon: TrendingDown },
    { label: 'Participation', value: `${inputs.laborForceParticipationRate.toFixed(1)}%`, icon: Percent }
  ];

  // Fiscal indicators
  const fiscalIndicators = [
    { label: 'Tax Revenue', value: formatNumber(taxRevenue), icon: DollarSign },
    { label: 'Budget', value: formatNumber(governmentBudget), icon: Building },
    { label: 'Balance', value: formatNumber(budgetBalance), icon: budgetBalance >= 0 ? TrendingUp : TrendingDown, 
      color: budgetBalance >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Total Debt', value: formatNumber(totalDebt), icon: CreditCard }
  ];

  // Find most similar countries
  const similarCountries = useMemo(() => {
    return allCountries
      .filter(c => c.name !== referenceCountry.name && c.name !== "World")
      .map(country => {
        const gdpDiff = Math.abs(inputs.gdpPerCapita - country.gdpPerCapita) / Math.max(country.gdpPerCapita, inputs.gdpPerCapita);
        const popDiff = Math.abs(inputs.population - country.population) / Math.max(country.population, inputs.population);
        const taxDiff = Math.abs(inputs.taxRevenuePercent - country.taxRevenuePercent) / Math.max(country.taxRevenuePercent, inputs.taxRevenuePercent);
        const unempDiff = Math.abs(inputs.unemploymentRate - country.unemploymentRate) / Math.max(country.unemploymentRate, inputs.unemploymentRate);
        
        const similarity = Math.max(0, 100 - ((gdpDiff + popDiff + taxDiff + unempDiff) * 25));
        
        return {
          name: country.name,
          similarity,
          tier: getEconomicTier(country.gdpPerCapita),
          gdpPerCapita: country.gdpPerCapita,
          population: country.population
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }, [inputs, allCountries, referenceCountry]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
            Economic Preview: {inputs.countryName}
          </h2>
          <p className="text-[var(--color-text-muted)]">
            Comprehensive economic profile and international comparisons
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm py-1.5 px-3">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </button>
      </div>

      {/* Key Economic Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {keyIndicators.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="card">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`h-6 w-6 ${item.colorClass || 'text-[var(--color-brand-primary)]'}`} />
                  {item.tier && <span className={`tier-badge ${item.tierColorStyle}`}>{item.tier}</span>}
                </div>
                <div className={`text-xl font-bold ${item.colorClass || 'text-[var(--color-text-primary)]'}`}>
                  {item.value}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {item.label} {item.subLabel && `(${item.subLabel})`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Economic Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Labor Market Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Labor Market
            </h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-2 gap-4">
              {laborIndicators.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-md">
                    <div className="flex items-center">
                      <Icon className="h-4 w-4 mr-3 text-[var(--color-brand-primary)]" />
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">{item.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-xs text-[var(--color-text-muted)] mb-2">Labor Productivity</div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {formatNumber((inputs.gdpPerCapita * inputs.population) / employedPopulation)} per worker
              </div>
            </div>
          </div>
        </div>

        {/* Fiscal Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Fiscal Position
            </h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-2 gap-4">
              {fiscalIndicators.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-md">
                    <div className="flex items-center">
                      <Icon className={`h-4 w-4 mr-3 ${item.color || 'text-[var(--color-brand-primary)]'}`} />
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${item.color || 'text-[var(--color-text-primary)]'}`}>
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-xs text-[var(--color-text-muted)] mb-2">Budget Balance</div>
              <div className={`text-lg font-bold ${budgetBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {budgetBalance >= 0 ? 'Surplus' : 'Deficit'}: {((budgetBalance / totalGDP) * 100).toFixed(1)}% of GDP
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Government Spending Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Government Spending
            </h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={spendingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {spendingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}% (${formatNumber((governmentBudget * value / 100))})`,
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-blur)',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mt-4">
              {spendingData.slice(0, 6).map((item, index) => (
                <div key={item.name} className="flex items-center">
                  <div className="w-3 h-3 rounded mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[var(--color-text-muted)] truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tax Revenue Sources */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Tax Revenue Sources
            </h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taxData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                  <XAxis type="number" stroke="var(--color-text-muted)" />
                  <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}% (${formatNumber(taxData.find(d => d.name === (name as any))?.amount || 0)})`,
                      'Revenue Share'
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-blur)',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Country Comparisons */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <BarChartHorizontalBig className="h-5 w-5 mr-2" />
            International Comparisons
          </h3>
        </div>
        <div className="card-content space-y-6">
          {/* Most Similar Countries */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Most Similar Economies</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {similarCountries.map((country, index) => {
                const tierStyle = getTierStyle(country.tier);
                return (
                  <div key={country.name} className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {country.name}
                      </span>
                      <span className={`tier-badge ${tierStyle.className} text-xs`}>{country.tier}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                      <div>GDP: {formatNumber(country.gdpPerCapita)}</div>
                      <div>Pop: {formatPopulationDisplay(country.population)}</div>
                      <div className="text-green-400 font-medium">
                        {country.similarity.toFixed(0)}% match
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Traditional Comparisons */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Economic Benchmarks</h4>
            <div className="space-y-4">
              {comparisons.map((comp, index) => (
                <div key={index} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-secondary)]">
                  <h5 className="font-semibold text-[var(--color-text-primary)] mb-1">{comp.metric}
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getTierStyle(comp.tier).className}`}>
                      {comp.tier}
                    </span>
                  </h5>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">{comp.analysis}</p>
                  {comp.comparableCountries.length > 0 && (
                    <div>
                      <h6 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Similar Countries:</h6>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {comp.comparableCountries.map((country, idx) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 text-xs bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border-primary)]">
                            <span className="font-medium text-[var(--color-text-primary)] truncate" title={country.name}>
                              {country.name}
                            </span>
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
        </div>
      </div>

      {/* Confirmation Section */}
      <div className="bg-[var(--color-brand-primary)] bg-opacity-10 border border-[var(--color-brand-primary)] border-opacity-30 rounded-lg p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-primary)] mb-1">
              Finalize Economic Model
            </h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              This comprehensive economic model for {inputs.countryName} includes all subsystems: 
              core indicators, labor markets, and fiscal policy. Ready to integrate with IxStats?
            </p>
            <div className="flex items-center mt-2 text-sm text-[var(--color-text-muted)]">
              <span className={`tier-badge ${tierStyle.className} mr-2`}>{economicTier}</span>
              <span>Economic Health: </span>
              <span className={`ml-1 font-medium ${healthRating.color}`}>{healthRating.label}</span>
              <span className="ml-1">({healthScore}/100)</span>
            </div>
          </div>
          <button onClick={onConfirm} className="btn-primary flex-shrink-0">
            <CheckCircle className="h-5 w-5 mr-2" /> 
            Confirm & Save Model
          </button>
        </div>
      </div>
    </div>
  );
}