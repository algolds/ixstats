"use client";

import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import {
  EnhancedNumberInput,
  EnhancedSlider,
  EnhancedDial,
  EnhancedBarChart,
  MetricCard
} from '../primitives/enhanced';
import type { EconomicInputs, RealCountryData } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface CoreIndicatorsSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry: RealCountryData;
  showAdvanced?: boolean;
}

export function CoreIndicatorsSection({ 
  inputs, 
  onInputsChange,
  referenceCountry,
  showAdvanced = false
}: CoreIndicatorsSectionProps) {
  
  // Calculate derived metrics for overview cards
  const metrics = useMemo(() => {
    const { totalPopulation, gdpPerCapita, realGDPGrowthRate, inflationRate } = inputs.coreIndicators;
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
  }, [inputs.coreIndicators]);

  // Prepare comparison data for charts with guaranteed numeric values
  const comparisonData = [
    {
      name: inputs.countryName || 'Your Custom Country',
      population: Number(inputs.coreIndicators?.totalPopulation) || 1000000,
      gdpPerCapita: Number(inputs.coreIndicators?.gdpPerCapita) || 25000,
      growthRate: Number(inputs.coreIndicators?.realGDPGrowthRate) || 2.1,
      inflationRate: Number(inputs.coreIndicators?.inflationRate) || 2.2,
      color: 'blue'
    },
    {
      name: `${referenceCountry?.name || 'Foundation Country'} (Foundation)`,
      population: Number(referenceCountry?.population) || 331000000,
      gdpPerCapita: Number(referenceCountry?.gdpPerCapita) || 63544,
      growthRate: Number(referenceCountry?.growthRate) || 2.3,
      inflationRate: Number(referenceCountry?.inflationRate) || 3.1,
      color: 'emerald'
    }
  ];


  const formatCurrency = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(1)}T`;
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`;
    return `$${numValue.toLocaleString()}`;
  };

  const formatPopulation = (value: number | string) => {
    // Always show full number with commas for clarity
    return Number(value).toLocaleString();
  };

  const formatPopulationCompact = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;
    return numValue.toLocaleString();
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
            value={Number(inputs.coreIndicators?.totalPopulation) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...inputs.coreIndicators,
                totalPopulation: Number(value),
                nominalGDP: Number(value) * Number(inputs.coreIndicators?.gdpPerCapita || 0)
              }
            })}
            min={100000}
            max={2000000000}
            step={100000}
            unit=" people"
            sectionId="core"
            icon={Users}
            format={formatPopulation}
            referenceValue={referenceCountry.population}
            referenceLabel={referenceCountry.name}
            showComparison={true}
            showButtons={true}
            showReset={true}
            resetValue={referenceCountry.population}
          />
          
          <EnhancedNumberInput
            label="GDP per Capita"
            description="Average economic output per person (annual income proxy)"
            value={Number(inputs.coreIndicators?.gdpPerCapita) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...inputs.coreIndicators,
                gdpPerCapita: Number(value),
                nominalGDP: Number(inputs.coreIndicators?.totalPopulation || 0) * Number(value)
              }
            })}
            min={500}
            max={150000}
            step={1000}
            unit=""
            sectionId="core"
            icon={DollarSign}
            format={formatCurrency}
            referenceValue={referenceCountry.gdpPerCapita}
            referenceLabel={referenceCountry.name}
            showComparison={true}
            showButtons={true}
          />
        </div>

        {/* Right Column - Growth and Inflation */}
        <div className="space-y-6">
          <EnhancedSlider
            label="Real GDP Growth Rate"
            description="Annual percentage change in economic output (inflation-adjusted)"
            value={Number(inputs.coreIndicators.realGDPGrowthRate) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...inputs.coreIndicators,
                realGDPGrowthRate: Number(value)
              }
            })}
            min={-10}
            max={15}
            step={0.1}
            precision={1}
            unit="%"
            sectionId="core"
            icon={TrendingUp}
            showTicks={true}
            tickCount={6}
            showValue={true}
            showRange={true}
            referenceValue={referenceCountry.growthRate || 2.5}
            referenceLabel={referenceCountry.name}
            showComparison={true}
          />

          <EnhancedSlider
            label="Inflation Rate"
            description="Annual percentage increase in general price levels"
            value={Number(inputs.coreIndicators.inflationRate) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...inputs.coreIndicators,
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
            showTicks={true}
            tickCount={6}
            showValue={true}
            showRange={true}
            referenceValue={referenceCountry.inflationRate || 2.0}
            referenceLabel={referenceCountry.name}
            showComparison={true}
          />
        </div>
      </div>

      {/* Advanced Section */}
      {showAdvanced && (
        <div className="space-y-6 pt-6 border-t border-blue-200/30">
          <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Economic Comparison: Custom vs Foundation Country
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GDP Comparison Chart */}
            <EnhancedBarChart
              data={comparisonData.map(item => ({
                ...item,
                gdpPerCapita: Math.max(1000, item.gdpPerCapita) // Ensure minimum visible value
              }))}
              xKey="name"
              yKey="gdpPerCapita"
              title="GDP per Capita Comparison"
              description={`${inputs.countryName || 'Your Custom Country'} vs ${referenceCountry?.name || 'Foundation Country'}`}
              height={300}
              sectionId="core"
              formatValue={formatCurrency}
              showTooltip={true}
              showGrid={true}
            />

            {/* Growth & Inflation Chart */}
            <EnhancedBarChart
              data={comparisonData.map(item => ({
                ...item,
                growthRate: Math.max(0.1, item.growthRate), // Ensure minimum visible value
                inflationRate: Math.max(0.1, item.inflationRate)
              }))}
              xKey="name"
              yKey={["growthRate", "inflationRate"]}
              title="Growth vs Inflation Rates"
              description={`${inputs.countryName || 'Your Custom Country'} vs ${referenceCountry?.name || 'Foundation Country'} - Economic Performance Indicators`}
              height={300}
              sectionId="core"
              formatValue={(value) => `${value.toFixed(1)}%`}
              showTooltip={true}
              showGrid={true}
              stacked={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}