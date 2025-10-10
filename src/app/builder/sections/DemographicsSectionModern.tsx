"use client";

import React, { useMemo } from 'react';
import { Users, Heart, Building2, GraduationCap, MapPin, Home, Baby, UserCheck } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedNumberInput,
  GlassSelectBox,
  MetricCard,
  ViewTransition
} from '../primitives/enhanced';
import { StandardSectionTemplate, SECTION_THEMES } from '../primitives/StandardSectionTemplate';
import type { StandardSectionProps } from '../primitives/StandardSectionTemplate';
import type { DemographicData } from '../lib/economy-data-service';

export function DemographicsSectionModern({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: StandardSectionProps) {
  const demographics = inputs.demographics;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  
  // Handle input changes with proper type safety
  const handleDemographicChange = (field: keyof DemographicData, value: any) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newDemographics = { ...demographics, [field]: safeValue };
    onInputsChange({ ...inputs, demographics: newDemographics });
  };

  const handleAgeDistributionChange = (index: number, value: number) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newAgeGroups = [...demographics.ageDistribution];
    const totalOthers = newAgeGroups.reduce((sum, group, idx) => {
      if (idx !== index) {
        const safePercent = typeof group.percent === 'number' && !isNaN(group.percent) ? group.percent : 0;
        return sum + safePercent;
      }
      return sum;
    }, 0);
    const adjustedValue = Math.min(Math.max(0, safeValue), 100 - totalOthers);
    
    if (newAgeGroups[index]) {
      newAgeGroups[index] = { ...newAgeGroups[index], percent: adjustedValue };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedGroups = newAgeGroups.map((group, idx) => {
        if (idx === index) return group;
        const safeGroupPercent = typeof group.percent === 'number' && !isNaN(group.percent) ? group.percent : 0;
        const normalizedPercent = totalOthers > 0 ? (safeGroupPercent / totalOthers) * remainingPercent : 0;
        return { ...group, percent: isNaN(normalizedPercent) ? 0 : normalizedPercent };
      });
      
      handleDemographicChange('ageDistribution', normalizedGroups);
    }
  };

  const handleEducationLevelChange = (index: number, value: number) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newLevels = [...demographics.educationLevels];
    const totalOthers = newLevels.reduce((sum, level, idx) => {
      if (idx !== index) {
        const safePercent = typeof level.percent === 'number' && !isNaN(level.percent) ? level.percent : 0;
        return sum + safePercent;
      }
      return sum;
    }, 0);
    const adjustedValue = Math.min(Math.max(0, safeValue), 100 - totalOthers);
    
    if (newLevels[index]) {
      newLevels[index] = { ...newLevels[index], percent: adjustedValue };
      
      const remainingPercent = 100 - adjustedValue;
      const normalizedLevels = newLevels.map((level, idx) => {
        if (idx === index) return level;
        const safeLevelPercent = typeof level.percent === 'number' && !isNaN(level.percent) ? level.percent : 0;
        const normalizedPercent = totalOthers > 0 ? (safeLevelPercent / totalOthers) * remainingPercent : 0;
        return { ...level, percent: isNaN(normalizedPercent) ? 0 : normalizedPercent };
      });
      
      handleDemographicChange('educationLevels', normalizedLevels);
    }
  };

  // Calculate dependency ratios for insights with NaN protection
  const youthGroup = demographics.ageDistribution.find(g => g.group === '0-15');
  const elderlyGroup = demographics.ageDistribution.find(g => g.group === '65+');
  const youthDependency = typeof youthGroup?.percent === 'number' && !isNaN(youthGroup.percent) ? youthGroup.percent : 0;
  const elderlyDependency = typeof elderlyGroup?.percent === 'number' && !isNaN(elderlyGroup.percent) ? elderlyGroup.percent : 0;
  const totalDependency = youthDependency + elderlyDependency;

  // Basic view content - Essential demographics only
  const basicContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Population"
          value={totalPopulation.toLocaleString()}
          icon={Users}
          sectionId="demographics"
        />
        <MetricCard
          label="Life Expectancy"
          value={demographics.lifeExpectancy}
          unit=" years"
          icon={Heart}
          sectionId="demographics"
        />
        <MetricCard
          label="Literacy Rate"
          value={demographics.literacyRate}
          unit="%"
          icon={GraduationCap}
          sectionId="demographics"
        />
        <MetricCard
          label="Urban Population"
          value={demographics.urbanRuralSplit.urban}
          unit="%"
          icon={Building2}
          sectionId="demographics"
        />
      </div>

      {/* Essential Controls */}
      <EnhancedNumberInput
        label="Life Expectancy"
        description="Average lifespan in years"
        value={Number(demographics.lifeExpectancy) || 0}
        onChange={(value) => handleDemographicChange('lifeExpectancy', Number(value))}
        min={50}
        max={90}
        step={0.1}
        precision={1}
        unit=" years"
        sectionId="demographics"
        icon={Heart}
        referenceValue={referenceCountry?.lifeExpectancy}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Literacy Rate"
        description="Percentage of adults who can read and write"
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
        referenceValue={referenceCountry?.literacyRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Urbanization Rate"
        description="Percentage of population living in urban areas"
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
        referenceValue={referenceCountry?.urbanizationRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      {/* Population Distribution Summary */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Population Distribution
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Urban"
            value={demographics.urbanRuralSplit.urban}
            unit="%"
            icon={Building2}
            sectionId="demographics"
            size="sm"
          />
          <MetricCard
            label="Rural"
            value={demographics.urbanRuralSplit.rural}
            unit="%"
            icon={Home}
            sectionId="demographics"
            size="sm"
          />
        </div>
      </div>
    </div>
  );

  // Advanced view content - Detailed demographics
  const advancedContent = (
    <div className="space-y-8">
      {/* Age Distribution Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" />
          Age Distribution
        </h4>
        
        {/* Age Group Overview */}
        <div className="grid grid-cols-3 gap-4">
          {demographics.ageDistribution.map((group) => (
            <MetricCard
              key={group.group}
              label={group.group}
              value={group.percent.toFixed(1)}
              unit="%"
              icon={group.group === '0-15' ? Baby : group.group === '65+' ? UserCheck : Users}
              sectionId="demographics"
            />
          ))}
        </div>

        {/* Age Group Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              icon={group.group === '0-15' ? Baby : group.group === '65+' ? UserCheck : Users}
              showTicks={true}
              tickCount={5}
            />
          ))}
        </div>

        {/* Dependency Ratio Insight */}
        <div className="p-4 rounded-lg bg-secondary border border-border">
          <p className="text-sm text-foreground">
            <strong>Dependency Ratio:</strong> {totalDependency.toFixed(1)}% 
            (Youth: {youthDependency.toFixed(1)}%, Elderly: {elderlyDependency.toFixed(1)}%)
          </p>
          {totalDependency > 50 && (
            <p className="text-xs text-orange-500 mt-1">
              High dependency ratio may strain working-age population
            </p>
          )}
        </div>
      </div>

      {/* Education Levels Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Education Levels
        </h4>
        
        {/* Education Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {demographics.educationLevels.map((level) => (
            <MetricCard
              key={level.level}
              label={level.level}
              value={level.percent.toFixed(1)}
              unit="%"
              icon={GraduationCap}
              sectionId="demographics"
              size="sm"
            />
          ))}
        </div>

        {/* Education Level Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Regional Distribution Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Regional Distribution
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {demographics.regions.map((region, index) => (
            <div key={region.name} className="space-y-4 p-4 rounded-lg bg-secondary border border-border">
              <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {region.name}
              </h5>
              
              <div className="space-y-3">
                <EnhancedNumberInput
                  label="Population"
                  value={Number(region.population) || 0}
                  onChange={(value) => {
                    const newRegions = [...demographics.regions];
                    if (newRegions[index]) {
                      newRegions[index] = { ...newRegions[index], population: Number(value) };
                      handleDemographicChange('regions', newRegions);
                    }
                  }}
                  min={Number(totalPopulation) * 0.01}
                  max={Number(totalPopulation) * 0.8}
                  step={Number(totalPopulation) * 0.01}
                  unit=" people"
                  sectionId="demographics"
                  icon={Users}
                  size="sm"
                />
                
                <EnhancedSlider
                  label="Urban Percentage"
                  value={Number(region.urbanPercent) || 0}
                  onChange={(value) => {
                    const newRegions = [...demographics.regions];
                    if (newRegions[index]) {
                      newRegions[index] = { ...newRegions[index], urbanPercent: Number(value) };
                      handleDemographicChange('regions', newRegions);
                    }
                  }}
                  min={0}
                  max={100}
                  step={0.1}
                  unit="%"
                  sectionId="demographics"
                  icon={Building2}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <StandardSectionTemplate
      title="Demographics"
      description="Population characteristics and social indicators"
      icon={Users}
      basicContent={basicContent}
      advancedContent={advancedContent}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      theme={SECTION_THEMES.demographics}
      depth="elevated"
      blur="medium"
      className={className}
      inputs={inputs}
      onInputsChange={onInputsChange}
      referenceCountry={referenceCountry}
    />
  );
}