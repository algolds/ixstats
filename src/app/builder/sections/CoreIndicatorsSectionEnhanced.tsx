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

  // Prepare comparison data for charts
  const comparisonData = [
    {
      name: inputs.countryName || 'Your Country',
      population: coreIndicators.totalPopulation,
      gdpPerCapita: coreIndicators.gdpPerCapita,
      growthRate: coreIndicators.realGDPGrowthRate,
      inflationRate: coreIndicators.inflationRate,
      color: 'blue'
    },
    ...(referenceCountry ? [{
      name: referenceCountry.name,
      population: referenceCountry.population,
      gdpPerCapita: referenceCountry.gdpPerCapita,
      growthRate: referenceCountry.growthRate || 2.5,
      inflationRate: referenceCountry.inflationRate || 2.0,
      color: 'emerald'
    }] : [])
  ];

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
            min={100000}
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
            min={500}
            max={150000}
            step={1000}
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
          <EnhancedSlider
            label="Real GDP Growth Rate"
            description="Annual percentage change in economic output (inflation-adjusted)"
            value={Number(coreIndicators.realGDPGrowthRate) || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              coreIndicators: {
                ...(inputs.coreIndicators || {}),
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
            referenceValue={referenceCountry?.growthRate}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
          />

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
            Visual Comparisons
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GDP Comparison Chart */}
            <EnhancedBarChart
              data={comparisonData}
              xKey="name"
              yKey="gdpPerCapita"
              title="GDP per Capita Comparison"
              description={referenceCountry ? `Your country vs ${referenceCountry.name}` : 'Your country'}
              height={300}
              sectionId="core"
              formatValue={formatCurrency}
              showTooltip={true}
              showGrid={true}
            />

            {/* Growth & Inflation Chart */}
            <EnhancedBarChart
              data={comparisonData}
              xKey="name"
              yKey={["growthRate", "inflationRate"]}
              title="Growth vs Inflation"
              description="Economic indicators comparison"
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
