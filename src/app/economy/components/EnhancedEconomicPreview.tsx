// src/app/economy/components/EnhancedEconomicPreview.tsx
// Comprehensive preview & comparison

import { useMemo, type JSXElementConstructor, type ReactElement, type ReactNode, type ReactPortal } from "react";
import {
  ArrowLeft, CheckCircle, Users, DollarSign, Percent, TrendingDown, Building, CreditCard,
  Globe, Star, BarChart3, Info, BarChartHorizontalBig, PieChart as PieIconLucide, // Renamed to avoid conflict
  TrendingUp as TrendingUpIcon, Activity // Renamed to avoid conflict
} from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import type { EnhancedEconomicInputs, CountryComparison as EnhancedCountryComparisonType } from "../lib/enhanced-economic-types";
import { type RealCountryData, getEconomicTier, EnhancedEconomyDataService, type EconomicComparison } from "../lib/economy-data-service";
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
  const comparisons: EnhancedCountryComparisonType[] = useMemo(() => {
    // Use the static method from EnhancedEconomyDataService
    return EnhancedEconomyDataService.findSimilarCountries(inputs, allCountries.filter(c => c.name !== "World"));
  }, [inputs, allCountries]);

  const totalGDP = (inputs.population ?? 0) * (inputs.gdpPerCapita ?? 0);
  const realTotalGDP = totalGDP * (1 + (inputs.realGDPGrowthRate ?? 0));
  const taxRevenue = totalGDP * ((inputs.taxRevenuePercent ?? 0) / 100);
  const governmentBudget = totalGDP * ((inputs.governmentBudgetPercent ?? 0) / 100);
  const budgetBalance = taxRevenue - governmentBudget;
  const budgetBalancePercent = totalGDP === 0 ? 0 : (budgetBalance / totalGDP) * 100;
  const totalDebt = totalGDP * (((inputs.internalDebtPercent ?? 0) + (inputs.externalDebtPercent ?? 0)) / 100);
  const workingAgePopulation = (inputs.population ?? 0) * 0.65;
  const laborForce = workingAgePopulation * ((inputs.laborForceParticipationRate ?? 0) / 100);
  const employedPopulation = laborForce * (1 - (inputs.unemploymentRate ?? 0) / 100);


  const formatNumber = (num?: number, precision = 1, isCurrency = true): string => {
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? '$0' : '0';
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const formatPopulationDisplay = (pop?: number): string => formatNumber(pop, 1, false);

  const economicTier = getEconomicTier(inputs.gdpPerCapita ?? 0);
  const tierStyle = getTierStyle(economicTier);

  const getEconomicHealthScore = () => {
    let score = 70;
    const gdpPC = inputs.gdpPerCapita ?? 0;
    const unemployment = inputs.unemploymentRate ?? 0;
    const taxRevPerc = inputs.taxRevenuePercent ?? 0;
    const internalDebt = inputs.internalDebtPercent ?? 0;
    const externalDebt = inputs.externalDebtPercent ?? 0;
    const realGDPGrowth = inputs.realGDPGrowthRate ?? 0;
    const inflation = inputs.inflationRate ?? 0;

    if (gdpPC >= 50000) score += 15; else if (gdpPC >= 25000) score += 10; else if (gdpPC >= 10000) score += 5; else score -= 5;
    if (unemployment <= 5) score += 10; else if (unemployment <= 10) score += 5; else if (unemployment >= 20) score -= 15; else if (unemployment >= 15) score -= 10;
    if (taxRevPerc >= 15 && taxRevPerc <= 30) score += 5; else if (taxRevPerc < 10 || taxRevPerc > 40) score -= 5;
    const totalDebtPerc = internalDebt + externalDebt;
    if (totalDebtPerc <= 60) score += 5; else if (totalDebtPerc >= 150) score -= 10; else if (totalDebtPerc >= 100) score -= 5;
    if (realGDPGrowth >= 0.02 && realGDPGrowth <= 0.06) score += 5;
    if (inflation >= 0.015 && inflation <= 0.03) score += 5;
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

  const spendingBreakdown = inputs.governmentSpendingBreakdown || {
    defense: 0, education: 0, healthcare: 0, infrastructure: 0,
    socialServices: 0, administration: 0, diplomatic: 0, justice: 0
  };
  const spendingData = [
    { name: 'Defense', value: spendingBreakdown.defense, color: '#ef4444' },
    { name: 'Education', value: spendingBreakdown.education, color: '#3b82f6' },
    { name: 'Healthcare', value: spendingBreakdown.healthcare, color: '#10b981' },
    { name: 'Infrastructure', value: spendingBreakdown.infrastructure, color: '#f59e0b' },
    { name: 'Social Services', value: spendingBreakdown.socialServices, color: '#8b5cf6' },
    { name: 'Other', value: 100 - Object.values(spendingBreakdown).reduce((a, b) => a + (b || 0), 0), color: '#6b7280' }
  ].filter(item => item.value > 0);

  const taxData = [
    { name: 'Income Tax', value: 45, amount: taxRevenue * 0.45 },
    { name: 'Corporate Tax', value: 20, amount: taxRevenue * 0.20 },
    { name: 'Sales Tax', value: (inputs.salesTaxRate ?? 0) / 2, amount: taxRevenue * ((inputs.salesTaxRate ?? 0) / 100) },
    { name: 'Property Tax', value: (inputs.propertyTaxRate ?? 0) * 5, amount: taxRevenue * ((inputs.propertyTaxRate ?? 0) / 100) },
    { name: 'Payroll Tax', value: (inputs.payrollTaxRate ?? 0) / 2, amount: taxRevenue * ((inputs.payrollTaxRate ?? 0) / 100) },
    { name: 'Other', value: 15, amount: taxRevenue * 0.15 }
  ];

  const keyIndicators = [
    { icon: Users, label: "Population", value: formatPopulationDisplay(inputs.population), tier: economicTier, tierColorStyle: tierStyle.className },
    { icon: DollarSign, label: "GDP p.c.", value: formatNumber(inputs.gdpPerCapita), subLabel: "per capita" },
    { icon: Globe, label: "Total GDP", value: formatNumber(totalGDP), subLabel: "total economy" },
    { icon: Star, label: "Health Score", value: healthScore.toString(), subLabel: healthRating.label, colorClass: healthRating.color },
    { icon: TrendingUpIcon, label: "Real GDP Growth", value: `${((inputs.realGDPGrowthRate ?? 0) * 100).toFixed(1)}%`, subLabel: "annual growth", colorClass: (inputs.realGDPGrowthRate ?? 0) > 0 ? 'text-green-400' : 'text-red-400' },
    { icon: Activity, label: "Inflation Rate", value: `${((inputs.inflationRate ?? 0) * 100).toFixed(1)}%`, subLabel: "price growth", colorClass: (inputs.inflationRate ?? 0) > 0.05 ? 'text-red-400' : (inputs.inflationRate ?? 0) < 0 ? 'text-red-400' : 'text-green-400' }
  ];

  const laborIndicators = [
    { label: 'Labor Force', value: formatPopulationDisplay(laborForce), icon: Users },
    { label: 'Employed', value: formatPopulationDisplay(employedPopulation), icon: Building },
    { label: 'Unemployment', value: `${(inputs.unemploymentRate ?? 0).toFixed(1)}%`, icon: TrendingDown },
    { label: 'Participation', value: `${(inputs.laborForceParticipationRate ?? 0).toFixed(1)}%`, icon: Percent }
  ];

  const fiscalIndicators = [
    { label: 'Tax Revenue', value: formatNumber(taxRevenue), icon: DollarSign },
    { label: 'Budget', value: formatNumber(governmentBudget), icon: Building },
    { label: 'Balance', value: formatNumber(budgetBalance), icon: budgetBalance >= 0 ? TrendingUpIcon : TrendingDown, color: budgetBalance >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Total Debt', value: formatNumber(totalDebt), icon: CreditCard }
  ];

  const similarCountries = useMemo(() => {
    return allCountries
      .filter(c => c.name !== referenceCountry.name && c.name !== "World")
      .map(country => {
        const gdpDiff = Math.abs((inputs.gdpPerCapita ?? 0) - country.gdpPerCapita) / Math.max(country.gdpPerCapita, (inputs.gdpPerCapita ?? 1));
        const popDiff = Math.abs((inputs.population ?? 0) - country.population) / Math.max(country.population, (inputs.population ?? 1));
        const taxDiff = Math.abs((inputs.taxRevenuePercent ?? 0) - country.taxRevenuePercent) / Math.max(country.taxRevenuePercent, (inputs.taxRevenuePercent ?? 1));
        const unempDiff = Math.abs((inputs.unemploymentRate ?? 0) - country.unemploymentRate) / Math.max(country.unemploymentRate, (inputs.unemploymentRate ?? 1));
        
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
  }, [inputs, allCountries, referenceCountry.name]);


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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                {formatNumber(employedPopulation > 0 ? totalGDP / employedPopulation : 0)} per worker
              </div>
            </div>
          </div>
        </div>

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
                {budgetBalance >= 0 ? 'Surplus' : 'Deficit'}: {budgetBalancePercent.toFixed(1)}% of GDP
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <PieIconLucide className="h-5 w-5 mr-2" />
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
                    nameKey="name"
                  >
                    {spendingData.map((entry, index) => (
                      <Cell key={`cell-spending-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                        const item = spendingData.find(d => d.name === name);
                        return [`${value.toFixed(1)}% (${formatNumber(item?.value || 0)})`, name];
                    }}
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
              {spendingData.slice(0, 6).map((item) => (
                <div key={item.name} className="flex items-center">
                  <div className="w-3 h-3 rounded mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[var(--color-text-muted)] truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Tax Revenue Sources (Illustrative)
            </h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taxData} layout="vertical"> {/* Changed to vertical for better label display */}
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                  <XAxis type="number" stroke="var(--color-text-muted)" tickFormatter={(value) => `${value}%`} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" width={100} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}% (${formatNumber(props.payload?.amount || 0)})`,
                      'Revenue Share'
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-blur)',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  <Bar dataKey="percentage" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
            <BarChartHorizontalBig className="h-5 w-5 mr-2" />
            International Comparisons
          </h3>
        </div>
        <div className="card-content space-y-6">
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Most Similar Economies</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {similarCountries.map((country) => {
                const countryTierStyle = getTierStyle(country.tier);
                return (
                  <div key={country.name} className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {country.name}
                      </span>
                      <span className={`tier-badge ${countryTierStyle.className} text-xs`}>{country.tier}</span>
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

          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Economic Benchmarks</h4>
            <div className="space-y-4">
              {comparisons.map((comp, compIndex: number) => ( // Added type for compIndex
                <div key={compIndex} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-secondary)]">
                  <h5 className="font-semibold text-[var(--color-text-primary)] mb-1 flex items-center">
                    {comp.metric}
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getTierStyle(comp.tier as unknown as string).className}`}>
                      {comp.tier as unknown as string}
                    </span>
                  </h5>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">{comp.analysis}</p>
                  {comp.comparableCountries.length > 0 && (
                    <div>
                      <h6 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Similar Countries:</h6>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {comp.comparableCountries.map((countryItem: { name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; value: number | undefined; }, countryIndex: number) => ( // Added type for countryIndex
                          <div key={countryIndex} className="flex items-center justify-between p-1.5 text-xs bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border-primary)]">
                            <span className="font-medium text-[var(--color-text-primary)] truncate" title={countryItem.name}>
                              {countryItem.name}
                            </span>
                            <span className="text-[var(--color-text-muted)]">
                              {comp.metric.includes('Population') ? formatPopulationDisplay(countryItem.value)
                              : comp.metric.includes('GDP per Capita') ? formatNumber(countryItem.value)
                              : `${countryItem.value.toFixed(1)}%`}
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