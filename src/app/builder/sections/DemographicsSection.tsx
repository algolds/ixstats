"use client";

import React, { useState, useMemo } from 'react';
import { Users, Heart, Building2, GraduationCap, Globe, Baby, UserCheck, Home, MapPin } from 'lucide-react';
import {
  GlassSlider,
  GlassNumberInput,
  GlassToggle,
  GlassProgressRing,
  GlassMetricCard
} from '../components/glass/GlassInputs';
import type { EconomicInputs, DemographicData } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';
import { 
  SectionBase, 
  SectionLayout, 
  sectionConfigs, 
  sectionUtils,
  type ExtendedSectionProps 
} from '../components/glass/SectionBase';
import { FormGrid } from '../components/glass/ProgressiveViews';
import { NumberFlowDisplay } from '~/components/ui/number-flow';

interface DemographicsSectionProps extends ExtendedSectionProps {
  onToggleAdvanced?: () => void;
}

export function DemographicsSection({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: DemographicsSectionProps) {
  const [selectedView, setSelectedView] = useState<'age' | 'geographic' | 'social'>('age');
  
  const demographics = inputs.demographics;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  
  // Calculate metrics for overview
  const metrics = useMemo(() => [
    {
      label: "Total Population",
      value: sectionUtils.formatNumber(totalPopulation, 1),
      icon: Users,
      theme: 'gold' as const
    },
    {
      label: "Life Expectancy",
      value: demographics.lifeExpectancy,
      unit: " years",
      icon: Heart,
      theme: 'red' as const,
      trend: demographics.lifeExpectancy > 75 ? 'up' as const : 
             demographics.lifeExpectancy > 65 ? 'neutral' as const : 'down' as const
    },
    {
      label: "Literacy Rate",
      value: demographics.literacyRate,
      unit: "%",
      icon: GraduationCap,
      theme: 'blue' as const,
      trend: demographics.literacyRate > 90 ? 'up' as const : 
             demographics.literacyRate > 75 ? 'neutral' as const : 'down' as const
    },
    {
      label: "Urban Population",
      value: demographics.urbanRuralSplit.urban,
      unit: "%",
      icon: Building2,
      theme: 'emerald' as const
    }
  ], [demographics, totalPopulation]);

  // Handle input changes with proper type safety
  const handleDemographicChange = (field: keyof DemographicData, value: any) => {
    const newDemographics = { ...demographics, [field]: value };
    onInputsChange({ ...inputs, demographics: newDemographics });
  };

  const handleAgeDistributionChange = (index: number, value: number) => {
    const newAgeGroups = [...demographics.ageDistribution];
    const totalOthers = newAgeGroups.reduce((sum, group, idx) => 
      idx !== index ? sum + group.percent : sum, 0);
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newAgeGroups[index]) {
      newAgeGroups[index] = { ...newAgeGroups[index], percent: adjustedValue };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedGroups = newAgeGroups.map((group, idx) => {
        if (idx === index) return group;
        const normalizedPercent = (group.percent / totalOthers) * remainingPercent;
        return { ...group, percent: normalizedPercent };
      });
      
      handleDemographicChange('ageDistribution', normalizedGroups);
    }
  };

  const handleEducationLevelChange = (index: number, value: number) => {
    const newLevels = [...demographics.educationLevels];
    const totalOthers = newLevels.reduce((sum, level, idx) => 
      idx !== index ? sum + level.percent : sum, 0);
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newLevels[index]) {
      newLevels[index] = { ...newLevels[index], percent: adjustedValue };
      
      const remainingPercent = 100 - adjustedValue;
      const normalizedLevels = newLevels.map((level, idx) => {
        if (idx === index) return level;
        const normalizedPercent = (level.percent / totalOthers) * remainingPercent;
        return { ...level, percent: normalizedPercent };
      });
      
      handleDemographicChange('educationLevels', normalizedLevels);
    }
  };

  const handleRegionChange = (index: number, field: 'population' | 'urbanPercent', value: number) => {
    const newRegions = [...demographics.regions];
    if (newRegions[index]) {
      newRegions[index] = { ...newRegions[index], [field]: value };
      handleDemographicChange('regions', newRegions);
    }
  };

  // Prepare chart data
  const ageData = demographics.ageDistribution.map(group => ({
    name: group.group,
    value: group.percent,
    category: group.group === '0-15' ? 'youth' : group.group === '65+' ? 'elderly' : 'working'
  }));

  const educationData = demographics.educationLevels.map(level => ({
    name: level.level,
    value: level.percent
  }));

  const urbanRuralData = [
    { name: 'Urban', value: demographics.urbanRuralSplit.urban },
    { name: 'Rural', value: demographics.urbanRuralSplit.rural }
  ];

  // Basic view content - Essential demographics
  const basicContent = (
    <>
      <GlassNumberInput
        label="Life Expectancy"
        value={demographics.lifeExpectancy}
        onChange={(value) => handleDemographicChange('lifeExpectancy', value)}
        min={50}
        max={90}
        step={0.1}
        precision={1}
        unit=" years"
        theme="gold"
      />

      <GlassSlider
        label="Literacy Rate"
        value={demographics.literacyRate}
        onChange={(value) => handleDemographicChange('literacyRate', value)}
        min={40}
        max={100}
        step={0.1}
        unit="%"
        theme="gold"
        showTicks={true}
        tickCount={7}
      />

      <GlassSlider
        label="Urbanization Rate"
        value={demographics.urbanRuralSplit.urban}
        onChange={(value) => {
          handleDemographicChange('urbanRuralSplit', {
            urban: value,
            rural: 100 - value
          });
        }}
        min={20}
        max={95}
        step={1}
        unit="%"
        theme="gold"
        showTicks={true}
        tickCount={6}
      />

      {/* Basic visualization */}
      <div className="md:col-span-2 space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Population Distribution
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <GlassMetricCard
            title="Urban Population"
            value={demographics.urbanRuralSplit.urban}
            unit="%"
            icon={Building2}
            theme="gold"
          />
          <GlassMetricCard
            title="Rural Population"
            value={demographics.urbanRuralSplit.rural}
            unit="%"
            icon={Home}
            theme="gold"
          />
        </div>
        <div className="flex justify-center">
          <GlassProgressRing
            value={demographics.urbanRuralSplit.urban}
            max={100}
            size={120}
            theme="gold"
            label="Urbanization"
            showValue={true}
          />
        </div>
      </div>
    </>
  );

  // Advanced view content - Detailed demographics
  const advancedContent = (
    <>
      {/* View Selector */}
      <div className="md:col-span-2">
        <div className="flex bg-card/50 rounded-lg p-1 backdrop-blur-sm border border-border">
          {(['age', 'geographic', 'social'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize ${
                selectedView === view
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
              }`}
            >
              {view === 'age' ? 'Age Groups' : view === 'geographic' ? 'Geography' : 'Social'}
            </button>
          ))}
        </div>
      </div>

      {/* Age Distribution */}
      {selectedView === 'age' && (
        <>
          <div className="md:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Age Distribution
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {demographics.ageDistribution.map((group) => (
                <GlassProgressRing
                  key={group.group}
                  value={group.percent}
                  max={50}
                  size={80}
                  theme={group.group === '0-15' ? 'blue' : group.group === '65+' ? 'red' : 'neutral'}
                  label={group.group}
                  showValue={true}
                />
              ))}
            </div>
          </div>

          {/* Age Group Controls - Use intuitive sliders instead of confusing dials */}
          {demographics.ageDistribution.map((group, index) => (
            <GlassSlider
              key={group.group}
              label={`${group.group} Population`}
              value={group.percent}
              onChange={(value) => handleAgeDistributionChange(index, value)}
              min={5}
              max={50}
              step={0.5}
              unit="%"
              theme={group.group === '0-15' ? 'blue' : group.group === '65+' ? 'red' : 'neutral'}
              showTicks={true}
              tickCount={5}
            />
          ))}
        </>
      )}

      {/* Geographic Distribution */}
      {selectedView === 'geographic' && (
        <>
          {demographics.regions.map((region, index) => (
            <div key={region.name} className="md:col-span-2 space-y-4">
              <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {region.name}
              </h5>
              <FormGrid columns={2}>
                <GlassSlider
                  label="Population"
                  value={region.population}
                  onChange={(value) => handleRegionChange(index, 'population', value)}
                  min={totalPopulation * 0.01}
                  max={totalPopulation * 0.8}
                  step={totalPopulation * 0.01}
                  unit=" people"
                  theme="gold"
                />
                <GlassSlider
                  label="Urban %"
                  value={region.urbanPercent}
                  onChange={(value) => handleRegionChange(index, 'urbanPercent', value)}
                  min={0}
                  max={100}
                  step={0.1}
                  unit="%"
                  theme="gold"
                />
              </FormGrid>
            </div>
          ))}
        </>
      )}

      {/* Social/Education */}
      {selectedView === 'social' && (
        <>
          <div className="md:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Education Levels
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {demographics.educationLevels.map((level) => (
                <GlassMetricCard
                  key={level.level}
                  title={level.level}
                  value={level.percent}
                  unit="%"
                  icon={GraduationCap}
                  theme="gold"
                />
              ))}
            </div>
          </div>

          {/* Education Level Controls */}
          {demographics.educationLevels.map((level, index) => (
            <GlassSlider
              key={level.level}
              label={level.level}
              value={level.percent}
              onChange={(value) => handleEducationLevelChange(index, value)}
              min={0}
              max={60}
              step={0.1}
              unit="%"
              theme="gold"
              showTicks={true}
              tickCount={5}
            />
          ))}

          {/* Social Policies */}
          <div className="md:col-span-2 space-y-4">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Social Policies
            </h5>
            <FormGrid columns={2}>
              <GlassToggle
                label="Universal Healthcare"
                description="Free healthcare for all citizens"
                checked={false}
                onChange={(checked) => {/* TODO: Implement social policy state */}}
                theme="default"
              />
              <GlassToggle
                label="Free Education"
                description="Public education through university level"
                checked={false}
                onChange={(checked) => {/* TODO: Implement social policy state */}}
                theme="gold"
              />
            </FormGrid>
          </div>
        </>
      )}
    </>
  );

  // Calculate dependency ratios for insights
  const youthDependency = demographics.ageDistribution.find(g => g.group === '0-15')?.percent || 0;
  const elderlyDependency = demographics.ageDistribution.find(g => g.group === '65+')?.percent || 0;
  const totalDependency = youthDependency + elderlyDependency;

  // Generate contextual insights
  const generateInsights = () => {
    const insights = [];
    
    if (demographics.urbanRuralSplit.urban > 70) {
      insights.push("Highly urbanized nation requiring strong urban infrastructure and services");
    } else if (demographics.urbanRuralSplit.urban < 50) {
      insights.push("Predominantly rural society with dispersed service delivery challenges");
    }
    
    if (demographics.literacyRate < 70) {
      insights.push("Low literacy rates may limit economic development potential");
    } else if (demographics.literacyRate > 95) {
      insights.push("Excellent education foundation supporting knowledge economy development");
    }
    
    if (totalDependency > 50) {
      insights.push("High dependency ratio places pressure on working-age population");
    }
    
    return insights;
  };

  const insights = generateInsights();

  return (
    <SectionBase
      config={sectionConfigs.demographics}
      inputs={inputs}
      onInputsChange={onInputsChange}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      referenceCountry={referenceCountry}
      metrics={metrics}
      validation={{
        errors: [],
        warnings: insights,
        info: [
          `Total dependency ratio: ${totalDependency.toFixed(1)}% (Youth: ${youthDependency.toFixed(1)}%, Elderly: ${elderlyDependency.toFixed(1)}%)`
        ]
      }}
      className={className}
    >
      <SectionLayout
        basicContent={basicContent}
        advancedContent={advancedContent}
        showAdvanced={showAdvanced}
        basicColumns={2}
        advancedColumns={2}
      />
    </SectionBase>
  );
}