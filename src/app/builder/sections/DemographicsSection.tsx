"use client";

import React from 'react';
import { Users, Heart, Building2 } from 'lucide-react';
import {
  GlassSlider,
  GlassDial,
  GlassNumberPicker,
  GlassToggle,
  GlassPieChart,
  GlassBarChart,
  GoogleLineChart,
} from '~/components/charts';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface DemographicsSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

export function DemographicsSection({ 
  inputs, 
  onInputsChange 
}: DemographicsSectionProps) {
  // Demographics data for visualization
  const ageDistribution = [
    { name: '0-17 years', value: inputs.demographics.ageDistribution.find(a => a.group === '0-15')?.percent || 20, category: 'youth' },
    { name: '18-64 years', value: inputs.demographics.ageDistribution.find(a => a.group === '16-64')?.percent || 65, category: 'working' },
    { name: '65+ years', value: inputs.demographics.ageDistribution.find(a => a.group === '65+')?.percent || 15, category: 'elderly' }
  ];

  const populationTrends = [
    ['Year', 'Birth Rate', 'Death Rate', 'Migration Rate'],
    ['2020', 12.5, 8.2, 2.1],
    ['2021', 12.1, 8.5, 1.8],
    ['2022', 11.8, 8.7, 2.3],
    ['2023', 11.5, 8.9, 2.5],
    ['2024', 12.5, 8.2, 2.1]
  ];

  const educationLevels = [
    { name: 'Primary', value: inputs.demographics.educationLevels.find(e => e.level === 'Primary Education')?.percent || 15 },
    { name: 'Secondary', value: inputs.demographics.educationLevels.find(e => e.level === 'Secondary Education')?.percent || 55 },
    { name: 'Tertiary', value: inputs.demographics.educationLevels.find(e => e.level === 'Higher Education')?.percent || 25 },
    { name: 'Postgraduate', value: inputs.demographics.educationLevels.find(e => e.level === 'Postgraduate Education')?.percent || 5 }
  ];

  const urbanRuralSplit = [
    { name: 'Urban', value: inputs.demographics.urbanRuralSplit.urban },
    { name: 'Rural', value: inputs.demographics.urbanRuralSplit.rural }
  ];

  const diversityData = [
    { name: 'Cultural Diversity Index', value: 7.5 },
    { name: 'Language Diversity', value: 6.2 },
    { name: 'Religious Diversity', value: 5.8 }
  ];

  const updateDemographics = (category: string, subcategory: string | null, value: number | boolean) => {
    if (subcategory) {
      onInputsChange({
        ...inputs,
        demographics: {
          ...inputs.demographics,
          [category]: {
            ...inputs.demographics[category as keyof typeof inputs.demographics],
            [subcategory]: value
          }
        }
      });
    } else {
      onInputsChange({
        ...inputs,
        demographics: {
          ...inputs.demographics,
          [category]: value
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Population Dynamics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--color-success)]" />
          Population Dynamics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassSlider
            label="Birth Rate"
            value={12.5}
            onChange={(value) => updateDemographics('birthRate', null, value)}
            min={5}
            max={40}
            step={0.1}
            unit=" per 1000"
            theme="emerald"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="Death Rate"
            value={8.2}
            onChange={(value) => updateDemographics('deathRate', null, value)}
            min={4}
            max={25}
            step={0.1}
            unit=" per 1000"
            theme="default"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="Net Migration Rate"
            value={2.1}
            onChange={(value) => updateDemographics('migrationRate', null, value)}
            min={-10}
            max={15}
            step={0.1}
            unit=" per 1000"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />
        </div>
      </div>

      {/* Age Structure */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Heart className="h-5 w-5 text-[var(--color-warning)]" />
          Age Distribution
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassDial
            label="Youth (0-17)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '0-15')?.percent || 20}
            onChange={(value) => updateDemographics('ageGroups', 'youth', value)}
            min={10}
            max={40}
            step={0.5}
            unit="%"
            theme="blue"
          />

          <GlassDial
            label="Working Age (18-64)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '16-64')?.percent || 65}
            onChange={(value) => updateDemographics('ageGroups', 'working', value)}
            min={45}
            max={75}
            step={0.5}
            unit="%"
            theme="emerald"
          />

          <GlassDial
            label="Elderly (65+)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '65+')?.percent || 15}
            onChange={(value) => updateDemographics('ageGroups', 'elderly', value)}
            min={5}
            max={35}
            step={0.5}
            unit="%"
            theme="purple"
          />
        </div>
      </div>

      {/* Social Characteristics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--color-purple)]" />
          Social Structure
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassSlider
            label="Urbanization Rate"
            value={inputs.demographics.urbanRuralSplit.urban}
            onChange={(value) => updateDemographics('urbanization', null, value)}
            min={20}
            max={95}
            step={1}
            unit="%"
            theme="gold"
            showTicks={true}
            tickCount={6}
          />

          <GlassNumberPicker
            label="Life Expectancy"
            value={inputs.demographics.lifeExpectancy || 78.5}
            onChange={(value) => updateDemographics('lifeExpectancy', null, value)}
            min={50}
            max={90}
            step={0.1}
            precision={1}
            unit=" years"
            theme="emerald"
          />

          <GlassSlider
            label="Literacy Rate"
            value={inputs.demographics.literacyRate || 96.8}
            onChange={(value) => updateDemographics('literacyRate', null, value)}
            min={40}
            max={100}
            step={0.1}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={7}
          />

          <GlassSlider
            label="Gender Equality Index"
            value={7.8}
            onChange={(value) => updateDemographics('genderEquality', null, value)}
            min={1}
            max={10}
            step={0.1}
            unit="/10"
            theme="purple"
            showTicks={true}
            tickCount={5}
          />
        </div>
      </div>

      {/* Social Policies */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Social Policies</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Universal Healthcare"
            description="Free healthcare for all citizens"
            checked={false}
            onChange={(checked) => updateDemographics('universalHealthcare', null, checked)}
            theme="default"
          />

          <GlassToggle
            label="Free Education"
            description="Public education through university level"
            checked={false}
            onChange={(checked) => updateDemographics('freeEducation', null, checked)}
            theme="blue"
          />

          <GlassToggle
            label="Immigration-Friendly Policies"
            description="Welcoming stance toward immigrants"
            checked={false}
            onChange={(checked) => updateDemographics('immigrationFriendly', null, checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Family Support Programs"
            description="Child care and family benefits"
            checked={false}
            onChange={(checked) => updateDemographics('familySupport', null, checked)}
            theme="gold"
          />

          <GlassToggle
            label="Senior Care System"
            description="Comprehensive elderly care programs"
            checked={false}
            onChange={(checked) => updateDemographics('seniorCare', null, checked)}
            theme="purple"
          />

          <GlassToggle
            label="Cultural Preservation"
            description="Programs to preserve cultural heritage"
            checked={false}
            onChange={(checked) => updateDemographics('culturalPreservation', null, checked)}
            theme="gold"
          />
        </div>
      </div>

      {/* Demographics Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={ageDistribution}
          dataKey="value"
          nameKey="name"
          title="Age Distribution"
          description="Population by age groups"
          height={300}
          theme="blue"
        />

        <GlassPieChart
          data={educationLevels}
          dataKey="value"
          nameKey="name"
          title="Education Levels"
          description="Population by educational attainment"
          height={300}
          theme="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassBarChart
          data={urbanRuralSplit}
          xKey="name"
          yKey="value"
          title="Urban vs Rural Population"
          description="Geographic distribution of population"
          height={250}
          theme="gold"
        />

        <GlassBarChart
          data={diversityData}
          xKey="name"
          yKey="value"
          title="Diversity Indices"
          description="Cultural, linguistic, and religious diversity scores"
          height={250}
          theme="purple"
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={populationTrends}
          title="Population Dynamics Trends"
          description="Birth rate, death rate, and migration patterns over time"
          height={250}
          theme="emerald"
          curveType="function"
        />
      </div>
    </div>
  );
}