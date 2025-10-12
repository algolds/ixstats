"use client";

import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Activity, Percent, Globe, Calculator } from 'lucide-react';
import {
  EnhancedNumberInput,
  EnhancedSlider,
  GlassProgressIndicator,
  MetricCard,
  ViewTransition
} from '../primitives/enhanced';
import { HealthRing } from '~/components/ui/health-ring';
import { StandardSectionTemplate, SECTION_THEMES } from '../primitives/StandardSectionTemplate';
import type { StandardSectionProps } from '../primitives/StandardSectionTemplate';
import type { CoreIndicatorsData } from '../lib/economy-data-service';

export function CoreIndicatorsSectionModern({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: StandardSectionProps) {
  const coreIndicators = inputs.coreIndicators;
  
  // Handle input changes with proper type safety and auto-calculations
  const handleCoreChange = (field: keyof CoreIndicatorsData, value: any) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newCoreIndicators = { ...coreIndicators, [field]: safeValue };
    
    // Auto-calculate related fields with NaN protection
    if (field === 'totalPopulation' || field === 'gdpPerCapita') {
      const population = typeof newCoreIndicators.totalPopulation === 'number' && !isNaN(newCoreIndicators.totalPopulation) 
        ? newCoreIndicators.totalPopulation : 0;
      const gdpPerCapita = typeof newCoreIndicators.gdpPerCapita === 'number' && !isNaN(newCoreIndicators.gdpPerCapita) 
        ? newCoreIndicators.gdpPerCapita : 0;
      newCoreIndicators.nominalGDP = population * gdpPerCapita;
    } else if (field === 'nominalGDP') {
      const population = typeof newCoreIndicators.totalPopulation === 'number' && !isNaN(newCoreIndicators.totalPopulation) 
        ? newCoreIndicators.totalPopulation : 0;
      const nominalGDP = typeof newCoreIndicators.nominalGDP === 'number' && !isNaN(newCoreIndicators.nominalGDP) 
        ? newCoreIndicators.nominalGDP : 0;
      if (population > 0) {
        newCoreIndicators.gdpPerCapita = nominalGDP / population;
      }
    }
    
    onInputsChange({ ...inputs, coreIndicators: newCoreIndicators });
  };

  // Calculate economic health and comparisons
  const economicAnalysis = useMemo(() => {
    // Safely extract and validate all values
    const safePopulation = typeof coreIndicators.totalPopulation === 'number' && !isNaN(coreIndicators.totalPopulation) 
      ? coreIndicators.totalPopulation : 0;
    const safeGdpPerCapita = typeof coreIndicators.gdpPerCapita === 'number' && !isNaN(coreIndicators.gdpPerCapita) 
      ? coreIndicators.gdpPerCapita : 0;
    const safeGrowthRate = typeof coreIndicators.realGDPGrowthRate === 'number' && !isNaN(coreIndicators.realGDPGrowthRate) 
      ? coreIndicators.realGDPGrowthRate : 0;
    const safeInflationRate = typeof coreIndicators.inflationRate === 'number' && !isNaN(coreIndicators.inflationRate) 
      ? coreIndicators.inflationRate : 0;
    const safeNominalGDP = typeof coreIndicators.nominalGDP === 'number' && !isNaN(coreIndicators.nominalGDP) 
      ? coreIndicators.nominalGDP : 0;
    
    // Economic tier classification
    const economicTier = safeGdpPerCapita >= 50000 ? 'developed' :
                        safeGdpPerCapita >= 25000 ? 'emerging' :
                        safeGdpPerCapita >= 10000 ? 'developing' : 'low-income';
    
    // Growth rate limits based on economic tier and population scale
    const populationScale = safePopulation >= 100000000 ? 'large' :
                           safePopulation >= 10000000 ? 'medium' :
                           safePopulation >= 1000000 ? 'small' : 'micro';
    
    const getMaxGrowthRate = () => {
      // Base limits by economic tier
      const tierLimits = {
        'developed': 4.5,    // Developed economies have slower max growth
        'emerging': 8.0,     // Emerging economies can grow faster
        'developing': 12.0,  // Developing economies can have high growth
        'low-income': 15.0   // Low-income economies can have very high growth
      };
      
      // Population scale modifiers (larger populations = slower sustainable growth)
      const sizeModifiers = {
        'large': 0.8,    // -20% for large populations
        'medium': 0.9,   // -10% for medium populations  
        'small': 1.0,    // No modifier for small populations
        'micro': 1.2     // +20% for micro populations
      };
      
      return tierLimits[economicTier] * sizeModifiers[populationScale];
    };
    
    const maxGrowthRate = getMaxGrowthRate();
    
    // Growth health assessment using safe values
    const growthHealth = safeGrowthRate >= 4 ? 'strong' :
                        safeGrowthRate >= 2 ? 'moderate' :
                        safeGrowthRate >= 0 ? 'weak' : 'declining';
    
    // Inflation assessment using safe values
    const inflationHealth = safeInflationRate <= 2 ? 'optimal' :
                           safeInflationRate <= 4 ? 'moderate' :
                           safeInflationRate <= 8 ? 'elevated' : 'critical';
    
    // Overall economic health using safe values
    const overallHealth = growthHealth === 'strong' && inflationHealth === 'optimal' && safeGdpPerCapita >= 25000 ? 'excellent' :
                         growthHealth !== 'declining' && inflationHealth !== 'critical' ? 'good' :
                         'needs_attention';
    
    // Population scale (moved above since we use it in maxGrowthRate calculation)
    
    // Comparison with reference country using safe values
    const vsReference = referenceCountry ? {
      gdpPerCapita: {
        value: safeGdpPerCapita - (referenceCountry.gdpPerCapita || 0),
        percent: referenceCountry.gdpPerCapita && referenceCountry.gdpPerCapita > 0 
          ? ((safeGdpPerCapita - referenceCountry.gdpPerCapita) / referenceCountry.gdpPerCapita) * 100 : 0
      },
      population: {
        value: safePopulation - (referenceCountry.population || 0),
        percent: referenceCountry.population && referenceCountry.population > 0 
          ? ((safePopulation - referenceCountry.population) / referenceCountry.population) * 100 : 0
      },
      growth: safeGrowthRate - (referenceCountry.growthRate || 0)
    } : null;

    return {
      economicTier,
      growthHealth,
      inflationHealth,
      overallHealth,
      populationScale,
      maxGrowthRate,
      vsReference
    };
  }, [coreIndicators, referenceCountry]);

  // Basic view content - Essential economic indicators
  const basicContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="GDP per Capita"
          value={`$${coreIndicators.gdpPerCapita.toLocaleString()}`}
          icon={DollarSign}
          sectionId="core"
        />
        <MetricCard
          label="Population"
          value={coreIndicators.totalPopulation.toLocaleString()}
          icon={Users}
          sectionId="core"
        />
        <MetricCard
          label="GDP Growth"
          value={`${coreIndicators.realGDPGrowthRate.toFixed(1)}%`}
          icon={coreIndicators.realGDPGrowthRate >= 0 ? TrendingUp : TrendingDown}
          sectionId="core"
        />
        <MetricCard
          label="Total GDP"
          value={`$${coreIndicators.nominalGDP.toLocaleString()}`}
          icon={BarChart3}
          sectionId="core"
        />
      </div>

      {/* Economic Health Vitality Ring */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Economic Health
        </h4>
        
        <div className="flex justify-center">
          <HealthRing
            value={economicAnalysis.overallHealth === 'excellent' ? 95 : 
                   economicAnalysis.overallHealth === 'good' ? 75 : 
                   economicAnalysis.overallHealth === 'needs_attention' ? 50 : 30}
            size={120}
            color={economicAnalysis.overallHealth === 'excellent' ? '#10b981' : 
                   economicAnalysis.overallHealth === 'good' ? '#3b82f6' : '#ef4444'}
            label="Economic Health"
            tooltip={`Economic development tier: ${economicAnalysis.economicTier} | Population scale: ${economicAnalysis.populationScale}`}
            isClickable={false}
          />
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground capitalize">
            {economicAnalysis.overallHealth.replace('_', ' ')}
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Tier: <span className="capitalize">{economicAnalysis.economicTier}</span></p>
            <p>Growth: <span className="capitalize">{economicAnalysis.growthHealth}</span></p>
            <p>Inflation: <span className="capitalize">{economicAnalysis.inflationHealth}</span></p>
          </div>
        </div>
      </div>

      {/* Essential Controls */}
      <div className="space-y-4">
        <EnhancedNumberInput
          label="Total Population"
          description="Total number of people in the country"
          value={coreIndicators.totalPopulation}
          onChange={(value) => handleCoreChange('totalPopulation', Number(value))}
          min={1000}
          max={2000000000}
          step={10000}
          unit=" people"
          sectionId="core"
          icon={Users}
          format={(value) => Number(value).toLocaleString()}
          referenceValue={referenceCountry?.population}
          referenceLabel={referenceCountry?.name}
          showComparison={true}
        />

        <EnhancedNumberInput
          label="GDP per Capita"
          description="Average economic output per person"
          value={coreIndicators.gdpPerCapita}
          onChange={(value) => handleCoreChange('gdpPerCapita', Number(value))}
          min={100}
          max={200000}
          step={100}
          unit=""
          sectionId="core"
          icon={DollarSign}
          format={(value) => `$${Number(value).toLocaleString()}`}
          referenceValue={referenceCountry?.gdpPerCapita}
          referenceLabel={referenceCountry?.name}
          showComparison={true}
        />

        <EnhancedSlider
          label="GDP Growth Rate"
          description={`Annual real GDP growth percentage (Max: ${economicAnalysis.maxGrowthRate.toFixed(1)}% for ${economicAnalysis.economicTier} ${economicAnalysis.populationScale} economy)`}
          value={coreIndicators.realGDPGrowthRate}
          onChange={(value) => handleCoreChange('realGDPGrowthRate', Math.min(Number(value), economicAnalysis.maxGrowthRate))}
          min={-10}
          max={economicAnalysis.maxGrowthRate}
          step={0.1}
          unit="%"
          sectionId="core"
          icon={TrendingUp}
          showTicks={true}
          tickCount={6}
          referenceValue={referenceCountry?.growthRate}
          referenceLabel={referenceCountry?.name}
          showComparison={true}
        />

        <EnhancedSlider
          label="Inflation Rate"
          description="Annual consumer price inflation"
          value={coreIndicators.inflationRate}
          onChange={(value) => handleCoreChange('inflationRate', Number(value))}
          min={-5}
          max={20}
          step={0.1}
          unit="%"
          sectionId="core"
          icon={Percent}
          showTicks={true}
          tickCount={6}
          referenceValue={referenceCountry?.inflationRate}
          referenceLabel={referenceCountry?.name}
          showComparison={true}
        />
      </div>
    </div>
  );

  // Advanced view content - Detailed economic analysis
  const advancedContent = (
    <div className="space-y-8">
      {/* Economic Classification */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Economic Classification & Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Economic Tier Analysis */}
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <h5 className="text-sm font-semibold text-foreground mb-3">Economic Development Tier</h5>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-foreground capitalize">{economicAnalysis.economicTier} Economy</span>
                <span className="text-sm font-medium text-foreground">
                  ${coreIndicators.gdpPerCapita.toLocaleString()} per capita
                </span>
              </div>
              
              <GlassProgressIndicator
                value={Math.min(coreIndicators.gdpPerCapita, 50000)}
                max={50000}
                variant="linear"
                height={8}
                showPercentage={false}
                sectionId="core"
                color={economicAnalysis.economicTier === 'developed' ? '#10b981' :
                       economicAnalysis.economicTier === 'emerging' ? '#3b82f6' :
                       economicAnalysis.economicTier === 'developing' ? '#f59e0b' : '#ef4444'}
              />
              
              <div className="text-xs text-muted-foreground">
                {economicAnalysis.economicTier === 'developed' && "Advanced industrialized economy with high living standards"}
                {economicAnalysis.economicTier === 'emerging' && "Rapidly developing economy with growing middle class"}
                {economicAnalysis.economicTier === 'developing' && "Growing economy with significant development potential"}
                {economicAnalysis.economicTier === 'low-income' && "Early-stage economy focusing on basic development"}
              </div>
            </div>
          </div>

          {/* Population Scale Analysis */}
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <h5 className="text-sm font-semibold text-foreground mb-3">Population Scale</h5>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-foreground capitalize">{economicAnalysis.populationScale} Nation</span>
                <span className="text-sm font-medium text-foreground">
                  {coreIndicators.totalPopulation.toLocaleString()} people
                </span>
              </div>
              
              <GlassProgressIndicator
                value={Math.min(coreIndicators.totalPopulation, 100000000)}
                max={100000000}
                variant="linear"
                height={8}
                showPercentage={false}
                sectionId="core"
              />
              
              <div className="text-xs text-muted-foreground">
                {economicAnalysis.populationScale === 'large' && "Major global population center with significant economic influence"}
                {economicAnalysis.populationScale === 'medium' && "Substantial population supporting diverse economic activities"}
                {economicAnalysis.populationScale === 'small' && "Moderate population enabling focused economic development"}
                {economicAnalysis.populationScale === 'micro' && "Small population allowing for agile policy implementation"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Economic Indicators */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Advanced Economic Metrics
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total GDP"
            value={`$${coreIndicators.nominalGDP.toLocaleString()}`}
            description="Total economic output"
            icon={BarChart3}
            sectionId="core"
          />
          <MetricCard
            label="Economic Size Rank"
            value={coreIndicators.nominalGDP >= 20000000000000 ? 'Top 5' :
                   coreIndicators.nominalGDP >= 5000000000000 ? 'Top 20' :
                   coreIndicators.nominalGDP >= 1000000000000 ? 'Top 50' : 'Emerging'}
            description="Global economic ranking"
            icon={Globe}
            sectionId="core"
          />
          <MetricCard
            label="Growth Trend"
            value={economicAnalysis.growthHealth}
            description="Economic growth assessment"
            icon={coreIndicators.realGDPGrowthRate >= 0 ? TrendingUp : TrendingDown}
            sectionId="core"
          />
          <MetricCard
            label="Price Stability"
            value={economicAnalysis.inflationHealth}
            description="Inflation control assessment"
            icon={Percent}
            sectionId="core"
          />
        </div>
      </div>

      {/* Comparison with Reference Country */}
      {economicAnalysis.vsReference && (
        <div className="space-y-6">
          <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Comparison with {referenceCountry?.name}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">GDP per Capita</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {economicAnalysis.vsReference.gdpPerCapita.value >= 0 ? '+' : ''}
                ${Math.abs(economicAnalysis.vsReference.gdpPerCapita.value).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {economicAnalysis.vsReference.gdpPerCapita.percent.toFixed(1)}% 
                {economicAnalysis.vsReference.gdpPerCapita.value >= 0 ? ' higher' : ' lower'}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-secondary border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Population</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {economicAnalysis.vsReference.population.value >= 0 ? '+' : ''}
                {Math.abs(economicAnalysis.vsReference.population.value).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.abs(economicAnalysis.vsReference.population.percent).toFixed(1)}% 
                {economicAnalysis.vsReference.population.value >= 0 ? ' larger' : ' smaller'}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-secondary border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Growth Rate</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {economicAnalysis.vsReference.growth >= 0 ? '+' : ''}
                {economicAnalysis.vsReference.growth.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {economicAnalysis.vsReference.growth >= 0 ? 'Faster growth' : 'Slower growth'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <StandardSectionTemplate
      title="Core Economic Indicators"
      description="Fundamental economic metrics and national statistics"
      icon={BarChart3}
      basicContent={basicContent}
      advancedContent={advancedContent}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      theme={SECTION_THEMES.core}
      depth="elevated"
      blur="medium"
      className={className}
      inputs={inputs}
      onInputsChange={onInputsChange}
      referenceCountry={referenceCountry}
    />
  );
}