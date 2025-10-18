"use client";

import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import {
  EnhancedNumberInput,
  EnhancedSlider,
  EnhancedDial,
  MetricCard
} from '../primitives/enhanced';
import { GlassBarChart } from '~/components/charts/RechartsIntegration';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import type { EconomicInputs, RealCountryData } from '../lib/economy-data-service';
import { getEconomicTier } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface CoreIndicatorsSectionEnhancedProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  showAdvanced?: boolean;
}

export function CoreIndicatorsSectionEnhanced({
  inputs,
  onInputsChange,
  referenceCountry,
  showAdvanced = false
}: CoreIndicatorsSectionEnhancedProps) {

  // Ensure coreIndicators exists with defaults
  const coreIndicators = inputs.coreIndicators || {
    totalPopulation: 10000000,
    nominalGDP: 250000000000,
    gdpPerCapita: 25000,
    realGDPGrowthRate: 3.0,
    inflationRate: 2.0,
    currencyExchangeRate: 1.0
  };

  // Calculate economic tier and expected growth rate
  const economicTier = getEconomicTier(coreIndicators.gdpPerCapita);
  
  const calculateExpectedGrowthRate = (gdpPerCapita: number, population: number): number => {
    // Higher income countries typically have lower growth potential
    // Larger countries also tend to have lower growth rates due to scale
    const incomeFactor = Math.max(0.5, Math.min(8, 8 - (gdpPerCapita / 10000)));
    const sizeFactor = population >= 100000000 ? 0.8 : 
                      population >= 10000000 ? 0.9 : 
                      population >= 1000000 ? 1.0 : 1.1;
    
    return Math.round((incomeFactor * sizeFactor) * 10) / 10; // Round to 1 decimal
  };

  const expectedGrowthRate = calculateExpectedGrowthRate(coreIndicators.gdpPerCapita, coreIndicators.totalPopulation);

  // Calculate derived metrics for overview cards
  const metrics = useMemo(() => {
    const totalPopulation = Number(coreIndicators.totalPopulation) || 0;
    const gdpPerCapita = Number(coreIndicators.gdpPerCapita) || 0;
    const realGDPGrowthRate = Number(coreIndicators.realGDPGrowthRate) || 0;
    const inflationRate = Number(coreIndicators.inflationRate) || 0;
    const nominalGDP = totalPopulation * gdpPerCapita;

    return [
      {
        label: "Total GDP",
        value: nominalGDP,
        unit: "",
        description: "Nominal Gross Domestic Product",
        icon: DollarSign,
        trend: realGDPGrowthRate > 2 ? 'up' as const : realGDPGrowthRate < 0 ? 'down' as const : 'neutral' as const,
        change: realGDPGrowthRate,
        changeUnit: "%"
      },
      {
        label: "Population",
        value: totalPopulation,
        unit: " people",
        description: "Total population count",
        icon: Users,
        trend: 'neutral' as const
      },
      {
        label: "GDP per Capita",
        value: gdpPerCapita,
        unit: " $",
        description: "Economic output per person",
        icon: Activity,
        trend: realGDPGrowthRate > 2 ? 'up' as const : realGDPGrowthRate < 0 ? 'down' as const : 'neutral' as const,
        change: realGDPGrowthRate,
        changeUnit: "%"
      },
      {
        label: "Growth Rate",
        value: realGDPGrowthRate,
        unit: "%",
        description: "Annual economic growth",
        icon: TrendingUp,
        trend: realGDPGrowthRate > 2 ? 'up' as const : realGDPGrowthRate < 0 ? 'down' as const : 'neutral' as const,
        change: realGDPGrowthRate - 2.5, // Assuming 2.5% is global average
        changeUnit: "pp"
      }
    ];
  }, [coreIndicators]);

  // Generate 10-year economic projections
  const generateProjections = (currentGDP: number, growthRate: number, inflationRate: number) => {
    const projections = [];
    let projectedGDP = currentGDP;
    
    for (let year = 0; year <= 10; year++) {
      const yearLabel = year === 0 ? 'Current' : `Year ${year}`;
      
      projections.push({
        name: yearLabel,
        population: coreIndicators.totalPopulation, // Population stays constant for simplicity
        gdpPerCapita: projectedGDP,
        growthRate: year === 0 ? growthRate : growthRate * (1 - year * 0.05), // Slightly declining growth over time
        inflationRate: inflationRate,
        color: year === 0 ? 'blue' : year <= 3 ? 'emerald' : year <= 7 ? 'yellow' : 'orange'
      });
      
      // Apply growth and inflation to next year's GDP
      projectedGDP = projectedGDP * (1 + growthRate / 100) * (1 + inflationRate / 100);
    }
    
    return projections;
  };

  // Prepare comparison data for charts
  const comparisonData = referenceCountry ? [
    {
      name: inputs.countryName || 'Your Country',
      population: coreIndicators.totalPopulation,
      gdpPerCapita: coreIndicators.gdpPerCapita,
      growthRate: coreIndicators.realGDPGrowthRate,
      inflationRate: coreIndicators.inflationRate,
      color: 'blue'
    },
    {
      name: referenceCountry.name,
      population: referenceCountry.population,
      gdpPerCapita: referenceCountry.gdpPerCapita,
      growthRate: referenceCountry.growthRate || 2.5,
      inflationRate: referenceCountry.inflationRate || 2.0,
      color: 'emerald'
    }
  ] : generateProjections(
    coreIndicators.gdpPerCapita,
    coreIndicators.realGDPGrowthRate,
    coreIndicators.inflationRate
  );

  const formatCurrency = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(1)}T`;
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`;
    return `$${numValue.toFixed(0)}`;
  };

  const formatPopulation = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;
    return numValue.toString();
  };

  return (
    <div className="space-y-8">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            {...metric}
            sectionId="core"
            className="h-full"
          />
        ))}
      </div>

      {/* Core Economic Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Population and GDP */}
        <div className="space-y-6">
          <EnhancedNumberInput
            label="Total Population"
            description="The total number of people living in your country"
            value={Number(coreIndicators.totalPopulation) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...(inputs.coreIndicators || {}),
                totalPopulation: Number(value),
                nominalGDP: Number(value) * Number(coreIndicators.gdpPerCapita)
              }
            })}
            min={1000}
            max={2000000000}
            step={100000}
            unit=" people"
            sectionId="core"
            icon={Users}
            format={formatPopulation}
            referenceValue={referenceCountry?.population}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
            showButtons={true}
            showReset={true}
            resetValue={referenceCountry?.population}
          />

          <EnhancedNumberInput
            label="GDP per Capita"
            description="Average economic output per person (annual income proxy)"
            value={Number(coreIndicators.gdpPerCapita) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...(inputs.coreIndicators || {}),
                gdpPerCapita: Number(value),
                nominalGDP: Number(coreIndicators.totalPopulation) * Number(value)
              }
            })}
            min={100}
            max={200000}
            step={500}
            unit=" $"
            sectionId="core"
            icon={DollarSign}
            format={formatCurrency}
            referenceValue={referenceCountry?.gdpPerCapita}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
            showButtons={true}
          />
        </div>

        {/* Right Column - Growth and Inflation */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="h-4 w-4" />
              Economic Growth Profile
            </label>
            <p className="text-xs text-muted-foreground">
              Calculated based on your country's economic tier and population size
            </p>
            <div className="p-4 bg-card/50 backdrop-blur-sm border rounded-lg border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">{economicTier}</div>
                  <div className="text-sm text-muted-foreground">Economic Development Tier</div>
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs font-medium",
                    economicTier === 'Advanced' && "bg-green-500/20 text-green-600 border-green-500/30",
                    economicTier === 'Developed' && "bg-blue-500/20 text-blue-600 border-blue-500/30",
                    economicTier === 'Emerging' && "bg-orange-500/20 text-orange-600 border-orange-500/30",
                    economicTier === 'Developing' && "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
                  )}
                >
                  {economicTier}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Expected Growth Rate:</span>
                  <div className="font-medium text-foreground">{expectedGrowthRate}%</div>
                </div>
                <div>
                  <span className="text-muted-foreground">GDP per Capita:</span>
                  <div className="font-medium text-foreground">${Number(coreIndicators.gdpPerCapita).toLocaleString()}</div>
                </div>
              </div>
              {referenceCountry && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    vs {referenceCountry.name}: {getEconomicTier(referenceCountry.gdpPerCapita)} tier
                  </div>
                </div>
              )}
            </div>
          </div>

          <EnhancedDial
            label="Inflation Rate"
            description="Annual percentage increase in general price levels"
            value={Number(coreIndicators.inflationRate) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...(inputs.coreIndicators || {}),
                inflationRate: Number(value)
              }
            })}
            min={-5}
            max={20}
            step={0.1}
            precision={1}
            unit="%"
            sectionId="core"
            icon={Activity}
            showValue={true}
            showTicks={true}
            referenceValue={referenceCountry?.inflationRate}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
          />
        </div>
      </div>

      {/* Advanced Section */}
      {showAdvanced && (
        <div className="space-y-6 pt-6 border-t border-border">
          <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {referenceCountry ? 'Visual Comparisons' : 'Economic Projections'}
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GDP Comparison Chart */}
            <GlassBarChart
              data={comparisonData}
              xKey="name"
              yKey="gdpPerCapita"
              title={referenceCountry ? "GDP per Capita Comparison" : "GDP per Capita Projections"}
              description={referenceCountry ? `Your country vs ${referenceCountry.name}` : '10-year economic projections based on current growth and inflation rates'}
              height={300}
              valueFormatter={formatCurrency}
            />

            {/* Growth & Inflation Chart */}
            <GlassBarChart
              data={comparisonData}
              xKey="name"
              yKey={["growthRate", "inflationRate"]}
              title={referenceCountry ? "Growth vs Inflation" : "Growth & Inflation Trends"}
              description={referenceCountry ? "Economic indicators comparison" : "Projected growth and inflation rates over 10 years"}
              height={300}
              stacked={false}
              colors={['hsl(217, 91%, 60%)', 'hsl(160, 84%, 60%)']}
            />
          </div>
        </div>
      )}
    </div>
  );
}
