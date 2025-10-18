"use client";

import React, { useState, useMemo } from 'react';
import { Users, Heart, Building2, GraduationCap, Globe, Baby, UserCheck, Home, MapPin } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedNumberInput,
  EnhancedToggle,
  MetricCard,
} from '../primitives/enhanced';
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
  mode?: 'create' | 'edit';
  fieldLocks?: Record<string, import('../components/enhanced/builderConfig').FieldLockConfig>;
}

export function DemographicsSection({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className,
  mode = 'create',
  fieldLocks
}: DemographicsSectionProps) {
  const isEditMode = mode === 'edit';
  const { EDIT_MODE_FIELD_LOCKS } = require('../components/enhanced/builderConfig');
  const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

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
    { name: 'Urban', value: demographics.urbanRuralSplit.urban, color: 'blue' },
    { name: 'Rural', value: demographics.urbanRuralSplit.rural, color: 'emerald' }
  ];

  // Basic view content - Essential demographics
  const basicContent = (
    <>
      <EnhancedNumberInput
        label="Life Expectancy"
        value={Number(demographics.lifeExpectancy) || 0}
        onChange={(value) => handleDemographicChange('lifeExpectancy', Number(value))}
        min={50}
        max={90}
        step={0.1}
        precision={1}
        unit=" years"
        sectionId="demographics"
        icon={Heart}
      />

      <EnhancedSlider
        label="Literacy Rate"
        value={Number(demographics.literacyRate) || 0}
        onChange={(value) => handleDemographicChange('literacyRate', Number(value))}
        min={40}
        max={100}
        step={0.1}
        unit="%"
        sectionId="demographics"
        icon={GraduationCap}
        showTicks={true}
        tickCount={7}
      />

      <EnhancedSlider
        label="Urbanization Rate"
        value={Number(demographics.urbanRuralSplit.urban) || 0}
        onChange={(value) => {
          handleDemographicChange('urbanRuralSplit', {
            urban: Number(value),
            rural: 100 - Number(value)
          });
        }}
        min={20}
        max={95}
        step={1}
        unit="%"
        sectionId="demographics"
        icon={Building2}
        showTicks={true}
        tickCount={6}
      />

      {/* Basic visualization */}
      <div className="md:col-span-2 space-y-4">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Population Distribution
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Urban Population"
            value={demographics.urbanRuralSplit.urban}
            unit="%"
            icon={Building2}
            sectionId="demographics"
          />
          <MetricCard
            label="Rural Population"
            value={demographics.urbanRuralSplit.rural}
            unit="%"
            icon={Home}
            sectionId="demographics"
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
        <div className="flex bg-card rounded-lg p-1 border border-border">
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
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Age Distribution
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {demographics.ageDistribution.map((group) => (
                <MetricCard
                  key={group.group}
                  label={group.group}
                  value={group.percent.toFixed(1)}
                  unit="%"
                  icon={Users}
                  sectionId="demographics"
                />
              ))}
            </div>
          </div>

          {/* Age Group Controls - Use intuitive sliders instead of confusing dials */}
          {demographics.ageDistribution.map((group, index) => (
            <EnhancedSlider
              key={group.group}
              label={`${group.group} Population`}
              value={Number(group.percent) || 0}
              onChange={(value) => handleAgeDistributionChange(index, Number(value))}
              min={5}
              max={50}
              step={0.5}
              unit="%"
              sectionId="demographics"
              icon={Users}
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
              <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {region.name}
              </h5>
              <FormGrid columns={2}>
                <EnhancedSlider
                  label="Population"
                  value={Number(region.population) || 0}
                  onChange={(value) => handleRegionChange(index, 'population', Number(value))}
                  min={Number(totalPopulation) * 0.01}
                  max={Number(totalPopulation) * 0.8}
                  step={Number(totalPopulation) * 0.01}
                  unit=" people"
                  sectionId="demographics"
                  icon={MapPin}
                />
                <EnhancedSlider
                  label="Urban %"
                  value={Number(region.urbanPercent) || 0}
                  onChange={(value) => handleRegionChange(index, 'urbanPercent', Number(value))}
                  min={0}
                  max={100}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Building2}
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
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Education Levels
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {demographics.educationLevels.map((level) => (
                <MetricCard
                  key={level.level}
                  label={level.level}
                  value={level.percent.toFixed(1)}
                  unit="%"
                  icon={GraduationCap}
                  sectionId="demographics"
                />
              ))}
            </div>
          </div>

          {/* Education Level Controls */}
          {demographics.educationLevels.map((level, index) => (
            <EnhancedSlider
              key={level.level}
              label={level.level}
              value={Number(level.percent) || 0}
              onChange={(value) => handleEducationLevelChange(index, Number(value))}
              min={0}
              max={60}
              step={0.1}
              unit="%"
              sectionId="demographics"
              icon={GraduationCap}
              showTicks={true}
              tickCount={5}
            />
          ))}

          {/* Social Policies */}
          <div className="md:col-span-2 space-y-4">
            <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Social Policies
            </h5>
            {/* Future Enhancement: Social Policy Toggles
                Universal Healthcare and Free Education toggles will be implemented
                when the social policy data model is added to support government
                spending integration. These policies are currently handled through
                the government spending allocation system in the fiscal section. */}
            {/* <FormGrid columns={2}>
              <EnhancedToggle
                label="Universal Healthcare"
                description="Free healthcare for all citizens"
                checked={false}
                onChange={(checked) => {}}
                sectionId="demographics"
                icon={Heart}
              />
              <EnhancedToggle
                label="Free Education"
                description="Public education through university level"
                checked={false}
                onChange={(checked) => {}}
                sectionId="demographics"
                icon={GraduationCap}
              />
            </FormGrid> */}
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
      config={sectionConfigs.demographics || { 
        id: 'demographics', 
        title: 'Demographics', 
        icon: Users, 
        theme: 'red' as const
      }}
      inputs={inputs}
      onInputsChange={onInputsChange}
      isReadOnly={false}
      showComparison={true}
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